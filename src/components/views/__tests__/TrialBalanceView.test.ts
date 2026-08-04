import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatTrialDisplayAmount } from '../reports/TrialBalanceView';

describe('TrialBalanceView mobile presentation', () => {
  it('formats compact cell values without repeating units', () => {
    expect(formatTrialDisplayAmount(125000.75, 'cash')).toBe('125,001');
    expect(formatTrialDisplayAmount(10.5, 'gold')).toBe('10.50');
    expect(formatTrialDisplayAmount(0, 'silver')).toBe('0.00');
  });
  it('keeps mobile cards and desktop table in separate breakpoint layouts with bottom safe-area space', () => {
    const source = readFileSync(new URL('../reports/TrialBalanceView.tsx', import.meta.url), 'utf8');
    expect(source).toContain('md:hidden');
    expect(source).toContain('hidden md:block');
    expect(source).toContain('safe-area-inset-bottom');
    expect(source).toContain('tabular-nums');
  });
});