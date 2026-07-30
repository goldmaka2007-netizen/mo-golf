import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { read, utils, write } from 'xlsx';
import { createDailyJournalWorkbook } from '../DailyJournalView';

describe('Daily journal selected-date entry shortcut', () => {
  it('opens the entry form with the currently selected journal date', () => {
    const source = readFileSync(new URL('../DailyJournalView.tsx', import.meta.url), 'utf8');

    expect(source).toContain('إضافة عملية لهذا اليوم');
    expect(source).toContain("const targetDate = selectedDate || format(new Date(), 'yyyy-MM-dd')");
    expect(source).toContain('setEditingEntry({ date: targetDate })');
    expect(source).toContain("setView('entry')");
  });

  it('preserves shortcut dates in the entry form instead of forcing today', () => {
    const source = readFileSync(new URL('../EntryForm.tsx', import.meta.url), 'utf8');

    expect(source).toContain("date: editingEntry.date || format(new Date(), 'yyyy-MM-dd')");
    expect(source).not.toContain('Always use today for shortcuts');
  });
  it('keeps tafyeet as a one-to-one weight transfer with automatic carried cost', () => {
    const source = readFileSync(new URL('../EntryForm.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain('وزن المنتج النهائي');
    expect(source).not.toContain('تكلفة التحويل المباشرة');
    expect(source).not.toContain("entry.operationKind = 'manufacturing'");
    expect(source).not.toContain('entry.manufacturing =');
  });
});

describe('Daily journal Excel export', () => {
  it('preserves sheets, columns, rows, Arabic text, dates, and numeric values through an xlsx round trip', async () => {
    const summary = [
      { dimension: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0630\u0647\u0628 (21)', openingDebit: 12.5, openingCredit: 1.25, periodDebit: 3, periodCredit: 2, closingDebit: 15.5, closingCredit: 3.25 },
      { dimension: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0641\u0636\u0629', openingDebit: 8, openingCredit: 0, periodDebit: 1.5, periodCredit: 0.5, closingDebit: 9.5, closingCredit: 0.5 },
      { dimension: '\u062d\u0631\u0643\u0629 \u0627\u0644\u0646\u0642\u062f\u064a\u0629', openingDebit: 1000, openingCredit: 100, periodDebit: 2500.75, periodCredit: 500.25, closingDebit: 3500.75, closingCredit: 600.25 },
    ];
    const operations = [
      { date: '2026-07-28', operation: 'INV-42', tx: '\u0628\u064a\u0639 \u0630\u0647\u0628', debit: '\u0627\u0644\u062e\u0632\u0646\u0629', credit: '\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a', cash: 2500.75, weight: 12.5, count: 2, notes: '\u0646\u0635 \u0639\u0631\u0628\u064a' },
      { date: '2026-07-28', operation: 43, tx: '\u0634\u0631\u0627\u0621', debit: '\u0627\u0644\u0645\u062e\u0632\u0648\u0646', credit: '\u0627\u0644\u062e\u0632\u0646\u0629', cash: 500.25, weight: 3.75, count: 1, notes: '' },
    ];

    const { workbook } = await createDailyJournalWorkbook(summary, operations);
    expect(workbook.SheetNames).toEqual(['Journal Summary', 'Operations']);

    const summaryRows = utils.sheet_to_json(workbook.Sheets['Journal Summary'], { header: 1, raw: true }) as unknown[][];
    const operationRows = utils.sheet_to_json(workbook.Sheets.Operations, { header: 1, raw: true }) as unknown[][];
    expect(summaryRows[0]).toEqual(['dimension', 'openingDebit', 'openingCredit', 'periodDebit', 'periodCredit', 'closingDebit', 'closingCredit']);
    expect(operationRows[0]).toEqual(['date', 'operation', 'tx', 'debit', 'credit', 'cash', 'weight', 'count', 'notes']);
    expect(summaryRows).toHaveLength(summary.length + 1);
    expect(operationRows).toHaveLength(operations.length + 1);
    expect(summaryRows[1]).toEqual(Object.values(summary[0]));
    expect(operationRows[1]).toEqual(Object.values(operations[0]));

    const bytes = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const imported = read(bytes, { type: 'buffer' });
    const importedOperations = utils.sheet_to_json(imported.Sheets.Operations, { raw: true }) as typeof operations;
    expect(imported.SheetNames).toEqual(['Journal Summary', 'Operations']);
    expect(importedOperations).toHaveLength(operations.length);
    expect(importedOperations[0]).toMatchObject({ date: '2026-07-28', tx: '\u0628\u064a\u0639 \u0630\u0647\u0628', cash: 2500.75, weight: 12.5, count: 2, notes: '\u0646\u0635 \u0639\u0631\u0628\u064a' });
  });
});
