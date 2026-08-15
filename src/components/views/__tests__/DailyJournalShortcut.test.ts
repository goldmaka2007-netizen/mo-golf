import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDailyJournalCsvRows } from '../DailyJournalView';

describe('Daily journal CSV export', () => {
  it('preserves Arabic, numeric values, and report sections', () => {
    const rows = createDailyJournalCsvRows([{ dimension: 'حركة الذهب', openingDebit: 12.5 }], [{ tx: 'بيع،ذهب', notes: 'قال "نعم"\nعربي', cash: 2500.75 }]);
    expect(rows).toEqual([{ التقرير: 'Journal Summary', dimension: 'حركة الذهب', openingDebit: 12.5 }, { التقرير: 'Operations', tx: 'بيع،ذهب', notes: 'قال "نعم"\nعربي', cash: 2500.75 }]);
  });
  it('keeps the selected-date shortcut contract', () => {
    const source = readFileSync(new URL('../DailyJournalView.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const targetDate = selectedDate || format(new Date(),');
  });
});
