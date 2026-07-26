import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Account, Entry } from '../types';
import {
  createCostInputRevision,
  executeCostCalculationRun,
} from '../lib/costRecalculation';
import type {
  CostCalculationRun,
  InventoryCostTimeline,
  Phase5OpeningCostConfig,
} from '../lib/inventoryCostTypes';

export interface Phase5GoldenBaseline {
  baselineVersion: string;
  previousBaselineVersion?: string;
  fixtureVersion?: string;
  datasetRecordCount: number;
  datasetFingerprint: string;
  sanitizedFixtureSha256?: string;
  /** Compatibility alias; v2 hashes the sanitized fixture, never the raw CSV. */
  sourceDatasetSha256: string;
  expectedResultFingerprint: string;
  calculationRulesVersion: string;
  approvedOverlayIds: string[];
  approvedOverlayAuditHashes: Record<string, string>;
  expectedCogsMinor: number;
  expectedGrossProfitMinor: number;
  expectedFinalAccountBalances: Record<string, {
    accountName: string;
    quantityUnits: number;
    unitBasis: string;
    metalWacMinorPerStandardUnit: number;
    workmanshipWacMinorPerPhysicalUnit: number;
  }>;
  expectedDeficitCount: number;
  expectedDiagnosticCount: number;
  expectedOverlayCount: number;
  expectedOverlayQuantityUnits: number;
  expectedOverlayQuantities: Record<string, number>;
  expectedOverlayWac: Record<string, {
    metalWacBefore: number;
    metalWacAfter: number;
    workmanshipWacBefore: number;
    workmanshipWacAfter: number;
  }>;
  expectedOrderingDiagnosticCount: number;
  expectedChangedOrderingDiagnosticCount: number;
  precisionPolicy: {
    moneyMinorUnits: 'exact_integer';
    decimalMoneyToleranceEgp: number;
    scaledQuantityUnits: 'exact_integer';
    decimalQuantityToleranceGrams: number;
    wacMinorPerScaledUnitTolerance: number;
  };
  generatedAt: string;
  changeId: string;
  updateReason: string;
  explanatoryNote: string;
  transitionProof?: Record<string, unknown>;
}

interface SanitizedGoldenAccount {
  id: string;
  name: string;
  type: Account['type'];
  metal: Account['metal'];
  karat: Account['karat'];
  is_inventory: true;
  quantityStep?: number;
}

interface SanitizedGoldenEntry {
  operationId: string;
  date: string;
  operationKind: Entry['operationKind'];
  operationType: string;
  debitAccountId: string;
  creditAccountId: string;
  debitLabel: string;
  creditLabel: string;
  physicalWeightUnits: number;
  standardizedQuantityUnits: number;
  quantityUnits: number;
  cashAmountMinor: number;
  workmanshipAmountMinor: number;
  karat: number | null;
  sourceOrder: number;
  legacyImported: true;
}

interface SanitizedGoldenFixture {
  fixtureVersion: 'phase5-cost-fixture-v2-sanitized';
  datasetRecordCount: number;
  sanitizationPolicy: {
    pseudonymousOperationIds: boolean;
    pseudonymousAccountLabels: boolean;
    excludedFields: string[];
  };
  accounts: SanitizedGoldenAccount[];
  entries: SanitizedGoldenEntry[];
  openingConfig: Phase5OpeningCostConfig;
}

const fixtureUrl = new URL(
  './golden/phase5-cost-fixture-v2-sanitized.json',
  import.meta.url,
);

const loadSanitizedFixture = (): SanitizedGoldenFixture =>
  JSON.parse(readFileSync(fixtureUrl, 'utf8')) as SanitizedGoldenFixture;

export const loadPhase5GoldenBaseline = (): Phase5GoldenBaseline => {
  const baseline = JSON.parse(readFileSync(
    new URL('./golden/phase5-cost-baseline-v2-sanitized.json', import.meta.url),
    'utf8',
  )) as Omit<Phase5GoldenBaseline, 'sourceDatasetSha256'> & {
    sourceDatasetSha256?: string;
  };
  return {
    ...baseline,
    sourceDatasetSha256:
      baseline.sourceDatasetSha256 ?? baseline.sanitizedFixtureSha256 ?? '',
  };
};

export const calculatePhase5SourceDatasetSha256 = (): string =>
  createHash('sha256').update(readFileSync(fixtureUrl)).digest('hex');

export const loadPhase5GoldenDataset = (): {
  entries: Entry[];
  accounts: Account[];
  openingConfig: Phase5OpeningCostConfig;
} => {
  const fixture = loadSanitizedFixture();
  if (fixture.entries.length !== fixture.datasetRecordCount) {
    throw new Error(
      `Sanitized Phase 5 fixture count mismatch: ${fixture.entries.length}`
      + ` != ${fixture.datasetRecordCount}`,
    );
  }
  const accounts = fixture.accounts.map(account => ({
    ...account,
    userId: 'phase5-golden-sanitized',
  })) as Account[];
  const entries = fixture.entries.map(item => ({
    id: item.operationId,
    date: item.date,
    operationKind: item.operationKind,
    tx: item.operationType,
    debitAccountId: item.debitAccountId,
    creditAccountId: item.creditAccountId,
    debit: item.debitLabel,
    credit: item.creditLabel,
    weight: String(item.physicalWeightUnits / 100),
    arabicWeight: String(item.standardizedQuantityUnits / 100),
    count: String(item.quantityUnits / 1000),
    cash: String(
      (item.cashAmountMinor + item.workmanshipAmountMinor) / 100,
    ),
    karat: item.karat ?? undefined,
    sourceRow: item.sourceOrder,
    imported: item.legacyImported,
  })) as Entry[];
  return { entries, accounts, openingConfig: fixture.openingConfig };
};

export const runPhase5GoldenDataset = (generationId = 1): {
  entries: Entry[];
  accounts: Account[];
  openingConfig: Phase5OpeningCostConfig;
  inputRevision: string;
  run: CostCalculationRun;
  timeline?: InventoryCostTimeline;
} => {
  const { entries, accounts, openingConfig } = loadPhase5GoldenDataset();
  const inputRevision = createCostInputRevision(entries, accounts, openingConfig);
  const run = executeCostCalculationRun({
    generationId,
    inputRevision,
    entries,
    accounts,
    openingConfig,
  });
  return { entries, accounts, openingConfig, inputRevision, run, timeline: run.timeline };
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

export const createGoldenResultFingerprint = (
  timeline: InventoryCostTimeline,
): string => createHash('sha256').update(stableStringify({
  orderedOperationIds: timeline.orderedOperationIds,
  results: timeline.results.map(({ entry: _sourceEntry, ...result }) => result),
  finalStates: timeline.finalStates,
  orderingDiagnostics: timeline.orderingDiagnostics,
  overlays: timeline.historicalInventoryOverlays.map(({
    calculationGenerationId: _runtimeGeneration,
    ...overlay
  }) => overlay),
})).digest('hex');

export const summarizeGoldenTimeline = (timeline: InventoryCostTimeline) => {
  const sales = timeline.results.filter(result => result.classification === 'sale');
  return {
    cogsMinor: sales.reduce((sum, result) => sum + result.totalCogsMinor, 0),
    grossProfitMinor: sales.reduce((sum, result) => sum + (result.profitMinor ?? 0), 0),
    deficitCount: timeline.diagnostics.filter(item =>
      item.code === 'insufficient_inventory').length,
    diagnosticCount: timeline.diagnostics.length,
    overlayCount: timeline.historicalInventoryOverlays.length,
    overlayQuantityUnits: timeline.historicalInventoryOverlays
      .reduce((sum, overlay) => sum + overlay.quantityUnits, 0),
  };
};
