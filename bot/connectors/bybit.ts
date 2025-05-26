/** Bybit connector wrapper (ccxt). */
import ccxt, { type Exchange } from 'ccxt';

export class BybitConnector {
  private client: Exchange;

  constructor(apiKey?: string, apiSecret?: string, testnet = true) {
    const key = apiKey ?? process.env.BYBIT_API_KEY;
    const secret = apiSecret ?? process.env.BYBIT_API_SECRET;
    const client = new ccxt.bybit({
      apiKey: key,
      secret,
      enableRateLimit: true,
    });
    if (testnet) {
      client.setSandboxMode(true);
    }
    this.client = client;
  }

  fetchTicker(symbol: string) {
    return this.client.fetchTicker(symbol);
  }

  createOrder(
    symbol: string,
    side: string,
    type_: string,
    amount: number,
    price?: number,
    params?: object
  ) {
    return this.client.createOrder(symbol, type_, side, amount, price, params ?? {});
  }

  fetchBalance() {
    return this.client.fetchBalance();
  }
}
