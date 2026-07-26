import path from 'node:path';
import dotenv from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import type { Account, Entry } from '../src/types';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from '../src/lib/inventoryCostCatalog';
import { SEED_ACCOUNTS } from '../src/migrationData';

const REPORTED_ID = '09qdBCNEiuO9JxX4N6JnK';
const RUNTIME_ID = '09qdBCNEiu9JxX4N6JnK';
dotenv.config({ path: path.join(process.cwd(), '.env.local'), quiet: true });
const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const app = initializeApp({
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
}, `runtime-account-evidence-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const metadata = (account: Partial<Account>) => ({
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
const seedInventory = SEED_ACCOUNTS.filter(account => account.is_inventory);
const stableByName = new Map(seedInventory.map((account, index) => [
  account.name,
  {
    resolvedStableAccountId: CURRENT_DATASET_INVENTORY_BINDINGS[index].inventoryAccountId,
    taxonomyKey: CURRENT_DATASET_INVENTORY_BINDINGS[index].taxonomyKey,
    seedMetadata: metadata(account as Account),
  },
]));

try {
  const credential = await signInWithEmailAndPassword(
    auth,
    env('PILOT_IMPORT_EMAIL'),
    env('PILOT_IMPORT_PASSWORD'),
  );
  if (credential.user.uid !== env('PILOT_IMPORT_USER_ID')) throw new Error('UID mismatch');
  const [entrySnapshot, accountSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'entries'), where('userId', '==', credential.user.uid))),
    getDocs(query(collection(db, 'accounts'), where('userId', '==', credential.user.uid))),
  ]);
  const entries = entrySnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Entry));
  const accounts = accountSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
  const inventoryAccounts = accounts.filter(account => account.is_inventory);
  const aliases = inventoryAccounts.map(account => {
    const candidate = stableByName.get(account.name);
    const actualMetadata = metadata(account);
    const fullMetadataMatchesSeed = !!candidate
      && JSON.stringify(actualMetadata) === JSON.stringify(candidate.seedMetadata);
    const nameReferences = entries.filter(entry =>
      entry.debit === account.name || entry.credit === account.name);
    const idReferences = entries.filter(entry =>
      entry.debitAccountId === account.id || entry.creditAccountId === account.id);
    return {
      legacyAccountId: account.id,
      resolvedStableAccountId: candidate?.resolvedStableAccountId ?? null,
      resolvedAccountName: account.name,
      taxonomyKey: candidate?.taxonomyKey ?? null,
      fullMetadataMatchesSeed,
      rawAccountMetadata: actualMetadata,
      evidence: {
        seedMetadata: candidate?.seedMetadata ?? null,
        nameReferenceCount: nameReferences.length,
        directIdReferenceCount: idReferences.length,
        importVersions: [...new Set(nameReferences.map(entry => entry.importVersion).filter(Boolean))],
      },
    };
  });
  const targetAccount = inventoryAccounts.find(account => account.id === RUNTIME_ID);
  const targetRecords = targetAccount ? entries.filter(entry =>
    entry.debit === targetAccount.name || entry.credit === targetAccount.name
    || entry.debitAccountId === RUNTIME_ID || entry.creditAccountId === RUNTIME_ID)
    .sort((left, right) => left.date.localeCompare(right.date)
      || Number(left.sourceRow ?? 0) - Number(right.sourceRow ?? 0))
    .map(entry => {
      const side = entry.debit === targetAccount.name || entry.debitAccountId === RUNTIME_ID
        ? 'debit' as const : 'credit' as const;
      return {
        operationId: entry.id ?? null,
        operationNo: entry.legacyOperationNo ?? null,
        date: entry.date,
        operationType: entry.tx,
        operationKind: entry.operationKind ?? null,
        side,
        accountNameInRecord: entry[side],
        debit: entry.debit,
        credit: entry.credit,
        metal: targetAccount.metal ?? null,
        karat: entry.karat ?? targetAccount.karat ?? null,
        physicalWeight: Number(entry.weight || 0),
        standardizedE21Weight: Number(entry.arabicWeight || 0),
        quantity: Number(entry.count || 0),
        amount: Number(entry.cash || 0),
        sourceCollection: 'entries',
        legacyOrImported: entry.imported === true || !!entry.importVersion,
        importVersion: entry.importVersion ?? null,
        sourceRow: entry.sourceRow ?? null,
      };
    }) : [];
  const inventorySides = entries.flatMap(entry => [
    { name: entry.debit, id: entry.debitAccountId },
    { name: entry.credit, id: entry.creditAccountId },
  ]).filter(side => inventoryAccounts.some(account => account.name === side.name));

  console.log(JSON.stringify({
    mode: 'read_only_no_writes',
    datasetRecordCount: entries.length,
    accountCatalogCount: accounts.length,
    inventoryAccountCount: inventoryAccounts.length,
    approvedAliasCandidateCount: aliases.filter(alias =>
      alias.fullMetadataMatchesSeed && alias.resolvedStableAccountId).length,
    inventoryOperationSideCount: inventorySides.length,
    inventoryOperationSidesWithId: inventorySides.filter(side => !!side.id).length,
    inventoryOperationSidesWithoutId: inventorySides.filter(side => !side.id).length,
    aliases,
    target: {
      reportedAccountId: REPORTED_ID,
      runtimeAccountId: RUNTIME_ID,
      reportedIdMatchesRuntime: String(REPORTED_ID) === String(RUNTIME_ID),
      accountFound: !!targetAccount,
      operationCount: targetRecords.length,
      firstDate: targetRecords[0]?.date ?? null,
      lastDate: targetRecords.at(-1)?.date ?? null,
      records: targetRecords,
    },
  }, null, 2));
} finally {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
}
