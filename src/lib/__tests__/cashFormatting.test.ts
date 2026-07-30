import { describe, expect, it } from 'vitest';
import { formatCashAmount, formatCurrency } from '../accounting';

describe('cash display formatting', () => {
  it('never displays piasters in plain cash values', () => {
    expect(formatCashAmount(4095095.75, 'en-US')).toBe('4,095,096');
    expect(formatCashAmount(-12.4, 'en-US')).toBe('-12');
  });

  it('never displays piasters in EGP currency values', () => {
    const formatted = formatCurrency(1234.56);
    expect(formatted).not.toMatch(/[.,٫]\d{1,2}/);
  });
});