/**
 * Simple backtester that reads OHLCV CSV and runs the agent over historical steps.
 * Produces an HTML report and a simple PDF snapshot.
 * CSV expected columns: timestamp,open,high,low,close,volume
 */
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { TradeJournal } from './journal';
import type { MarketSnapshot } from './exchange';
import type { AnalyzeModel } from './agent';
import {
  decimalFromUnknown,
  decimalMulMinus,
  decimalMulPlus,
  decimalTimes,
} from './decimalMoney';

export interface OhlcvRow {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function parseOhlcvCsv(csvPath: string): OhlcvRow[] {
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(',').map((h) => h.trim());
  const idx = {
    timestamp: header.indexOf('timestamp'),
    open: header.indexOf('open'),
    high: header.indexOf('high'),
    low: header.indexOf('low'),
    close: header.indexOf('close'),
    volume: header.indexOf('volume'),
  };
  const rows: OhlcvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(',');
    rows.push({
      timestamp: parts[idx.timestamp]!.trim(),
      open: decimalFromUnknown(parts[idx.open]),
      high: decimalFromUnknown(parts[idx.high]),
      low: decimalFromUnknown(parts[idx.low]),
      close: decimalFromUnknown(parts[idx.close]),
      volume: decimalFromUnknown(parts[idx.volume]),
    });
  }
  return rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function runBacktest(
  csvPath: string,
  model: AnalyzeModel,
  startingBalance = 10000.0,
  riskPct = 1.0
): Promise<{
  html: string;
  pdf: string;
  tradesRows: ReturnType<TradeJournal['toTradeRows']>;
}> {
  const df = parseOhlcvCsv(csvPath);
  let balance = startingBalance;
  let position = 0.0;
  let avgEntry: number | null = null;
  const journal = new TradeJournal();

  for (const row of df) {
    const snapshot: MarketSnapshot = {
      price: row.close,
      trend:
        row.open > 0 ? (row.close - row.open) / row.open : 0,
      volatility: 0,
    };
    const sig = await model.analyze(snapshot);
    if (sig.action === 'buy') {
      const size = (balance * (riskPct / 100.0)) / snapshot.price;
      const feeRate = '0.0007';
      const executed = {
        side: 'buy',
        price: snapshot.price,
        size,
        fee: decimalTimes(snapshot.price, size, feeRate),
      };
      journal.record(executed, 'backtest_buy');
      const cost = decimalMulPlus(executed.price, executed.size, executed.fee);
      balance -= cost;
      position += executed.size;
      avgEntry =
        avgEntry === null
          ? executed.price
          : (avgEntry + executed.price) / 2;
    } else if (sig.action === 'sell' && position > 0) {
      const feeRate = '0.0007';
      const executed = {
        side: 'sell',
        price: snapshot.price,
        size: position,
        fee: decimalTimes(snapshot.price, position, feeRate),
      };
      journal.record(executed, 'backtest_sell');
      const proceeds = decimalMulMinus(
        executed.price,
        executed.size,
        executed.fee
      );
      balance += proceeds;
      position = 0.0;
      avgEntry = null;
    }
  }

  if (position > 0) {
    const lastPrice = df[df.length - 1]!.close;
    const feeRate = '0.0007';
    const executed = {
      side: 'sell',
      price: lastPrice,
      size: position,
      fee: decimalTimes(lastPrice, position, feeRate),
    };
    journal.record(executed, 'backtest_close');
    balance += decimalMulMinus(
      executed.price,
      executed.size,
      executed.fee
    );
  }

  const outDir = path.join(process.cwd(), 'backtest_reports');
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 17);
  const htmlPath = path.join(outDir, `report_${ts}.html`);
  const pdfPath = path.join(outDir, `report_${ts}.pdf`);

  const dfTrades = journal.toTradeRows();
  const tableHtml = tradesToHtmlTable(dfTrades);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Backtest</title></head><body>
<h1>Backtest report</h1><p>Starting balance: ${startingBalance}</p><p>Ending balance: ${balance.toFixed(2)}</p>
${tableHtml}</body></html>`;
  fs.writeFileSync(htmlPath, html, 'utf-8');

  const doc = new PDFDocument({ margin: 50 });
  const pdfStream = fs.createWriteStream(pdfPath);
  doc.pipe(pdfStream);
  doc.fontSize(12).text(
    `Backtest report\nStarting: ${startingBalance}\nEnding: ${balance.toFixed(2)}\nTrades: ${dfTrades.length}`,
    { align: 'left' }
  );
  doc.end();
  await new Promise<void>((resolve, reject) => {
    pdfStream.on('finish', resolve);
    pdfStream.on('error', reject);
  });

  return { html: htmlPath, pdf: pdfPath, tradesRows: dfTrades };
}

function tradesToHtmlTable(rows: import('./journal').TradeRow[]): string {
  if (rows.length === 0) return '<p>No trades</p>';
  const headers = [
    'timestamp',
    'side',
    'price',
    'size',
    'fee',
    'reason',
  ] as const;
  let h = '<table border="1"><tr>';
  for (const k of headers) h += `<th>${k}</th>`;
  h += '</tr>';
  for (const r of rows) {
    h += '<tr>';
    for (const k of headers) {
      const v = r[k];
      h += `<td>${v instanceof Date ? v.toISOString() : String(v)}</td>`;
    }
    h += '</tr>';
  }
  return h + '</table>';
}
