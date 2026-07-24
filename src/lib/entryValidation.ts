import { Entry } from '../types';

export type EntryValidationCode =
  | 'missing_new_entry_seq'
  | 'invalid_seq'
  | 'missing_document_id'
  | 'invalid_legacy_document_id'
  | 'missing_legacy_operation_id'
  | 'missing_legacy_operation_no'
  | 'missing_source_row'
  | 'missing_source_file'
  | 'missing_import_version'
  | 'missing_imported_at'
  | 'invalid_legacy_source_hash'
  | 'duplicate_document_id';

export interface EntryValidationIssue {
  code: EntryValidationCode;
  field: keyof Entry | 'id';
  message: string;
  entryId?: string;
}

export interface EntryValidationResult {
  valid: boolean;
  issues: EntryValidationIssue[];
}

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const validSeq = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/**
 * Validates only the numbering/migration identity policy.
 * Imported entries may omit seq; application-created entries may not.
 */
export const validateEntryNumberingPolicy = (entry: Partial<Entry>): EntryValidationResult => {
  const issues: EntryValidationIssue[] = [];
  const imported = entry.imported === true;

  if (imported) {
    if (!hasText(entry.id)) {
      issues.push({ code: 'missing_document_id', field: 'id', message: 'Legacy imported entries require a deterministic document ID.' });
    } else if (!/^csvref-entry-[a-f0-9]{32}$/.test(entry.id)) {
      issues.push({ code: 'invalid_legacy_document_id', field: 'id', entryId: entry.id, message: 'Legacy document ID does not match the approved deterministic ID format.' });
    }
    if (!hasText(entry.legacyOperationId)) issues.push({ code: 'missing_legacy_operation_id', field: 'legacyOperationId', entryId: entry.id, message: 'legacyOperationId is required for imported entries.' });
    if (!hasText(entry.legacyOperationNo)) issues.push({ code: 'missing_legacy_operation_no', field: 'legacyOperationNo', entryId: entry.id, message: 'legacyOperationNo is required for imported entries.' });
    if (!Number.isSafeInteger(entry.sourceRow) || Number(entry.sourceRow) < 2) issues.push({ code: 'missing_source_row', field: 'sourceRow', entryId: entry.id, message: 'A valid original CSV sourceRow is required.' });
    if (!hasText(entry.sourceFile)) issues.push({ code: 'missing_source_file', field: 'sourceFile', entryId: entry.id, message: 'sourceFile is required for imported entries.' });
    if (!hasText(entry.importVersion)) issues.push({ code: 'missing_import_version', field: 'importVersion', entryId: entry.id, message: 'importVersion is required for imported entries.' });
    if (entry.importedAt === null || entry.importedAt === undefined || entry.importedAt === '') issues.push({ code: 'missing_imported_at', field: 'importedAt', entryId: entry.id, message: 'importedAt is required and supplied at import runtime.' });
    if (!hasText(entry.legacySourceHash) || !/^[a-f0-9]{64}$/i.test(entry.legacySourceHash)) issues.push({ code: 'invalid_legacy_source_hash', field: 'legacySourceHash', entryId: entry.id, message: 'legacySourceHash must be a SHA-256 hex value.' });
    if (entry.seq !== null && entry.seq !== undefined && !validSeq(entry.seq)) issues.push({ code: 'invalid_seq', field: 'seq', entryId: entry.id, message: 'Optional legacy seq must be a non-negative safe integer when present.' });
  } else if (entry.seq === null || entry.seq === undefined) {
    issues.push({ code: 'missing_new_entry_seq', field: 'seq', entryId: entry.id, message: 'New application entries require seq.' });
  } else if (!validSeq(entry.seq)) {
    issues.push({ code: 'invalid_seq', field: 'seq', entryId: entry.id, message: 'New application entry seq must be a non-negative safe integer.' });
  }

  return { valid: issues.length === 0, issues };
};

/**
 * Import preflight that keys collision checks only by deterministic document ID.
 * Repeated legacyOperationNo values are intentionally allowed.
 */
export const validateLegacyImportBatch = (entries: Partial<Entry>[]): EntryValidationResult => {
  const issues = entries.flatMap(entry => validateEntryNumberingPolicy(entry).issues);
  const seenIds = new Set<string>();
  entries.forEach(entry => {
    if (!entry.id) return;
    if (seenIds.has(entry.id)) {
      issues.push({ code: 'duplicate_document_id', field: 'id', entryId: entry.id, message: 'Duplicate deterministic document ID would overwrite an imported document.' });
    }
    seenIds.add(entry.id);
  });
  return { valid: issues.length === 0, issues };
};
