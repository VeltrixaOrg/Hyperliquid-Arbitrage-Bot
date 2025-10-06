import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { SimulatedExchange, Order as SimOrder } from './exchange';
import type { MarketSnapshot } from './exchange';
import { AIModelPlaceholder } from './agent';
import { RiskManager } from './risk';
import { TradeJournal, describeTrades, type ExecutedOrder } from './journal';
import type { Signal } from './agent';
import {
  HyperliquidConnector,
  defaultHyperliquidSymbol,
} from './connectors/hyperliquid';
import type { Order as CcxtOrder } from 'ccxt';
import {
  decimalFromUnknown,
  decimalMulMinus,
  decimalMulPlus,
} from './decimalMoney';

export interface RunnerConfig {
  general: {
    starting_balance: number;
    dry_run?: boolean;
    /** `hyperliquid` uses HYPERLIQUID_PRIVATE_KEY from the environment. */
    exchange?: 'simulated' | 'hyperliquid';
  };
  trading: {
    symbol: string;
    risk_per_trade_pct: number;
    /** Override ccxt symbol (default maps e.g. BTC-USD → BTC/USDC:USDC). */
    hyperliquid_symbol?: string;
    hyperliquid_testnet?: boolean;
  };
  ai?: { model?: string; temperature?: number };
}

function isRunnerConfig(v: unknown): v is RunnerConfig {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const gen = o.general as Record<string, unknown> | undefined;
  const tr = o.trading as Record<string, unknown> | undefined;
  return (
    typeof gen?.starting_balance === 'number' &&
    typeof tr?.symbol === 'string' &&
    typeof tr?.risk_per_trade_pct === 'number'
  );
}

export class Runner {
  config: RunnerConfig;
  exchange: SimulatedExchange;
  agent: { analyze: (snap: import('./exchange').MarketSnapshot) => Promise<Signal> };
  risk: RiskManager;
  journal: TradeJournal;
  balance: number;
  position = 0.0;
  avgEntry: number | null = null;

  constructor(configPath = 'config.yaml') {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const loaded = yaml.load(raw) as unknown;
    if (!isRunnerConfig(loaded)) {
      throw new Error(`Invalid config: ${configPath}`);
    }
    this.config = loaded;
    this.exchange = new SimulatedExchange(this.config.trading.symbol);
    this.agent = new AIModelPlaceholder(this.config);
    this.risk = new RiskManager(this.config);
    this.journal = new TradeJournal();
    this.balance = this.config.general.starting_balance;
  }

  async runSimulation(steps = 100): Promise<void> {
    for (let step = 0; step < steps; step++) {
      const snap = this.exchange.getMarketSnapshot();
      const signal = await this.agent.analyze(snap);
      console.log(
        `step=${String(step).padStart(3, '0')} price=${snap.price.toFixed(2)} trend=${snap.trend.toFixed(4)} -> ${signal.action} (c=${signal.confidence.toFixed(2)})`
      );

      if (!this.risk.checkDrawdown(this.balance)) {
        console.log('Drawdown protection triggered — stopping trading.');
        break;
      }

      if (signal.action === 'buy') {
        const size = this.risk.positionSize(
          this.balance,
          snap.price,
          this.config.trading.risk_per_trade_pct
        );
        const order = new SimOrder('buy', snap.price, size);
        const executed = this.exchange.placeOrder(order);
        this.journal.record(executed, 'ai_buy');
        const cost = decimalMulPlus(
          executed.price,
          executed.size,
          executed.fee
        );
        this.balance -= cost;
        this.position += executed.size;
        this.avgEntry =
          this.avgEntry === null
            ? executed.price
            : (this.avgEntry + executed.price) / 2;
      } else if (signal.action === 'sell' && this.position > 0) {
        const size = this.position;
        const order = new SimOrder('sell', snap.price, size);
        const executed = this.exchange.placeOrder(order);
        this.journal.record(executed, 'ai_sell');
        const proceeds = decimalMulMinus(
          executed.price,
          executed.size,
          executed.fee
        );
        this.balance += proceeds;
        this.position = 0.0;
        this.avgEntry = null;
      }

      await new Promise((r) => setTimeout(r, 10));
    }

    console.log('\nSimulation finished. Balance:', Math.round(this.balance * 100) / 100);
    const rows = this.journal.toTradeRows();
    if (rows.length > 0) {
      console.log(describeTrades(rows));
    }
  }

  /**
   * Live loop against Hyperliquid (perps). Requires HYPERLIQUID_PRIVATE_KEY.
   * When `general.dry_run` is true (default in sample config), orders are not sent.
   */
  async runHyperliquidLoop(steps = 100): Promise<void> {
    const hl = new HyperliquidConnector({
      testnet: this.config.trading.hyperliquid_testnet,
    });
    const ccxtSymbol =
      this.config.trading.hyperliquid_symbol?.trim() ||
      defaultHyperliquidSymbol(this.config.trading.symbol);
    const dryRun = this.config.general.dry_run !== false;

    let testnetFlag: boolean;
    if (this.config.trading.hyperliquid_testnet !== undefined) {
      testnetFlag = this.config.trading.hyperliquid_testnet;
    } else {
      testnetFlag =
        process.env.HYPERLIQUID_TESTNET === '1' ||
        process.env.HYPERLIQUID_TESTNET === 'true';
    }
    console.log(
      `Hyperliquid wallet=${hl.walletAddress} symbol=${ccxtSymbol} testnet=${testnetFlag} dry_run=${dryRun}`
    );

    await hl.loadMarkets();

    let prevPrice: number | null = null;
    const volDefault = 0.02;
    const stepDelayMs = 1000;

    for (let step = 0; step < steps; step++) {
      const ticker = await hl.fetchTicker(ccxtSymbol);
      const raw =
        ticker.last ??
        ticker.close ??
        readMarkFromTickerInfo(ticker.info);
      if (raw === undefined || raw === null) {
        throw new Error(`No usable price in ticker for ${ccxtSymbol}`);
      }
      const price = decimalFromUnknown(raw);
      if (Number.isNaN(price)) {
        throw new Error(`No usable price in ticker for ${ccxtSymbol}`);
      }
      const trend =
        prevPrice !== null && prevPrice !== 0
          ? (price - prevPrice) / prevPrice
          : 0;
      prevPrice = price;

      const snap: MarketSnapshot = {
        symbol: ccxtSymbol,
        price,
        trend,
        volatility: volDefault,
      };

      const signal = await this.agent.analyze(snap);
      console.log(
        `step=${String(step).padStart(3, '0')} price=${price.toFixed(2)} trend=${trend.toFixed(4)} -> ${signal.action} (c=${signal.confidence.toFixed(2)})`
      );

      if (!this.risk.checkDrawdown(this.balance)) {
        console.log('Drawdown protection triggered — stopping trading.');
        break;
      }

      if (signal.action === 'buy') {
        const size = this.risk.positionSize(
          this.balance,
          snap.price,
          this.config.trading.risk_per_trade_pct
        );
        if (dryRun) {
          console.log(`[dry_run] limit buy IOC size=${size} price=${snap.price}`);
          const order = new SimOrder('buy', snap.price, size);
          const executed = this.exchange.placeOrder(order);
          this.journal.record(executed, 'ai_buy_dry');
          const cost = decimalMulPlus(
            executed.price,
            executed.size,
            executed.fee
          );
          this.balance -= cost;
          this.position += executed.size;
          this.avgEntry =
            this.avgEntry === null
              ? executed.price
              : (this.avgEntry + executed.price) / 2;
        } else {
          const order = await hl.createOrder(
            ccxtSymbol,
            'limit',
            'buy',
            size,
            snap.price,
            { timeInForce: 'IOC' }
          );
          const executed = ccxtOrderToExecuted(order);
          this.journal.record(executed, 'ai_buy');
          const cost = decimalMulPlus(
            executed.price,
            executed.size,
            executed.fee ?? 0
          );
          this.balance -= cost;
          this.position += executed.size;
          this.avgEntry =
            this.avgEntry === null
              ? executed.price
              : (this.avgEntry + executed.price) / 2;
        }
      } else if (signal.action === 'sell' && this.position > 0) {
        const size = this.position;
        if (dryRun) {
          console.log(`[dry_run] limit sell IOC reduceOnly size=${size} price=${snap.price}`);
          const order = new SimOrder('sell', snap.price, size);
          const executed = this.exchange.placeOrder(order);
          this.journal.record(executed, 'ai_sell_dry');
          const proceeds = decimalMulMinus(
            executed.price,
            executed.size,
            executed.fee
          );
          this.balance += proceeds;
          this.position = 0.0;
          this.avgEntry = null;
        } else {
          const order = await hl.createOrder(
            ccxtSymbol,
            'limit',
            'sell',
            size,
            snap.price,
            { timeInForce: 'IOC', reduceOnly: true }
          );
          const executed = ccxtOrderToExecuted(order);
          this.journal.record(executed, 'ai_sell');
          const proceeds = decimalMulMinus(
            executed.price,
            executed.size,
            executed.fee ?? 0
          );
          this.balance += proceeds;
          this.position = 0.0;
          this.avgEntry = null;
        }
      }

      await new Promise((r) => setTimeout(r, stepDelayMs));
    }

    console.log('\nHyperliquid loop finished. Local balance:', Math.round(this.balance * 100) / 100);
    const rows = this.journal.toTradeRows();
    if (rows.length > 0) {
      console.log(describeTrades(rows));
    }
  }
}

function readMarkFromTickerInfo(info: unknown): number | undefined {
  if (!info || typeof info !== 'object') return undefined;
  const o = info as Record<string, unknown>;
  const mark = o.markPx ?? o.midPx;
  if (mark === undefined || mark === null) return undefined;
  const n = decimalFromUnknown(mark);
  return Number.isFinite(n) ? n : undefined;
}

function ccxtOrderToExecuted(order: CcxtOrder): ExecutedOrder {
  const px = decimalFromUnknown(order.average ?? order.price ?? 0);
  const sz = decimalFromUnknown(order.filled ?? order.amount ?? 0);
  let fee = 0;
  if (typeof order.fee === 'number') {
    fee = decimalFromUnknown(order.fee);
  } else if (order.fee && typeof order.fee === 'object') {
    fee = decimalFromUnknown(order.fee.cost ?? 0);
  }
  return { side: String(order.side), price: px, size: sz, fee };
}
