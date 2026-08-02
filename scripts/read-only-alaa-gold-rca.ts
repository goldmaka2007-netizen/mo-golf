import path from 'node:path';
import dotenv from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import type { Account, Entry } from '../src/types';
import {
  compareBalanceEntries,
  computeAccountBalances,
  computePeriodAccountBalances,
  getEntryArabicWeight,
  getKaratMultiplier,
} from '../src/lib/engine';
import { parseWeight } from '../src/lib/accounting';
import { buildLegacyLedgerLegs } from '../src/lib/legacyLedger';
import { buildLedgerReport } from '../src/lib/ledgerReport';
import { buildTrialBalanceReport } from '../src/lib/trialBalanceReport';
import { buildWeightedPartyBalances } from '../src/lib/scrapAnalysis';
import { buildIncomeStatementReport } from '../src/lib/incomeStatementReport';
import { buildEquityStatementReport } from '../src/lib/equityStatementReport';
import { buildFinancialPositionReport } from '../src/lib/financialPositionReport';

dotenv.config({ path: path.join(process.cwd(), '.env.local'), quiet: true });
const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const included = (entry: Entry): boolean => {
  const raw = entry as Entry & Record<string, unknown>;
  if (raw.isDeleted === true || raw.deleted === true || raw.isVoided === true || raw.voided === true
    || raw.isReversed === true || raw.reversed === true) return false;
  return !['voided', 'deleted', 'reversed', 'excluded', 'invalid']
    .includes(String(raw.status ?? '').toLowerCase());
};
const app = initializeApp({
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: required('VITE_FIREBASE_APP_ID'),
}, 'read-only-alaa-gold-rca');
const auth = getAuth(app);
const db = process.env.VITE_FIREBASE_DATABASE_ID?.trim()
  ? getFirestore(app, process.env.VITE_FIREBASE_DATABASE_ID.trim())
  : getFirestore(app);

try {
  const credential = await signInWithEmailAndPassword(auth, required('PILOT_IMPORT_EMAIL'), required('PILOT_IMPORT_PASSWORD'));
  if (credential.user.uid !== required('PILOT_IMPORT_USER_ID')) throw new Error('UID mismatch');
  const [entrySnapshot, accountSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'entries'), where('userId', '==', credential.user.uid))),
    getDocs(query(collection(db, 'accounts'), where('userId', '==', credential.user.uid))),
  ]);
  const entries = entrySnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Entry)).filter(included);
  const accounts = accountSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
  const alaa = accounts.find(account => account.name === 'علاء صالح');
  if (!alaa?.id) throw new Error('Alaa Saleh account not found');
  const relevant = entries.filter(entry =>
    entry.debitAccountId === alaa.id || entry.creditAccountId === alaa.id
    || (!entry.debitAccountId && entry.debit === alaa.name)
    || (!entry.creditAccountId && entry.credit === alaa.name))
    .sort(compareBalanceEntries);
  const computed = computeAccountBalances(entries, accounts);
  const period = computePeriodAccountBalances(entries, accounts, '0000-01-01', '9999-12-31');
  const engine = computed.balances.get(alaa.id);
  const legacyLegs = buildLegacyLedgerLegs(relevant, accounts)
    .filter(leg => leg.account.sourceAccount?.id === alaa.id && leg.dimension === 'gold');
  let engineCumulative = 0;
  let legacyCumulative = 0;
  const movements = relevant.map(entry => {
    const side = entry.debitAccountId === alaa.id || (!entry.debitAccountId && entry.debit === alaa.name) ? 'debit' : 'credit';
    const sign = side === 'credit' ? 1 : -1;
    const actualWeight = parseWeight(entry.weight);
    const multiplier = getKaratMultiplier(entry.karat);
    const convertedFromActual = actualWeight * multiplier;
    const snapshot = entry.goldEquivalent21Snapshot?.equivalent21Units !== undefined
      ? entry.goldEquivalent21Snapshot.equivalent21Units / 100
      : null;
    const storedArabicWeight = parseWeight(entry.arabicWeight);
    const engineE21 = getEntryArabicWeight(entry, alaa);
    const legacyLeg = legacyLegs.find(leg => leg.sourceEntryId === (entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? '')));
    const legacyAmount = legacyLeg?.amount ?? 0;
    engineCumulative += engineE21 * sign;
    legacyCumulative += legacyAmount * sign;
    return {
      entryId: entry.id,
      operationId: entry.operationNo ?? entry.invoiceNumber ?? entry.legacyOperationId ?? entry.seq,
      date: entry.date,
      operationKind: entry.operationKind ?? entry.tx,
      debit: entry.debit,
      credit: entry.credit,
      side,
      actualWeight,
      karat: entry.karat,
      multiplier,
      convertedFromActual,
      snapshot,
      snapshotKarat: entry.goldEquivalent21Snapshot?.karat ?? null,
      storedArabicWeight,
      engineE21,
      legacyLedgerE21: legacyAmount,
      engineSignedContribution: engineE21 * sign,
      ledgerSignedContribution: engineE21 * sign,
      trialSignedContribution: legacyAmount * sign,
      engineCumulative,
      legacyCumulative,
      cumulativeDelta: legacyCumulative - engineCumulative,
    };
  });
  const trial = buildTrialBalanceReport(period, 'gold');
  const trialRow = trial.groups.flatMap(group => group.rows).find(row => row.entityId === `merchant:${alaa.id}`);
  const ledger = buildLedgerReport(entries, accounts, alaa, 'gold', '0000-01-01', '9999-12-31');
  const merchant = buildWeightedPartyBalances(computed).merchants.find(row => row.accountId === alaa.id);
  const income = buildIncomeStatementReport(computed);
  const equity = buildEquityStatementReport(computed, income);
  const position = buildFinancialPositionReport(computed, equity);
  const balanceSheet = position.gold.liabilities.categories.merchant_gold.details.find(row => row.accountId === alaa.id);
  console.log(JSON.stringify({
    account: alaa,
    stages: {
      rawEntryCount: relevant.length,
      canonicalOrder: relevant.map(entry => entry.id),
      accountBalancesResult: engine,
      accountMovements: computed.movements.get(alaa.id),
      openingRaw: period.opening.balances.get(alaa.id)?.goldE21Balance,
      periodRaw: period.period.balances.get(alaa.id)?.goldE21Balance,
      closingRaw: period.closing.balances.get(alaa.id)?.goldE21Balance,
      trialRaw: trialRow ? trialRow.closingCredit - trialRow.closingDebit : null,
      ledgerRaw: ledger.closingBalance,
      ledgerFinalRunningRaw: ledger.rows.at(-1)?.balance ?? ledger.openingBalance,
      balanceSheetRaw: balanceSheet?.val,
      balanceSheetActualRaw: balanceSheet?.actualVal,
      scrapAnalysisRaw: merchant?.goldE21Balance,
      scrapAnalysisActualRaw: merchant?.actualBalance,
    },
    movements,
    warnings: {
      alaaLegacyNameMatches: computed.legacyNameMatchedEntries.filter(item => item.accountId === alaa.id),
      alaaUnclassified: computed.unclassifiedAccounts.filter(item => item.accountId === alaa.id),
      alaaClassificationConflicts: computed.classificationConflicts.filter(item => item.accountId === alaa.id),
    },
  }, null, 2));
  await signOut(auth);
} finally {
  await deleteApp(app);
}
