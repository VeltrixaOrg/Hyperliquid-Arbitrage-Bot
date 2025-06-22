import * as fs from 'fs';

export function loadEnv(path: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(path, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
