import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  writeBatch,
} from 'firebase/firestore';
import { SEED_ACCOUNTS } from '../src/migrationData';
import { Entry } from '../src/types';
import { normalizeAccountName } from '../src/lib/accountRegistry';
import { validateEntryNumberingPolicy, validateLegacyImportBatch } from '../src/lib/entryValidation';

type CsvRow = Record<string, string>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type PilotSample = {
  projectId: string;
  collection: 'entries';
  sourceHash: string;
  importVersion: 'csv-2026-07-23-v1';
  generatedAt: string;
  records: PilotRecord[];
};
type PilotRecord = {
  category: string;
  documentId: string;
  sourceRow: number;
  date: string;
  operationType: string;
  legacyOperationId: string;
  legacyOperationNo: string;
  debit: string;
  credit: string;
  dimensions: string[];
  warningCodes: string[];
  approvedDocument: Entry;
  originalRawValues: Record<string, string>;
};

const EXPECTED_PROJECT = 'makka-central-accounting';
const EXPECTED_HASH = '0f80dc5a76d43e0c588f02ef4574543aecb6d8825419f31ded1af3de27a37892';
const IMPORT_VERSION = 'csv-2026-07-23-v1' as const;
const COLLECTION = 'entries' as const;
const root = process.cwd();
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

const args = new Set(process.argv.slice(2));
const prepareOnly = args.has('--prepare');
const sourceArgIndex = process.argv.indexOf('--source');
const sourcePath = sourceArgIndex >= 0 ? process.argv[sourceArgIndex + 1] : process.env.PILOT_SOURCE_CSV;
if (!sourcePath) throw new Error('Provide --source <CSV path> or PILOT_SOURCE_CSV.');

const sha256 = (filename: string) => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const parseCsv = (text: string): CsvRow[] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field.length || record.length) {
    record.push(field);
    records.push(record);
  }
  const headers = records.shift() ?? [];
  return records.filter(row => row.some(value => value !== '')).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const writeCsv = (filename: string, rows: Record<string, unknown>[], headers: string[]) => {
  fs.writeFileSync(path.join(root, filename), [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
  ].join('\r\n') + '\r\n', 'utf8');
};
const sourceHash = sha256(sourcePath);
const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim();
const firebaserc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')) as { projects?: { default?: string } };
const activeTarget = firebaserc.projects?.default;
if (projectId !== EXPECTED_PROJECT || activeTarget !== EXPECTED_PROJECT || sourceHash !== EXPECTED_HASH) {
  throw new Error(`Preflight mismatch: env=${projectId}, firebaseTarget=${activeTarget}, sourceHash=${sourceHash}`);
}

const approvedRows = parseCsv(fs.readFileSync(path.join(root, 'approved_normalized_preview.csv'), 'utf8'));
const categorySpecs = [
  { category: 'بيع ذهب', types: ['بيع ذهب'], count: 3 },
  { category: 'شراء ذهب', types: ['شراء ذهب'], count: 3 },
  { category: 'بيع فضة', types: ['بيع فضة'], count: 3 },
  { category: 'شراء فضة', types: ['شراء فضة'], count: 3 },
  { category: 'ملحقات', types: ['بيع ملحقات', 'شراء ملحقات'], count: 3 },
  { category: 'تاجر ذهب', types: ['تاجر ذهب'], count: 3 },
  { category: 'تاجر فضة', types: ['تاجر فضة'], count: 2 },
  { category: 'قيد افتتاحي', types: ['قيد افتتاحي'], count: 3 },
  { category: 'تسوية', types: ['تسوية'], count: 2 },
  { category: 'تحويل', types: ['تحويل'], count: 2 },
  { category: 'مسحوبات', types: ['مسحوبات'], count: 3 },
] as const;

const quantilePick = (rows: CsvRow[], count: number): CsvRow[] => {
  if (rows.length < count) throw new Error(`Not enough rows: requested ${count}, found ${rows.length}`);
  if (count === 1) return [rows[Math.floor(rows.length / 2)]];
  return Array.from({ length: count }, (_, index) => rows[Math.round(index * (rows.length - 1) / (count - 1))]);
};
const approvedDate = (row: CsvRow) =>
  String((JSON.parse(row.proposed_import_document) as Partial<Entry>).date ?? '');
const accountNames = new Set(SEED_ACCOUNTS.map(account => normalizeAccountName(account.name)));
const accountByName = new Map(SEED_ACCOUNTS.map(account => [normalizeAccountName(account.name), account]));
const selectedRows: { category: string; row: CsvRow }[] = [];
for (const spec of categorySpecs) {
  const candidates = approvedRows
    .filter(row => spec.types.includes((JSON.parse(row.original_raw_values) as Record<string, string>)['العملية'] as never))
    .sort((left, right) =>
      approvedDate(left).localeCompare(approvedDate(right))
      || Number(left.original_row_number) - Number(right.original_row_number));
  if (spec.category === 'ملحقات') {
    const purchase = candidates.filter(row => (JSON.parse(row.original_raw_values) as Record<string, string>)['العملية'] === 'شراء ملحقات');
    const sales = candidates.filter(row => (JSON.parse(row.original_raw_values) as Record<string, string>)['العملية'] === 'بيع ملحقات');
    selectedRows.push({ category: spec.category, row: quantilePick(purchase, 1)[0] });
    quantilePick(sales, spec.count - 1).forEach(row => selectedRows.push({ category: spec.category, row }));
  } else {
    quantilePick(candidates, spec.count).forEach(row => selectedRows.push({ category: spec.category, row }));
  }
}
if (selectedRows.length !== 30) throw new Error(`Pilot sample must contain 30 rows, got ${selectedRows.length}.`);

const records: PilotRecord[] = selectedRows.map(({ category, row }) => {
  const raw = JSON.parse(row.original_raw_values) as Record<string, string>;
  const approved = JSON.parse(row.proposed_import_document) as Entry;
  approved.seq = null;
  approved.importVersion = IMPORT_VERSION;
  approved.importedAt = '__RUNTIME_IMPORT_TIMESTAMP__';
  approved.userId = '__RUNTIME_AUTH_UID__';
  const debitAccount = accountByName.get(normalizeAccountName(approved.debit));
  const creditAccount = accountByName.get(normalizeAccountName(approved.credit));
  const isAccessory = [debitAccount, creditAccount].some(account => account?.type === 'accessory');
  const isSilver = [debitAccount, creditAccount].some(account => account?.metal === 'silver');
  const dimensions = [
    Number(approved.cash) > 0 ? 'cash' : '',
    Number(approved.weight) > 0 && isSilver ? 'silver' : '',
    Number(approved.weight) > 0 && !isSilver && !isAccessory ? 'gold' : '',
    Number(approved.count) > 0 || (isAccessory && Number(approved.weight) > 0) ? 'quantity' : '',
  ].filter(Boolean);
  if (!accountNames.has(normalizeAccountName(approved.debit)) || !accountNames.has(normalizeAccountName(approved.credit))) {
    throw new Error(`Unknown account in source row ${row.original_row_number}.`);
  }
  return {
    category,
    documentId: row.document_id,
    sourceRow: Number(row.original_row_number),
    date: approved.date,
    operationType: raw['العملية'],
    legacyOperationId: approved.legacyOperationId ?? '',
    legacyOperationNo: approved.legacyOperationNo ?? '',
    debit: approved.debit,
    credit: approved.credit,
    dimensions,
    warningCodes: row.warning_codes ? row.warning_codes.split('|') : [],
    approvedDocument: approved,
    originalRawValues: raw,
  };
});

const sample: PilotSample = {
  projectId: EXPECTED_PROJECT,
  collection: COLLECTION,
  sourceHash,
  importVersion: IMPORT_VERSION,
  generatedAt: new Date().toISOString(),
  records,
};
const ids = records.map(record => record.documentId);
if (new Set(ids).size !== ids.length) throw new Error('Pilot sample contains duplicate deterministic IDs.');

const localValidationEntries = records.map(record => ({
  ...record.approvedDocument,
  id: record.documentId,
  importedAt: '__RUNTIME_IMPORT_TIMESTAMP__',
})) as Entry[];
const batchPreflight = validateLegacyImportBatch(localValidationEntries);
if (!batchPreflight.valid) {
  throw new Error(`Pilot preflight validation failed: ${JSON.stringify(batchPreflight.issues)}`);
}
fs.writeFileSync(path.join(root, 'pilot_import_sample.json'), JSON.stringify(sample, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(root, 'pilot_rollback_manifest.json'), JSON.stringify({
  projectId: EXPECTED_PROJECT,
  collection: COLLECTION,
  sourceHash,
  importVersion: IMPORT_VERSION,
  ids,
}, null, 2) + '\n', 'utf8');
writeCsv('pilot_sample_preflight.csv', records.map(record => ({
  category: record.category,
  document_id: record.documentId,
  source_row: record.sourceRow,
  date: record.date,
  operation_type: record.operationType,
  legacy_operation_id: record.legacyOperationId,
  legacy_operation_no: record.legacyOperationNo,
  debit: record.debit,
  credit: record.credit,
  dimensions: record.dimensions.join('|'),
  warning_codes: record.warningCodes.join('|'),
  preflight_valid: validateEntryNumberingPolicy({ ...record.approvedDocument, id: record.documentId }).valid,
})), [
  'category', 'document_id', 'source_row', 'date', 'operation_type',
  'legacy_operation_id', 'legacy_operation_no', 'debit', 'credit',
  'dimensions', 'warning_codes', 'preflight_valid',
]);

if (prepareOnly) {
  fs.writeFileSync(path.join(root, 'pilot_import_report.md'), `# Pilot Import — Preflight Prepared

- Firebase target: \`${activeTarget}\`
- Vite project ID: \`${projectId}\`
- Source SHA-256: \`${sourceHash}\`
- Sample records: ${records.length}
- Unique deterministic IDs: ${new Set(ids).size}
- Local preflight failures: ${batchPreflight.issues.length}
- External writes: 0
- Status: BLOCKED before write because the project currently has no Firebase Authentication users. Provide an authenticated pilot user UID and credentials.
`, 'utf8');
  console.log(JSON.stringify({ status: 'prepared_no_write', sampleCount: records.length, uniqueIds: new Set(ids).size, preflightFailures: batchPreflight.issues.length }, null, 2));
  process.exit(0);
}

const email = process.env.PILOT_IMPORT_EMAIL;
const password = process.env.PILOT_IMPORT_PASSWORD;
const expectedUid = process.env.PILOT_IMPORT_USER_ID;
if (!email || !password || !expectedUid) {
  throw new Error('PILOT_IMPORT_EMAIL, PILOT_IMPORT_PASSWORD, and PILOT_IMPORT_USER_ID are required for the write phase.');
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig, `pilot-import-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const writtenIds: string[] = [];
const skippedIds: string[] = [];
const failed: { id: string; reason: string }[] = [];

const normalize = (value: unknown): JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value as null | string | number | boolean;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalize(item)]));
  }
  return String(value);
};
const comparable = (value: Record<string, unknown>) => {
  const copy = { ...value };
  delete copy.importedAt;
  return normalize(copy);
};
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const differingTopLevelFields = (left: Record<string, unknown>, right: Record<string, unknown>) => {
  const leftComparable = comparable(left) as Record<string, JsonValue>;
  const rightComparable = comparable(right) as Record<string, JsonValue>;
  return [...new Set([...Object.keys(leftComparable), ...Object.keys(rightComparable)])]
    .filter(key => !same(leftComparable[key], rightComparable[key]))
    .sort();
};
type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };
const toFirestoreValue = (value: unknown): FirestoreValue => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, toFirestoreValue(item)])),
      },
    };
  }
  return { stringValue: String(value) };
};
const toFirestoreFields = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value)
    .filter(([key, item]) => key !== 'importedAt' && item !== undefined)
    .map(([key, item]) => [key, toFirestoreValue(item)]));

try {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  if (credential.user.uid !== expectedUid) throw new Error(`Authenticated UID does not match PILOT_IMPORT_USER_ID.`);

  const runtimeRecords = records.map(record => ({
    ...record,
    approvedDocument: {
      ...record.approvedDocument,
      id: record.documentId,
      seq: null,
      userId: credential.user.uid,
      imported: true,
      importVersion: IMPORT_VERSION,
      importedAt: '__SERVER_TIMESTAMP__',
      legacySourceHash: sourceHash,
    } satisfies Entry,
  }));
  const runtimeValidation = validateLegacyImportBatch(runtimeRecords.map(record => record.approvedDocument));
  if (!runtimeValidation.valid) throw new Error(`Runtime preflight failed: ${JSON.stringify(runtimeValidation.issues)}`);

  for (const record of runtimeRecords) {
    try {
      const snapshot = await getDoc(doc(db, COLLECTION, record.documentId));
      if (!snapshot.exists()) continue;
      if (!same(comparable(snapshot.data()), comparable(record.approvedDocument as unknown as Record<string, unknown>))) {
        throw new Error(`ID collision with different document content: ${record.documentId}`);
      }
      skippedIds.push(record.documentId);
    } catch (error) {
      const code = (error as { code?: string }).code;
      // Current rules intentionally deny reads for nonexistent documents because
      // ownsExisting() needs resource.data. A create-only precondition below is
      // the authoritative, race-safe existence check.
      if (code !== 'permission-denied') throw error;
    }
  }

  const createRecords = runtimeRecords.filter(record => !skippedIds.includes(record.documentId));
  writtenIds.push(...createRecords.map(record => record.documentId));
  if (createRecords.length > 0) {
    const token = await credential.user.getIdToken();
    const dbName = databaseId || '(default)';
    const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbName}/documents:commit`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        writes: createRecords.map(record => ({
          update: {
            name: `projects/${projectId}/databases/${dbName}/documents/${COLLECTION}/${record.documentId}`,
            fields: toFirestoreFields(record.approvedDocument as unknown as Record<string, unknown>),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'importedAt', setToServerValue: 'REQUEST_TIME' }],
        })),
      }),
    });
    if (!response.ok) {
      writtenIds.length = 0;
      throw new Error(`Create-only Firestore commit failed safely with HTTP ${response.status}.`);
    }
  }

  let read = 0;
  let verified = 0;
  for (const record of runtimeRecords) {
    const snapshot = await getDoc(doc(db, COLLECTION, record.documentId));
    if (!snapshot.exists()) {
      failed.push({ id: record.documentId, reason: 'document_missing_after_write' });
      continue;
    }
    read += 1;
    const data = snapshot.data();
    const fieldsMatch = same(comparable(data), comparable(record.approvedDocument as unknown as Record<string, unknown>));
    const importedAtPresent = data.importedAt !== null && data.importedAt !== undefined;
    if (fieldsMatch && importedAtPresent) verified += 1;
    else failed.push({
      id: record.documentId,
      reason: fieldsMatch
        ? 'importedAt_missing'
        : `field_mismatch:${differingTopLevelFields(
          data,
          record.approvedDocument as unknown as Record<string, unknown>,
        ).join('|')}`,
    });
  }

  if (failed.length > 0) {
    const rollback = writeBatch(db);
    writtenIds.forEach(id => rollback.delete(doc(db, COLLECTION, id)));
    if (writtenIds.length > 0) await rollback.commit();
    let rollbackConfirmedAbsent = 0;
    for (const id of writtenIds) {
      try {
        const snapshot = await getDoc(doc(db, COLLECTION, id));
        if (!snapshot.exists()) rollbackConfirmedAbsent += 1;
      } catch (error) {
        if ((error as { code?: string }).code === 'permission-denied') rollbackConfirmedAbsent += 1;
        else throw error;
      }
    }
    fs.writeFileSync(path.join(root, 'pilot_import_failure.json'), JSON.stringify({
      status: 'verification_failed_rolled_back',
      failed,
      writtenBeforeRollback: writtenIds.length,
      rollbackConfirmedAbsent,
    }, null, 2) + '\n', 'utf8');
    throw new Error(`Verification failed; rolled back ${writtenIds.length} documents created by this run.`);
  }

  const result = {
    status: 'verified',
    projectId,
    userId: `${credential.user.uid.slice(0, 4)}…${credential.user.uid.slice(-4)}`,
    importVersion: IMPORT_VERSION,
    sampleIds: ids,
    written: writtenIds.length,
    skippedExistingIdempotent: skippedIds.length,
    read,
    verified,
    failed: failed.length,
    documentCountForManifestIds: read,
    duplicateIds: ids.length - new Set(ids).size,
    accountValidationFailures: 0,
    dimensionWarnings: records.filter(record => record.warningCodes.length > 0).length,
    rollbackManifest: 'pilot_rollback_manifest.json',
  };
  fs.writeFileSync(path.join(root, 'pilot_import_result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
}
