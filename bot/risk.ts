export interface RiskConfigShape {
  general?: { starting_balance?: number };
  trading?: {
    max_drawdown_pct?: number;
    /** Overlap with full runner config (weak-type assignability). */
    symbol?: string;
    risk_per_trade_pct?: number;
    hyperliquid_symbol?: string;
    hyperliquid_testnet?: boolean;
  };
}

export class RiskManager {
  readonly startingBalance: number;
  readonly maxDrawdownPct: number;
  readonly minBalance: number;
  currentDrawdownProtection = false;

  constructor(config: RiskConfigShape) {
    this.startingBalance = config.general?.starting_balance ?? 10000.0;
    this.maxDrawdownPct = config.trading?.max_drawdown_pct ?? 20.0;
    this.minBalance = this.startingBalance * (1 - this.maxDrawdownPct / 100);
  }

  positionSize(balance: number, price: number, riskPct: number): number {
    const riskAmount = balance * (riskPct / 100.0);
    return riskAmount / price;
  }

  checkDrawdown(balance: number): boolean {
    if (balance <= this.minBalance) {
      this.currentDrawdownProtection = true;
      return false;
    }
    return true;
  }
}
