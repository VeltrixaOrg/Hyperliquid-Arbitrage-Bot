export interface ExecutedOrder {
  side: string;
  price: number;
  size: number;
  fee?: number;
}

export interface TradeRow {
  timestamp: Date;
  side: string;
  price: number;
  size: number;
  fee: number;
  reason: string;
}

export class TradeJournal {
  trades: TradeRow[] = [];

  record(executedOrder: ExecutedOrder, reason = ''): void {
    const row: TradeRow = {
      timestamp: new Date(),
      side: executedOrder.side,
      price: executedOrder.price,
      size: executedOrder.size,
      fee: executedOrder.fee ?? 0.0,
      reason,
    };
    this.trades.push(row);
  }

  toTradeRows(): TradeRow[] {
    return [...this.trades];
  }
}

/** Basic numeric column stats similar to pandas DataFrame.describe() for numeric fields. */
export function describeTrades(rows: TradeRow[]): Record<string, Record<string, number>> {
  const numericKeys: (keyof Pick<TradeRow, 'price' | 'size' | 'fee'>)[] = [
    'price',
    'size',
    'fee',
  ];
  const out: Record<string, Record<string, number>> = {};
  for (const key of numericKeys) {
    const vals = rows.map((r) => r[key]).filter((v) => Number.isFinite(v));
    if (vals.length === 0) {
      out[key] = {};
      continue;
    }
    const sorted = [...vals].sort((a, b) => a - b);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / vals.length;
    const variance =
      vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
    out[key] = {
      count: vals.length,
      mean,
      std: Math.sqrt(variance),
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
    };
  }
  return out;
}
