import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDailyJournalCsvRows } from '../DailyJournalView';
import { groupDailyJournalEntries } from '../daily-journal/dailyJournalPresentation';
import type { AccountingLeg } from '../../../lib/canonicalAccounting';
import type { Entry } from '../../../types';

describe('Daily journal CSV export', () => {
  it('preserves Arabic, numeric values, and report sections', () => {
    const rows = createDailyJournalCsvRows([{ dimension: 'حركة الذهب', openingDebit: 12.5 }], [{ tx: 'بيع،ذهب', notes: 'قال "نعم"\nعربي', cash: 2500.75 }]);
    expect(rows).toEqual([{ التقرير: 'Journal Summary', dimension: 'حركة الذهب', openingDebit: 12.5 }, { التقرير: 'Operations', tx: 'بيع،ذهب', notes: 'قال "نعم"\nعربي', cash: 2500.75 }]);
  });
  it('keeps the selected-date shortcut contract', () => {
    const source = readFileSync(new URL('../DailyJournalView.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const targetDate = selectedDate || format(new Date(),');
  });

  it('preserves UTF-8 Arabic in the Daily Journal presentation surface', () => {
    const sources = [
      readFileSync(new URL('../DailyJournalView.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../daily-journal/DailyJournalDashboardPresentation.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../daily-journal/DailyJournalEntryPresentation.tsx', import.meta.url), 'utf8'),
    ].join('\n');
    expect(sources).toContain('اختر التاريخ');
    expect(sources).toContain('رصيد وإقفال الخزنة');
    expect(sources).toContain('قرار شراء الذهب الآن');
    expect(sources).toContain('غير متاح');
    expect(sources).not.toMatch(/[ÃÂ]|â(?:€|‚)|[™ÅËÆ]/);
  });

  it('preserves operation grouping from canonical leg operationKind', () => {
    const entries = [
      { id: 'sale', seq: 1, operationKind: 'sale' },
      { id: 'purchase', seq: 2, operationKind: 'purchase' },
      { id: 'expense', seq: 3, operationKind: 'expense' },
      { id: 'other', seq: 4, operationKind: 'transfer' },
    ];
    const legs = new Map(entries.map(entry => [entry.id, [{ sourceEntryId: entry.id, operationKind: entry.operationKind }]])) as unknown as Map<string, AccountingLeg[]>;
    const groups = groupDailyJournalEntries(entries as unknown as Entry[], legs);
    expect(Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.map(entry => entry.id)]))).toEqual({ sale: ['sale'], purchase: ['purchase'], expense: ['expense'], other: ['other'] });
  });
});
