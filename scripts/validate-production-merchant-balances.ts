import path from 'node:path';
import dotenv from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import type { Account, Entry } from '../src/types';
import { computeAccountBalances, getEntryArabicWeight, parseCash } from '../src/lib/engine';
import { parseWeight } from '../src/lib/accounting';
import { clearLegacyNatureFallbackWarnings, getDynamicAccountNature, getLegacyNatureFallbackWarnings } from '../src/utils/accountLogic';
import { getUnclassifiedLedgerAccounts } from '../src/lib/ledgerReport';

dotenv.config({ path: path.join(process.cwd(), '.env.local'), quiet: true });
const required = (name: string): string => { const value = process.env[name]?.trim(); if (!value) throw new Error(`Missing ${name}`); return value; };
const app = initializeApp({ apiKey: required('VITE_FIREBASE_API_KEY'), authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'), projectId: required('VITE_FIREBASE_PROJECT_ID'), storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET'), messagingSenderId: required('VITE_FIREBASE_MESSAGING_SENDER_ID'), appId: required('VITE_FIREBASE_APP_ID') }, 'balance-production-validation');
const auth = getAuth(app);
const db = process.env.VITE_FIREBASE_DATABASE_ID?.trim() ? getFirestore(app, process.env.VITE_FIREBASE_DATABASE_ID!.trim()) : getFirestore(app);
const included = (entry: Entry): boolean => {
  const raw = entry as Entry & Record<string, unknown>;
  if (raw.isDeleted === true || raw.deleted === true || raw.isVoided === true || raw.voided === true || raw.isReversed === true || raw.reversed === true) return false;
  return !['voided', 'deleted', 'reversed', 'excluded', 'invalid'].includes(String(raw.status ?? '').toLowerCase());
};
try {
  const credential = await signInWithEmailAndPassword(auth, required('PILOT_IMPORT_EMAIL'), required('PILOT_IMPORT_PASSWORD'));
  if (credential.user.uid !== required('PILOT_IMPORT_USER_ID')) throw new Error('UID mismatch');
  const [entrySnapshot, accountSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'entries'), where('userId', '==', credential.user.uid))),
    getDocs(query(collection(db, 'accounts'), where('userId', '==', credential.user.uid))),
  ]);
  const entries = entrySnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Entry)).filter(included);
  const accounts = accountSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
  const computed = computeAccountBalances(entries, accounts);
  clearLegacyNatureFallbackWarnings();
  accounts.forEach(account => getDynamicAccountNature(account.name, accounts, account.id));
  const legacyNatureFallbacks = getLegacyNatureFallbackWarnings();
  const unclassifiedLedgerAccounts = getUnclassifiedLedgerAccounts(accounts);
  const merchants = accounts.filter(account => account.type === 'merchant').filter(account => entries.some(entry => entry.debitAccountId === account.id || entry.creditAccountId === account.id || (!entry.debitAccountId && entry.debit === account.name) || (!entry.creditAccountId && entry.credit === account.name))).sort((a, b) => (a.id ?? a.name).localeCompare(b.id ?? b.name)).slice(0, 3);
  if (merchants.length < 3) throw new Error(`Only ${merchants.length} merchant accounts with movements were available`);
  const results = merchants.map(account => {
    const direction = account.merchantDirection ?? ((account.canonicalMainType ?? account.mainType).toLowerCase().includes('asset') ? 'receivable' : 'payable');
    const debitSign = direction === 'receivable' ? 1 : -1;
    let cash = 0; let actual = 0; let equivalent21 = 0; let silver = 0; let operations = 0;
    for (const entry of entries) {
      const debit = entry.debitAccountId ? entry.debitAccountId === account.id : entry.debit === account.name;
      const credit = entry.creditAccountId ? entry.creditAccountId === account.id : entry.credit === account.name;
      if (!debit && !credit) continue;
      operations += 1;
      const sign = debit ? debitSign : -debitSign;
      cash += parseCash(entry) * sign;
      if (account.metal === 'gold') { actual += parseWeight(entry.weight) * sign; equivalent21 += getEntryArabicWeight(entry, account) * sign; }
      if (account.metal === 'silver') silver += parseWeight(entry.weight) * sign;
    }
    const engine = computed.balances.get(account.id!);
    const deltas = { cash: (engine?.cashBalance ?? 0) - cash, actual: (engine?.goldActualBalance ?? 0) - actual, equivalent21: (engine?.goldE21Balance ?? 0) - equivalent21, silver: (engine?.silverBalance ?? 0) - silver };
    return { accountId: account.id, accountName: account.name, operations, direction, manual: { cash, actual, equivalent21, silver }, engine: { cash: engine?.cashBalance ?? 0, actual: engine?.goldActualBalance ?? 0, equivalent21: engine?.goldE21Balance ?? 0, silver: engine?.silverBalance ?? 0 }, deltas, matched: Object.values(deltas).every(value => Math.abs(value) <= 1e-8) };
  });
  console.log(JSON.stringify({
    balanceEngineVersion: computed.balanceEngineVersion,
    merchantCount: results.length,
    matchedCount: results.filter(item => item.matched).length,
    legacyNatureFallbackCount: legacyNatureFallbacks.length,
    legacyNatureFallbacks,
    unclassifiedLedgerAccountCount: unclassifiedLedgerAccounts.length,
    unclassifiedLedgerAccounts,
    results,
  }, null, 2));
  if (results.some(item => !item.matched)) process.exitCode = 1;
  await signOut(auth);
} finally {
  await deleteApp(app);
}
