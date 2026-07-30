import { describe, expect, it } from 'vitest';
import { formatBalanceSheetMoney, formatFinancialPositionMeasure } from './EgpBalanceSheetView';

describe('EGP balance sheet presentation', () => {
  it('displays cash values as whole EGP without piastres', () => {
    expect(formatBalanceSheetMoney(1234.56)).toBe('١٬٢٣٥');
    expect(formatBalanceSheetMoney(12025)).toBe('١٢٬٠٢٥');
  });

  it('labels gold as Arabic equivalent-21 only and distinguishes silver and accessories', () => {
    expect(formatFinancialPositionMeasure(12.3456, 'gold21')).toBe('١٢٫٣٤٦ جم عربي عيار 21');
    expect(formatFinancialPositionMeasure(8.5, 'silverGram')).toBe('٨٫٥ جم فضة');
    expect(formatFinancialPositionMeasure(3, 'piece')).toBe('٣ قطعة');
  });
});