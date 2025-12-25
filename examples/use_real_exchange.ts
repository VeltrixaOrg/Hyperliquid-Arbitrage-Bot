/**
 * Example: How to initialize a real exchange connector and fetch a ticker.
 * IMPORTANT: Keep your API keys local and never commit them to git.
 */
import 'dotenv/config';
import { BinanceConnector } from '../bot/connectors/binance';

async function demo(): Promise<void> {
  const b = new BinanceConnector(undefined, undefined, true);
  const ticker = await b.fetchTicker('BTC/USDT');
  console.log('Ticker:', ticker);
}

demo().catch(console.error);
