/**
 * Hyperliquid (perps) via ccxt — wallet auth uses an Ethereum-style private key.
 * The trading address is derived from HYPERLIQUID_PRIVATE_KEY.
 */
import ccxt from 'ccxt';

function normalizePrivateKey(key: string): string {
  const t = key.trim();
  if (t.startsWith('0x')) return t;
  return `0x${t}`;
}

export class HyperliquidConnector {
  readonly client: InstanceType<typeof ccxt.hyperliquid>;

  constructor(options?: { privateKey?: string; testnet?: boolean }) {
    const raw = options?.privateKey ?? process.env.HYPERLIQUID_PRIVATE_KEY;
    if (!raw?.trim()) {
      throw new Error(
        'HYPERLIQUID_PRIVATE_KEY is missing. Add it to .env (see .env.example).'
      );
    }
    const privateKey = normalizePrivateKey(raw);
    let testnet: boolean;
    if (options?.testnet !== undefined) {
      testnet = options.testnet;
    } else {
      testnet =
        process.env.HYPERLIQUID_TESTNET === '1' ||
        process.env.HYPERLIQUID_TESTNET === 'true';
    }

    const client = new ccxt.hyperliquid({
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
        sandboxMode: testnet,
      },
    });
    client.privateKey = privateKey;
    client.walletAddress = client.ethGetAddressFromPrivateKey(privateKey);
    this.client = client;
  }

  get walletAddress(): string {
    return this.client.walletAddress ?? '';
  }

  loadMarkets() {
    return this.client.loadMarkets();
  }

  fetchTicker(symbol: string) {
    return this.client.fetchTicker(symbol);
  }

  fetchBalance() {
    return this.client.fetchBalance();
  }

  createOrder(
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number,
    params?: object
  ) {
    return this.client.createOrder(symbol, type, side, amount, price, params ?? {});
  }
}

/** Maps config style `BTC-USD` to ccxt Hyperliquid swap symbol `BTC/USDC:USDC`. */
export function defaultHyperliquidSymbol(configSymbol: string): string {
  const s = configSymbol.trim();
  if (s.includes('/')) return s;
  const m = /^(.+)-USD$/i.exec(s);
  if (m) return `${m[1].toUpperCase()}/USDC:USDC`;
  return `${s.toUpperCase()}/USDC:USDC`;
}
