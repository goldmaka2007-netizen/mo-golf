import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, query, where, writeBatch } from 'firebase/firestore';
import type { Account, Entry } from '../src/types';
import { getEntryArabicWeight, resolveMerchantMetalOperationSemantic, type MerchantMetal } from '../src/lib/engine';
import { compareEntriesForPhase5Cost, getPhase5OperationId } from '../src/lib/inventoryCostEngine';
import { applyRuntimeAccountOverride } from '../src/lib/runtimeAccountOverrides';

dotenv.config({ path: path.join(process.cwd(), '.env.local'), quiet: true });
const APPLY = process.argv.includes('--apply');
const EXPECTED_PROJECT = 'makka-central-accounting';
const PRICE_FIELD = 'invoiceOfficialPricePerGramEgp' as const;
const PREVIEW_PATH = path.join(process.cwd(), 'artifacts', 'merchant-metal-price-backfill-preview.json');
const PRICE_DATA_PATH = path.join(process.cwd(), 'scripts', 'data', 'gold-bullion-official-2026.json');
const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const projectId = required('VITE_FIREBASE_PROJECT_ID');
if (projectId !== EXPECTED_PROJECT) throw new Error(`Refusing project ${projectId}; expected ${EXPECTED_PROJECT}`);

interface OfficialPriceRow { date: string; gold21: number; silver999: number }
interface PriceFile { sourceSpreadsheetId: string; sourceTitle: string; sourceSheet: string; readRange: string; verifiedAt: string; rows: OfficialPriceRow[] }
interface PreviewRow {
  documentId: string;
  operationId: string;
  operationDate: string;
  metal: MerchantMetal;
  oldPriceState: string;
  proposedField: typeof PRICE_FIELD;
  proposedPrice: number;
}

const priceFile = JSON.parse(readFileSync(PRICE_DATA_PATH, 'utf8')) as PriceFile;
const priceByDate = new Map(priceFile.rows.map(row => [row.date, row]));
if (priceFile.rows.length !== 221 || priceFile.rows[0]?.date !== '2026-01-01' || priceFile.rows.at(-1)?.date !== '2026-08-09') {
  throw new Error('Official price file does not match the verified 2026-01-01..2026-08-09 range');
}
for (let index = 1; index < priceFile.rows.length; index += 1) {
  const previous = new Date(`${priceFile.rows[index - 1].date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() + 1);
  if (previous.toISOString().slice(0, 10) !== priceFile.rows[index].date) throw new Error(`Price date gap before ${priceFile.rows[index].date}`);
}

const normalize = (value: unknown): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const priceState = (entry: Entry): string => {
  const raw = entry as Entry & Record<string, unknown>;
  const official = raw[PRICE_FIELD];
  if (Number.isFinite(Number(official)) && Number(official) > 0) return `valid:${PRICE_FIELD}:${official}`;
  if (Number.isFinite(Number(entry.marketPrice)) && Number(entry.marketPrice) > 0) return `valid:marketPrice:${entry.marketPrice}`;
  if (!Object.prototype.hasOwnProperty.call(raw, PRICE_FIELD) && !Object.prototype.hasOwnProperty.call(raw, 'marketPrice')) return 'absent';
  if (official === null || entry.marketPrice === null) return 'null';
  if (official === undefined && entry.marketPrice === undefined) return 'undefined';
  return `legacy_placeholder:official=${String(official)};market=${String(entry.marketPrice)}`;
};
const hasValidSavedPrice = (entry: Entry): boolean => priceState(entry).startsWith('valid:');
const quantityUnits = (entry: Entry, metal: MerchantMetal): number => metal === 'silver'
  ? Math.round(Math.abs(Number(entry.weight) || 0) * 100)
  : Math.round(Math.abs(getEntryArabicWeight(entry)) * 100);
const immutablePriceSnapshot = (entry: Entry): Record<string, unknown> => ({
  marketPrice: Object.prototype.hasOwnProperty.call(entry, 'marketPrice') ? entry.marketPrice : '__ABSENT__',
  invoiceOfficialPricePerGramEgp: Object.prototype.hasOwnProperty.call(entry, PRICE_FIELD) ? entry.invoiceOfficialPricePerGramEgp : '__ABSENT__',
});
const hashSnapshots = (entries: Entry[]): string => createHash('sha256')
  .update(JSON.stringify([...entries].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(entry => [entry.id, immutablePriceSnapshot(entry)])))
  .digest('hex');

const buildPreview = (entries: Entry[], rawAccounts: Account[]): PreviewRow[] => {
  const accounts = rawAccounts.map(applyRuntimeAccountOverride);
  const byId = new Map(accounts.flatMap(account => account.id ? [[account.id, account] as const] : []));
  const byName = new Map<string, Account[]>();
  accounts.forEach(account => byName.set(normalize(account.name), [...(byName.get(normalize(account.name)) ?? []), account]));
  const resolve = (entry: Entry, side: 'debit' | 'credit'): Account | undefined => {
    const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
    if (id) return byId.get(id);
    const candidates = byName.get(normalize(side === 'debit' ? entry.debit : entry.credit)) ?? [];
    return candidates.length === 1 ? candidates[0] : undefined;
  };
  const states = new Map<string, number>();
  const accountId = (account?: Account): string | undefined => account?.id ?? (account ? `legacy-name:${normalize(account.name)}` : undefined);
  const preview: PreviewRow[] = [];
  [...entries].sort(compareEntriesForPhase5Cost).forEach(entry => {
    const debit = resolve(entry, 'debit');
    const credit = resolve(entry, 'credit');
    const semantic = resolveMerchantMetalOperationSemantic(entry, debit, credit);
    const metal = semantic.metal;
    if (!metal) return;
    const units = quantityUnits(entry, metal);
    const debitId = accountId(debit);
    const creditId = accountId(credit);
    const debitBefore = debitId ? states.get(debitId) ?? 0 : 0;
    const priceRequired = semantic.kind === 'receipt'
      || (semantic.kind === 'weight_settlement' && debitBefore < units);
    if (priceRequired && !hasValidSavedPrice(entry)) {
      if (semantic.kind === 'opening') throw new Error(`Opening entry ${getPhase5OperationId(entry)} was incorrectly selected`);
      if (!entry.id) throw new Error(`Eligible operation ${getPhase5OperationId(entry)} has no immutable Firestore document ID`);
      const official = priceByDate.get(entry.date);
      if (!official) throw new Error(`No exact-date official price for ${entry.date} (${getPhase5OperationId(entry)})`);
      const proposedPrice = metal === 'gold' ? official.gold21 : official.silver999;
      if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) throw new Error(`Invalid ${metal} price for ${entry.date}`);
      preview.push({
        documentId: entry.id,
        operationId: entry.operationNo ?? entry.legacyOperationNo ?? entry.invoiceNumber ?? getPhase5OperationId(entry),
        operationDate: entry.date,
        metal,
        oldPriceState: priceState(entry),
        proposedField: PRICE_FIELD,
        proposedPrice,
      });
    }
    if (semantic.kind === 'opening') {
      if (creditId && credit?.type === 'merchant') states.set(creditId, (states.get(creditId) ?? 0) + units);
      if (debitId && debit?.type === 'merchant') states.set(debitId, (states.get(debitId) ?? 0) - units);
    } else if (semantic.kind === 'receipt' && creditId) {
      states.set(creditId, (states.get(creditId) ?? 0) + units);
    } else if (semantic.kind === 'weight_settlement' && debitId) {
      states.set(debitId, (states.get(debitId) ?? 0) - units);
    } else if (semantic.kind === 'merchant_transfer' && debitId && creditId) {
      states.set(debitId, (states.get(debitId) ?? 0) - units);
      states.set(creditId, (states.get(creditId) ?? 0) + units);
    }
  });
  return preview;
};

const app = initializeApp({
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId,
  storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: required('VITE_FIREBASE_APP_ID'),
}, `merchant-metal-price-backfill-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const readProduction = async (userId: string): Promise<{ entries: Entry[]; accounts: Account[] }> => {
  const [entrySnapshot, accountSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'entries'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'accounts'), where('userId', '==', userId))),
  ]);
  return {
    entries: entrySnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Entry)),
    accounts: accountSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account)),
  };
};

try {
  const credential = await signInWithEmailAndPassword(auth, required('PILOT_IMPORT_EMAIL'), required('PILOT_IMPORT_PASSWORD'));
  const expectedUid = required('PILOT_IMPORT_USER_ID');
  if (credential.user.uid !== expectedUid) throw new Error('Authenticated UID mismatch');
  const before = await readProduction(expectedUid);
  const preExistingValid = before.entries.filter(hasValidSavedPrice);
  const preExistingValidById = new Map(preExistingValid.map(entry => [entry.id!, immutablePriceSnapshot(entry)]));
  const preExistingValidHash = hashSnapshots(preExistingValid);
  const previewRows = buildPreview(before.entries, before.accounts);
  const preview = {
    mode: APPLY ? 'apply_requested' : 'dry_run',
    projectId,
    databaseId: databaseId || '(default)',
    collection: 'entries',
    targetField: PRICE_FIELD,
    source: {
      spreadsheetId: priceFile.sourceSpreadsheetId,
      title: priceFile.sourceTitle,
      sheet: priceFile.sourceSheet,
      range: priceFile.readRange,
      verifiedAt: priceFile.verifiedAt,
      exactDateOnly: true,
      previousDayFallback: false,
    },
    eligibleMissingCount: previewRows.length,
    preExistingValidPriceCount: preExistingValid.length,
    preExistingValidPriceHash: preExistingValidHash,
    rows: previewRows,
  };
  mkdirSync(path.dirname(PREVIEW_PATH), { recursive: true });
  writeFileSync(PREVIEW_PATH, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...preview, previewPath: PREVIEW_PATH }, null, 2));

  if (APPLY) {
    for (let offset = 0; offset < previewRows.length; offset += 200) {
      const batch = writeBatch(db);
      previewRows.slice(offset, offset + 200).forEach(row => {
        batch.update(doc(db, 'entries', row.documentId), { [PRICE_FIELD]: row.proposedPrice });
      });
      await batch.commit();
    }
    const after = await readProduction(expectedUid);
    const remaining = buildPreview(after.entries, after.accounts);
    const afterById = new Map(after.entries.map(entry => [entry.id!, entry]));
    const changedExisting = [...preExistingValidById].filter(([id, snapshot]) =>
      JSON.stringify(snapshot) !== JSON.stringify(immutablePriceSnapshot(afterById.get(id)!)));
    const afterExistingHash = hashSnapshots([...preExistingValidById.keys()].map(id => afterById.get(id)!));
    if (remaining.length > 0) throw new Error(`${remaining.length} eligible operations remain without price after apply`);
    if (changedExisting.length > 0 || afterExistingHash !== preExistingValidHash) throw new Error('A pre-existing valid price changed');
    console.log(JSON.stringify({
      verification: 'passed',
      rowsChanged: previewRows.length,
      eligibleMissingAfter: remaining.length,
      preExistingValidPricesUnchanged: true,
      preExistingValidPriceHashBefore: preExistingValidHash,
      preExistingValidPriceHashAfter: afterExistingHash,
    }, null, 2));
  }
  await signOut(auth);
} finally {
  await deleteApp(app);
}
