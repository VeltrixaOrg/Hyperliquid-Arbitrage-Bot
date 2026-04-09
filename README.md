# hyperliquid-arbitrage-bot-ts

TypeScript trading bot that combines a simple AI-driven signal layer with either an in-process simulated exchange or [Hyperliquid](https://hyperliquid.xyz/) (via [ccxt](https://github.com/ccxt/ccxt)). The layout mirrors the original Python project for easier comparison.

## Requirements

- Node.js 18+ (recommended: current LTS)
- npm

## Setup

```bash
git clone https://github.com/VeltrixaOrg/Hyperliquid-Arbitrage-Bot
cd Hyperliquid-Arbitrage-Bot
npm install
```

Copy environment variables and fill in what you use:

```bash
cp .env.example .env
```

Trading behavior is driven by `config.yaml` at the repository root (see below). The default file uses **simulated** exchange and **dry run** semantics where applicable.

## Run the bot

Development (TypeScript directly):

```bash
npm run dev
```

Production-style (compile then run):

```bash
npm run build
npm start
```

`run.ts` loads `config.yaml` and:

- runs the **simulation loop** when `general.exchange` is not `hyperliquid`;
- runs the **Hyperliquid loop** when `general.exchange` is `hyperliquid`.

The loop step count is fixed in `run.ts` (currently 200 steps).

## Configuration

### `config.yaml`

Important fields:

| Area | Field | Notes |
|------|--------|--------|
| `general` | `exchange` | `simulated` (default) or `hyperliquid`. |
| `general` | `dry_run` | For Hyperliquid: when `true` (default in the sample), orders are **not** sent; the bot logs intended IOC orders and updates a local paper balance. Set to `false` only when you intend to trade for real. |
| `general` | `starting_balance` | Starting balance for simulation / local accounting. |
| `trading` | `symbol` | e.g. `BTC-USD`; mapped to a ccxt symbol for Hyperliquid unless you override. |
| `trading` | `hyperliquid_symbol` | Optional ccxt symbol override (e.g. `BTC/USDC:USDC`). |
| `trading` | `hyperliquid_testnet` | Optional; otherwise `HYPERLIQUID_TESTNET` in `.env` is used. |
| `trading` | `risk_per_trade_pct` | Risk input for position sizing. |
| `ai` | `model` | `placeholder` uses a small rule-based agent. Names containing `openai` or `gpt` select the OpenAI client (requires `OPENAI_API_KEY`). |

The runner validates `general.starting_balance`, `trading.symbol`, and `trading.risk_per_trade_pct`. Extra keys in YAML (e.g. `notifications`) are ignored by the TypeScript runner unless wired in code.

### Environment (`.env`)

- **Hyperliquid:** `HYPERLIQUID_PRIVATE_KEY`, and optionally `HYPERLIQUID_TESTNET` (`true` / `1` for testnet).
- **OpenAI:** `OPENAI_API_KEY` when using a GPT-style model name in config.
- Connectors under `bot/connectors/` can use `BINANCE_*`, `BYBIT_*`, `OKX_*` where you integrate them (see examples).

Never commit real keys or private keys.

## Examples

```bash
# Backtest from CSV; produces HTML/PDF report paths (see console output)
npm run example:backtest
```

Expect `data/sample_ohlcv.csv` with columns: `timestamp`, `open`, `high`, `low`, `close`, `volume`.

```bash
# Demo: Binance connector ticker fetch (requires API keys in .env if not using public-only paths)
npm run example:exchange
```

## Project layout

- `bot/runner.ts` — config load, simulation loop, Hyperliquid loop, risk and journal hooks.
- `bot/agent.ts` — signal models (`placeholder`, OpenAI, stubs for Qwen / DeepSeek).
- `bot/connectors/` — exchange adapters (Hyperliquid, Binance, Bybit, OKX).
- `examples/` — backtest and connector demos.

## Disclaimer

This software is for education and experimentation. Cryptocurrency trading involves substantial risk of loss. The default configuration avoids live orders; if you enable live trading, you are solely responsible for keys, sizing, compliance, and outcomes. There is no warranty; see [LICENSE](LICENSE).
