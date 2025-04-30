export interface MarketSnapshot {
  symbol?: string;
  price: number;
  trend: number;
  volatility: number;
}

export class Order {
  constructor(
    public side: string,
    public price: number,
    public size: number
  ) {}
}

export class SimulatedExchange {
  symbol: string;
  price: number;
  volatility: number;

  constructor(symbol = 'BTC-USD', initialPrice = 30000.0, volatility = 0.02) {
    this.symbol = symbol;
    this.price = initialPrice;
    this.volatility = volatility;
  }

  getMarketSnapshot(): MarketSnapshot {
    const shock = randomGaussian() * this.volatility * this.price;
    const oldPrice = this.price;
    this.price = Math.max(0.1, this.price + shock);
    const trend = (this.price - oldPrice) / oldPrice;
    return {
      symbol: this.symbol,
      price: this.price,
      trend,
      volatility: this.volatility,
    };
  }

  placeOrder(order: Order): {
    side: string;
    price: number;
    size: number;
    fee: number;
  } {
    return {
      side: order.side,
      price: order.price,
      size: order.size,
      fee: Math.abs(order.price * order.size) * 0.0007,
    };
  }
}

function randomGaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
