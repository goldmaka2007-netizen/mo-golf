import { describe, expect, it } from 'vitest';
import { Entry } from '../../types';
import { validateEntryNumberingPolicy, validateLegacyImportBatch } from '../entryValidation';

const sourceHash = '0f80dc5a76d43e0c588f02ef4574543aecb6d8825419f31ded1af3de27a37892';
const importedEntry = (overrides: Partial<Entry> = {}): Entry => ({
  id: 'csvref-entry-f3a18d92552904081d58bf3e761dac80',
  seq: null,
  tx: 'مسحوبات',
  debit: 'المسحوبات',
  credit: 'الخزنة',
  date: '2026-06-04',
  cash: '1000',
  weight: '0',
  arabicWeight: '0',
  count: '0',
  notes: '',
  userId: '__RUNTIME_IMPORT_PARAMETER__',
  imported: true,
  importVersion: 'csv-reference-v1',
  importedAt: '__RUNTIME_IMPORT_TIMESTAMP__',
  legacySourceHash: sourceHash,
  legacyOperationId: '4luR7XZEaKGN5EEbGmr2',
  legacyOperationNo: 'TX1707',
  sourceRow: 2,
  sourceFile: 'makkah_gold_all_data_2026-07-23.csv',
  ...overrides,
});

describe('legacy migration numbering policy', () => {
  it('accepts a fully identified legacy imported entry without seq', () => {
    const result = validateEntryNumberingPolicy(importedEntry({ seq: undefined }));
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('rejects a new application entry without seq', () => {
    const entry = importedEntry({ imported: false, seq: undefined });
    const result = validateEntryNumberingPolicy(entry);
    expect(result.valid).toBe(false);
    expect(result.issues.map(issue => issue.code)).toContain('missing_new_entry_seq');
  });

  it('accepts distinct deterministic IDs', () => {
    const entries = [
      importedEntry(),
      importedEntry({
        id: 'csvref-entry-033ed20b6e6850c25be8fa166881c40c',
        legacyOperationId: 'tQVJmk2iHHJrTk9XfFwB',
        legacyOperationNo: 'P1747',
        sourceRow: 4,
      }),
    ];
    const result = validateLegacyImportBatch(entries);
    expect(result.valid).toBe(true);
    expect(new Set(entries.map(entry => entry.id)).size).toBe(entries.length);
  });

  it('allows repeated legacyOperationNo without overwrite when document IDs differ', () => {
    const entries = [
      importedEntry({ legacyOperationNo: 'TX1594', sourceRow: 452 }),
      importedEntry({
        id: 'csvref-entry-033ed20b6e6850c25be8fa166881c40c',
        legacyOperationId: '43FQQNcfocpeOlHBTEUK',
        legacyOperationNo: 'TX1594',
        sourceRow: 453,
      }),
    ];
    const documents = new Map(entries.map(entry => [entry.id, entry]));
    expect(validateLegacyImportBatch(entries).valid).toBe(true);
    expect(documents.size).toBe(2);
    expect([...documents.values()].map(entry => entry.legacyOperationNo)).toEqual(['TX1594', 'TX1594']);
  });

  it('blocks duplicate deterministic document IDs', () => {
    const duplicate = importedEntry({ legacyOperationId: 'different-legacy-id', sourceRow: 3 });
    const result = validateLegacyImportBatch([importedEntry(), duplicate]);
    expect(result.valid).toBe(false);
    expect(result.issues.map(issue => issue.code)).toContain('duplicate_document_id');
  });
});
