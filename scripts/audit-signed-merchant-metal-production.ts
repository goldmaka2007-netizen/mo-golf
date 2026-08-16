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
import { compareEntriesForPhase5Cost, getPhase5OperationId } from '../src/lib/inventoryCostEngine';

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
  const periodStart = '2026-01-01';
  const periodEnd = '2026-07-20';
  const statements = buildFinancialStatementsEgp(entries, rawAccounts, {
    timeline: inventory,
    incomeStartDate: periodStart,
    incomeEndDate: periodEnd,
    balanceEndDate: periodEnd,
  });
  const signed = (accountId: string, dimension: 'cash' | 'gold' | 'book_value'): number => legs
    .filter(leg => leg.entityId === `merchant:${accountId}` && leg.dimension === dimension)
    .reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0);
  const tx476 = merchant.movements.find(movement =>
    movement.entry.invoiceNumber === 'TX476' || movement.entry.legacyOperationNo === 'TX476');
  const tx1768 = merchant.movements.find(movement =>
    movement.entry.invoiceNumber === 'TX1768' || movement.entry.legacyOperationNo === 'TX1768');
  const tx39 = merchant.movements.find(movement =>
    movement.entry.invoiceNumber === 'TX39' || movement.entry.legacyOperationNo === 'TX39');
  const sortedEntries = [...entries].sort(compareEntriesForPhase5Cost);
  const operationAudit = (movement: typeof tx1768) => {
    if (!movement) return null;
    const index = sortedEntries.findIndex(entry => getPhase5OperationId(entry) === movement.operationId);
    const beforeEntries = sortedEntries.slice(0, index);
    const throughEntries = sortedEntries.slice(0, index + 1);
    const before = buildMerchantMetalPositionTimeline(beforeEntries, accounts, inventory);
    const through = buildMerchantMetalPositionTimeline(throughEntries, accounts, inventory);
    return {
      operationId: movement.operationId,
      invoiceNumber: movement.entry.invoiceNumber ?? movement.entry.legacyOperationNo ?? null,
      date: movement.entry.date,
      savedPrice: {
        invoiceOfficialPricePerGramEgp: movement.entry.invoiceOfficialPricePerGramEgp ?? null,
        marketPrice: movement.entry.marketPrice ?? null,
        karat: movement.entry.karat ?? null,
      },
      quantityUnits: movement.quantityUnits,
      transferInvoiceValueMinor: movement.transferInvoiceValueMinor,
      sourceMerchantAccountId: movement.sourceMerchantAccountId,
      sourceBefore: before.finalStates[movement.sourceMerchantAccountId ?? ''] ?? null,
      sourceAfter: through.finalStates[movement.sourceMerchantAccountId ?? ''] ?? null,
      sourceReleasedQuantityUnits: movement.sourceMerchantReleasedQuantityUnits,
      sourceReleasedValueMinor: movement.sourceMerchantReleasedValueMinor,
      sourceTransferGainMinor: movement.sourceTransferGainMinor,
      sourceTransferLossMinor: movement.sourceTransferLossMinor,
      alSafiBefore: before.finalStates[ids.safy] ?? null,
      alSafiAfter: through.finalStates[ids.safy] ?? null,
      alSafiReleasedQuantityUnits: movement.sourceMerchantAccountId === ids.safy
        ? movement.sourceMerchantReleasedQuantityUnits : movement.destinationMerchantReleasedQuantityUnits,
      alSafiReleasedValueMinor: movement.sourceMerchantAccountId === ids.safy
        ? movement.sourceMerchantReleasedValueMinor : movement.destinationMerchantReleasedValueMinor,
      alSafiCreatedValueMinor: movement.sourceMerchantAccountId === ids.safy
        ? movement.sourceMerchantCreatedValueMinor : movement.destinationMerchantCreatedValueMinor,
      alSafiTransferGainMinor: movement.sourceMerchantAccountId === ids.safy
        ? movement.sourceTransferGainMinor : movement.destinationTransferGainMinor,
      alSafiTransferLossMinor: movement.sourceMerchantAccountId === ids.safy
        ? movement.sourceTransferLossMinor : movement.destinationTransferLossMinor,
      totalTransferGainMinor: movement.transferGainMinor,
      totalTransferLossMinor: movement.transferLossMinor,
      inventoryBookValueReleasedMinor: movement.inventoryBookValueReleasedMinor,
      inventoryBookValueRecognizedMinor: movement.inventoryBookValueRecognizedMinor,
      settlementGainMinor: movement.settlementGainMinor,
      settlementLossMinor: movement.settlementLossMinor,
      diagnostics: merchant.diagnostics.filter(item => item.operationId === movement.operationId),
    };
  };
  const periodMovements = merchant.movements.filter(movement => movement.entry.date >= periodStart && movement.entry.date <= periodEnd);
  const movementTotals = {
    goldSettlementGainMinor: periodMovements.filter(item => item.metal === 'gold').reduce((sum, item) => sum + item.settlementGainMinor, 0),
    goldSettlementLossMinor: periodMovements.filter(item => item.metal === 'gold').reduce((sum, item) => sum + item.settlementLossMinor, 0),
    goldTransferGainMinor: periodMovements.filter(item => item.metal === 'gold').reduce((sum, item) => sum + item.transferGainMinor, 0),
    goldTransferLossMinor: periodMovements.filter(item => item.metal === 'gold').reduce((sum, item) => sum + item.transferLossMinor, 0),
    silverSettlementGainMinor: periodMovements.filter(item => item.metal === 'silver').reduce((sum, item) => sum + item.settlementGainMinor, 0),
    silverSettlementLossMinor: periodMovements.filter(item => item.metal === 'silver').reduce((sum, item) => sum + item.settlementLossMinor, 0),
    silverTransferGainMinor: periodMovements.filter(item => item.metal === 'silver').reduce((sum, item) => sum + item.transferGainMinor, 0),
    silverTransferLossMinor: periodMovements.filter(item => item.metal === 'silver').reduce((sum, item) => sum + item.transferLossMinor, 0),
  };
  const statementAmount = (id: string): number => [
    ...statements.incomeStatement.revenue,
    ...statements.incomeStatement.operatingExpenses,
  ].find(line => line.id === id)?.amount ?? 0;
  const financialProjectionMinor = (id: string, normal: 'debit' | 'credit'): number => Math.round(legs
    .filter(leg => leg.entityId === id && leg.dimension === 'book_value' && leg.date >= periodStart && leg.date <= periodEnd)
    .reduce((sum, leg) => sum + (leg.side === normal ? leg.amount : -leg.amount), 0) * 100);
  const layers = {
    goldSettlementGain: [movementTotals.goldSettlementGainMinor, financialProjectionMinor('system:income:gold-settlement-gain', 'credit'), Math.round(statementAmount('system:income:gold-settlement-gain') * 100)],
    goldSettlementLoss: [movementTotals.goldSettlementLossMinor, financialProjectionMinor('system:income:gold-settlement-loss', 'debit'), Math.round(statementAmount('system:income:gold-settlement-loss') * 100)],
    goldTransferGain: [movementTotals.goldTransferGainMinor, financialProjectionMinor('system:income:gold-transfer-gain', 'credit'), Math.round(statementAmount('system:income:gold-transfer-gain') * 100)],
    goldTransferLoss: [movementTotals.goldTransferLossMinor, financialProjectionMinor('system:income:gold-transfer-loss', 'debit'), Math.round(statementAmount('system:income:gold-transfer-loss') * 100)],
    silverSettlementGain: [movementTotals.silverSettlementGainMinor, financialProjectionMinor('system:income:silver-settlement-gain', 'credit'), Math.round(statementAmount('system:income:silver-settlement-gain') * 100)],
    silverSettlementLoss: [movementTotals.silverSettlementLossMinor, financialProjectionMinor('system:income:silver-settlement-loss', 'debit'), Math.round(statementAmount('system:income:silver-settlement-loss') * 100)],
    silverTransferGain: [movementTotals.silverTransferGainMinor, financialProjectionMinor('system:income:silver-transfer-gain', 'credit'), Math.round(statementAmount('system:income:silver-transfer-gain') * 100)],
    silverTransferLoss: [movementTotals.silverTransferLossMinor, financialProjectionMinor('system:income:silver-transfer-loss', 'debit'), Math.round(statementAmount('system:income:silver-transfer-loss') * 100)],
  };
  const ordinaryHubId = 'audit:al-safi-as-ordinary-merchant';
  const ordinaryEntries = entries.map(entry => ({
    ...entry,
    debitAccountId: entry.debitAccountId === ids.safy ? ordinaryHubId : entry.debitAccountId,
    creditAccountId: entry.creditAccountId === ids.safy ? ordinaryHubId : entry.creditAccountId,
  }));
  const ordinaryRawAccounts = rawAccounts.map(account => account.id === ids.safy ? { ...account, id: ordinaryHubId } : account);
  const ordinaryAccounts = ordinaryRawAccounts.map(applyRuntimeAccountOverride);
  const ordinaryInventory = rebuildRuntimeInventoryCostTimeline(ordinaryEntries, ordinaryRawAccounts, openingConfig);
  const ordinaryMerchant = buildMerchantMetalPositionTimeline(ordinaryEntries, ordinaryAccounts, ordinaryInventory);
  const ordinaryStatements = buildFinancialStatementsEgp(ordinaryEntries, ordinaryRawAccounts, {
    timeline: ordinaryInventory,
    incomeStartDate: periodStart,
    incomeEndDate: periodEnd,
    balanceEndDate: periodEnd,
  });
  const ordinaryStatementAmount = (id: string): number => [
    ...ordinaryStatements.incomeStatement.revenue,
    ...ordinaryStatements.incomeStatement.operatingExpenses,
  ].find(line => line.id === id)?.amount ?? 0;
  const ordinaryOperationAudit = (invoiceNumber: string) => {
    const movement = ordinaryMerchant.movements.find(item =>
      item.entry.invoiceNumber === invoiceNumber || item.entry.legacyOperationNo === invoiceNumber);
    if (!movement) return null;
    const ordered = [...ordinaryEntries].sort(compareEntriesForPhase5Cost);
    const index = ordered.findIndex(entry => getPhase5OperationId(entry) === movement.operationId);
    const before = buildMerchantMetalPositionTimeline(ordered.slice(0, index), ordinaryAccounts, ordinaryInventory);
    const through = buildMerchantMetalPositionTimeline(ordered.slice(0, index + 1), ordinaryAccounts, ordinaryInventory);
    return {
      operationId: movement.operationId,
      quantityUnits: movement.quantityUnits,
      carryingValueMinor: movement.carryingValueMinor,
      beneficiaryReleasedValueMinor: movement.merchantDebitValueMinor,
      alSafiBefore: before.finalStates[ordinaryHubId] ?? null,
      alSafiAfter: through.finalStates[ordinaryHubId] ?? null,
      transferGainMinor: movement.transferGainMinor,
      transferLossMinor: movement.transferLossMinor,
      diagnostics: ordinaryMerchant.diagnostics.filter(item => item.operationId === movement.operationId),
    };
  };
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
    tx476: operationAudit(tx476),
    tx1768: operationAudit(tx1768),
    tx39: tx39 ? { quantityUnits: tx39.quantityUnits, carryingValueMinor: tx39.carryingValueMinor, valuationSource: tx39.valuationSource } : null,
    oldGenericRuleSimulation: {
      tx476: ordinaryOperationAudit('TX476'),
      tx1768: ordinaryOperationAudit('TX1768'),
      incomeStatementEgp: {
        goldSettlementGain: ordinaryStatementAmount('system:income:gold-settlement-gain'),
        goldSettlementLoss: ordinaryStatementAmount('system:income:gold-settlement-loss'),
        silverSettlementGain: ordinaryStatementAmount('system:income:silver-settlement-gain'),
        silverSettlementLoss: ordinaryStatementAmount('system:income:silver-settlement-loss'),
        goldTransferGain: ordinaryStatementAmount('system:income:gold-transfer-gain'),
        goldTransferLoss: ordinaryStatementAmount('system:income:gold-transfer-loss'),
      },
      balanceSheetDifference: ordinaryStatements.balanceSheet.balances.assetsLessLiabilitiesAndEquity,
      diagnostics: ordinaryMerchant.diagnostics,
    },
    balanceSheet: {
      difference: statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity,
      merchantGoldPayables: statements.balanceSheet.liabilities.merchantGold,
      merchantGoldReceivables: statements.balanceSheet.assets.merchantGoldReceivables,
      safyAsset: statements.balanceSheet.assets.merchantReceivableDetails.find(row => row.accountId === ids.safy) ?? null,
      alaaLiability: statements.balanceSheet.liabilities.merchantDetails.find(row => row.accountId === ids.alaa) ?? null,
    },
    historicalPeriod: {
      start: periodStart,
      end: periodEnd,
      movementTotalsMinor: movementTotals,
      incomeStatementEgp: {
        goldSettlementGain: statementAmount('system:income:gold-settlement-gain'),
        goldSettlementLoss: statementAmount('system:income:gold-settlement-loss'),
        goldTransferGain: statementAmount('system:income:gold-transfer-gain'),
        goldTransferLoss: statementAmount('system:income:gold-transfer-loss'),
        silverSettlementGain: statementAmount('system:income:silver-settlement-gain'),
        silverSettlementLoss: statementAmount('system:income:silver-settlement-loss'),
        silverTransferGain: statementAmount('system:income:silver-transfer-gain'),
        silverTransferLoss: statementAmount('system:income:silver-transfer-loss'),
      },
      reconciliationLayersMinor: layers,
      maximumLayerDifferenceMinor: Math.max(...Object.values(layers).flatMap(values => values.map(value => Math.abs(value - values[0])))),
    },
  }, null, 2));
  await signOut(auth);
} finally {
  await deleteApp(app);
}
