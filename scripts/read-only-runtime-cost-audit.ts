import path from 'node:path';
import dotenv from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';
import type { Account, Entry } from '../src/types';
import { buildOpeningCostConfig } from '../src/lib/openingCostConfig';
import {
  createCostInputRevision,
  executeCostCalculationRun,
} from '../src/lib/costRecalculation';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
  buildInventoryRuntimeCatalog,
} from '../src/lib/inventoryCostCatalog';
import { SEED_ACCOUNTS } from '../src/migrationData';

const TARGET_ACCOUNT_ID = '09qdBCNEiuO9JxX4N6JnK';
const root = process.cwd();
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required local environment variable: ${name}`);
  return value;
};

const app = initializeApp({
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: required('VITE_FIREBASE_APP_ID'),
}, `read-only-runtime-cost-audit-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const comparableMetadata = (account: Partial<Account>) => ({
  name: account.name ?? null,
  mainType: account.mainType ?? null,
  subType: account.subType ?? null,
  balanceNature: account.balanceNature ?? null,
  type: account.type ?? null,
  is_inventory: account.is_inventory ?? null,
  karat: account.karat ?? null,
  metal: account.metal ?? null,
  quantityStep: account.quantityStep ?? null,
});

const inventoryStableBySeedName = new Map(
  SEED_ACCOUNTS
    .filter(account => account.is_inventory)
    .map((account, index) => [
      account.name,
      {
        stableAccountId: CURRENT_DATASET_INVENTORY_BINDINGS[index].inventoryAccountId,
        taxonomyKey: CURRENT_DATASET_INVENTORY_BINDINGS[index].taxonomyKey,
        seedMetadata: comparableMetadata(account as Account),
      },
    ]),
);

const timestampValue = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && value && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'object' && value && 'seconds' in value) {
    const item = value as { seconds: number; nanoseconds?: number };
    return new Date(item.seconds * 1000 + (item.nanoseconds ?? 0) / 1_000_000).toISOString();
  }
  return null;
};

try {
  const credential = await signInWithEmailAndPassword(
    auth,
    required('PILOT_IMPORT_EMAIL'),
    required('PILOT_IMPORT_PASSWORD'),
  );
  if (credential.user.uid !== required('PILOT_IMPORT_USER_ID')) {
    throw new Error('Authenticated UID does not match PILOT_IMPORT_USER_ID.');
  }

  const isAdmin = credential.user.email?.toLowerCase()
    === process.env.VITE_ADMIN_EMAIL?.trim().toLowerCase();
  const entriesQuery = isAdmin
    ? query(collection(db, 'entries'))
    : query(collection(db, 'entries'), where('userId', '==', credential.user.uid));
  const accountsQuery = query(
    collection(db, 'accounts'),
    where('userId', '==', credential.user.uid),
  );
  const [entriesSnapshot, accountsSnapshot, settingsSnapshot] = await Promise.all([
    getDocs(entriesQuery),
    getDocs(accountsQuery),
    getDoc(doc(db, 'settings', credential.user.uid)),
  ]);
  const entries = entriesSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Entry));
  const accounts = accountsSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
  const targetAccount = accounts.find(account => account.id === TARGET_ACCOUNT_ID);
  const matchingEntries = entries.filter(entry =>
    entry.debitAccountId === TARGET_ACCOUNT_ID || entry.creditAccountId === TARGET_ACCOUNT_ID);
  const openingConfig = buildOpeningCostConfig(
    settingsSnapshot.exists() && Array.isArray(settingsSnapshot.data().openingCostConfig)
      ? settingsSnapshot.data().openingCostConfig
      : [],
  );
  const inputRevision = createCostInputRevision(entries, accounts, openingConfig);
  const run = executeCostCalculationRun({
    generationId: 1,
    inputRevision,
    entries,
    accounts,
    openingConfig,
  });
  const catalog = buildInventoryRuntimeCatalog(accounts);
  const exactSeedCandidate = targetAccount
    ? inventoryStableBySeedName.get(targetAccount.name)
    : undefined;
  const targetMetadata = targetAccount ? comparableMetadata(targetAccount) : null;
  const metadataMatchesSeed = !!(
    targetMetadata
    && exactSeedCandidate
    && JSON.stringify(targetMetadata) === JSON.stringify(exactSeedCandidate.seedMetadata)
  );

  const relatedRecords = matchingEntries
    .sort((left, right) => left.date.localeCompare(right.date)
      || Number(left.seq ?? 0) - Number(right.seq ?? 0)
      || String(left.id).localeCompare(String(right.id)))
    .map(entry => {
      const side = entry.debitAccountId === TARGET_ACCOUNT_ID ? 'debit' : 'credit';
      return {
        operationId: entry.id ?? null,
        operationNo: (entry as Entry & { operationNo?: unknown }).operationNo
          ?? entry.legacyOperationNo
          ?? null,
        date: entry.date,
        operationType: entry.tx,
        operationKind: entry.operationKind ?? null,
        side,
        accountNameInRecord: entry[side],
        debit: entry.debit,
        credit: entry.credit,
        metal: targetAccount?.metal ?? null,
        karat: entry.karat ?? targetAccount?.karat ?? null,
        physicalWeight: Number(entry.weight || 0),
        standardizedE21Weight: Number(entry.arabicWeight || 0),
        quantity: Number(entry.count || 0),
        amount: Number(entry.cash || 0),
        sourceCollection: 'entries',
        legacyOrImported: entry.imported === true
          || !!entry.importVersion
          || !!entry.legacyOperationId
          || !!entry.legacyOperationNo,
        importVersion: entry.importVersion ?? null,
        sourceRow: entry.sourceRow ?? null,
        createdAt: timestampValue(entry.createdAt),
      };
    });

  const stableIdsInRuntimeAccounts = accounts.filter(account =>
    account.id && CURRENT_DATASET_INVENTORY_BINDINGS.some(
      binding => binding.inventoryAccountId === account.id,
    )).length;
  const runtimeInventoryAccounts = accounts.filter(account => account.is_inventory);
  const inventoryIdsReferenced = new Set(entries.flatMap(entry => [
    entry.debitAccountId,
    entry.creditAccountId,
  ]).filter((id): id is string =>
    !!id && runtimeInventoryAccounts.some(account => account.id === id)));

  console.log(JSON.stringify({
    mode: 'read_only_no_writes',
    runtime: {
      projectId: required('VITE_FIREBASE_PROJECT_ID'),
      databaseId: databaseId || '(default)',
      adminDataset: isAdmin,
      datasetRecordCount: entries.length,
      accountCatalogCount: accounts.length,
      inventoryAccountCount: runtimeInventoryAccounts.length,
      referencedInventoryAccountCount: inventoryIdsReferenced.size,
      stableInventoryIdsPresentInRuntimeAccounts: stableIdsInRuntimeAccounts,
      costInputRevision: inputRevision,
      costRunStatus: run.status,
      costRunError: run.error ?? null,
      catalogResolvedCount: catalog.byAccountId.size,
      catalogErrors: catalog.errors,
    },
    target: {
      accountId: TARGET_ACCOUNT_ID,
      accountDocumentFound: !!targetAccount,
      rawAccountMetadata: targetAccount ? {
        id: targetAccount.id,
        ...comparableMetadata(targetAccount),
        isActive: targetAccount.isActive ?? null,
      } : null,
      exactSeedCandidate: exactSeedCandidate ?? null,
      fullMetadataMatchesSeed: metadataMatchesSeed,
      operationCount: relatedRecords.length,
      firstDate: relatedRecords[0]?.date ?? null,
      lastDate: relatedRecords.at(-1)?.date ?? null,
      records: relatedRecords,
    },
  }, null, 2));
} finally {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
}
