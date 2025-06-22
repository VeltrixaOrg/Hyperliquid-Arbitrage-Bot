/** OKX connector wrapper (ccxt). */
import ccxt, { type Exchange } from 'ccxt';

export class OKXConnector {
  private client: Exchange;

  constructor(
    apiKey?: string,
    apiSecret?: string,
    password?: string,
    testnet = true
  ) {
    const key = apiKey ?? process.env.OKX_API_KEY;
    const secret = apiSecret ?? process.env.OKX_API_SECRET;
    const pass = password ?? process.env.OKX_API_PASSPHRASE;
    const client = new ccxt.okx({
      apiKey: key,
      secret,
      password: pass,
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
