/**
 * Example: Run backtest on CSV with an AI model (uses placeholder if configured).
 * Prepare data/sample_ohlcv.csv with columns: timestamp,open,high,low,close,volume
 */
import * as path from 'path';
import { getModel } from '../bot/agent';
import { runBacktest } from '../bot/backtester';

/** Same as Python: path relative to current working directory. */
const csvPath = path.join(process.cwd(), 'data', 'sample_ohlcv.csv');

async function main(): Promise<void> {
  const model = getModel({ ai: { model: 'placeholder' } });
  const out = await runBacktest(csvPath, model);
  console.log('Report generated:', out.html, out.pdf);
}

main().catch(console.error);
