import { describe, expect, it } from 'vitest';
import { normalizeAccessoryEntryPayload, shouldShowWeightAndCount } from '../EntryForm';
import { formatLedgerAmount } from '../../../lib/ledgerReport';

describe('accessory entry presentation', () => {
  it('stores accessory piece input in weight and leaves count empty in the saved payload', () => {
    const entry = normalizeAccessoryEntryPayload({ weight: '5', count: '5' }, true);

    expect(entry.weight).toBe('5');
    expect(entry.count).toBe('0');
  });

  it('shows accessory quantity as pieces', () => {
    expect(formatLedgerAmount(5, 'quantity')).toBe('5 قطعة');
  });
});
describe('merchant settlement presentation', () => {
  it('hides weight for a cash/workmanship settlement and keeps it for a metal settlement', () => {
    expect(shouldShowWeightAndCount('حساب تاجر ذهب', false, true)).toBe(false);
    expect(shouldShowWeightAndCount('حساب تاجر ذهب', false, false)).toBe(true);
  });
});
