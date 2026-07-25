import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
});
