import { describe, it, expect } from 'vitest';
import { parseMetrics } from '../../../../../packages/connectors/implementation/Kaggle.connector.js';

describe('parseMetrics', () => {
  it('returns empty object for empty string', () => {
    expect(parseMetrics('')).toEqual({});
  });

  it('parses full JSON overview', () => {
    const overview = JSON.stringify({ auc: 0.91, f1: 0.87, accuracy: 0.89 });
    expect(parseMetrics(overview)).toEqual({ auc: 0.91, f1: 0.87, accuracy: 0.89 });
  });

  it('parses embedded JSON block inside markdown', () => {
    const overview = '## Results\n{"auc": 0.95, "f1": 0.90}';
    const result = parseMetrics(overview);
    expect(result.auc).toBe(0.95);
    expect(result.f1).toBe(0.90);
  });

  it('parses colon-separated key:value patterns', () => {
    const overview = 'Model metrics:\nauc: 0.92\nf1: 0.85\naccuracy: 0.88';
    expect(parseMetrics(overview)).toEqual({ auc: 0.92, f1: 0.85, accuracy: 0.88 });
  });

  it('returns empty object when no metrics found', () => {
    expect(parseMetrics('This model does classification tasks.')).toEqual({});
  });

  it('ignores non-finite values', () => {
    const overview = '{"f1": 0.80}';
    const result = parseMetrics(overview);
    expect(result.auc).toBeUndefined();
    expect(result.f1).toBe(0.80);
  });
});
