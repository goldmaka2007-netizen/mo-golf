import type { AccountingLeg } from '../../../lib/canonicalAccounting';
import type { Entry } from '../../../types';

export type DailyJournalExportRow = Record<string, string | number | undefined>;

export const createDailyJournalCsvRows = (summary: DailyJournalExportRow[], operations: DailyJournalExportRow[]) => [
  ...summary.map(row => ({ \u0627\u0644\u062a\u0642\u0631\u064a\u0631: 'Journal Summary', ...row })),
  ...operations.map(row => ({ \u0627\u0644\u062a\u0642\u0631\u064a\u0631: 'Operations', ...row })),
];

export const entryKey = (entry: Entry) => entry.id || String(entry.seq);
export const unique = (items: string[]) => [...new Set(items)].filter(Boolean);

export type DailyJournalEntryGroups = Record<'sale' | 'purchase' | 'expense' | 'other', Entry[]>;

export const groupDailyJournalEntries = (entries: Entry[], legsByEntry: Map<string, AccountingLeg[]>): DailyJournalEntryGroups => {
  const groups: DailyJournalEntryGroups = { sale: [], purchase: [], expense: [], other: [] };
  entries.forEach(entry => {
    const kind = legsByEntry.get(entryKey(entry))?.[0]?.operationKind;
    if (kind === 'sale' || kind === 'purchase' || kind === 'expense') groups[kind].push(entry); else groups.other.push(entry);
  });
  return groups;
};
