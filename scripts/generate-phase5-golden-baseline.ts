/**
 * Deterministic, local-only Phase 5 golden baseline generator.
 *
 * Default mode compares a regenerated sanitized baseline candidate with the
 * approved baseline and writes nothing. Updating the baseline requires an
 * explicit --write command plus owner approval metadata.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  calculatePhase5SourceDatasetSha256,
  createGoldenResultFingerprint,
  runPhase5GoldenDataset,
  summarizeGoldenTimeline,
  type Phase5GoldenBaseline,
} from '../src/test-fixtures/phase5GoldenDataset';
import { HISTORICAL_COST_REVIEW_VERSION } from '../src/lib/historicalCostReview';
import { HISTORICAL_INVENTORY_OVERLAY_VERSION, HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION } from '../src/lib/historicalInventoryOverlay';
import { INVENTORY_COST_TAXONOMY_VERSION } from '../src/lib/inventoryCostCatalog';
import { INVENTORY_COST_CALCULATION_VERSION } from '../src/lib/inventoryCostTypes';

const WRITE_FLAG = '--write';
const REQUIRED_FLAG = '--explicit-owner-approved-change';
const BASELINE_PATH = path.resolve(
  'src/test-fixtures/golden/phase5-cost-baseline-v2-sanitized.json',
);
const FIXTURE_PATH = path.resolve(
  'src/test-fixtures/golden/phase5-cost-fixture-v2-sanitized.json',
);

const argumentValue = (name: string): string => {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1] ?? '';
  const prefix = `${name}=`;
  return process.argv.find(item => item.startsWith(prefix))?.slice(prefix.length) ?? '';
};

const refuse = (message: string): never => {
  console.error(`Golden baseline not written: ${message}`);
  process.exit(1);
};

const sortRecord = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) =>
    left.localeCompare(right),
  ));

const serializeBaseline = (baseline: Phase5GoldenBaseline): string =>
  `${JSON.stringify(baseline, null, 2)}\n`;

const assertSanitizedFixture = (): void => {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    fixtureVersion?: string;
    sanitizationPolicy?: {
      pseudonymousOperationIds?: boolean;
      pseudonymousAccountLabels?: boolean;
      excludedFields?: string[];
    };
  };
  if (fixture.fixtureVersion !== 'phase5-cost-fixture-v2-sanitized') {
    refuse('fixture is not the approved sanitized Phase 5 fixture');
  }
  if (!fixture.sanitizationPolicy?.pseudonymousOperationIds
    || !fixture.sanitizationPolicy?.pseudonymousAccountLabels) {
    refuse('fixture sanitization policy is incomplete');
  }
  const contactPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?20)?0?1[0125][0-9]{8}/gi;
  const contactPaths: string[] = [];
  const walk = (value: unknown, pathParts: string[]): void => {
    if (typeof value === 'string') {
      if (contactPattern.test(value) && pathParts.at(-1) !== 'operationId') {
        contactPaths.push(pathParts.join('.'));
      }
      contactPattern.lastIndex = 0;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...pathParts, `[${index}]`]));
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => walk(item, [...pathParts, key]));
    }
  };
  walk(fixture, []);
  if (contactPaths.length > 0) {
    refuse('fixture contains contact-like values outside sanitized operation ids');
  }
};

const buildCandidateBaseline = (
  current: Phase5GoldenBaseline,
  metadata?: { changeId: string; updateReason: string },
): Phase5GoldenBaseline => {
  const { entries, inputRevision, run, timeline } = runPhase5GoldenDataset(1);
  if (run.status !== 'valid' || !timeline?.valid) refuse('Cost Run is not valid');
  if (timeline.costDataComplete !== true) refuse('Cost Run has unresolved cost data');
  const summary = summarizeGoldenTimeline(timeline);
  if (summary.deficitCount !== 0) refuse(`Cost Run has ${summary.deficitCount} deficit(s)`);
  if (summary.diagnosticCount !== 0) refuse(`Cost Run has ${summary.diagnosticCount} diagnostic(s)`);

  const expectedFinalAccountBalances = sortRecord(Object.fromEntries(
    Object.entries(current.expectedFinalAccountBalances).map(([accountId, old]) => {
      const state = timeline.finalStates[accountId];
      if (!state) refuse(`missing stable account ${accountId}`);
      const quantityUnits = state.unitBasis === 'accessory_milli_piece'
        ? state.accessoryQuantityUnits
        : state.standardizedQuantityUnits;
      return [accountId, {
        accountName: old.accountName,
        quantityUnits,
        unitBasis: state.unitBasis,
        metalWacMinorPerStandardUnit: state.metalWacMinorPerStandardUnit ?? 0,
        workmanshipWacMinorPerPhysicalUnit: state.workmanshipWacMinorPerPhysicalUnit ?? 0,
      }];
    }),
  ));

  const overlayIds = timeline.historicalInventoryOverlays
    .map(item => item.overlayId)
    .sort((left, right) => left.localeCompare(right));
  const overlayById = new Map(timeline.historicalInventoryOverlays.map(item => [
    item.overlayId,
    item,
  ]));

  const next: Phase5GoldenBaseline = {
    ...current,
    datasetRecordCount: entries.length,
    datasetFingerprint: inputRevision,
    sanitizedFixtureSha256: calculatePhase5SourceDatasetSha256(),
    expectedResultFingerprint: createGoldenResultFingerprint(timeline),
    calculationRulesVersion:
      `${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}`
      + `+${HISTORICAL_INVENTORY_OVERLAY_VERSION}`
      + `+${HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION}+${HISTORICAL_COST_REVIEW_VERSION}`,
    approvedOverlayIds: overlayIds,
    approvedOverlayAuditHashes: sortRecord(Object.fromEntries(
      overlayIds.map(id => [id, overlayById.get(id)!.auditHash]),
    )),
    expectedCogsMinor: summary.cogsMinor,
    expectedGrossProfitMinor: summary.grossProfitMinor,
    expectedFinalAccountBalances,
    expectedDeficitCount: summary.deficitCount,
    expectedDiagnosticCount: summary.diagnosticCount,
    expectedOverlayCount: summary.overlayCount,
    expectedOverlayQuantityUnits: summary.overlayQuantityUnits,
    expectedOverlayQuantities: sortRecord(Object.fromEntries(
      overlayIds.map(id => [id, overlayById.get(id)!.quantityUnits]),
    )),
    expectedOverlayWac: sortRecord(Object.fromEntries(
      overlayIds.map(id => {
        const overlay = overlayById.get(id)!;
        return [id, {
          metalWacBefore: overlay.metalWacBefore,
          metalWacAfter: overlay.metalWacAfter,
          workmanshipWacBefore: overlay.workmanshipWacBefore,
          workmanshipWacAfter: overlay.workmanshipWacAfter,
        }];
      }),
    )),
    expectedOrderingDiagnosticCount: timeline.orderingDiagnostics.length,
    expectedChangedOrderingDiagnosticCount:
      timeline.orderingDiagnostics.filter(item => item.changed).length,
    generatedAt: current.generatedAt,
    changeId: metadata?.changeId ?? current.changeId,
    updateReason: metadata?.updateReason ?? current.updateReason,
    explanatoryNote: current.explanatoryNote,
  };
  if (Object.prototype.hasOwnProperty.call(current, 'sourceDatasetSha256')) {
    next.sourceDatasetSha256 = calculatePhase5SourceDatasetSha256();
  } else {
    delete (next as Partial<Phase5GoldenBaseline>).sourceDatasetSha256;
  }
  return next;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

const diffTopLevelKeys = (left: Phase5GoldenBaseline, right: Phase5GoldenBaseline): string[] =>
  Object.keys({ ...left, ...right }).filter(key =>
    stableStringify(left[key as keyof Phase5GoldenBaseline])
      !== stableStringify(right[key as keyof Phase5GoldenBaseline]),
  ).sort((a, b) => a.localeCompare(b));

const writeMode = process.argv.includes(WRITE_FLAG);
if (writeMode && process.env.CI === 'true') refuse('generation is disabled in CI');
if (writeMode && !process.argv.includes(REQUIRED_FLAG)) refuse(`missing ${REQUIRED_FLAG}`);

const updateReason = argumentValue('--reason').trim();
const changeId = argumentValue('--change-id').trim();
if (writeMode && !updateReason) refuse('missing --reason');
if (writeMode && !changeId) refuse('missing --change-id');

assertSanitizedFixture();
const prerequisites = spawnSync(
  'npm run test:golden:prerequisites',
  { cwd: path.resolve('.'), encoding: 'utf8', shell: true, stdio: 'inherit' },
);
if (prerequisites.error) refuse(`could not run prerequisite tests: ${prerequisites.error.message}`);
if (prerequisites.status !== 0) refuse('prerequisite tests failed');

const current = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Phase5GoldenBaseline;
if (current.baselineVersion !== 'phase5-cost-baseline-v2-sanitized') {
  refuse('approved baseline is not the sanitized v2 baseline');
}
const candidate = buildCandidateBaseline(current, writeMode ? { changeId, updateReason } : undefined);
const changedKeys = diffTopLevelKeys(current, candidate);

console.log(JSON.stringify({
  mode: writeMode ? 'explicit_write' : 'compare_only',
  baselinePath: path.relative(process.cwd(), BASELINE_PATH),
  fixturePath: path.relative(process.cwd(), FIXTURE_PATH),
  changedTopLevelKeys: changedKeys,
  summary: {
    datasetRecordCount: candidate.datasetRecordCount,
    expectedCogsMinor: candidate.expectedCogsMinor,
    expectedGrossProfitMinor: candidate.expectedGrossProfitMinor,
    expectedDeficitCount: candidate.expectedDeficitCount,
    expectedDiagnosticCount: candidate.expectedDiagnosticCount,
    expectedOverlayCount: candidate.expectedOverlayCount,
    expectedOverlayQuantityUnits: candidate.expectedOverlayQuantityUnits,
  },
}, null, 2));

if (changedKeys.length === 0) {
  console.log('No baseline changes detected; no file written.');
  process.exit(0);
}
if (!writeMode) {
  refuse('candidate differs from approved baseline; rerun with explicit write flags only after review');
}

writeFileSync(BASELINE_PATH, serializeBaseline(candidate), 'utf8');
console.log(`Golden baseline written: ${path.relative(process.cwd(), BASELINE_PATH)}`);
