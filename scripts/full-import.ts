import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getFirestore,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { SEED_ACCOUNTS } from '../src/migrationData';
import type { Entry } from '../src/types';
import { normalizeAccountName } from '../src/lib/accountRegistry';
import { validateLegacyImportBatch } from '../src/lib/entryValidation';

type CsvRow = Record<string, string>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

type RuntimeRecord = {
  documentId: string;
  sourceRow: number;
  warningCodes: string[];
  expected: Entry;
};

const EXPECTED_PROJECT = 'makka-central-accounting';
const EXPECTED_SOURCE_HASH = '0f80dc5a76d43e0c588f02ef4574543aecb6d8825419f31ded1af3de27a37892';
const IMPORT_VERSION = 'csv-2026-07-23-v1';
const COLLECTION = 'entries';
const EXPECTED_COUNT = 2169;
const PILOT_COUNT = 30;
const BATCH_SIZE = 200;
const root = process.cwd();
const previewPath = path.join(root, 'approved_normalized_preview.csv');
const schemaPath = path.join(root, 'csv_reference_schema_mapping.json');
const pilotManifestPath = path.join(root, 'pilot_rollback_manifest.json');
const rollbackManifestPath = path.join(root, 'full_rollback_manifest.json');
const progressPath = path.join(root, 'full_import_progress.jsonl');
const resultPath = path.join(root, 'full_import_result.json');
const verificationPath = path.join(root, 'full_import_verification.json');

dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

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
  return records
    .filter(row => row.some(value => value !== ''))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const normalize = (value: unknown): JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value as null | string | number | boolean;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
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
  const normalizedLeft = comparable(left) as Record<string, JsonValue>;
  const normalizedRight = comparable(right) as Record<string, JsonValue>;
  return [...new Set([...Object.keys(normalizedLeft), ...Object.keys(normalizedRight)])]
    .filter(key => !same(normalizedLeft[key], normalizedRight[key]))
    .sort();
};

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
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => [key, toFirestoreValue(item)]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
};

const toFirestoreFields = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => key !== 'importedAt' && item !== undefined)
      .map(([key, item]) => [key, toFirestoreValue(item)]),
  );

const chunks = <T>(values: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size));

const mapCounts = (values: string[]) =>
  Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(item => item === value).length]));

const accountByName = new Map(SEED_ACCOUNTS.map(account => [normalizeAccountName(account.name), account]));
const classifyDimension = (entry: Entry): 'silver' | 'gold' | 'none' => {
  const debit = accountByName.get(normalizeAccountName(entry.debit));
  const credit = accountByName.get(normalizeAccountName(entry.credit));
  const accounts = [debit, credit];
  if (accounts.some(account => account?.metal === 'silver' || account?.type === 'silver')) return 'silver';
  if (accounts.some(account => account?.type === 'accessory')) return 'none';
  if (Number(entry.weight) !== 0 || Number(entry.arabicWeight) !== 0) return 'gold';
  return 'none';
};

const dimensionSummary = (entries: Entry[]) => {
  const cashEntries = entries.filter(entry => Number(entry.cash) !== 0);
  const goldEntries = entries.filter(entry => classifyDimension(entry) === 'gold');
  const silverEntries = entries.filter(entry => classifyDimension(entry) === 'silver');
  return {
    cash: {
      records: cashEntries.length,
      total: cashEntries.reduce((sum, entry) => sum + Number(entry.cash), 0),
    },
    gold: {
      records: goldEntries.length,
      weightTotal: goldEntries.reduce((sum, entry) => sum + Number(entry.weight), 0),
      arabicWeightTotal: goldEntries.reduce((sum, entry) => sum + Number(entry.arabicWeight), 0),
    },
    silver: {
      records: silverEntries.length,
      weightTotal: silverEntries.reduce((sum, entry) => sum + Number(entry.weight), 0),
      arabicWeightTotal: silverEntries.reduce((sum, entry) => sum + Number(entry.arabicWeight), 0),
    },
  };
};

const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.trim();
const firebaserc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8')) as {
  projects?: { default?: string };
};
const firebaseTarget = firebaserc.projects?.default;
if (projectId !== EXPECTED_PROJECT || firebaseTarget !== EXPECTED_PROJECT) {
  throw new Error(`Project preflight mismatch: firebaseUse=${firebaseTarget}, VITE_FIREBASE_PROJECT_ID=${projectId}`);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
  source?: { sha256?: string; logicalFilename?: string; byteSize?: number };
};
if (schema.source?.sha256 !== EXPECTED_SOURCE_HASH) {
  throw new Error(`Source metadata SHA-256 mismatch: ${schema.source?.sha256}`);
}

const previewBytes = fs.readFileSync(previewPath);
const previewHash = crypto.createHash('sha256').update(previewBytes).digest('hex');
const approvedRows = parseCsv(previewBytes.toString('utf8'));
if (approvedRows.length !== EXPECTED_COUNT) {
  throw new Error(`Approved preview row count mismatch: expected ${EXPECTED_COUNT}, got ${approvedRows.length}`);
}

const rowSourceHashMismatches = approvedRows.filter(row => row.legacy_source_hash !== EXPECTED_SOURCE_HASH);
const proposedSourceHashMismatches = approvedRows.filter(row => {
  const proposed = JSON.parse(row.proposed_import_document) as Partial<Entry>;
  return proposed.legacySourceHash !== EXPECTED_SOURCE_HASH;
});
if (rowSourceHashMismatches.length || proposedSourceHashMismatches.length) {
  throw new Error(
    `Source SHA evidence mismatch: rows=${rowSourceHashMismatches.length}, proposed=${proposedSourceHashMismatches.length}`,
  );
}

const email = process.env.PILOT_IMPORT_EMAIL;
const password = process.env.PILOT_IMPORT_PASSWORD;
const expectedUid = process.env.PILOT_IMPORT_USER_ID;
if (!email || !password || !expectedUid) {
  throw new Error('PILOT_IMPORT_EMAIL, PILOT_IMPORT_PASSWORD, and PILOT_IMPORT_USER_ID are required.');
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig, `full-import-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

let createdThisRun: string[] = [];
let rollbackExecuted = false;
let authenticatedUid = '';

const appendProgress = (event: Record<string, unknown>) => {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...event });
  fs.appendFileSync(progressPath, `${line}\n`, 'utf8');
  console.log(line);
};

const readOwnedEntries = async (uid: string) => {
  const snapshot = await getDocs(query(collection(db, COLLECTION), where('userId', '==', uid)));
  return new Map(snapshot.docs.map(item => [item.id, item.data() as Record<string, unknown>]));
};

const rollbackCreatedDocuments = async () => {
  for (const group of chunks(createdThisRun, 400)) {
    const batch = writeBatch(db);
    group.forEach(id => batch.delete(doc(db, COLLECTION, id)));
    await batch.commit();
  }
  rollbackExecuted = createdThisRun.length > 0;
};

try {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  authenticatedUid = credential.user.uid;
  if (authenticatedUid !== expectedUid) {
    throw new Error('Authenticated UID does not match PILOT_IMPORT_USER_ID.');
  }

  const records: RuntimeRecord[] = approvedRows.map(row => {
    const approved = JSON.parse(row.proposed_import_document) as Entry;
    const documentId = row.document_id;
    const expected: Entry = {
      ...approved,
      id: documentId,
      seq: null,
      userId: authenticatedUid,
      imported: true,
      importVersion: IMPORT_VERSION,
      importedAt: '__SERVER_TIMESTAMP__',
      legacySourceHash: EXPECTED_SOURCE_HASH,
    };
    return {
      documentId,
      sourceRow: Number(row.original_row_number),
      warningCodes: row.warning_codes ? row.warning_codes.split('|') : [],
      expected,
    };
  });

  const ids = records.map(record => record.documentId);
  const uniqueIds = new Set(ids);
  const duplicateIds = ids.length - uniqueIds.size;
  if (duplicateIds > 0 || ids.some(id => !/^csvref-entry-[a-f0-9]{32}$/.test(id))) {
    throw new Error(`Deterministic ID validation failed: duplicates=${duplicateIds}`);
  }

  const localValidation = validateLegacyImportBatch(records.map(record => record.expected));
  if (!localValidation.valid) {
    throw new Error(`Full import local validation failed: ${JSON.stringify(localValidation.issues.slice(0, 20))}`);
  }

  const accountReferenceFailures = records.flatMap(record => {
    const failures: { id: string; field: 'debit' | 'credit'; value: string }[] = [];
    if (!accountByName.has(normalizeAccountName(record.expected.debit))) {
      failures.push({ id: record.documentId, field: 'debit', value: record.expected.debit });
    }
    if (!accountByName.has(normalizeAccountName(record.expected.credit))) {
      failures.push({ id: record.documentId, field: 'credit', value: record.expected.credit });
    }
    return failures;
  });
  if (accountReferenceFailures.length > 0) {
    throw new Error(`Account reference validation failed: ${JSON.stringify(accountReferenceFailures.slice(0, 20))}`);
  }

  const pilotManifest = JSON.parse(fs.readFileSync(pilotManifestPath, 'utf8')) as {
    ids?: string[];
    sourceHash?: string;
    importVersion?: string;
  };
  if (
    pilotManifest.ids?.length !== PILOT_COUNT
    || new Set(pilotManifest.ids).size !== PILOT_COUNT
    || pilotManifest.sourceHash !== EXPECTED_SOURCE_HASH
    || pilotManifest.importVersion !== IMPORT_VERSION
  ) {
    throw new Error('Pilot manifest preflight failed.');
  }

  const ownedBefore = await readOwnedEntries(authenticatedUid);
  const expectedById = new Map(records.map(record => [record.documentId, record.expected]));
  const pilotMismatches: { id: string; reason: string; fields?: string[] }[] = [];
  for (const id of pilotManifest.ids) {
    const existing = ownedBefore.get(id);
    const expected = expectedById.get(id);
    if (!existing || !expected) {
      pilotMismatches.push({ id, reason: !expected ? 'not_in_approved_preview' : 'missing' });
    } else if (!same(comparable(existing), comparable(expected as unknown as Record<string, unknown>))) {
      pilotMismatches.push({
        id,
        reason: 'field_mismatch',
        fields: differingTopLevelFields(existing, expected as unknown as Record<string, unknown>),
      });
    }
  }
  if (pilotMismatches.length > 0) {
    throw new Error(`Pilot document verification failed: ${JSON.stringify(pilotMismatches.slice(0, 10))}`);
  }

  const conflictingExisting: { id: string; fields: string[] }[] = [];
  const matchingExisting: string[] = [];
  const createRecords: RuntimeRecord[] = [];
  for (const record of records) {
    const existing = ownedBefore.get(record.documentId);
    if (!existing) {
      createRecords.push(record);
    } else if (same(comparable(existing), comparable(record.expected as unknown as Record<string, unknown>))) {
      matchingExisting.push(record.documentId);
    } else {
      conflictingExisting.push({
        id: record.documentId,
        fields: differingTopLevelFields(existing, record.expected as unknown as Record<string, unknown>),
      });
    }
  }
  if (conflictingExisting.length > 0) {
    throw new Error(`Existing ID collision with different content: ${JSON.stringify(conflictingExisting.slice(0, 10))}`);
  }

  const qualifyingBefore = [...ownedBefore.entries()]
    .filter(([, data]) =>
      data.imported === true
      && data.importVersion === IMPORT_VERSION
      && data.legacySourceHash === EXPECTED_SOURCE_HASH)
    .map(([id]) => id);
  const extrasBefore = qualifyingBefore.filter(id => !uniqueIds.has(id));
  if (extrasBefore.length > 0) {
    throw new Error(`Extra documents already exist for this import identity: ${extrasBefore.slice(0, 20).join(',')}`);
  }

  const rollbackManifest = {
    status: 'prepared_before_write',
    generatedAt: new Date().toISOString(),
    projectId,
    collection: COLLECTION,
    authenticatedUserId: authenticatedUid,
    sourceHash: EXPECTED_SOURCE_HASH,
    approvedPreviewSha256: previewHash,
    importVersion: IMPORT_VERSION,
    totalManifestIds: ids.length,
    preexistingMatchingIds: matchingExisting,
    plannedCreateIds: createRecords.map(record => record.documentId),
    ids,
    rollbackScope: 'plannedCreateIds_only_never_preexistingMatchingIds',
  };
  fs.writeFileSync(rollbackManifestPath, `${JSON.stringify(rollbackManifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(progressPath, '', 'utf8');

  appendProgress({
    event: 'preflight_complete',
    firebaseUse: firebaseTarget,
    viteProjectId: projectId,
    sourceHash: EXPECTED_SOURCE_HASH,
    authenticatedUid: `${authenticatedUid.slice(0, 4)}…${authenticatedUid.slice(-4)}`,
    pilotVerified: PILOT_COUNT,
    total: records.length,
    matchingExisting: matchingExisting.length,
    plannedWrites: createRecords.length,
    rollbackManifest: path.basename(rollbackManifestPath),
  });

  const token = await credential.user.getIdToken();
  const dbName = databaseId || '(default)';
  const endpoint = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbName}/documents:commit`;
  const writeGroups = chunks(createRecords, BATCH_SIZE);

  for (let index = 0; index < writeGroups.length; index += 1) {
    const group = writeGroups[index];
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        writes: group.map(record => ({
          update: {
            name: `projects/${projectId}/databases/${dbName}/documents/${COLLECTION}/${record.documentId}`,
            fields: toFirestoreFields(record.expected as unknown as Record<string, unknown>),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'importedAt', setToServerValue: 'REQUEST_TIME' }],
        })),
      }),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 1000);
      throw new Error(`Create-only batch ${index + 1} failed safely with HTTP ${response.status}: ${body}`);
    }
    createdThisRun.push(...group.map(record => record.documentId));
    appendProgress({
      event: 'batch_committed',
      batch: index + 1,
      batchCount: writeGroups.length,
      batchSize: group.length,
      writtenCumulative: createdThisRun.length,
      skipped: matchingExisting.length,
    });
  }

  const ownedAfter = await readOwnedEntries(authenticatedUid);
  const failures: { id: string; reason: string; fields?: string[] }[] = [];
  const actualEntries: Entry[] = [];
  let read = 0;
  let verified = 0;
  for (const record of records) {
    const actual = ownedAfter.get(record.documentId);
    if (!actual) {
      failures.push({ id: record.documentId, reason: 'missing_document' });
      continue;
    }
    read += 1;
    const fieldsMatch = same(comparable(actual), comparable(record.expected as unknown as Record<string, unknown>));
    const importedAtPresent = actual.importedAt !== null && actual.importedAt !== undefined;
    if (!fieldsMatch) {
      failures.push({
        id: record.documentId,
        reason: 'field_mismatch',
        fields: differingTopLevelFields(actual, record.expected as unknown as Record<string, unknown>),
      });
    } else if (!importedAtPresent) {
      failures.push({ id: record.documentId, reason: 'importedAt_missing' });
    } else {
      verified += 1;
      actualEntries.push(actual as unknown as Entry);
    }
  }

  const missing = ids.filter(id => !ownedAfter.has(id));
  const qualifyingAfter = [...ownedAfter.entries()]
    .filter(([, data]) =>
      data.imported === true
      && data.importVersion === IMPORT_VERSION
      && data.legacySourceHash === EXPECTED_SOURCE_HASH)
    .map(([id]) => id);
  const extra = qualifyingAfter.filter(id => !uniqueIds.has(id));
  const expectedEntries = records.map(record => record.expected);
  const expectedDimensions = dimensionSummary(expectedEntries);
  const actualDimensions = dimensionSummary(actualEntries);
  const dimensionMismatches = {
    cash: records.filter(record => {
      const actual = ownedAfter.get(record.documentId);
      return !actual || String(actual.cash) !== String(record.expected.cash);
    }).length,
    gold: records.filter(record => {
      if (classifyDimension(record.expected) !== 'gold') return false;
      const actual = ownedAfter.get(record.documentId);
      return !actual
        || String(actual.weight) !== String(record.expected.weight)
        || String(actual.arabicWeight) !== String(record.expected.arabicWeight);
    }).length,
    silver: records.filter(record => {
      if (classifyDimension(record.expected) !== 'silver') return false;
      const actual = ownedAfter.get(record.documentId);
      return !actual
        || String(actual.weight) !== String(record.expected.weight)
        || String(actual.arabicWeight) !== String(record.expected.arabicWeight);
    }).length,
  };
  const expectedRecordTypes = mapCounts(expectedEntries.map(entry => entry.tx));
  const actualRecordTypes = mapCounts(actualEntries.map(entry => entry.tx));
  const recordTypeParity = same(expectedRecordTypes, actualRecordTypes);

  if (
    failures.length > 0
    || missing.length > 0
    || extra.length > 0
    || qualifyingAfter.length !== EXPECTED_COUNT
    || Object.values(dimensionMismatches).some(count => count > 0)
    || !recordTypeParity
  ) {
    throw new Error(`Post-import verification failed: ${JSON.stringify({
      failures: failures.slice(0, 20),
      missing: missing.slice(0, 20),
      extra: extra.slice(0, 20),
      qualifyingCount: qualifyingAfter.length,
      dimensionMismatches,
      recordTypeParity,
    })}`);
  }

  const warningRows = records.filter(record => record.warningCodes.length > 0).length;
  const result = {
    status: 'verified',
    projectId,
    authenticatedUserId: `${authenticatedUid.slice(0, 4)}…${authenticatedUid.slice(-4)}`,
    firebaseUse: firebaseTarget,
    viteFirebaseProjectId: projectId,
    sourceHash: EXPECTED_SOURCE_HASH,
    sourceHashEvidence: {
      schemaMetadataMatch: true,
      approvedRowsMatch: approvedRows.length,
      proposedDocumentsMatch: approvedRows.length,
    },
    approvedPreviewSha256: previewHash,
    importVersion: IMPORT_VERSION,
    written: createdThisRun.length,
    skipped: matchingExisting.length,
    read,
    verified,
    failed: failures.length,
    documentCount: qualifyingAfter.length,
    duplicates: duplicateIds,
    missing: missing.length,
    extra: extra.length,
    accountReferenceFailures: accountReferenceFailures.length,
    pilotDocumentsVerifiedUnchanged: PILOT_COUNT,
    parity: {
      cash: {
        match: dimensionMismatches.cash === 0 && same(expectedDimensions.cash, actualDimensions.cash),
        mismatches: dimensionMismatches.cash,
        expected: expectedDimensions.cash,
        actual: actualDimensions.cash,
      },
      gold: {
        match: dimensionMismatches.gold === 0 && same(expectedDimensions.gold, actualDimensions.gold),
        mismatches: dimensionMismatches.gold,
        expected: expectedDimensions.gold,
        actual: actualDimensions.gold,
      },
      silver: {
        match: dimensionMismatches.silver === 0 && same(expectedDimensions.silver, actualDimensions.silver),
        mismatches: dimensionMismatches.silver,
        expected: expectedDimensions.silver,
        actual: actualDimensions.silver,
      },
      cleanRows: records.length - warningRows,
      warningRows,
      blockingRows: 0,
    },
    recordTypes: {
      match: recordTypeParity,
      expected: expectedRecordTypes,
      actual: actualRecordTypes,
    },
    batchSize: BATCH_SIZE,
    batchCount: writeGroups.length,
    rollbackManifest: path.basename(rollbackManifestPath),
    rollbackManifestStatus: 'ready_not_executed_verification_passed',
    rollbackExecuted: false,
    hostingDeploy: false,
  };
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  appendProgress({ event: 'verification_complete', ...result });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  if (createdThisRun.length > 0) {
    try {
      await rollbackCreatedDocuments();
      appendProgress({
        event: 'rollback_complete_after_true_failure',
        deleted: createdThisRun.length,
        reason,
      });
    } catch (rollbackError) {
      fs.writeFileSync(path.join(root, 'full_import_failure.json'), `${JSON.stringify({
        status: 'failed_rollback_incomplete',
        reason,
        createdThisRun,
        rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      }, null, 2)}\n`, 'utf8');
      throw rollbackError;
    }
  }
  fs.writeFileSync(path.join(root, 'full_import_failure.json'), `${JSON.stringify({
    status: rollbackExecuted ? 'failed_rolled_back' : 'failed_before_write',
    reason,
    createdThisRun: createdThisRun.length,
    rollbackExecuted,
  }, null, 2)}\n`, 'utf8');
  throw error;
} finally {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
}

// This file is written only after two successful invocations by the operator.
if (process.argv.includes('--record-idempotency-verification')) {
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as Record<string, unknown>;
  fs.writeFileSync(verificationPath, `${JSON.stringify({
    status: 'verified_idempotent',
    generatedAt: new Date().toISOString(),
    ...result,
    idempotencyRun: {
      written: result.written,
      skipped: result.skipped,
      read: result.read,
      verified: result.verified,
      failed: result.failed,
      batchCount: result.batchCount,
    },
  }, null, 2)}\n`, 'utf8');
}
