import path from 'node:path';
import dotenv from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import type { Account, Entry } from '../src/types';
import { rebuildRuntimeInventoryCostTimeline } from '../src/lib/costRecalculation';
import { buildOpeningCostConfig } from '../src/lib/openingCostConfig';
import { applyRuntimeAccountOverride } from '../src/lib/runtimeAccountOverrides';
import { buildMerchantMetalPositionTimeline } from '../src/lib/merchantGoldLiability';
import { buildLegacyLedgerLegs } from '../src/lib/legacyLedger';
import { buildFinancialStatementsEgp } from '../src/lib/financialStatementsEgp';

dotenv.config({ path: path.join(process.cwd(), '.env.local'), quiet: true });
const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const app = initializeApp({
  apiKey: required('VITE_FIREBASE_API_KEY'), authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'), storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: required('VITE_FIREBASE_MESSAGING_SENDER_ID'), appId: required('VITE_FIREBASE_APP_ID'),
}, `signed-merchant-metal-audit-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const ids = {
  khaled: '3eNdq2apXaOtEDSLhmih', safy: '3zGclNk6qdAuNxM6y5iP',
  alaa: 'CGuSD99FTGDiX3fdfuCc', mohamed: 'kCVuxL6VCfgaWaEGuVO0',
};

try {
  const credential = await signInWithEmailAndPassword(auth, required('PILOT_IMPORT_EMAIL'), required('PILOT_IMPORT_PASSWORD'));
  if (credential.user.uid !== required('PILOT_IMPORT_USER_ID')) throw new Error('UID mismatch');
  const [entrySnapshot, accountSnapshot, settingsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'entries'), where('userId', '==', credential.user.uid))),
    getDocs(query(collection(db, 'accounts'), where('userId', '==', credential.user.uid))),
    getDoc(doc(db, 'settings', credential.user.uid)),
  ]);
  const entries = entrySnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Entry));
  const rawAccounts = accountSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
  const accounts = rawAccounts.map(applyRuntimeAccountOverride);
  const openingConfig = buildOpeningCostConfig(settingsSnapshot.data()?.openingCostConfig ?? [], rawAccounts);
  const inventory = rebuildRuntimeInventoryCostTimeline(entries, rawAccounts, openingConfig);
  const merchant = buildMerchantMetalPositionTimeline(entries, accounts, inventory);
  const legs = buildLegacyLedgerLegs(entries, accounts, [], { enableFinancialProjection: true, costTimeline: inventory });
  const statements = buildFinancialStatementsEgp(entries, rawAccounts, { timeline: inventory, balanceEndDate: '2026-08-09' });
  const signed = (accountId: string, dimension: 'cash' | 'gold' | 'book_value'): number => legs
    .filter(leg => leg.entityId === `merchant:${accountId}` && leg.dimension === dimension)
    .reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0);
  const tx1768 = merchant.movements.find(movement =>
    movement.entry.invoiceNumber === 'TX1768' || movement.entry.legacyOperationNo === 'TX1768');
  const tx39 = merchant.movements.find(movement =>
    movement.entry.invoiceNumber === 'TX39' || movement.entry.legacyOperationNo === 'TX39');
  console.log(JSON.stringify({
    mode: 'read_only',
    inventory: {
      valid: inventory.valid,
      diagnostics: inventory.diagnostics,
      negativeFinalStateCount: Object.values(inventory.finalStates).filter(state =>
        state.standardizedQuantityUnits < 0 || state.actualPhysicalWeightUnits < 0 || state.accessoryQuantityUnits < 0).length,
    },
    merchant: {
      calculationVersion: merchant.calculationVersion,
      diagnostics: merchant.diagnostics,
      khaled: merchant.finalStates[ids.khaled],
      safy: merchant.finalStates[ids.safy],
      alaa: merchant.finalStates[ids.alaa],
      mohamed: merchant.finalStates[ids.mohamed],
    },
    khaledLedger: { cash: signed(ids.khaled, 'cash'), gold: signed(ids.khaled, 'gold'), bookValue: signed(ids.khaled, 'book_value') },
    tx1768: tx1768 ? { quantityUnits: tx1768.quantityUnits, carryingValueMinor: tx1768.carryingValueMinor, inventoryBookValueReleasedMinor: tx1768.inventoryBookValueReleasedMinor, settlementGainMinor: tx1768.settlementGainMinor, settlementLossMinor: tx1768.settlementLossMinor } : null,
    tx39: tx39 ? { quantityUnits: tx39.quantityUnits, carryingValueMinor: tx39.carryingValueMinor, valuationSource: tx39.valuationSource } : null,
    balanceSheet: {
      difference: statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity,
      merchantGoldPayables: statements.balanceSheet.liabilities.merchantGold,
      merchantGoldReceivables: statements.balanceSheet.assets.merchantGoldReceivables,
      safyAsset: statements.balanceSheet.assets.merchantReceivableDetails.find(row => row.accountId === ids.safy) ?? null,
      alaaLiability: statements.balanceSheet.liabilities.merchantDetails.find(row => row.accountId === ids.alaa) ?? null,
    },
  }, null, 2));
  await signOut(auth);
} finally {
  await deleteApp(app);
}
