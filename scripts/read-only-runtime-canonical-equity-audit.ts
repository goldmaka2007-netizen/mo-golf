import path from 'node:path';
import dotenv from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import type { Account, Entry } from '../src/types';
import { buildAccountRegistry } from '../src/lib/accountRegistry';
import {
  buildCanonicalAccountingLegs,
  buildCanonicalAccountRegistry,
  diagnoseMetalPostings,
  findUnbalancedMetalPostings,
} from '../src/lib/canonicalAccounting';
import { CANONICAL_EQUITY_ACCOUNT_IDS } from '../src/lib/canonicalEquityCatalog';
import { canonicalResolverCatalogV1Runtime } from '../src/lib/canonicalResolverCatalogV1';
import { buildDailyJournalReport } from '../src/lib/dailyJournalReport';

const TARGET_OPERATION_ID = 'csvref-entry-3e1f9b1fe78247341d78529914239bba';
dotenv.config({ path: path.join(process.cwd(), '.env.local'), quiet: true });
const env = (name: string): string => {
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
}, `runtime-canonical-equity-audit-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const rawAccountMetadata = (account: Account | undefined) => account ? ({
  id: account.id,
  name: account.name,
  mainType: account.mainType,
  subType: account.subType,
  balanceNature: account.balanceNature,
  type: account.type ?? null,
  metal: account.metal ?? null,
  karat: account.karat ?? null,
  isInventory: account.is_inventory ?? false,
  isActive: account.isActive ?? true,
}) : null;

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
  const target = entries.find(item => item.id === TARGET_OPERATION_ID);
  if (!target) throw new Error(`Target operation not found: ${TARGET_OPERATION_ID}`);
  const accountRegistry = buildAccountRegistry(accounts, entries);
  const canonicalRegistry = buildCanonicalAccountRegistry(accounts, entries);
  const allLegs = buildCanonicalAccountingLegs(entries, canonicalRegistry);
  const targetLegs = allLegs.filter(leg => leg.sourceEntryId === TARGET_OPERATION_ID);
  const targetMetalDiagnostic = diagnoseMetalPostings(
    [target],
    canonicalRegistry,
    targetLegs,
  );
  const journal = buildDailyJournalReport(entries, accounts, target.date);
  const resolver = canonicalResolverCatalogV1Runtime.resolve(target);
  const sourceSides = [
    { id: target.debitAccountId, name: target.debit },
    { id: target.creditAccountId, name: target.credit },
  ];
  const sourceAccountMatches = sourceSides.map(side => accounts.filter(account =>
    side.id ? account.id === side.id : account.name === side.name));
  const sourceAccounts = sourceAccountMatches.map(matches =>
    matches.length === 1 ? matches[0] : undefined);
  const definitions = sourceSides.map(side =>
    accountRegistry.resolve(side.id, side.name));

  console.log(JSON.stringify({
    mode: 'read_only_no_writes',
    projectId: env('VITE_FIREBASE_PROJECT_ID'),
    databaseId: databaseId || '(default)',
    datasetRecordCount: entries.length,
    accountCatalogCount: accounts.length,
    target: {
      rawEntry: {
        id: target.id,
        tx: target.tx,
        operationKind: target.operationKind ?? null,
        date: target.date,
        invoiceNumber: target.invoiceNumber ?? null,
        debit: target.debit,
        debitAccountId: target.debitAccountId ?? null,
        credit: target.credit,
        creditAccountId: target.creditAccountId ?? null,
        cash: Number(target.cash || 0),
        actualGoldWeight: Number(target.weight || 0),
        equivalent21Weight: Number(target.arabicWeight || 0),
        karat: target.karat ?? null,
        legacyOperationId: target.legacyOperationId ?? null,
        legacyOperationNo: target.legacyOperationNo ?? null,
        imported: target.imported ?? false,
        importVersion: target.importVersion ?? null,
        sourceRow: target.sourceRow ?? null,
        sourceFile: target.sourceFile ?? null,
        legacySourceHash: target.legacySourceHash ?? null,
      },
      rawAccountMatchCounts: sourceAccountMatches.map(matches => matches.length),
      rawAccounts: sourceAccounts.map(rawAccountMetadata),
      canonicalDefinitions: definitions.map(result => result.status === 'resolved' ? ({
        resolvedVia: result.via,
        id: result.account.id,
        sourceAccountId: result.account.sourceAccountId,
        canonicalName: result.account.canonicalName,
        displayName: result.account.displayName,
        legacyNames: result.account.legacyNames,
        mainGroup: result.account.mainGroup,
        entityType: result.account.entityType,
        allowedDimensions: result.account.allowedDimensions,
        metal: result.account.metal,
        karat: result.account.karat,
        trackingMode: result.account.trackingMode,
        normalBalanceByDimension: result.account.normalBalanceByDimension,
        approvalStatus: result.account.approvalStatus,
        classificationConflicts: result.account.classificationConflicts,
      }) : result),
      runtimeLegs: targetLegs.map(leg => ({
        side: leg.side,
        dimension: leg.dimension,
        amount: leg.amount,
        accountId: leg.entity.sourceAccount?.id ?? leg.entityId,
        canonicalName: leg.accountName,
        group: leg.group,
      })),
      metalDiagnostic: targetMetalDiagnostic,
      unbalancedMetalPostings: findUnbalancedMetalPostings([target], targetLegs),
      dailyJournalDiagnostics: journal.diagnostics.entries.filter(
        item => item.id === TARGET_OPERATION_ID,
      ),
      resolverCatalog: resolver.status === 'matched' ? {
        status: resolver.status,
        resolverId: resolver.definition.resolverId,
        approvedVariantId: resolver.definition.approvedVariantId,
        postingStatus: resolver.posting.postingStatus,
        balancingStatus: resolver.posting.balancingStatus,
        goldLedgerLegs: resolver.posting.goldLedgerLegs,
      } : resolver,
    },
    runtimeDiagnostics: {
      canonicalLegDiagnosticCount: journal.diagnostics.entries.length,
      canonicalLegDiagnosticIds: journal.diagnostics.entries.map(item => item.id),
      unbalancedMetalPostingCount: findUnbalancedMetalPostings(entries, allLegs).length,
    },
    approvedStableEquityIds: CANONICAL_EQUITY_ACCOUNT_IDS,
    writes: 0,
    deletes: 0,
    migrations: 0,
  }, null, 2));
} finally {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
}
