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
  areOperationWritesLocked,
  createCostInputRevision,
  executeCostCalculationRun,
} from '../src/lib/costRecalculation';
import { selectCostIntegrity } from '../src/lib/costIntegrity';
import {
  createGoldenResultFingerprint,
  loadPhase5GoldenBaseline,
  runPhase5GoldenDataset,
  summarizeGoldenTimeline,
} from '../src/test-fixtures/phase5GoldenDataset';
import { canonicalResolverCatalogV1 } from '../src/lib/canonicalResolverCatalogV1';
import { APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES } from '../src/lib/historicalInventoryOverlay';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from '../src/lib/inventoryCostCatalog';

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
}, `runtime-cost-verification-${Date.now()}`);
const auth = getAuth(app);
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const economicState = (state: NonNullable<ReturnType<typeof executeCostCalculationRun>['timeline']>['finalStates'][string]) => ({
  standardizedQuantityUnits: state.standardizedQuantityUnits,
  actualPhysicalWeightUnits: state.actualPhysicalWeightUnits,
  accessoryQuantityUnits: state.accessoryQuantityUnits,
  remainingMetalCostMinor: state.remainingMetalCostMinor,
  remainingWorkmanshipCostMinor: state.remainingWorkmanshipCostMinor,
  remainingAccessoryCostMinor: state.remainingAccessoryCostMinor,
  remainingTotalCostMinor: state.remainingTotalCostMinor,
  metalWacMinorPerStandardUnit: state.metalWacMinorPerStandardUnit,
  workmanshipWacMinorPerPhysicalUnit: state.workmanshipWacMinorPerPhysicalUnit,
});

try {
  const credential = await signInWithEmailAndPassword(
    auth,
    env('PILOT_IMPORT_EMAIL'),
    env('PILOT_IMPORT_PASSWORD'),
  );
  if (credential.user.uid !== env('PILOT_IMPORT_USER_ID')) throw new Error('UID mismatch');
  const [entrySnapshot, accountSnapshot, settingsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'entries'), where('userId', '==', credential.user.uid))),
    getDocs(query(collection(db, 'accounts'), where('userId', '==', credential.user.uid))),
    getDoc(doc(db, 'settings', credential.user.uid)),
  ]);
  const entries = entrySnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Entry));
  const accounts = accountSnapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
  const explicitOpeningConfig = buildOpeningCostConfig(
    settingsSnapshot.exists() && Array.isArray(settingsSnapshot.data().openingCostConfig)
      ? settingsSnapshot.data().openingCostConfig
      : [],
    accounts,
  );
  const inputRevision = createCostInputRevision(entries, accounts, explicitOpeningConfig);
  const runtimeRun = executeCostCalculationRun({
    generationId: 1,
    inputRevision,
    entries,
    accounts,
    openingConfig: explicitOpeningConfig,
  });
  if (runtimeRun.status !== 'valid' || !runtimeRun.timeline) {
    throw new Error(JSON.stringify(runtimeRun.error));
  }

  const baseline = loadPhase5GoldenBaseline();
  const golden = runPhase5GoldenDataset(1);
  if (golden.run.status !== 'valid' || !golden.timeline) {
    throw new Error(JSON.stringify(golden.run.error));
  }
  const goldenPassed = golden.inputRevision === baseline.datasetFingerprint
    && createGoldenResultFingerprint(golden.timeline) === baseline.expectedResultFingerprint;
  const integrity = selectCostIntegrity({
    currentRun: runtimeRun,
    currentInputRevision: inputRevision,
    datasetRecordCount: entries.length,
    overlays: APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
    currentBaselineVersion: baseline.baselineVersion,
    goldenRegressionStatus: goldenPassed ? 'passed' : 'failed',
    originalDataHash: entries[0]?.legacySourceHash ?? null,
  });
  const runtimeSummary = summarizeGoldenTimeline(runtimeRun.timeline);
  const goldenSummary = summarizeGoldenTimeline(golden.timeline);
  const accountIds = [...new Set([
    ...Object.keys(runtimeRun.timeline.finalStates),
    ...Object.keys(golden.timeline.finalStates),
  ])].sort();
  const finalBalanceDifferences = accountIds.flatMap(accountId => {
    const runtime = runtimeRun.timeline!.finalStates[accountId];
    const expected = golden.timeline!.finalStates[accountId];
    if (!runtime || !expected) return [{ accountId, runtime: runtime ?? null, golden: expected ?? null }];
    const runtimeEconomic = economicState(runtime);
    const goldenEconomic = economicState(expected);
    return JSON.stringify(runtimeEconomic) === JSON.stringify(goldenEconomic)
      ? []
      : [{ accountId, runtime: runtimeEconomic, golden: goldenEconomic }];
  });
  const runtimeOverlays = runtimeRun.timeline.historicalInventoryOverlays.map(item => ({
    overlayId: item.overlayId,
    quantityUnits: item.quantityUnits,
    auditHash: item.auditHash,
    totalCostMinor: item.totalCostMinor,
  }));
  const goldenOverlays = golden.timeline.historicalInventoryOverlays.map(item => ({
    overlayId: item.overlayId,
    quantityUnits: item.quantityUnits,
    auditHash: item.auditHash,
    totalCostMinor: item.totalCostMinor,
  }));

  console.log(JSON.stringify({
    mode: 'read_only_no_writes',
    runtime: {
      datasetRecordCount: entries.length,
      datasetFingerprint: inputRevision,
      accountCatalogCount: accounts.length,
      inventoryAccountCount: accounts.filter(account => account.is_inventory).length,
      stableCatalogBindingCount: CURRENT_DATASET_INVENTORY_BINDINGS.length,
      phase4CatalogDefinitionCount: canonicalResolverCatalogV1.definitions.length,
      explicitOpeningCostConfigPresent:
        Object.keys(explicitOpeningConfig.gold21PriceByYearMinor ?? {}).length > 0,
      runStatus: runtimeRun.status,
      unknownInventoryAccountCount: runtimeRun.timeline.diagnostics.filter(item =>
        item.code === 'unknown_inventory_account').length,
      summary: runtimeSummary,
      overlays: runtimeOverlays,
    },
    golden: {
      baselineVersion: baseline.baselineVersion,
      datasetRecordCount: baseline.datasetRecordCount,
      datasetFingerprint: baseline.datasetFingerprint,
      regressionPassed: goldenPassed,
      summary: goldenSummary,
      overlays: goldenOverlays,
    },
    parity: {
      cogsDifferenceMinor: runtimeSummary.cogsMinor - goldenSummary.cogsMinor,
      grossProfitDifferenceMinor:
        runtimeSummary.grossProfitMinor - goldenSummary.grossProfitMinor,
      finalBalanceDifferenceCount: finalBalanceDifferences.length,
      finalBalanceDifferences,
      overlaysEqual: JSON.stringify(runtimeOverlays) === JSON.stringify(goldenOverlays),
    },
    integrity,
    reportsBlocked: !integrity.canExposeCurrentCostReports,
    operationsBlocked: areOperationWritesLocked(runtimeRun),
    writes: 0,
    deletes: 0,
  }, null, 2));
} finally {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
}
