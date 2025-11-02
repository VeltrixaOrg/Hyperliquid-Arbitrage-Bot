/** Runner bot */
import 'dotenv/config';
import { Runner } from './bot/runner';

async function main(): Promise<void> {
  const runner = new Runner('config.yaml');
  if (runner.config.general.exchange === 'hyperliquid') {
    await runner.runHyperliquidLoop(200);
  } else {
    await runner.runSimulation(200);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
