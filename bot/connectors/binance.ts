/**
 * Connector wrapper for Binance (spot & futures) using ccxt.
 * Keys must remain local (e.g., .env or encrypted local storage).
 */
import ccxt, { type Exchange } from 'ccxt';

export class BinanceConnector {
  private client: Exchange;

  constructor(apiKey?: string, apiSecret?: string, testnet = true) {
    const key = apiKey ?? process.env.BINANCE_API_KEY;
    const secret = apiSecret ?? process.env.BINANCE_API_SECRET;
    const client = new ccxt.binance({
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
