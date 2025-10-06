import 'dotenv/config';
import OpenAI from 'openai';
import type { MarketSnapshot } from './exchange';

export interface Signal {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  price?: number;
}

export interface AgentConfigShape {
  ai?: { model?: string; temperature?: number };
}

/** Simple rule-based agent used when `model` is `placeholder` (also fills missing Python class). */
export class AIModelPlaceholder {
  constructor(private config: AgentConfigShape) {}

  async analyze(marketSnapshot: MarketSnapshot): Promise<Signal> {
    const t = marketSnapshot.trend;
    if (t > 0.001) {
      return { action: 'buy', confidence: 0.55, price: marketSnapshot.price };
    }
    if (t < -0.001) {
      return { action: 'sell', confidence: 0.55, price: marketSnapshot.price };
    }
    return { action: 'hold', confidence: 0.5, price: marketSnapshot.price };
  }
}

export class OpenAIModel {
  private client: OpenAI | null = null;
  private config: AgentConfigShape;

  constructor(config: AgentConfigShape) {
    this.config = config;
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        this.client = new OpenAI({ apiKey });
      } catch {
        this.client = null;
      }
    }
  }

  async analyze(marketSnapshot: MarketSnapshot): Promise<Signal> {
    if (!this.client) {
      return { action: 'hold', confidence: 0.5, price: marketSnapshot.price };
    }
    const prompt = `Market snapshot: ${JSON.stringify(marketSnapshot)}\nDecide: buy/sell/hold and a confidence 0..1`;
    const resp = await this.client.chat.completions.create({
      model: this.config.ai?.model ?? 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.ai?.temperature ?? 0.2,
      max_tokens: 128,
    });
    const text = (resp.choices[0]?.message?.content ?? '').trim().toLowerCase();
    if (text.includes('buy')) {
      return { action: 'buy', confidence: 0.6, price: marketSnapshot.price };
    }
    if (text.includes('sell')) {
      return { action: 'sell', confidence: 0.6, price: marketSnapshot.price };
    }
    return { action: 'hold', confidence: 0.5, price: marketSnapshot.price };
  }
}

export class QwenModel {
  constructor(private _config: AgentConfigShape) {}

  async analyze(marketSnapshot: MarketSnapshot): Promise<Signal> {
    return { action: 'hold', confidence: 0.5, price: marketSnapshot.price };
  }
}

export class DeepSeekModel {
  constructor(private _config: AgentConfigShape) {}

  async analyze(marketSnapshot: MarketSnapshot): Promise<Signal> {
    return { action: 'hold', confidence: 0.5, price: marketSnapshot.price };
  }
}

export type AnalyzeModel = {
  analyze: (marketSnapshot: MarketSnapshot) => Promise<Signal>;
};

export function getModel(config: AgentConfigShape): AnalyzeModel {
  const name = (config.ai?.model ?? 'placeholder').toLowerCase();
  if (name.includes('openai') || name.includes('gpt')) {
    return new OpenAIModel(config);
  }
  if (name.includes('qwen')) {
    return new QwenModel(config);
  }
  if (name.includes('deepseek')) {
    return new DeepSeekModel(config);
  }
  return new AIModelPlaceholder(config);
}
