import type { Account, Entry } from '../types';
import { GOLD_EQUIVALENT_21_CALCULATION_VERSION, GOLD_EQUIVALENT_21_ROUNDING_SCALE } from './goldEquivalent';
import { createDeterministicAuditHash } from './historicalInventoryOverlay';
import { rebuildInventoryCostTimeline, type RebuildInventoryCostOptions } from './inventoryCostEngine';
import type { InventoryCostState, InventoryCostTimeline, Phase5OpeningCostConfig } from './inventoryCostTypes';
import { isOpeningEntry } from './openingEntry';

export const ANNUAL_COST_SNAPSHOT_VERSION = 'annual-cost-snapshot-v1' as const;

export interface AnnualInventoryPoolSnapshot {
  inventoryAccountId: string;
  closingQuantityUnits: number;
  actualWeightUnits: number;
  standard21WeightUnits: number;
  metalCarryingCostMinor: number;
  workmanshipCarryingCostMinor: number;
  accessoryCarryingCostMinor: number;
  derivedWacMinorPerDisplayUnit: number | null;
}

export interface AnnualCostSnapshot {
  snapshotId: string;
  snapshotVersion: typeof ANNUAL_COST_SNAPSHOT_VERSION;
  sourcePeriod: string;
  approvalTimestamp: string;
  approvedBy: string;
  pools: AnnualInventoryPoolSnapshot[];
  auditHash: string;
  status: 'approved' | 'requires_recalculation';
  invalidatedByOperationId?: string;
}

const snapshotPayload = (snapshot: Omit<AnnualCostSnapshot, 'auditHash'> | AnnualCostSnapshot) => {
  const { auditHash: _ignored, ...rest } = snapshot as AnnualCostSnapshot;
  return rest;
};

export const createAnnualCostSnapshot = (
  timeline: InventoryCostTimeline,
  sourcePeriod: string,
  approvalTimestamp: string,
  approvedBy: string,
): AnnualCostSnapshot => {
  if (!/^\d{4}$/.test(sourcePeriod) || !approvalTimestamp || !approvedBy) throw new Error('invalid_snapshot_approval');
  if (!timeline.valid || !timeline.costDataComplete) throw new Error('cost_run_not_eligible_for_annual_snapshot');
  const pools = Object.values(timeline.finalStates).sort((a, b) => a.inventoryAccountId.localeCompare(b.inventoryAccountId)).map((state): AnnualInventoryPoolSnapshot => ({
    inventoryAccountId: state.inventoryAccountId,
    closingQuantityUnits: state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits,
    actualWeightUnits: state.actualPhysicalWeightUnits,
    standard21WeightUnits: state.standardizedQuantityUnits,
    metalCarryingCostMinor: state.remainingMetalCostMinor,
    workmanshipCarryingCostMinor: state.remainingWorkmanshipCostMinor,
    accessoryCarryingCostMinor: state.remainingAccessoryCostMinor,
    derivedWacMinorPerDisplayUnit: state.totalWacMinorPerDisplayUnit,
  }));
  const base: Omit<AnnualCostSnapshot, 'auditHash'> = {
    snapshotId: `cost-close-${sourcePeriod}`,
    snapshotVersion: ANNUAL_COST_SNAPSHOT_VERSION,
    sourcePeriod,
    approvalTimestamp,
    approvedBy,
    pools,
    status: 'approved',
  };
  return { ...base, auditHash: createDeterministicAuditHash(base) };
};

export const validateAnnualCostSnapshot = (snapshot: AnnualCostSnapshot): boolean => {
  if (snapshot.snapshotVersion !== ANNUAL_COST_SNAPSHOT_VERSION || snapshot.status !== 'approved') return false;
  if (snapshot.auditHash !== createDeterministicAuditHash(snapshotPayload(snapshot))) return false;
  return snapshot.pools.every(pool => [
    pool.closingQuantityUnits, pool.actualWeightUnits, pool.standard21WeightUnits,
    pool.metalCarryingCostMinor, pool.workmanshipCarryingCostMinor, pool.accessoryCarryingCostMinor,
  ].every(value => Number.isSafeInteger(value) && value >= 0));
};

const decimal = (units: number, scale: number): string => (units / scale).toFixed(scale === 1000 ? 3 : 2);

export const buildAnnualSnapshotOpeningEntries = (
  snapshot: AnnualCostSnapshot,
  accounts: Account[],
): Entry[] => {
  if (!validateAnnualCostSnapshot(snapshot)) throw new Error('invalid_or_stale_annual_snapshot');
  const openingYear = String(Number(snapshot.sourcePeriod) + 1);
  return snapshot.pools.filter(pool => pool.closingQuantityUnits > 0).map((pool, index) => {
    const account = accounts.find(item => item.id === pool.inventoryAccountId);
    if (!account?.id) throw new Error(`snapshot_account_not_found:${pool.inventoryAccountId}`);
    const accessory = account.type === 'accessory';
    const karat = account.karat && account.karat !== 'silver' ? Number(account.karat) as 18 | 21 | 24 : undefined;
    const physicalWeight = decimal(pool.actualWeightUnits, 100);
    return {
      id: `${snapshot.snapshotId}:${pool.inventoryAccountId}`,
      seq: -(index + 1),
      tx: 'قيد افتتاحي سنوي من لقطة تكلفة معتمدة',
      operationKind: 'opening',
      subTx: `رصيد افتتاحي ${openingYear}`,
      debit: account.name,
      credit: 'رصيد افتتاحي مرحل',
      debitAccountId: account.id,
      date: `${openingYear}-01-01`,
      cash: '0',
      weight: accessory ? '0' : physicalWeight,
      count: accessory ? decimal(pool.closingQuantityUnits, 1000) : '0',
      arabicWeight: accessory ? '0' : decimal(pool.standard21WeightUnits, 100),
      karat,
      notes: `Annual Cost Snapshot ${snapshot.snapshotId}`,
      userId: snapshot.approvedBy,
      goldEquivalent21Snapshot: karat ? {
        physicalWeight,
        physicalWeightUnits: pool.actualWeightUnits,
        karat,
        equivalent21: decimal(pool.standard21WeightUnits, 100),
        equivalent21Units: pool.standard21WeightUnits,
        roundingScale: GOLD_EQUIVALENT_21_ROUNDING_SCALE,
        calculationVersion: GOLD_EQUIVALENT_21_CALCULATION_VERSION,
      } : undefined,
      annualOpeningSnapshot: {
        snapshotId: snapshot.snapshotId,
        auditHash: snapshot.auditHash,
        standardizedQuantityUnits: pool.standard21WeightUnits,
        physicalWeightUnits: pool.actualWeightUnits,
        accessoryQuantityUnits: accessory ? pool.closingQuantityUnits : 0,
        metalCostMinor: pool.metalCarryingCostMinor,
        workmanshipCostMinor: pool.workmanshipCarryingCostMinor,
        accessoryCostMinor: pool.accessoryCarryingCostMinor,
      },
    };
  });
};

export const rebuildInventoryCostFromAnnualSnapshot = (
  allEntries: Entry[],
  accounts: Account[],
  snapshot: AnnualCostSnapshot,
  openingConfig: Phase5OpeningCostConfig = {},
  options: RebuildInventoryCostOptions = {},
): InventoryCostTimeline => {
  const periodEnd = `${snapshot.sourcePeriod}-12-31`;
  const futureEntries = allEntries.filter(entry => entry.date > periodEnd);
  if (futureEntries.some(isOpeningEntry)) throw new Error('duplicate_opening_after_snapshot_seed');
  return rebuildInventoryCostTimeline([
    ...buildAnnualSnapshotOpeningEntries(snapshot, accounts),
    ...futureEntries,
  ], accounts, openingConfig, options);
};

export const annualSnapshotMatchesFullHistory = (
  fullHistory: InventoryCostTimeline,
  snapshotSeeded: InventoryCostTimeline,
): boolean => {
  if (!fullHistory.valid || !snapshotSeeded.valid) return false;
  const compact = (states: Record<string, InventoryCostState>) => Object.fromEntries(Object.entries(states).sort(([a], [b]) => a.localeCompare(b)).map(([id, state]) => [id, {
    standardizedQuantityUnits: state.standardizedQuantityUnits,
    actualPhysicalWeightUnits: state.actualPhysicalWeightUnits,
    accessoryQuantityUnits: state.accessoryQuantityUnits,
    remainingMetalCostMinor: state.remainingMetalCostMinor,
    remainingWorkmanshipCostMinor: state.remainingWorkmanshipCostMinor,
    remainingAccessoryCostMinor: state.remainingAccessoryCostMinor,
  }]));
  return JSON.stringify(compact(fullHistory.finalStates)) === JSON.stringify(compact(snapshotSeeded.finalStates));
};

export const invalidateAnnualSnapshots = (
  snapshots: AnnualCostSnapshot[],
  changedOperation: Pick<Entry, 'id' | 'legacyOperationId' | 'date'>,
): AnnualCostSnapshot[] => snapshots.map(snapshot => snapshot.sourcePeriod >= changedOperation.date.slice(0, 4)
  ? { ...snapshot, status: 'requires_recalculation' as const, invalidatedByOperationId: changedOperation.id || changedOperation.legacyOperationId || 'unknown' }
  : snapshot);