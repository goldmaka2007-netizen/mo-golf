import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { SEED_ACCOUNTS } from '../src/migrationData';
import type { Entry } from '../src/types';
import { normalizeAccountName } from '../src/lib/accountRegistry';

const PROJECT_ID = 'makka-central-accounting';
const SOURCE_HASH = '0f80dc5a76d43e0c588f02ef4574543aecb6d8825419f31ded1af3de27a37892';
const IMPORT_VERSION = 'csv-2026-07-23-v1';
const root = process.cwd();
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

if (process.env.VITE_FIREBASE_PROJECT_ID !== PROJECT_ID) {
  throw new Error('VITE_FIREBASE_PROJECT_ID mismatch.');
}

const email = process.env.PILOT_IMPORT_EMAIL;
const password = process.env.PILOT_IMPORT_PASSWORD;
const expectedUid = process.env.PILOT_IMPORT_USER_ID;
if (!email || !password || !expectedUid) throw new Error('Verification credentials are missing.');

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}, `post-import-read-verify-${Date.now()}`);
const auth = getAuth(app);
const db = process.env.VITE_FIREBASE_DATABASE_ID?.trim()
  ? getFirestore(app, process.env.VITE_FIREBASE_DATABASE_ID.trim())
  : getFirestore(app);

const accountByName = new Map(SEED_ACCOUNTS.map(account => [normalizeAccountName(account.name), account]));
const classifyMetal = (entry: Entry): 'gold' | 'silver' | 'none' => {
  const accounts = [
    accountByName.get(normalizeAccountName(entry.debit)),
    accountByName.get(normalizeAccountName(entry.credit)),
  ];
  if (accounts.some(account => account?.metal === 'silver' || account?.type === 'silver')) return 'silver';
  if (accounts.some(account => account?.type === 'accessory')) return 'none';
  if (Number(entry.weight) !== 0 || Number(entry.arabicWeight) !== 0) return 'gold';
  return 'none';
};

try {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  if (credential.user.uid !== expectedUid) throw new Error('Authenticated UID mismatch.');

  const snapshot = await getDocs(query(collection(db, 'entries'), where('userId', '==', credential.user.uid)));
  const allEntries = snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Entry);
  const entries = allEntries.filter(entry =>
    entry.imported === true
    && entry.importVersion === IMPORT_VERSION
    && entry.legacySourceHash === SOURCE_HASH);
  const ids = entries.map(entry => entry.id ?? '');
  const typeCounts = Object.fromEntries(
    [...new Set(entries.map(entry => entry.tx))]
      .sort()
      .map(tx => [tx, entries.filter(entry => entry.tx === tx).length]),
  );
  const cashEntries = entries.filter(entry => Number(entry.cash) !== 0);
  const goldEntries = entries.filter(entry => classifyMetal(entry) === 'gold');
  const silverEntries = entries.filter(entry => classifyMetal(entry) === 'silver');
  const brokenAccountReferences = entries.filter(entry =>
    !accountByName.has(normalizeAccountName(entry.debit))
    || !accountByName.has(normalizeAccountName(entry.credit)));
  const invalidLegacyNumbering = entries.filter(entry =>
    entry.seq !== null
    || !entry.legacyOperationId
    || !entry.legacyOperationNo
    || !Number.isSafeInteger(entry.sourceRow)
    || Number(entry.sourceRow) < 2);
  const requiredRenderingFields = ['tx', 'debit', 'credit', 'date', 'cash', 'weight', 'arabicWeight', 'count'] as const;
  const nullOrUndefinedRequiredFields = entries.filter(entry =>
    requiredRenderingFields.some(field => entry[field] === null || entry[field] === undefined));

  const report = {
    status: 'verified_read_only',
    projectId: PROJECT_ID,
    authenticatedUidMatches: true,
    totalOwnedDocumentsRead: allEntries.length,
    importedDocumentsRead: entries.length,
    recordTypeCounts: typeCounts,
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
    duplicateDocumentIds: ids.length - new Set(ids).size,
    brokenAccountReferences: brokenAccountReferences.length,
    invalidLegacyNumbering: invalidLegacyNumbering.length,
    nullOrUndefinedRequiredFields: nullOrUndefinedRequiredFields.length,
    writes: 0,
    deletes: 0,
  };
  fs.writeFileSync(path.join(root, 'post_import_read_verification.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
}
