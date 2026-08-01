import type { Account, Entry } from '../types';
import {
  isHistoricalOverlayActive,
  sealAppliedHistoricalInventoryOverlay,
  type HistoricalMerchantLiabilityOpeningDirective,
} from './historicalInventoryOverlay';
import { normalizeNumerals } from './accounting';
import {
  buildInventoryRuntimeCatalog,
  INVENTORY_COST_TAXONOMY_VERSION,
  type InventoryRuntimeCatalog,
} from './inventoryCostCatalog';
import {
  INVENTORY_COST_CALCULATION_VERSION,
  type AppliedHistoricalInventoryOverlay,
  type HistoricalInventoryOverlayDirective,
  type InventoryCostDiagnostic,
  type LegacySameDayOrderingDiagnostic,
  type InventoryCostOperationClassification,
  type InventoryCostState,
  type InventoryCostTimeline,
  type InventoryRuntimeBinding,
  type OperationCostResultV2,
  type Phase5OpeningCostConfig,
  type ResolvedInventoryAccount,
} from './inventoryCostTypes';
import {
  calculateGoldEquivalent21,
  canCalculateGoldEquivalent21,
  type SupportedGoldKarat,
} from './goldEquivalent';
import { isOpeningEntry } from './openingEntry';
import { calculateMerchantInvoiceMetalValueMinor } from './merchantInvoiceValuation';

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const ACCESSORY_SCALE = 1000;
const GRAM_SCALE = 100;

class CostEngineError extends Error {
  constructor(
    readonly diagnostic: InventoryCostDiagnostic,
  ) {
    super(diagnostic.message);
  }
}

const fail = (
  code: InventoryCostDiagnostic['code'],
  message: string,
  entry?: Entry,
  inventoryAccountId?: string,
): never => {
  throw new CostEngineError({
    code,
    message,
    operationId: entry ? getPhase5OperationId(entry) : undefined,
    inventoryAccountId,
  });
};

const toSafeInteger = (value: bigint, label: string, entry?: Entry): number => {
  if (value < 0n || value > MAX_SAFE_BIGINT) {
    fail('invalid_amount', `${label} exceeds safe integer bounds`, entry);
  }
  return Number(value);
};

const roundDivide = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= 0n) throw new Error('division_by_zero');
  return (numerator + denominator / 2n) / denominator;
};

const proportionalCost = (
  totalCostMinor: number,
  outgoingUnits: number,
  availableUnits: number,
  entry: Entry,
  label: string,
): number => {
  if (outgoingUnits === availableUnits) return totalCostMinor;
  return toSafeInteger(
    roundDivide(BigInt(totalCostMinor) * BigInt(outgoingUnits), BigInt(availableUnits)),
    label,
    entry,
  );
};

const parseScaledDecimal = (
  value: string | number | undefined,
  scale: number,
  maxDecimals: number,
  label: string,
  entry: Entry,
  allowZero: boolean,
  allowLegacyFloatNoise = false,
): number => {
  const normalized = normalizeNumerals(String(value ?? '')).trim();
  const strictPattern = new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`);
  if (strictPattern.test(normalized)) {
    const [whole, fraction = ''] = normalized.split('.');
    const units = BigInt(whole) * BigInt(scale)
      + BigInt(fraction.padEnd(maxDecimals, '0'));
    if (!allowZero && units === 0n) fail('invalid_quantity', `${label} must be positive`, entry);
    return toSafeInteger(units, label, entry);
  }
  if (allowLegacyFloatNoise && isLegacyEntry(entry)) {
    const numeric = Number(normalized);
    if (Number.isFinite(numeric) && numeric >= 0) {
      const units = Math.round(numeric * scale);
      if (!allowZero && units === 0) fail('invalid_quantity', `${label} must be positive`, entry);
      if (Number.isSafeInteger(units)) return units;
    }
  }
  fail('invalid_quantity', `${label} is not a valid decimal`, entry);
};

const parseMoneyMinor = (
  value: string | number | undefined,
  entry: Entry,
  allowZero: boolean,
): number => {
  const normalized = normalizeNumerals(String(value ?? '')).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    fail('invalid_amount', 'Cost amount must be a finite non-negative EGP value', entry);
  }
  const [whole, fraction = ''] = normalized.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (!allowZero && minor === 0n) fail('invalid_amount', 'Cost amount must be greater than zero', entry);
  return toSafeInteger(minor, 'money minor units', entry);
};

const parseConfigMinor = (
  value: number | string | undefined,
  label: string,
  entry?: Entry,
): number => {
  if (value === undefined || value === '') {
    fail('missing_opening_cost', `Missing ${label}`, entry);
  }
  const normalized = normalizeNumerals(String(value)).trim();
  if (!/^\d+$/.test(normalized)) {
    fail('invalid_opening_cost', `${label} must be stored as integer minor units`, entry);
  }
  const parsed = BigInt(normalized);
  if (parsed <= 0n) fail('invalid_opening_cost', `${label} must be greater than zero`, entry);
  return toSafeInteger(parsed, label, entry);
};

const isLegacyEntry = (entry: Entry): boolean =>
  entry.imported === true || !!entry.importVersion || !!entry.legacyOperationId || !!entry.legacyOperationNo;

export const getPhase5OperationId = (entry: Entry): string =>
  String(entry.id || entry.legacyOperationId || entry.legacyOperationNo || entry.seq || '');

const createdAtComparable = (entry: Entry): string => {
  const value: any = entry.createdAt;
  if (!value) return '';
  if (value instanceof Date) return String(value.getTime()).padStart(16, '0');
  if (typeof value === 'number') return String(value).padStart(16, '0');
  if (typeof value === 'string') return value;
  if (typeof value.seconds === 'number') {
    return `${String(value.seconds).padStart(12, '0')}.${String(value.nanoseconds ?? 0).padStart(9, '0')}`;
  }
  if (typeof value.toMillis === 'function') return String(value.toMillis()).padStart(16, '0');
  return '';
};

const orderingNumber = (entry: Entry): number => {
  const candidates = [
    (entry as Entry & { operationNo?: unknown }).operationNo,
    (entry as Entry & { journalNo?: unknown }).journalNo,
    entry.seq,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeNumerals(String(candidate ?? '')).trim();
    if (/^\d+$/.test(normalized)) {
      const parsed = Number(normalized);
      if (Number.isSafeInteger(parsed)) return parsed;
    }
  }
  const sourceRow = Number(normalizeNumerals(String(entry.sourceRow ?? '')).trim());
  if (Number.isSafeInteger(sourceRow) && sourceRow > 0) {
    // The approved legacy CSV is exported newest-first. Within one effective
    // date, larger source rows therefore represent earlier journal activity.
    return -sourceRow;
  }
  const legacy = normalizeNumerals(String(entry.legacyOperationNo ?? '')).trim();
  const match = legacy.match(/(\d+)$/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return Number.MAX_SAFE_INTEGER;
};

const compareText = (left: string, right: string): number => left === right ? 0 : left < right ? -1 : 1;

export const compareEntriesForPhase5Cost = (left: Entry, right: Entry): number => {
  const date = compareText(left.date, right.date);
  if (date !== 0) return date;
  // Opening layers are effective at the start of their date. This is an
  // explicit accounting order, required because the approved legacy export
  // has no seq and its source rows are not guaranteed to place openings first.
  const openingOrder = Number(isOpeningEntry(right)) - Number(isOpeningEntry(left));
  if (openingOrder !== 0) return openingOrder;
  const order = orderingNumber(left) - orderingNumber(right);
  if (order !== 0) return order;
  const created = compareText(createdAtComparable(left), createdAtComparable(right));
  if (created !== 0) return created;
  return compareText(getPhase5OperationId(left), getPhase5OperationId(right));
};

const validateOrdering = (entries: Entry[]): void => {
  const seen = new Set<string>();
  for (const entry of entries) {
    const operationId = getPhase5OperationId(entry);
    if (!operationId) fail('invalid_ordering', 'Cost-relevant operation is missing a stable ID', entry);
    if (seen.has(operationId)) fail('duplicate_operation', `Duplicate operation: ${operationId}`, entry);
    seen.add(operationId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) {
      fail('invalid_ordering', `Invalid operation date for ${operationId}`, entry);
    }
  }
};

const emptyState = (account: ResolvedInventoryAccount): InventoryCostState => ({
  inventoryAccountId: account.inventoryAccountId,
  taxonomyKey: account.taxonomyKey,
  displayName: account.displayName,
  kind: account.kind,
  unitBasis: account.unitBasis,
  dimension: account.dimension,
  costingMethod: account.costingMethod,
  valuationStatus: 'empty-uninitialized',
  standardizedQuantityUnits: 0,
  actualPhysicalWeightUnits: 0,
  accessoryQuantityUnits: 0,
  pendingStandardizedQuantityUnits: 0,
  pendingActualPhysicalWeightUnits: 0,
  pendingAccessoryQuantityUnits: 0,
  remainingMetalCostMinor: 0,
  remainingWorkmanshipCostMinor: 0,
  remainingAccessoryCostMinor: 0,
  remainingTotalCostMinor: 0,
  metalWacMinorPerStandardUnit: null,
  workmanshipWacMinorPerPhysicalUnit: null,
  totalWacMinorPerDisplayUnit: null,
  hasReliableCostBasis: false,
  lastKnownMetalCostMinor: 0,
  lastKnownStandardizedQuantityUnits: 0,
  lastKnownWorkmanshipCostMinor: 0,
  lastKnownPhysicalQuantityUnits: 0,
  lastKnownAccessoryCostMinor: 0,
  lastKnownAccessoryQuantityUnits: 0,
  calculationVersion: INVENTORY_COST_CALCULATION_VERSION,
});

const updateDerivedState = (state: InventoryCostState): void => {
  const primaryQuantity = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  state.valuationStatus = primaryQuantity === 0
    ? (state.lastProcessedOperationId ? 'ready' : 'empty-uninitialized')
    : state.hasReliableCostBasis ? 'ready' : 'missing-cost-basis';
  state.remainingTotalCostMinor = state.remainingMetalCostMinor
    + state.remainingWorkmanshipCostMinor
    + state.remainingAccessoryCostMinor;
  state.metalWacMinorPerStandardUnit = state.kind !== 'accessory'
    && state.standardizedQuantityUnits > 0
    && state.hasReliableCostBasis
    ? state.remainingMetalCostMinor / state.standardizedQuantityUnits
    : null;
  state.workmanshipWacMinorPerPhysicalUnit = state.kind !== 'accessory'
    && state.actualPhysicalWeightUnits > 0
    && state.hasReliableCostBasis
    ? state.remainingWorkmanshipCostMinor / state.actualPhysicalWeightUnits
    : null;
  if (state.hasReliableCostBasis && state.standardizedQuantityUnits > 0) {
    state.lastKnownMetalCostMinor = state.remainingMetalCostMinor;
    state.lastKnownStandardizedQuantityUnits = state.standardizedQuantityUnits;
  }
  if (state.hasReliableCostBasis && state.actualPhysicalWeightUnits > 0) {
    state.lastKnownWorkmanshipCostMinor = state.remainingWorkmanshipCostMinor;
    state.lastKnownPhysicalQuantityUnits = state.actualPhysicalWeightUnits;
  }
  if (state.hasReliableCostBasis && state.accessoryQuantityUnits > 0) {
    state.lastKnownAccessoryCostMinor = state.remainingAccessoryCostMinor;
    state.lastKnownAccessoryQuantityUnits = state.accessoryQuantityUnits;
  }
  if (!state.hasReliableCostBasis) {
    state.totalWacMinorPerDisplayUnit = null;
  } else if (state.kind === 'accessory') {
    state.totalWacMinorPerDisplayUnit = state.accessoryQuantityUnits > 0
      ? (state.remainingAccessoryCostMinor * ACCESSORY_SCALE) / state.accessoryQuantityUnits
      : null;
  } else {
    state.totalWacMinorPerDisplayUnit = state.standardizedQuantityUnits > 0
      ? (state.remainingTotalCostMinor * GRAM_SCALE) / state.standardizedQuantityUnits
      : null;
  }
};

const assertStateInvariant = (state: InventoryCostState, entry: Entry): void => {
  const primaryQuantity = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  const integers = [
    state.standardizedQuantityUnits, state.actualPhysicalWeightUnits, state.accessoryQuantityUnits,
    state.remainingMetalCostMinor, state.remainingWorkmanshipCostMinor,
    state.remainingAccessoryCostMinor, state.remainingTotalCostMinor,
  ];
  if (integers.some(value => !Number.isSafeInteger(value) || value < 0)) {
    fail('cost_invariant_failed', 'Inventory quantity and carrying cost must remain non-negative safe integers', entry, state.inventoryAccountId);
  }
  const components = state.remainingMetalCostMinor
    + state.remainingWorkmanshipCostMinor + state.remainingAccessoryCostMinor;
  if (components !== state.remainingTotalCostMinor) {
    fail('cost_invariant_failed', 'Inventory total cost does not equal its cost components', entry, state.inventoryAccountId);
  }
  if (primaryQuantity === 0 && state.remainingTotalCostMinor !== 0) {
    fail('cost_invariant_failed', 'Zero inventory cannot retain rounding residual cost', entry, state.inventoryAccountId);
  }
  if (primaryQuantity > 0 && state.hasReliableCostBasis) {
    const derived = state.kind === 'accessory'
      ? (state.remainingTotalCostMinor * ACCESSORY_SCALE) / primaryQuantity
      : (state.remainingTotalCostMinor * GRAM_SCALE) / primaryQuantity;
    if (state.totalWacMinorPerDisplayUnit === null
      || Math.abs(derived - state.totalWacMinorPerDisplayUnit) > 1e-9) {
      fail('cost_invariant_failed', 'Derived WAC is inconsistent with remaining carrying cost', entry, state.inventoryAccountId);
    }
  }
};

interface MovementQuantity {
  standardizedUnits: number;
  physicalUnits: number;
  accessoryUnits: number;
}

const movementQuantity = (entry: Entry, account: ResolvedInventoryAccount): MovementQuantity => {
  if (account.kind === 'accessory') {
    let quantity = isLegacyEntry(entry) ? parseScaledDecimal(entry.count, ACCESSORY_SCALE, 3, 'legacy accessory quantity', entry, true) : 0;
    if (quantity === 0) quantity = parseScaledDecimal(entry.weight, ACCESSORY_SCALE, 3, 'accessory quantity', entry, true, true);
    if (quantity === 0 && !isLegacyEntry(entry)) quantity = parseScaledDecimal(entry.count, ACCESSORY_SCALE, 3, 'legacy accessory quantity', entry, true);
    return { standardizedUnits: 0, physicalUnits: 0, accessoryUnits: quantity };
  }

  const physicalUnits = parseScaledDecimal(
    entry.weight,
    GRAM_SCALE,
    2,
    'physical weight',
    entry,
    true,
    true,
  );
  if (physicalUnits === 0) return { standardizedUnits: 0, physicalUnits: 0, accessoryUnits: 0 };
  if (account.kind === 'silver') {
    return { standardizedUnits: physicalUnits, physicalUnits, accessoryUnits: 0 };
  }

  if (
    entry.goldEquivalent21Snapshot
    && entry.goldEquivalent21Snapshot.equivalent21Units > 0
    && entry.goldEquivalent21Snapshot.karat === account.karat
  ) {
    return {
      standardizedUnits: entry.goldEquivalent21Snapshot.equivalent21Units,
      physicalUnits,
      accessoryUnits: 0,
    };
  }
  if (isLegacyEntry(entry) && entry.arabicWeight) {
    const approvedLegacyUnits = parseScaledDecimal(
      entry.arabicWeight,
      GRAM_SCALE,
      2,
      'approved legacy E21 weight',
      entry,
      false,
      true,
    );
    return { standardizedUnits: approvedLegacyUnits, physicalUnits, accessoryUnits: 0 };
  }
  if (account.karat && canCalculateGoldEquivalent21(entry.weight, account.karat)) {
    const snapshot = calculateGoldEquivalent21(entry.weight, account.karat as SupportedGoldKarat);
    return { standardizedUnits: snapshot.equivalent21Units, physicalUnits, accessoryUnits: 0 };
  }
  fail('missing_karat_conversion', 'Missing approved E21 conversion input', entry, account.inventoryAccountId);
};

const manufacturingMovementQuantity = (
  movement: NonNullable<Entry['manufacturing']>['inputs'][number],
  account: ResolvedInventoryAccount,
  entry: Entry,
): MovementQuantity => {
  if (account.kind === 'accessory') {
    fail('invalid_manufacturing', 'Manufacturing does not support accessory inventory pools', entry, account.inventoryAccountId);
  }
  const physicalUnits = parseScaledDecimal(
    movement.physicalWeight, GRAM_SCALE, 2, 'manufacturing physical weight', entry, true, true,
  );
  let standardizedUnits = movement.standardizedQuantityUnits;
  if (standardizedUnits === undefined) {
    if (account.kind === 'silver') standardizedUnits = physicalUnits;
    else if (account.karat && canCalculateGoldEquivalent21(movement.physicalWeight, account.karat)) {
      standardizedUnits = calculateGoldEquivalent21(
        movement.physicalWeight, account.karat as SupportedGoldKarat,
      ).equivalent21Units;
    }
  }
  if (!Number.isSafeInteger(standardizedUnits) || Number(standardizedUnits) <= 0) {
    fail('invalid_manufacturing', 'Manufacturing movement requires a positive integer Standard-21 quantity', entry, account.inventoryAccountId);
  }
  return { standardizedUnits: Number(standardizedUnits), physicalUnits, accessoryUnits: 0 };
};
const blankResult = (
  entry: Entry,
  classification: InventoryCostOperationClassification,
): OperationCostResultV2 => ({
  operationId: getPhase5OperationId(entry),
  classification,
  incomingStandardizedQuantityUnits: 0,
  outgoingStandardizedQuantityUnits: 0,
  incomingActualPhysicalWeightUnits: 0,
  outgoingActualPhysicalWeightUnits: 0,
  incomingAccessoryQuantityUnits: 0,
  outgoingAccessoryQuantityUnits: 0,
  incomingMetalCostMinor: 0,
  incomingWorkmanshipCostMinor: 0,
  outgoingMetalCostMinor: 0,
  outgoingWorkmanshipCostMinor: 0,
  incomingTotalCostMinor: 0,
  outgoingTotalCostMinor: 0,
  metalCogsMinor: 0,
  workmanshipCogsMinor: 0,
  totalCogsMinor: 0,
  saleAmountMinor: 0,
  profitMinor: null,
  adjustmentGainMinor: 0,
  adjustmentLossMinor: 0,
  revenueReversalMinor: 0,
  reversedCogsMinor: 0,
  purchaseCostReversalMinor: 0,
  merchantLiabilityIncreaseMinor: 0,
  merchantLiabilityDecreaseMinor: 0,
  merchantSettlementGainMinor: 0,
  merchantSettlementLossMinor: 0,
  manufacturingConversionCostMinor: 0,
  manufacturingAbnormalLossMinor: 0,
  originalOperationId: entry.originalOperationId,
  calculationVersion: INVENTORY_COST_CALCULATION_VERSION,
  entry,
});

const addIncoming = (
  state: InventoryCostState,
  quantity: MovementQuantity,
  metalCostMinor: number,
  workmanshipCostMinor: number,
  accessoryCostMinor: number,
  entry: Entry,
): void => {
  const primaryQuantity = state.kind === 'accessory' ? quantity.accessoryUnits : quantity.standardizedUnits;
  if (primaryQuantity <= 0) fail('invalid_quantity', 'Incoming inventory quantity must be positive', entry, state.inventoryAccountId);
  const quantityBefore = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  const hadMissingCostBasis = quantityBefore > 0 && !state.hasReliableCostBasis;
  state.standardizedQuantityUnits += quantity.standardizedUnits;
  state.actualPhysicalWeightUnits += quantity.physicalUnits;
  state.accessoryQuantityUnits += quantity.accessoryUnits;
  state.remainingMetalCostMinor += metalCostMinor;
  state.remainingWorkmanshipCostMinor += workmanshipCostMinor;
  state.remainingAccessoryCostMinor += accessoryCostMinor;
  for (const value of [
    state.standardizedQuantityUnits,
    state.actualPhysicalWeightUnits,
    state.accessoryQuantityUnits,
    state.remainingMetalCostMinor,
    state.remainingWorkmanshipCostMinor,
    state.remainingAccessoryCostMinor,
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) fail('invalid_amount', 'Inventory cost state overflow', entry, state.inventoryAccountId);
  }
  state.hasReliableCostBasis = !hadMissingCostBasis;
  state.lastProcessedOperationId = getPhase5OperationId(entry);
  updateDerivedState(state);
  assertStateInvariant(state, entry);
};

interface RemovedCost {
  metalCostMinor: number;
  workmanshipCostMinor: number;
  accessoryCostMinor: number;
  totalCostMinor: number;
}

const calculateRemoval = (
  state: InventoryCostState,
  quantity: MovementQuantity,
  entry: Entry,
): RemovedCost => {
  const availablePrimary = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  if (availablePrimary > 0 && !state.hasReliableCostBasis) {
    fail('inventory_cost_basis_required', 'Inventory account has positive quantity but no cost basis', entry, state.inventoryAccountId);
  }
  if (state.kind === 'accessory') {
    if (quantity.accessoryUnits <= 0) fail('invalid_quantity', 'Accessory outgoing quantity must be positive', entry, state.inventoryAccountId);
    if (quantity.accessoryUnits > state.accessoryQuantityUnits
      && quantity.accessoryUnits <= state.accessoryQuantityUnits + state.pendingAccessoryQuantityUnits) {
      fail('pending_surplus_cost', 'Confirmed inventory is insufficient; a pending surplus cannot be used before audited cost approval', entry, state.inventoryAccountId);
    }
    if (quantity.accessoryUnits > state.accessoryQuantityUnits) {
      fail(
        'insufficient_inventory',
        `Accessory movement exceeds costed inventory: required=${quantity.accessoryUnits / ACCESSORY_SCALE}, available=${state.accessoryQuantityUnits / ACCESSORY_SCALE}`,
        entry,
        state.inventoryAccountId,
      );
    }
    const accessoryCostMinor = proportionalCost(
      state.remainingAccessoryCostMinor,
      quantity.accessoryUnits,
      state.accessoryQuantityUnits,
      entry,
      'accessory outgoing cost',
    );
    return { metalCostMinor: 0, workmanshipCostMinor: 0, accessoryCostMinor, totalCostMinor: accessoryCostMinor };
  }
  if (quantity.standardizedUnits <= 0 || quantity.physicalUnits <= 0) {
    fail('invalid_quantity', 'Metal outgoing weight must be positive', entry, state.inventoryAccountId);
  }
  if ((quantity.standardizedUnits > state.standardizedQuantityUnits || quantity.physicalUnits > state.actualPhysicalWeightUnits)
    && quantity.standardizedUnits <= state.standardizedQuantityUnits + state.pendingStandardizedQuantityUnits
    && quantity.physicalUnits <= state.actualPhysicalWeightUnits + state.pendingActualPhysicalWeightUnits) {
    fail('pending_surplus_cost', 'Confirmed inventory is insufficient; a pending surplus cannot be used before audited cost approval', entry, state.inventoryAccountId);
  }
  if (
    quantity.standardizedUnits > state.standardizedQuantityUnits
    || quantity.physicalUnits > state.actualPhysicalWeightUnits
  ) {
    fail(
      'insufficient_inventory',
      `Metal movement exceeds costed inventory: required standardized=${quantity.standardizedUnits / GRAM_SCALE}g, available=${state.standardizedQuantityUnits / GRAM_SCALE}g; required physical=${quantity.physicalUnits / GRAM_SCALE}g, available=${state.actualPhysicalWeightUnits / GRAM_SCALE}g`,
      entry,
      state.inventoryAccountId,
    );
  }
  const metalCostMinor = proportionalCost(
    state.remainingMetalCostMinor,
    quantity.standardizedUnits,
    state.standardizedQuantityUnits,
    entry,
    'metal outgoing cost',
  );
  const workmanshipCostMinor = proportionalCost(
    state.remainingWorkmanshipCostMinor,
    quantity.physicalUnits,
    state.actualPhysicalWeightUnits,
    entry,
    'workmanship outgoing cost',
  );
  return {
    metalCostMinor,
    workmanshipCostMinor,
    accessoryCostMinor: 0,
    totalCostMinor: metalCostMinor + workmanshipCostMinor,
  };
};

const hasValidPreOperationWac = (state: InventoryCostState): boolean => {
  if (!state.hasReliableCostBasis
    || state.remainingTotalCostMinor <= 0
    || state.totalWacMinorPerDisplayUnit === null
    || state.totalWacMinorPerDisplayUnit <= 0) return false;
  return state.kind === 'accessory'
    ? state.accessoryQuantityUnits > 0
    : state.standardizedQuantityUnits > 0 && state.actualPhysicalWeightUnits > 0;
};

const calculateAtCurrentWac = (  state: InventoryCostState,
  quantity: MovementQuantity,
  entry: Entry,
): RemovedCost => {
  if (state.kind === 'accessory') {
    if (quantity.accessoryUnits <= 0) {
      fail('invalid_quantity', 'Accessory surplus quantity must be positive', entry, state.inventoryAccountId);
    }
    const basisCost = state.hasReliableCostBasis && state.accessoryQuantityUnits > 0
      ? state.remainingAccessoryCostMinor
      : state.lastKnownAccessoryCostMinor;
    const basisQuantity = state.hasReliableCostBasis && state.accessoryQuantityUnits > 0
      ? state.accessoryQuantityUnits
      : state.lastKnownAccessoryQuantityUnits;
    if (basisQuantity <= 0) fail('missing_wac', 'Inventory account has no reliable WAC', entry, state.inventoryAccountId);
    const accessoryCostMinor = toSafeInteger(
      roundDivide(BigInt(basisCost) * BigInt(quantity.accessoryUnits), BigInt(basisQuantity)),
      'accessory surplus cost',
      entry,
    );
    return { metalCostMinor: 0, workmanshipCostMinor: 0, accessoryCostMinor, totalCostMinor: accessoryCostMinor };
  }
  if (quantity.standardizedUnits <= 0 || quantity.physicalUnits <= 0) {
    fail('invalid_quantity', 'Metal surplus weight must be positive', entry, state.inventoryAccountId);
  }
  const metalBasisCost = state.hasReliableCostBasis && state.standardizedQuantityUnits > 0
    ? state.remainingMetalCostMinor
    : state.lastKnownMetalCostMinor;
  const metalBasisQuantity = state.hasReliableCostBasis && state.standardizedQuantityUnits > 0
    ? state.standardizedQuantityUnits
    : state.lastKnownStandardizedQuantityUnits;
  const workmanshipBasisCost = state.hasReliableCostBasis && state.actualPhysicalWeightUnits > 0
    ? state.remainingWorkmanshipCostMinor
    : state.lastKnownWorkmanshipCostMinor;
  const workmanshipBasisQuantity = state.hasReliableCostBasis && state.actualPhysicalWeightUnits > 0
    ? state.actualPhysicalWeightUnits
    : state.lastKnownPhysicalQuantityUnits;
  if (metalBasisQuantity <= 0 || workmanshipBasisQuantity <= 0) {
    fail('missing_wac', 'Inventory account has no reliable WAC', entry, state.inventoryAccountId);
  }
  const metalCostMinor = toSafeInteger(
    roundDivide(BigInt(metalBasisCost) * BigInt(quantity.standardizedUnits), BigInt(metalBasisQuantity)),
    'metal surplus cost',
    entry,
  );
  const workmanshipCostMinor = toSafeInteger(
    roundDivide(BigInt(workmanshipBasisCost) * BigInt(quantity.physicalUnits), BigInt(workmanshipBasisQuantity)),
    'workmanship surplus cost',
    entry,
  );
  return {
    metalCostMinor,
    workmanshipCostMinor,
    accessoryCostMinor: 0,
    totalCostMinor: metalCostMinor + workmanshipCostMinor,
  };
};
const applyRemoval = (
  state: InventoryCostState,
  quantity: MovementQuantity,
  removed: RemovedCost,
  entry: Entry,
): void => {
  state.standardizedQuantityUnits -= quantity.standardizedUnits;
  state.actualPhysicalWeightUnits -= quantity.physicalUnits;
  state.accessoryQuantityUnits -= quantity.accessoryUnits;
  state.remainingMetalCostMinor -= removed.metalCostMinor;
  state.remainingWorkmanshipCostMinor -= removed.workmanshipCostMinor;
  state.remainingAccessoryCostMinor -= removed.accessoryCostMinor;
  const primaryQuantity = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  if (primaryQuantity === 0) {
    if (
      state.remainingMetalCostMinor !== 0
      || state.remainingWorkmanshipCostMinor !== 0
      || state.remainingAccessoryCostMinor !== 0
    ) {
      fail('invalid_amount', 'Zero inventory cannot retain book cost', entry, state.inventoryAccountId);
    }
    state.hasReliableCostBasis = false;
  }
  state.lastProcessedOperationId = getPhase5OperationId(entry);
  updateDerivedState(state);
  assertStateInvariant(state, entry);
};


const applySpecifiedRemoval = (
  state: InventoryCostState,
  quantity: MovementQuantity,
  removed: RemovedCost,
  entry: Entry,
): void => {
  const available = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  const required = state.kind === 'accessory' ? quantity.accessoryUnits : quantity.standardizedUnits;
  if (required <= 0 || required > available || quantity.physicalUnits > state.actualPhysicalWeightUnits) {
    fail('insufficient_inventory', 'Original-cost return exceeds confirmed inventory', entry, state.inventoryAccountId);
  }
  if (removed.metalCostMinor > state.remainingMetalCostMinor
    || removed.workmanshipCostMinor > state.remainingWorkmanshipCostMinor
    || removed.accessoryCostMinor > state.remainingAccessoryCostMinor) {
    fail('cost_invariant_failed', 'Original acquisition cost exceeds the remaining pool carrying cost', entry, state.inventoryAccountId);
  }
  state.standardizedQuantityUnits -= quantity.standardizedUnits;
  state.actualPhysicalWeightUnits -= quantity.physicalUnits;
  state.accessoryQuantityUnits -= quantity.accessoryUnits;
  state.remainingMetalCostMinor -= removed.metalCostMinor;
  state.remainingWorkmanshipCostMinor -= removed.workmanshipCostMinor;
  state.remainingAccessoryCostMinor -= removed.accessoryCostMinor;
  const primary = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  if (primary === 0) state.hasReliableCostBasis = false;
  state.lastProcessedOperationId = getPhase5OperationId(entry);
  updateDerivedState(state);
  assertStateInvariant(state, entry);
};
const applyZeroCostMerchantDelivery = (
  state: InventoryCostState,
  quantity: MovementQuantity,
  entry: Entry,
): void => {
  if (state.kind === 'accessory') fail('unknown_inventory_operation', 'Merchant delivery cannot target accessories', entry);
  if (
    quantity.standardizedUnits <= 0
    || quantity.physicalUnits <= 0
    || quantity.standardizedUnits > state.standardizedQuantityUnits
    || quantity.physicalUnits > state.actualPhysicalWeightUnits
  ) {
    fail('insufficient_inventory', 'Merchant metal delivery exceeds physical inventory', entry, state.inventoryAccountId);
  }
  state.standardizedQuantityUnits -= quantity.standardizedUnits;
  state.actualPhysicalWeightUnits -= quantity.physicalUnits;
  if (state.standardizedQuantityUnits === 0 && state.remainingTotalCostMinor !== 0) {
    fail('invalid_amount', 'Merchant delivery would leave cost without inventory', entry, state.inventoryAccountId);
  }
  state.lastProcessedOperationId = getPhase5OperationId(entry);
  updateDerivedState(state);
  assertStateInvariant(state, entry);
};

const accountIdForSide = (entry: Entry, side: 'debit' | 'credit'): string | undefined =>
  side === 'debit' ? entry.debitAccountId : entry.creditAccountId;

const resolveInventorySide = (
  entry: Entry,
  side: 'debit' | 'credit',
  catalog: InventoryRuntimeCatalog,
): ResolvedInventoryAccount | undefined => {
  const id = accountIdForSide(entry, side);
  return id ? catalog.byAccountId.get(id) : undefined;
};

const sideLooksLikeInventory = (
  entry: Entry,
  side: 'debit' | 'credit',
  accountsByName: ReadonlyMap<string, Account>,
): boolean => accountsByName.get(side === 'debit' ? entry.debit : entry.credit)?.is_inventory === true;

const classify = (
  entry: Entry,
  debitInventory?: ResolvedInventoryAccount,
  creditInventory?: ResolvedInventoryAccount,
): InventoryCostOperationClassification => {
  if (entry.operationKind === 'customer_return') return 'customer_return';
  if (entry.operationKind === 'supplier_return') return 'supplier_return';
  if (entry.operationKind === 'manufacturing') return 'manufacturing';
  if (entry.tx === 'مرتجع ذهب' || entry.tx === 'مرتجع فضة') return 'customer_return';
  if (entry.tx === 'تاجر ذهب' || entry.tx === 'تاجر فضة') return 'merchant_receipt';
  if (entry.tx === 'حساب تاجر ذهب' || entry.tx === 'حساب تاجر فضة') {
    return creditInventory ? 'merchant_delivery' : entry.merchantGoldWeight ? 'merchant_cash_settlement' : 'non_cost';
  }
  if (isOpeningEntry(entry)) return 'opening';
  if (entry.operationKind === 'sale' || ['بيع ذهب', 'بيع فضة', 'بيع ملحقات'].includes(entry.tx)) return 'sale';
  if (entry.operationKind === 'purchase' || ['شراء ذهب', 'شراء فضة', 'شراء ملحقات'].includes(entry.tx)) return 'customer_purchase';
  if (entry.operationKind === 'tifeet' || entry.tx === 'تيفيت') return 'tafyeet';
  if (entry.operationKind === 'transfer' || entry.tx === 'تحويل') return 'transfer';
  if (entry.operationKind === 'adjustment' || ['تسوية', 'تسوية عجز', 'تسوية زيادة'].includes(entry.tx)) {
    if (debitInventory && creditInventory) return 'two_sided_adjustment';
    if (creditInventory) return 'shortage';
    if (debitInventory) return entry.costAssignmentStatus === 'approved'
      ? 'approved_surplus'
      : 'pending_surplus';
  }
  return debitInventory || creditInventory ? 'non_cost' : 'non_cost';
};

const hasReliableLegacyOrder = (entry: Entry): boolean => {
  const hasSequence = typeof entry.seq === 'number'
    && Number.isSafeInteger(entry.seq)
    && entry.seq >= 0;
  const createdAt: any = entry.createdAt;
  let hasTimestamp = false;
  if (createdAt instanceof Date) hasTimestamp = Number.isFinite(createdAt.getTime());
  else if (typeof createdAt === 'number') hasTimestamp = Number.isFinite(createdAt);
  else if (typeof createdAt === 'string') hasTimestamp = Number.isFinite(Date.parse(createdAt));
  else if (createdAt && typeof createdAt.seconds === 'number') {
    hasTimestamp = Number.isFinite(createdAt.seconds)
      && (createdAt.nanoseconds === undefined || Number.isFinite(createdAt.nanoseconds));
  } else if (createdAt && typeof createdAt.toMillis === 'function') {
    try {
      hasTimestamp = Number.isFinite(createdAt.toMillis());
    } catch {
      hasTimestamp = false;
    }
  }
  return hasSequence || hasTimestamp;
};

const isLegacyBatchEligible = (entry: Entry): boolean =>
  isLegacyEntry(entry) && !hasReliableLegacyOrder(entry);

type LegacyBatchPhase = 'opening' | 'incoming' | 'outgoing' | 'none';

const isMerchantAccount = (account: Account | undefined): boolean =>
  account?.type === 'merchant';

const merchantLiabilityPhaseForAccount = (
  entry: Entry,
  accountId: string,
  accountsById: ReadonlyMap<string, Account>,
): LegacyBatchPhase => {
  const debit = entry.debitAccountId === accountId;
  const credit = entry.creditAccountId === accountId;
  if (!debit && !credit) return 'none';
  if (!isMerchantAccount(accountsById.get(accountId))) return 'none';
  if (isOpeningEntry(entry) && credit) return 'opening';
  if ((entry.tx === 'تاجر ذهب' || entry.tx === 'تاجر فضة') && credit) return 'incoming';
  if (entry.tx === 'حوالة') return credit ? 'incoming' : 'outgoing';
  if ((entry.tx === 'حساب تاجر ذهب' || entry.tx === 'حساب تاجر فضة') && debit) return 'outgoing';
  return 'none';
};

const legacyBatchPhaseForAccount = (
  entry: Entry,
  accountId: string,
  catalog: InventoryRuntimeCatalog,
): LegacyBatchPhase => {
  const debitInventory = resolveInventorySide(entry, 'debit', catalog);
  const creditInventory = resolveInventorySide(entry, 'credit', catalog);
  const classification = classify(entry, debitInventory, creditInventory);
  if (classification === 'opening' && debitInventory?.inventoryAccountId === accountId) return 'opening';
  if (classification === 'transfer') {
    if (debitInventory?.inventoryAccountId === accountId) return 'incoming';
    if (creditInventory?.inventoryAccountId === accountId) return 'outgoing';
    return 'none';
  }
  if (
    ['customer_purchase', 'merchant_receipt', 'surplus'].includes(classification)
    && debitInventory?.inventoryAccountId === accountId
  ) return 'incoming';
  if (
    debitInventory?.inventoryAccountId === accountId
    || creditInventory?.inventoryAccountId === accountId
  ) return classification === 'non_cost' || classification === 'quantity_only' ? 'none' : 'outgoing';
  return 'none';
};

const inventoryAccountIdsForEntry = (
  entry: Entry,
  catalog: InventoryRuntimeCatalog,
): string[] => [
  resolveInventorySide(entry, 'debit', catalog)?.inventoryAccountId,
  resolveInventorySide(entry, 'credit', catalog)?.inventoryAccountId,
].filter((value, index, values): value is string => !!value && values.indexOf(value) === index);

const reorderLegacySegment = (
  segment: Entry[],
  catalog: InventoryRuntimeCatalog,
  accountsById: ReadonlyMap<string, Account>,
): Entry[] => {
  if (segment.length < 2) return segment;
  const edges = segment.map(() => new Set<number>());
  const indegree = segment.map(() => 0);
  const accountIds = new Set(segment.flatMap(entry => inventoryAccountIdsForEntry(entry, catalog)));

  const addEdge = (from: number, to: number) => {
    if (from === to || edges[from].has(to)) return;
    edges[from].add(to);
    indegree[to] += 1;
  };

  for (const accountId of accountIds) {
    const phases = segment.map(entry => legacyBatchPhaseForAccount(entry, accountId, catalog));
    const openings = phases.flatMap((phase, index) => phase === 'opening' ? [index] : []);
    const incoming = phases.flatMap((phase, index) => phase === 'incoming' ? [index] : []);
    const outgoing = phases.flatMap((phase, index) => phase === 'outgoing' ? [index] : []);
    for (const opening of openings) {
      for (const later of [...incoming, ...outgoing]) addEdge(opening, later);
    }
    for (const receipt of incoming) {
      for (const issue of outgoing) addEdge(receipt, issue);
    }
  }

  const merchantAccountIds = new Set(segment.flatMap(entry => [
    entry.debitAccountId,
    entry.creditAccountId,
  ]).filter((id): id is string => !!id && isMerchantAccount(accountsById.get(id))));
  for (const accountId of merchantAccountIds) {
    const phases = segment.map(entry => merchantLiabilityPhaseForAccount(entry, accountId, accountsById));
    const openings = phases.flatMap((phase, index) => phase === 'opening' ? [index] : []);
    const incoming = phases.flatMap((phase, index) => phase === 'incoming' ? [index] : []);
    const outgoing = phases.flatMap((phase, index) => phase === 'outgoing' ? [index] : []);
    for (const opening of openings) {
      for (const later of [...incoming, ...outgoing]) addEdge(opening, later);
    }
    for (const receipt of incoming) {
      for (const issue of outgoing) addEdge(receipt, issue);
    }
  }

  const ready = segment.map((_, index) => index).filter(index => indegree[index] === 0);
  const ordered: Entry[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => left - right);
    const index = ready.shift()!;
    ordered.push(segment[index]);
    for (const target of edges[index]) {
      indegree[target] -= 1;
      if (indegree[target] === 0) ready.push(target);
    }
  }
  if (ordered.length !== segment.length) {
    fail('invalid_ordering', 'Legacy same-day inventory ordering constraints contain a cycle');
  }
  return ordered;
};

const orderEntriesWithLegacySameDayPolicy = (
  entries: Entry[],
  catalog: InventoryRuntimeCatalog,
  accountsById: ReadonlyMap<string, Account>,
): { ordered: Entry[]; diagnostics: LegacySameDayOrderingDiagnostic[] } => {
  const base = [...entries].sort(compareEntriesForPhase5Cost);
  const byDate = new Map<string, Entry[]>();
  for (const entry of base) {
    const day = byDate.get(entry.date) ?? [];
    day.push(entry);
    byDate.set(entry.date, day);
  }

  const ordered: Entry[] = [];
  const diagnostics: LegacySameDayOrderingDiagnostic[] = [];
  for (const [date, day] of byDate) {
    const reorderedDay: Entry[] = [];
    let segment: Entry[] = [];
    const flush = () => {
      if (segment.length > 0) reorderedDay.push(...reorderLegacySegment(segment, catalog, accountsById));
      segment = [];
    };
    for (const entry of day) {
      const touchesInventory = inventoryAccountIdsForEntry(entry, catalog).length > 0;
      if (touchesInventory && !isLegacyBatchEligible(entry)) {
        flush();
        reorderedDay.push(entry);
      } else {
        segment.push(entry);
      }
    }
    flush();

    const accountIds = new Set(day.flatMap(entry => inventoryAccountIdsForEntry(entry, catalog)));
    for (const accountId of accountIds) {
      const relevantBefore = day.filter(entry =>
        isLegacyBatchEligible(entry)
        && legacyBatchPhaseForAccount(entry, accountId, catalog) !== 'none');
      const phases = relevantBefore.map(entry => legacyBatchPhaseForAccount(entry, accountId, catalog));
      const hasPolicyWork = phases.includes('outgoing')
        && (phases.includes('opening') || phases.includes('incoming'));
      if (!hasPolicyWork) continue;
      const relevantAfter = reorderedDay.filter(entry =>
        isLegacyBatchEligible(entry)
        && legacyBatchPhaseForAccount(entry, accountId, catalog) !== 'none');
      const beforeIds = relevantBefore.map(getPhase5OperationId);
      const afterIds = relevantAfter.map(getPhase5OperationId);
      const changed = beforeIds.some((id, index) => id !== afterIds[index]);
      const account = catalog.byAccountId.get(accountId)!;
      diagnostics.push({
        code: 'legacy_same_day_batch_ordering_applied',
        date,
        inventoryAccountId: accountId,
        displayName: account.displayName,
        changed,
        openingOperationIds: relevantBefore
          .filter(entry => legacyBatchPhaseForAccount(entry, accountId, catalog) === 'opening')
          .map(getPhase5OperationId),
        incomingOperationIds: relevantBefore
          .filter(entry => legacyBatchPhaseForAccount(entry, accountId, catalog) === 'incoming')
          .map(getPhase5OperationId),
        outgoingOperationIds: relevantBefore
          .filter(entry => legacyBatchPhaseForAccount(entry, accountId, catalog) === 'outgoing')
          .map(getPhase5OperationId),
        operationIdsBefore: beforeIds,
        operationIdsAfter: afterIds,
        message: changed
          ? `Applied legacy same-day batch ordering for ${account.displayName} on ${date}`
          : `Legacy same-day batch ordering already satisfied for ${account.displayName} on ${date}`,
      });
    }
    ordered.push(...reorderedDay);
  }
  return { ordered, diagnostics };
};

const cloneState = (state: InventoryCostState): InventoryCostState => ({ ...state });

const validateSameMovement = (
  source: MovementQuantity,
  destination: MovementQuantity,
  entry: Entry,
  tafyeet: boolean,
): void => {
  const matches = source.standardizedUnits === destination.standardizedUnits
    && source.physicalUnits === destination.physicalUnits
    && source.accessoryUnits === destination.accessoryUnits;
  if (!matches) {
    fail(
      tafyeet ? 'tafyeet_quantity_mismatch' : 'transfer_quantity_mismatch',
      tafyeet
        ? 'Tafyeet outgoing and incoming quantities must be identical'
        : 'Transfer outgoing and incoming quantities must be identical',
      entry,
    );
  }
};

const openingCosts = (
  entry: Entry,
  account: ResolvedInventoryAccount,
  quantity: MovementQuantity,
  config: Phase5OpeningCostConfig,
): { metal: number; workmanship: number; accessory: number } => {
  const year = entry.date.slice(0, 4);
  if (entry.annualOpeningSnapshot) {
    const snapshot = entry.annualOpeningSnapshot;
    if (snapshot.standardizedQuantityUnits !== quantity.standardizedUnits
      || snapshot.physicalWeightUnits !== quantity.physicalUnits
      || snapshot.accessoryQuantityUnits !== quantity.accessoryUnits
      || ![snapshot.metalCostMinor, snapshot.workmanshipCostMinor, snapshot.accessoryCostMinor].every(value => Number.isSafeInteger(value) && value >= 0)) {
      fail('invalid_snapshot', 'Annual opening snapshot quantity or cost components are invalid', entry, account.inventoryAccountId);
    }
    return { metal: snapshot.metalCostMinor, workmanship: snapshot.workmanshipCostMinor, accessory: snapshot.accessoryCostMinor };
  }
  if (account.kind === 'gold') {
    const price = parseConfigMinor(config.gold21PriceByYearMinor?.[year], 'gold E21 opening price', entry);
    return {
      metal: toSafeInteger(roundDivide(BigInt(quantity.standardizedUnits) * BigInt(price), 100n), 'gold opening cost', entry),
      workmanship: 0,
      accessory: 0,
    };
  }
  if (account.kind === 'silver') {
    const price = parseConfigMinor(config.silverPriceByYearMinor?.[year], 'silver opening price', entry);
    return {
      metal: toSafeInteger(roundDivide(BigInt(quantity.standardizedUnits) * BigInt(price), 100n), 'silver opening cost', entry),
      workmanship: 0,
      accessory: 0,
    };
  }
  if (quantity.accessoryUnits <= 0) {
    return { metal: 0, workmanship: 0, accessory: 0 };
  }
  const accessoryOpeningCosts = config.accessoryUnitCostByYearAndAccountMinor?.[year];
  const resolvedValue = accessoryOpeningCosts?.[account.inventoryAccountId];
  if (resolvedValue === undefined || resolvedValue === '') {
    console.log({
      recalculationYear: year,
      openingCostDocument: config,
      accessoryOpeningCosts,
      requestedAccountId: account.inventoryAccountId,
      resolvedValue,
    });
  }
  const unitCost = parseConfigMinor(
    resolvedValue,
    `accessory opening unit cost for ${account.displayName} (${account.inventoryAccountId})`,
    entry,
  );
  return {
    metal: 0,
    workmanship: 0,
    accessory: toSafeInteger(
      roundDivide(BigInt(quantity.accessoryUnits) * BigInt(unitCost), BigInt(ACCESSORY_SCALE)),
      'accessory opening cost',
      entry,
    ),
  };
};

const applyHistoricalOverlayDirective = (
  directive: HistoricalInventoryOverlayDirective,
  entry: Entry,
  account: ResolvedInventoryAccount,
  state: InventoryCostState,
  calculationGenerationId: number,
): AppliedHistoricalInventoryOverlay => {
  if (directive.effectiveDate !== entry.date
    || directive.sourceDeficitOperationId !== getPhase5OperationId(entry)
    || directive.stableInventoryAccountId !== account.inventoryAccountId) {
    fail('invalid_historical_overlay', `Overlay ${directive.overlayId} does not match its source deficit operation`, entry, account.inventoryAccountId);
  }
  if (directive.unitBasis !== account.unitBasis) {
    fail('invalid_historical_overlay', `Overlay ${directive.overlayId} unit basis does not match inventory account`, entry, account.inventoryAccountId);
  }
  if (!Number.isSafeInteger(directive.quantityUnits) || directive.quantityUnits <= 0) {
    fail('invalid_historical_overlay', `Overlay ${directive.overlayId} quantityUnits must be a positive integer`, entry, account.inventoryAccountId);
  }
  if (account.kind === 'gold' && account.karat !== 21) {
    fail('invalid_historical_overlay', `Overlay ${directive.overlayId} requires an explicit physical quantity for non-E21 gold`, entry, account.inventoryAccountId);
  }
  if (!state.hasReliableCostBasis || state.remainingTotalCostMinor <= 0) {
    fail('invalid_historical_overlay', `Overlay ${directive.overlayId} cannot use zero or missing current WAC`, entry, account.inventoryAccountId);
  }

  const quantity: MovementQuantity = account.kind === 'accessory'
    ? { standardizedUnits: 0, physicalUnits: 0, accessoryUnits: directive.quantityUnits }
    : { standardizedUnits: directive.quantityUnits, physicalUnits: directive.quantityUnits, accessoryUnits: 0 };
  const metalWacBefore = state.metalWacMinorPerStandardUnit ?? 0;
  const workmanshipWacBefore = state.workmanshipWacMinorPerPhysicalUnit ?? 0;
  const currentCost = calculateAtCurrentWac(state, quantity, entry);
  if (currentCost.totalCostMinor <= 0 || (account.kind !== 'accessory' && currentCost.metalCostMinor <= 0)) {
    fail('invalid_historical_overlay', `Overlay ${directive.overlayId} resolved to zero cost`, entry, account.inventoryAccountId);
  }
  addIncoming(
    state,
    quantity,
    currentCost.metalCostMinor,
    currentCost.workmanshipCostMinor,
    currentCost.accessoryCostMinor,
    entry,
  );

  return sealAppliedHistoricalInventoryOverlay({
    ...directive,
    metalCostMinor: currentCost.metalCostMinor,
    workmanshipCostMinor: currentCost.workmanshipCostMinor,
    totalCostMinor: currentCost.totalCostMinor,
    calculationGenerationId,
    metalWacBefore,
    metalWacAfter: state.metalWacMinorPerStandardUnit ?? 0,
    workmanshipWacBefore,
    workmanshipWacAfter: state.workmanshipWacMinorPerPhysicalUnit ?? 0,
  });
};
export interface RebuildInventoryCostOptions {
  bindings?: readonly InventoryRuntimeBinding[];
  historicalInventoryOverlayDirectives?: readonly HistoricalInventoryOverlayDirective[];
  historicalMerchantLiabilityOpeningDirectives?: readonly HistoricalMerchantLiabilityOpeningDirective[];
  allowPendingFinalApprovalForSimulation?: boolean;
  calculationGenerationId?: number;
  saveValidationOperationId?: string;
}

export const rebuildInventoryCostTimeline = (
  entries: Entry[],
  accounts: Account[],
  openingConfig: Phase5OpeningCostConfig = {},
  options: RebuildInventoryCostOptions = {},
): InventoryCostTimeline => {
  const diagnostics: InventoryCostDiagnostic[] = [];
  let orderingDiagnostics: LegacySameDayOrderingDiagnostic[] = [];
  const historicalInventoryOverlays: AppliedHistoricalInventoryOverlay[] = [];
  const unresolvedCostData: InventoryCostTimeline['unresolvedCostData'] = [];
  const merchantGoldLiabilities: InventoryCostTimeline['merchantGoldLiabilities'] = {};
  const returnedByOriginalOperation = new Map<string, MovementQuantity>();

  const merchantState = (merchantAccountId: string) => merchantGoldLiabilities[merchantAccountId] ??= {
    merchantAccountId, standardizedWeightUnits: 0, physicalWeightUnits: 0,
    bookValueMinor: 0, unresolvedWeightUnits: 0,
  };
  const catalog = buildInventoryRuntimeCatalog(accounts);
  if (catalog.errors.length > 0) {
    diagnostics.push(...catalog.errors.map(message => ({
      code: message.startsWith('Unknown inventory accountId')
        ? 'unknown_inventory_account' as const
        : message.includes('missing accountId')
          ? 'missing_inventory_account_id' as const
          : 'unsupported_inventory_account_type' as const,
      message,
    })));
    return {
      calculationVersion: INVENTORY_COST_CALCULATION_VERSION,
      orderedOperationIds: [],
      results: [],
      resultsByOperationId: {},
      finalStates: {},
      diagnostics,
      orderingDiagnostics,
      historicalInventoryOverlays,
      valid: false,
      merchantGoldLiabilities,
      unresolvedCostData,
      costDataComplete: false,
      completeness: 'partial',
      excludedAccounts: [],
      accountValuations: {},
    };
  }

  const excludedAccountReasons = new Map(catalog.invalidAccounts);
  const states: Record<string, InventoryCostState> = {};
  for (const account of catalog.byAccountId.values()) {
    states[account.inventoryAccountId] = emptyState(account);
  }
  const accountsByName = new Map(accounts.map(account => [account.name, account]));
  const results: OperationCostResultV2[] = [];
  let ordered: Entry[] = [];

  try {
    const suppliedOverlayDirectives = options.historicalInventoryOverlayDirectives ?? [];
    const overlayIds = new Set<string>();
    const sourceOperationIds = new Set<string>();
    for (const directive of suppliedOverlayDirectives) {
      if (overlayIds.has(directive.overlayId)) {
        fail('invalid_historical_overlay', `Duplicate historical overlayId: ${directive.overlayId}`);
      }
      overlayIds.add(directive.overlayId);
      if (directive.ownerApprovalStatus === 'pending_final_approval'
        && !options.allowPendingFinalApprovalForSimulation) {
        fail('invalid_historical_overlay', `Overlay ${directive.overlayId} is pending final owner approval`);
      }
      if (directive.ownerApprovalStatus === 'approved' && !directive.approvedAt) {
        fail('invalid_historical_overlay', `Approved overlay ${directive.overlayId} is missing approvedAt`);
      }
      if (isHistoricalOverlayActive(directive, options.allowPendingFinalApprovalForSimulation === true)) {
        if (sourceOperationIds.has(directive.sourceDeficitOperationId)) {
          fail('invalid_historical_overlay', `Multiple active overlays target ${directive.sourceDeficitOperationId}`);
        }
        sourceOperationIds.add(directive.sourceDeficitOperationId);
      }
    }
    const activeOverlayBySourceOperationId = new Map(
      suppliedOverlayDirectives
        .filter(directive => isHistoricalOverlayActive(
          directive,
          options.allowPendingFinalApprovalForSimulation === true,
        ))
        .map(directive => [directive.sourceDeficitOperationId, directive]),
    );

    validateOrdering(entries);
    const accountsById = new Map(accounts.map(account => [account.id, account]));
    const merchantOpeningOverlayIds = new Set<string>();
    for (const directive of options.historicalMerchantLiabilityOpeningDirectives ?? []) {
      if (merchantOpeningOverlayIds.has(directive.overlayId)) {
        fail('invalid_historical_overlay', `Duplicate merchant liability opening overlayId: ${directive.overlayId}`);
      }
      merchantOpeningOverlayIds.add(directive.overlayId);
      const account = accountsById.get(directive.merchantAccountId);
      if (!account || !isMerchantAccount(account) || account.metal !== directive.metal) {
        fail('invalid_historical_overlay', `Merchant liability opening overlay ${directive.overlayId} has invalid account metadata`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(directive.effectiveDate)
        || !Number.isSafeInteger(directive.standardizedWeightUnits)
        || directive.standardizedWeightUnits <= 0
        || !Number.isSafeInteger(directive.physicalWeightUnits)
        || directive.physicalWeightUnits <= 0
        || !Number.isSafeInteger(directive.bookValueMinor)
        || directive.bookValueMinor <= 0
        || directive.ownerApprovalStatus !== 'approved'
        || !directive.approvedAt
        || !directive.sourceReference) {
        fail('invalid_historical_overlay', `Merchant liability opening overlay ${directive.overlayId} is incomplete`);
      }
      const year = directive.effectiveDate.slice(0, 4);
      const approvedOpeningPrice = parseConfigMinor(
        directive.metal === 'silver'
          ? openingConfig.silverPriceByYearMinor?.[year]
          : openingConfig.gold21PriceByYearMinor?.[year],
        `${directive.metal} merchant opening overlay price`,
      );
      const expectedBookValue = toSafeInteger(
        roundDivide(
          BigInt(directive.standardizedWeightUnits) * BigInt(approvedOpeningPrice),
          BigInt(GRAM_SCALE),
        ),
        'merchant liability opening overlay book value',
      );
      if (directive.bookValueMinor !== expectedBookValue) {
        fail('invalid_historical_overlay', `Merchant liability opening overlay ${directive.overlayId} does not match the approved opening price`);
      }
      const liability = merchantState(directive.merchantAccountId);
      liability.standardizedWeightUnits += directive.standardizedWeightUnits;
      liability.physicalWeightUnits += directive.physicalWeightUnits;
      liability.bookValueMinor += directive.bookValueMinor;
    }
    const ordering = orderEntriesWithLegacySameDayPolicy(entries, catalog, accountsById);
    ordered = ordering.ordered;
    orderingDiagnostics = ordering.diagnostics;
    for (const entry of ordered) {
      const sourceOperationId = getPhase5OperationId(entry);
      const overlayDirective = activeOverlayBySourceOperationId.get(sourceOperationId);
      if (overlayDirective) {
        const overlayAccount = catalog.byAccountId.get(overlayDirective.stableInventoryAccountId);
        if (!overlayAccount || entry.creditAccountId !== overlayDirective.stableInventoryAccountId) {
          fail('invalid_historical_overlay', `Overlay ${overlayDirective.overlayId} does not target an outgoing movement from its inventory account`, entry, overlayDirective.stableInventoryAccountId);
        }
        historicalInventoryOverlays.push(applyHistoricalOverlayDirective(
          overlayDirective,
          entry,
          overlayAccount,
          states[overlayAccount.inventoryAccountId],
          options.calculationGenerationId ?? 0,
        ));
      }

      const debitAccountForIsolation = entry.debitAccountId ? accountsById.get(entry.debitAccountId) : accountsByName.get(entry.debit);
      const creditAccountForIsolation = entry.creditAccountId ? accountsById.get(entry.creditAccountId) : accountsByName.get(entry.credit);
      const isolatedInvalidAccount = [debitAccountForIsolation, creditAccountForIsolation].find(account =>
        account?.is_inventory && catalog.invalidAccounts.has(account.id ?? account.name));
      if (isolatedInvalidAccount) {
        const reason = catalog.invalidAccounts.get(isolatedInvalidAccount.id ?? isolatedInvalidAccount.name)!;
        if (options.saveValidationOperationId === getPhase5OperationId(entry)) {
          fail(reason, 'Inventory account configuration is invalid: ' + reason, entry, isolatedInvalidAccount.id);
        }
        continue;
      }
      const debitInventory = resolveInventorySide(entry, 'debit', catalog);
      const creditInventory = resolveInventorySide(entry, 'credit', catalog);
      const debitLooksInventory = sideLooksLikeInventory(entry, 'debit', accountsByName);
      const creditLooksInventory = sideLooksLikeInventory(entry, 'credit', accountsByName);
      if ((debitLooksInventory && !entry.debitAccountId) || (creditLooksInventory && !entry.creditAccountId)) {
        fail('missing_inventory_account_id', 'Inventory operation is missing a stable accountId', entry);
      }
      if (
        (entry.debitAccountId && debitLooksInventory && !debitInventory)
        || (entry.creditAccountId && creditLooksInventory && !creditInventory)
      ) {
        fail('unknown_inventory_account', 'Inventory operation references an unknown accountId', entry);
      }

      const debitAccount = entry.debitAccountId ? accountsById.get(entry.debitAccountId) : undefined;
      const creditAccount = entry.creditAccountId ? accountsById.get(entry.creditAccountId) : undefined;
      const baseClassification = classify(entry, debitInventory, creditInventory);
      const classification: InventoryCostOperationClassification =
        isOpeningEntry(entry) && isMerchantAccount(creditAccount)
          ? 'merchant_liability_opening'
          : entry.tx === 'حوالة' && isMerchantAccount(debitAccount) && isMerchantAccount(creditAccount)
            ? 'merchant_liability_transfer'
            : baseClassification;
      if (
        !debitInventory
        && !creditInventory
        && classification !== 'manufacturing'
        && classification !== 'merchant_cash_settlement'
        && classification !== 'merchant_liability_opening'
        && classification !== 'merchant_liability_transfer'
      ) continue;
      if (classification === 'non_cost') {
        const rawWeight = Number(normalizeNumerals(String(entry.weight ?? '0')));
        const rawCount = Number(normalizeNumerals(String(entry.count ?? '0')));
        const metal = debitInventory?.kind !== 'accessory' ? debitInventory : creditInventory?.kind !== 'accessory' ? creditInventory : undefined;
        if (metal && rawWeight === 0 && Number.isFinite(rawCount) && rawCount !== 0) {
          results.push(blankResult(entry, 'quantity_only'));
          continue;
        }
        fail('unknown_inventory_operation', `Unknown inventory operation variant: ${entry.tx}`, entry);
      }

      if (classification === 'merchant_liability_opening') {
        const merchantAccountId = entry.creditAccountId;
        if (!merchantAccountId || !creditAccount) {
          fail('missing_inventory_account_id', 'Merchant opening liability requires merchant accountId', entry);
        }
        if (creditAccount.metal !== 'gold' && creditAccount.metal !== 'silver') {
          fail('unknown_inventory_operation', 'Merchant opening liability requires gold or silver account metadata', entry);
        }
        const standardizedWeight = parseScaledDecimal(
          creditAccount.metal === 'silver' ? entry.weight : (entry.arabicWeight || entry.weight),
          GRAM_SCALE,
          2,
          'merchant opening liability weight',
          entry,
          true,
          true,
        );
        const physicalWeight = parseScaledDecimal(
          entry.weight,
          GRAM_SCALE,
          2,
          'merchant opening physical weight',
          entry,
          true,
          true,
        );
        if (standardizedWeight === 0) continue;
        const year = entry.date.slice(0, 4);
        const price = parseConfigMinor(
          creditAccount.metal === 'silver'
            ? openingConfig.silverPriceByYearMinor?.[year]
            : openingConfig.gold21PriceByYearMinor?.[year],
          `${creditAccount.metal === 'silver' ? 'silver' : 'gold E21'} merchant opening price`,
          entry,
        );
        const bookValue = toSafeInteger(
          roundDivide(BigInt(standardizedWeight) * BigInt(price), BigInt(GRAM_SCALE)),
          'merchant opening liability book value',
          entry,
        );
        const liability = merchantState(merchantAccountId);
        liability.standardizedWeightUnits += standardizedWeight;
        liability.physicalWeightUnits += physicalWeight;
        liability.bookValueMinor += bookValue;
        const result = blankResult(entry, classification);
        result.merchantLiabilityIncreaseMinor = bookValue;
        results.push(result);
        continue;
      }
      if (classification === 'merchant_liability_transfer') {
        const sourceMerchantAccountId = entry.debitAccountId;
        const destinationMerchantAccountId = entry.creditAccountId;
        if (!sourceMerchantAccountId || !destinationMerchantAccountId || !debitAccount || !creditAccount) {
          fail('missing_inventory_account_id', 'Merchant liability transfer requires both merchant accountIds', entry);
        }
        if (debitAccount.metal !== creditAccount.metal
          || (creditAccount.metal !== 'gold' && creditAccount.metal !== 'silver')) {
          fail('unknown_inventory_operation', 'Merchant liability transfer cannot cross metals', entry);
        }
        const standardizedWeight = parseScaledDecimal(
          creditAccount.metal === 'silver' ? entry.weight : (entry.arabicWeight || entry.weight),
          GRAM_SCALE,
          2,
          'merchant liability transfer weight',
          entry,
          false,
          true,
        );
        const physicalWeight = parseScaledDecimal(
          entry.weight,
          GRAM_SCALE,
          2,
          'merchant liability transfer physical weight',
          entry,
          false,
          true,
        );
        const source = merchantState(sourceMerchantAccountId);
        if (standardizedWeight > source.standardizedWeightUnits) {
          if (!isLegacyEntry(entry)) {
            fail('over_return', 'Merchant liability transfer exceeds source liability weight', entry);
          }
          const gap = standardizedWeight - source.standardizedWeightUnits;
          source.standardizedWeightUnits += gap;
          source.physicalWeightUnits += Math.max(0, physicalWeight - source.physicalWeightUnits);
          source.unresolvedWeightUnits += gap;
          unresolvedCostData.push({
            code: 'unresolved_merchant_cost',
            operationId: getPhase5OperationId(entry),
            message: 'Historical merchant liability transfer has no complete source book value',
            requiredCorrection: 'أدخل رصيد التزام التاجر المصدر الافتتاحي وقيمته الدفترية قبل الحوالة.',
          });
        }
        const transferredBookValue = standardizedWeight === source.standardizedWeightUnits
          ? source.bookValueMinor
          : proportionalCost(
            source.bookValueMinor,
            standardizedWeight,
            source.standardizedWeightUnits,
            entry,
            'merchant liability transfer',
          );
        const transferredUnresolvedWeight = Math.min(source.unresolvedWeightUnits, standardizedWeight);
        source.standardizedWeightUnits -= standardizedWeight;
        source.physicalWeightUnits = Math.max(0, source.physicalWeightUnits - physicalWeight);
        source.bookValueMinor -= transferredBookValue;
        source.unresolvedWeightUnits -= transferredUnresolvedWeight;
        const destination = merchantState(destinationMerchantAccountId);
        destination.standardizedWeightUnits += standardizedWeight;
        destination.physicalWeightUnits += physicalWeight;
        destination.bookValueMinor += transferredBookValue;
        destination.unresolvedWeightUnits += transferredUnresolvedWeight;
        const result = blankResult(entry, classification);
        result.merchantLiabilityDecreaseMinor = transferredBookValue;
        result.merchantLiabilityIncreaseMinor = transferredBookValue;
        results.push(result);
        continue;
      }
      if (classification === 'merchant_cash_settlement') {
        const merchantAccountId = entry.debitAccountId;
        if (!merchantAccountId) fail('missing_inventory_account_id', 'Merchant cash settlement requires merchant accountId', entry);
        const liability = merchantState(merchantAccountId);
        const settledWeight = parseScaledDecimal(entry.merchantGoldWeight, GRAM_SCALE, 2, 'merchant settlement Standard-21 weight', entry, false, true);
        if (settledWeight > liability.standardizedWeightUnits) fail('over_return', 'Cash settlement exceeds merchant gold liability weight', entry);
        const liabilityDecrease = settledWeight === liability.standardizedWeightUnits
          ? liability.bookValueMinor
          : proportionalCost(liability.bookValueMinor, settledWeight, liability.standardizedWeightUnits, entry, 'merchant cash liability settlement');
        const cashPaid = parseMoneyMinor(entry.cash, entry, false);
        liability.standardizedWeightUnits -= settledWeight;
        liability.physicalWeightUnits = Math.max(0, liability.physicalWeightUnits - settledWeight);
        liability.bookValueMinor -= liabilityDecrease;
        liability.unresolvedWeightUnits = Math.max(0, liability.unresolvedWeightUnits - settledWeight);
        const difference = liabilityDecrease - cashPaid;
        const result = blankResult(entry, classification);
        Object.assign(result, {
          merchantLiabilityDecreaseMinor: liabilityDecrease,
          merchantSettlementGainMinor: Math.max(0, difference),
          merchantSettlementLossMinor: Math.max(0, -difference),
        });
        results.push(result);
        continue;
      }
      if (classification === 'manufacturing') {
        const transformation = entry.manufacturing;
        if (!transformation || transformation.version !== 'manufacturing-v1'
          || transformation.inputs.length === 0 || transformation.outputs.length === 0) {
          fail('invalid_manufacturing', 'Manufacturing requires a versioned transformation with inputs and outputs', entry);
        }
        const workingStates: Record<string, InventoryCostState> = { ...states };
        const touched = new Set<string>();
        const mutableState = (accountId: string): InventoryCostState => {
          if (!touched.has(accountId)) {
            workingStates[accountId] = cloneState(states[accountId]);
            touched.add(accountId);
          }
          return workingStates[accountId];
        };
        let inputStandardUnits = 0;
        let inputPhysicalUnits = 0;
        let inputMetalCost = 0;
        let inputWorkmanshipCost = 0;
        let inputAccessoryCost = 0;
        const costPostingMovements: NonNullable<OperationCostResultV2['costPostingMovements']> = [];
        for (const movement of transformation.inputs) {
          const account = catalog.byAccountId.get(movement.inventoryAccountId);
          if (!account) fail('unknown_inventory_account', 'Unknown manufacturing input accountId', entry, movement.inventoryAccountId);
          const quantity = manufacturingMovementQuantity(movement, account, entry);
          const source = mutableState(account.inventoryAccountId);
          const removed = calculateRemoval(source, quantity, entry);
          applyRemoval(source, quantity, removed, entry);
          inputStandardUnits += quantity.standardizedUnits;
          inputPhysicalUnits += quantity.physicalUnits;
          inputMetalCost += removed.metalCostMinor;
          inputWorkmanshipCost += removed.workmanshipCostMinor;
          inputAccessoryCost += removed.accessoryCostMinor;
          costPostingMovements.push({ accountId: account.inventoryAccountId, side: 'credit', amountMinor: removed.totalCostMinor, role: 'raw_material' });
        }
        const outputDefinitions = transformation.outputs.map(movement => {
          const account = catalog.byAccountId.get(movement.inventoryAccountId);
          if (!account) fail('unknown_inventory_account', 'Unknown manufacturing output accountId', entry, movement.inventoryAccountId);
          return { movement, account, quantity: manufacturingMovementQuantity(movement, account, entry) };
        });
        const outputStandardUnits = outputDefinitions.reduce((sum, item) => sum + item.quantity.standardizedUnits, 0);
        const outputPhysicalUnits = outputDefinitions.reduce((sum, item) => sum + item.quantity.physicalUnits, 0);
        const normalLossUnits = transformation.normalLossStandardizedUnits ?? 0;
        const abnormalLossUnits = transformation.abnormalLossStandardizedUnits ?? 0;
        if (![normalLossUnits, abnormalLossUnits].every(Number.isSafeInteger)
          || normalLossUnits < 0 || abnormalLossUnits < 0
          || outputStandardUnits + normalLossUnits + abnormalLossUnits !== inputStandardUnits) {
          fail('invalid_manufacturing', 'Manufacturing Standard-21 inputs must equal outputs plus normal and abnormal loss', entry);
        }
        const conversionCost = transformation.directConversionCostMinor ?? 0;
        if (!Number.isSafeInteger(conversionCost) || conversionCost < 0) {
          fail('invalid_amount', 'Direct conversion cost must be a non-negative integer minor amount', entry);
        }
        const inputTotalCost = inputMetalCost + inputWorkmanshipCost + inputAccessoryCost;
        const totalAvailableCost = inputTotalCost + conversionCost;
        let abnormalLossCost = transformation.abnormalLossCostMinor;
        if (abnormalLossCost === undefined) {
          abnormalLossCost = abnormalLossUnits === 0 ? 0
            : proportionalCost(totalAvailableCost, abnormalLossUnits, inputStandardUnits, entry, 'manufacturing abnormal loss cost');
        }
        if (!Number.isSafeInteger(abnormalLossCost) || abnormalLossCost < 0 || abnormalLossCost > totalAvailableCost) {
          fail('invalid_manufacturing', 'Abnormal loss cost is outside the available manufacturing cost', entry);
        }
        const distributableCost = totalAvailableCost - abnormalLossCost;
        const explicitCost = outputDefinitions.reduce((sum, item) => sum + (item.movement.allocatedCostMinor ?? 0), 0);
        if (!outputDefinitions.every(item => item.movement.allocatedCostMinor === undefined
          || (Number.isSafeInteger(item.movement.allocatedCostMinor) && Number(item.movement.allocatedCostMinor) >= 0))
          || explicitCost > distributableCost) {
          fail('invalid_manufacturing', 'Manufacturing output allocations exceed available cost', entry);
        }
        const unallocated = outputDefinitions.filter(item => item.movement.allocatedCostMinor === undefined);
        if (unallocated.length === 0 && explicitCost !== distributableCost) {
          fail('invalid_manufacturing', 'Explicit output allocations must equal distributable manufacturing cost', entry);
        }
        const remainingForAutomatic = distributableCost - explicitCost;
        const automaticBasis = unallocated.reduce((sum, item) => sum + item.quantity.standardizedUnits, 0);
        let automaticAssigned = 0;
        const totalAllocations = outputDefinitions.map((item, index) => {
          if (item.movement.allocatedCostMinor !== undefined) return Number(item.movement.allocatedCostMinor);
          const isLastAutomatic = unallocated[unallocated.length - 1] === item;
          const allocated = isLastAutomatic
            ? remainingForAutomatic - automaticAssigned
            : proportionalCost(remainingForAutomatic, item.quantity.standardizedUnits, automaticBasis, entry, `manufacturing output ${index + 1}`);
          automaticAssigned += allocated;
          return allocated;
        });
        const abnormalMetalCost = inputTotalCost === 0 ? 0
          : proportionalCost(inputMetalCost, abnormalLossCost, totalAvailableCost, entry, 'abnormal metal loss');
        const distributableMetalCost = inputMetalCost - abnormalMetalCost;
        const distributableWorkmanshipCost = distributableCost - distributableMetalCost - inputAccessoryCost;
        let metalAssigned = 0;
        let workmanshipAssigned = 0;
        outputDefinitions.forEach((item, index) => {
          const isLast = index === outputDefinitions.length - 1;
          const totalCost = totalAllocations[index];
          const metalCost = isLast ? distributableMetalCost - metalAssigned
            : proportionalCost(distributableMetalCost, totalCost, distributableCost || 1, entry, 'manufacturing metal allocation');
          const workmanshipCost = isLast ? distributableWorkmanshipCost - workmanshipAssigned
            : proportionalCost(distributableWorkmanshipCost, totalCost, distributableCost || 1, entry, 'manufacturing workmanship allocation');
          metalAssigned += metalCost;
          workmanshipAssigned += workmanshipCost;
          addIncoming(mutableState(item.account.inventoryAccountId), item.quantity, metalCost, workmanshipCost, 0, entry);
          costPostingMovements.push({ accountId: item.account.inventoryAccountId, side: 'debit', amountMinor: totalCost, role: item.movement.role ?? 'finished_good' });
        });
        touched.forEach(accountId => { states[accountId] = workingStates[accountId]; });
        const result = blankResult(entry, classification);
        Object.assign(result, {
          sourceInventoryAccountId: transformation.inputs.length === 1 ? transformation.inputs[0].inventoryAccountId : undefined,
          destinationInventoryAccountId: transformation.outputs.length === 1 ? transformation.outputs[0].inventoryAccountId : undefined,
          outgoingStandardizedQuantityUnits: inputStandardUnits,
          outgoingActualPhysicalWeightUnits: inputPhysicalUnits,
          outgoingMetalCostMinor: inputMetalCost,
          outgoingWorkmanshipCostMinor: inputWorkmanshipCost,
          outgoingTotalCostMinor: inputTotalCost,
          incomingStandardizedQuantityUnits: outputStandardUnits,
          incomingActualPhysicalWeightUnits: outputPhysicalUnits,
          incomingMetalCostMinor: distributableMetalCost,
          incomingWorkmanshipCostMinor: distributableWorkmanshipCost,
          incomingTotalCostMinor: distributableCost,
          manufacturingConversionCostMinor: conversionCost,
          manufacturingAbnormalLossMinor: abnormalLossCost,
          adjustmentLossMinor: abnormalLossCost,
          costPostingMovements,
        });
        results.push(result);
        continue;
      }
      if (classification === 'opening' || classification === 'customer_purchase' || classification === 'merchant_receipt') {
        if (!debitInventory) fail('missing_inventory_account_id', 'Incoming inventory accountId is missing', entry);
        const state = states[debitInventory.inventoryAccountId];
        const quantity = movementQuantity(entry, debitInventory);
        if (classification === 'opening' && debitInventory.kind === 'accessory' && quantity.accessoryUnits === 0) {
          const result = blankResult(entry, classification);
          Object.assign(result, {
            inventoryAccountId: debitInventory.inventoryAccountId,
            destinationInventoryAccountId: debitInventory.inventoryAccountId,
          });
          results.push(result);
          continue;
        }
        let metalCost = 0;
        let workmanshipCost = 0;
        let accessoryCost = 0;
        if (classification === 'opening') {
          try {
            const costs = openingCosts(entry, debitInventory, quantity, openingConfig);
            metalCost = costs.metal;
            workmanshipCost = costs.workmanship;
            accessoryCost = costs.accessory;
          } catch (error) {
            if (!(error instanceof CostEngineError) || error.diagnostic.code !== 'missing_opening_cost') throw error;
            state.standardizedQuantityUnits += quantity.standardizedUnits;
            state.actualPhysicalWeightUnits += quantity.physicalUnits;
            state.accessoryQuantityUnits += quantity.accessoryUnits;
            state.hasReliableCostBasis = false;
            state.lastProcessedOperationId = getPhase5OperationId(entry);
            updateDerivedState(state);
            excludedAccountReasons.set(debitInventory.inventoryAccountId, 'missing_cost_basis');
            results.push(blankResult(entry, classification));
            continue;
          }
        } else if (classification === 'customer_purchase') {
          const amount = parseMoneyMinor(entry.cash, entry, false);
          if (debitInventory.kind === 'accessory') accessoryCost = amount;
          else metalCost = amount;
        } else {
          if (debitInventory.kind === 'accessory') {
            fail('unknown_inventory_operation', 'Merchant receipt does not support accessories', entry);
          }
          const recognizedMetalValue = calculateMerchantInvoiceMetalValueMinor(entry, accounts)
            ?? entry.transactionGoldValueMinor
            ?? entry.merchantGoldBookValueMinor;
          if (Number.isSafeInteger(recognizedMetalValue) && Number(recognizedMetalValue) > 0) {
            metalCost = Number(recognizedMetalValue);
          } else if (isLegacyEntry(entry)) {
            unresolvedCostData.push({
              code: 'unresolved_merchant_cost',
              operationId: getPhase5OperationId(entry),
              inventoryAccountId: debitInventory.inventoryAccountId,
              message: 'Historical merchant receipt has no approved EGP metal carrying value',
              requiredCorrection: 'أدخل القيمة الدفترية التاريخية المعتمدة أو أضف Historical Cost Overlay مُراجعًا.',
            });
          } else {
            fail('unresolved_merchant_cost', 'Merchant receipt requires the official invoice price per gram', entry, debitInventory.inventoryAccountId);
          }
          workmanshipCost = entry.workmanshipCostMinor === undefined
            ? parseMoneyMinor(entry.cash, entry, true)
            : Number(entry.workmanshipCostMinor);
          if (!Number.isSafeInteger(workmanshipCost) || workmanshipCost < 0) {
            fail('invalid_amount', 'Merchant workmanship must be non-negative integer minor units', entry);
          }
          if (workmanshipCost > 0 && quantity.physicalUnits <= 0) {
            fail('merchant_workmanship_without_weight', 'Merchant workmanship requires positive physical weight', entry);
          }
          const merchantAccountId = entry.creditAccountId;
          if (!merchantAccountId) fail('missing_inventory_account_id', 'Merchant receipt requires merchant accountId', entry);
          const liability = merchantState(merchantAccountId);
          liability.standardizedWeightUnits += quantity.standardizedUnits;
          liability.physicalWeightUnits += quantity.physicalUnits;
          liability.bookValueMinor += metalCost;
          if (metalCost === 0) liability.unresolvedWeightUnits += quantity.standardizedUnits;
        }
        addIncoming(state, quantity, metalCost, workmanshipCost, accessoryCost, entry);
        const result = blankResult(entry, classification);
        Object.assign(result, {
          inventoryAccountId: debitInventory.inventoryAccountId,
          destinationInventoryAccountId: debitInventory.inventoryAccountId,
          incomingStandardizedQuantityUnits: quantity.standardizedUnits,
          incomingActualPhysicalWeightUnits: quantity.physicalUnits,
          incomingAccessoryQuantityUnits: quantity.accessoryUnits,
          incomingMetalCostMinor: metalCost,
          incomingWorkmanshipCostMinor: workmanshipCost,
          incomingTotalCostMinor: metalCost + workmanshipCost + accessoryCost,
          merchantLiabilityIncreaseMinor: classification === 'merchant_receipt' ? metalCost : 0,
        });
        results.push(result);
        continue;
      }

      if (classification === 'customer_return' || classification === 'supplier_return') {
        if (!entry.originalOperationId) fail('missing_original_operation', 'Return requires originalOperationId', entry);
        const original = results.find(item => item.operationId === entry.originalOperationId);
        const expected = classification === 'customer_return'
          ? original?.classification === 'sale'
          : original?.classification === 'customer_purchase' || original?.classification === 'merchant_receipt';
        if (!original || !expected) fail('missing_original_operation', 'Return does not reference an eligible earlier operation', entry);
        const inventory = classification === 'customer_return' ? debitInventory : creditInventory;
        if (!inventory) fail('missing_inventory_account_id', 'Return inventory accountId is missing', entry);
        const originalAccountId = classification === 'customer_return'
          ? original.sourceInventoryAccountId : original.destinationInventoryAccountId;
        if (originalAccountId !== inventory.inventoryAccountId) {
          fail('missing_original_operation', 'Return inventory account differs from the original operation', entry, inventory.inventoryAccountId);
        }
        const quantity = movementQuantity(entry, inventory);
        const originalQuantity: MovementQuantity = {
          standardizedUnits: classification === 'customer_return'
            ? original.outgoingStandardizedQuantityUnits : original.incomingStandardizedQuantityUnits,
          physicalUnits: classification === 'customer_return'
            ? original.outgoingActualPhysicalWeightUnits : original.incomingActualPhysicalWeightUnits,
          accessoryUnits: classification === 'customer_return'
            ? original.outgoingAccessoryQuantityUnits : original.incomingAccessoryQuantityUnits,
        };
        const returned = returnedByOriginalOperation.get(entry.originalOperationId)
          ?? { standardizedUnits: 0, physicalUnits: 0, accessoryUnits: 0 };
        if (returned.standardizedUnits + quantity.standardizedUnits > originalQuantity.standardizedUnits
          || returned.physicalUnits + quantity.physicalUnits > originalQuantity.physicalUnits
          || returned.accessoryUnits + quantity.accessoryUnits > originalQuantity.accessoryUnits) {
          fail('over_return', 'Returned quantity exceeds the unreturned quantity of the original operation', entry, inventory.inventoryAccountId);
        }
        const costFrom = classification === 'customer_return'
          ? { metal: original.outgoingMetalCostMinor, workmanship: original.outgoingWorkmanshipCostMinor,
              accessory: original.outgoingTotalCostMinor - original.outgoingMetalCostMinor - original.outgoingWorkmanshipCostMinor }
          : { metal: original.incomingMetalCostMinor, workmanship: original.incomingWorkmanshipCostMinor,
              accessory: original.incomingTotalCostMinor - original.incomingMetalCostMinor - original.incomingWorkmanshipCostMinor };
        const metalCost = originalQuantity.standardizedUnits > 0
          ? proportionalCost(costFrom.metal, quantity.standardizedUnits, originalQuantity.standardizedUnits, entry, 'original return metal cost') : 0;
        let workmanshipCost = originalQuantity.physicalUnits > 0
          ? proportionalCost(costFrom.workmanship, quantity.physicalUnits, originalQuantity.physicalUnits, entry, 'original return workmanship cost') : 0;
        if (classification === 'supplier_return' && !entry.reverseWorkmanshipOnReturn) workmanshipCost = 0;
        const accessoryCost = originalQuantity.accessoryUnits > 0
          ? proportionalCost(costFrom.accessory, quantity.accessoryUnits, originalQuantity.accessoryUnits, entry, 'original return accessory cost') : 0;
        const restored: RemovedCost = { metalCostMinor: metalCost, workmanshipCostMinor: workmanshipCost,
          accessoryCostMinor: accessoryCost, totalCostMinor: metalCost + workmanshipCost + accessoryCost };
        const state = states[inventory.inventoryAccountId];
        if (classification === 'customer_return') {
          addIncoming(state, quantity, metalCost, workmanshipCost, accessoryCost, entry);
        } else {
          applySpecifiedRemoval(state, quantity, restored, entry);
        }
        returnedByOriginalOperation.set(entry.originalOperationId, {
          standardizedUnits: returned.standardizedUnits + quantity.standardizedUnits,
          physicalUnits: returned.physicalUnits + quantity.physicalUnits,
          accessoryUnits: returned.accessoryUnits + quantity.accessoryUnits,
        });
        const primaryReturned = inventory.kind === 'accessory' ? quantity.accessoryUnits : quantity.standardizedUnits;
        const primaryOriginal = inventory.kind === 'accessory' ? originalQuantity.accessoryUnits : originalQuantity.standardizedUnits;
        const revenueReversal = classification === 'customer_return' && primaryOriginal > 0
          ? proportionalCost(original.saleAmountMinor, primaryReturned, primaryOriginal, entry, 'original revenue reversal') : 0;
        const result = blankResult(entry, classification);
        if (classification === 'supplier_return' && original.classification === 'merchant_receipt') {
          const merchantAccountId = original.entry.creditAccountId;
          if (!merchantAccountId) fail('missing_original_operation', 'Original merchant receipt is missing merchant accountId', entry);
          const liability = merchantState(merchantAccountId);
          if (quantity.standardizedUnits > liability.standardizedWeightUnits || metalCost > liability.bookValueMinor) {
            fail('over_return', 'Merchant return exceeds the remaining merchant liability', entry);
          }
          liability.standardizedWeightUnits -= quantity.standardizedUnits;
          liability.physicalWeightUnits = Math.max(0, liability.physicalWeightUnits - quantity.physicalUnits);
          liability.bookValueMinor -= metalCost;
          result.merchantLiabilityDecreaseMinor = metalCost;
        }
        Object.assign(result, {
          inventoryAccountId: inventory.inventoryAccountId,
          sourceInventoryAccountId: classification === 'supplier_return' ? inventory.inventoryAccountId : undefined,
          destinationInventoryAccountId: classification === 'customer_return' ? inventory.inventoryAccountId : undefined,
          incomingStandardizedQuantityUnits: classification === 'customer_return' ? quantity.standardizedUnits : 0,
          incomingActualPhysicalWeightUnits: classification === 'customer_return' ? quantity.physicalUnits : 0,
          incomingAccessoryQuantityUnits: classification === 'customer_return' ? quantity.accessoryUnits : 0,
          outgoingStandardizedQuantityUnits: classification === 'supplier_return' ? quantity.standardizedUnits : 0,
          outgoingActualPhysicalWeightUnits: classification === 'supplier_return' ? quantity.physicalUnits : 0,
          outgoingAccessoryQuantityUnits: classification === 'supplier_return' ? quantity.accessoryUnits : 0,
          incomingMetalCostMinor: classification === 'customer_return' ? metalCost : 0,
          incomingWorkmanshipCostMinor: classification === 'customer_return' ? workmanshipCost : 0,
          incomingTotalCostMinor: classification === 'customer_return' ? restored.totalCostMinor : 0,
          outgoingMetalCostMinor: classification === 'supplier_return' ? metalCost : 0,
          outgoingWorkmanshipCostMinor: classification === 'supplier_return' ? workmanshipCost : 0,
          outgoingTotalCostMinor: classification === 'supplier_return' ? restored.totalCostMinor : 0,
          revenueReversalMinor: revenueReversal,
          reversedCogsMinor: classification === 'customer_return' ? restored.totalCostMinor : 0,
          purchaseCostReversalMinor: classification === 'supplier_return' ? restored.totalCostMinor : 0,
        });
        results.push(result);
        continue;
      }

      if (classification === 'sale' || classification === 'shortage') {
        if (!creditInventory) fail('missing_inventory_account_id', 'Outgoing inventory accountId is missing', entry);
        const state = states[creditInventory.inventoryAccountId];
        const quantity = movementQuantity(entry, creditInventory);
        if (
          classification === 'shortage'
          && creditInventory.kind !== 'accessory'
          && quantity.standardizedUnits === 0
          && Number(normalizeNumerals(String(entry.count ?? '0'))) !== 0
        ) {
          results.push(blankResult(entry, 'quantity_only'));
          continue;
        }
        const removed = calculateRemoval(state, quantity, entry);
        applyRemoval(state, quantity, removed, entry);
        const result = blankResult(entry, classification);
        const saleAmount = classification === 'sale' ? parseMoneyMinor(entry.cash, entry, true) : 0;
        Object.assign(result, {
          inventoryAccountId: creditInventory.inventoryAccountId,
          sourceInventoryAccountId: creditInventory.inventoryAccountId,
          outgoingStandardizedQuantityUnits: quantity.standardizedUnits,
          outgoingActualPhysicalWeightUnits: quantity.physicalUnits,
          outgoingAccessoryQuantityUnits: quantity.accessoryUnits,
          outgoingMetalCostMinor: removed.metalCostMinor,
          outgoingWorkmanshipCostMinor: removed.workmanshipCostMinor,
          outgoingTotalCostMinor: removed.totalCostMinor,
          metalCogsMinor: classification === 'sale' ? removed.metalCostMinor : 0,
          workmanshipCogsMinor: classification === 'sale' ? removed.workmanshipCostMinor : 0,
          totalCogsMinor: classification === 'sale' ? removed.totalCostMinor : 0,
          saleAmountMinor: saleAmount,
          profitMinor: classification === 'sale' ? saleAmount - removed.totalCostMinor : null,
          adjustmentLossMinor: classification === 'shortage' ? removed.totalCostMinor : 0,
        });
        results.push(result);
        continue;
      }

      if (classification === 'pending_surplus' || classification === 'approved_surplus') {
        if (!debitInventory) fail('missing_inventory_account_id', 'Surplus inventory accountId is missing', entry);
        const state = states[debitInventory.inventoryAccountId];
        const quantity = movementQuantity(entry, debitInventory);
        if (
          debitInventory.kind !== 'accessory'
          && quantity.standardizedUnits === 0
          && Number(normalizeNumerals(String(entry.count ?? '0'))) !== 0
        ) {
          results.push(blankResult(entry, 'quantity_only'));
          continue;
        }

        // A surplus belongs to this inventory pool. When that same pool has a
        // reliable pre-operation WAC, value the new quantity at that WAC and
        // recognize an equal inventory-surplus gain. Manual values (including
        // historical overlays) are only a fallback when no valid WAC exists.
        if (hasValidPreOperationWac(state)) {
          const wacBeforeMinorPerDisplayUnit = state.totalWacMinorPerDisplayUnit;
          const surplusCost = calculateAtCurrentWac(state, quantity, entry);
          addIncoming(
            state,
            quantity,
            surplusCost.metalCostMinor,
            surplusCost.workmanshipCostMinor,
            surplusCost.accessoryCostMinor,
            entry,
          );
          const result = blankResult(entry, 'surplus');
          Object.assign(result, {
            inventoryAccountId: debitInventory.inventoryAccountId,
            destinationInventoryAccountId: debitInventory.inventoryAccountId,
            incomingStandardizedQuantityUnits: quantity.standardizedUnits,
            incomingActualPhysicalWeightUnits: quantity.physicalUnits,
            incomingAccessoryQuantityUnits: quantity.accessoryUnits,
            incomingMetalCostMinor: surplusCost.metalCostMinor,
            incomingWorkmanshipCostMinor: surplusCost.workmanshipCostMinor,
            incomingTotalCostMinor: surplusCost.totalCostMinor,
            adjustmentGainMinor: surplusCost.totalCostMinor,
            wacBeforeMinorPerDisplayUnit,
            wacAfterMinorPerDisplayUnit: state.totalWacMinorPerDisplayUnit,
          });
          results.push(result);
          continue;
        }

        if (classification === 'pending_surplus') {
          state.pendingStandardizedQuantityUnits += quantity.standardizedUnits;
          state.pendingActualPhysicalWeightUnits += quantity.physicalUnits;
          state.pendingAccessoryQuantityUnits += quantity.accessoryUnits;
          unresolvedCostData.push({
            code: 'pending_surplus_cost', operationId: getPhase5OperationId(entry),
            inventoryAccountId: debitInventory.inventoryAccountId,
            message: 'Inventory surplus has no valid pre-operation WAC and is excluded pending approval',
            requiredCorrection: 'لا يوجد WAC سابق صالح؛ أدخل Manual Cost Assignment موثقًا.',
          });
          const result = blankResult(entry, classification);
          Object.assign(result, {
            inventoryAccountId: debitInventory.inventoryAccountId,
            destinationInventoryAccountId: debitInventory.inventoryAccountId,
            incomingStandardizedQuantityUnits: quantity.standardizedUnits,
            incomingActualPhysicalWeightUnits: quantity.physicalUnits,
            incomingAccessoryQuantityUnits: quantity.accessoryUnits,
            wacBeforeMinorPerDisplayUnit: null,
            wacAfterMinorPerDisplayUnit: null,
          });
          results.push(result);
          continue;
        }
        if (!Number.isSafeInteger(entry.manualCostAssignmentMinor)
          || Number(entry.manualCostAssignmentMinor) <= 0
          || !entry.costAssignmentApprovedAt || !entry.costAssignmentApprovedBy) {
          fail('pending_surplus_cost', 'Approved surplus requires positive manual cost, approver and approval timestamp', entry, debitInventory.inventoryAccountId);
        }
        const assignedCost = Number(entry.manualCostAssignmentMinor);
        const metalCost = debitInventory.kind === 'accessory' ? 0 : assignedCost;
        const accessoryCost = debitInventory.kind === 'accessory' ? assignedCost : 0;
        addIncoming(state, quantity, metalCost, 0, accessoryCost, entry);
        const result = blankResult(entry, classification);
        Object.assign(result, {
          inventoryAccountId: debitInventory.inventoryAccountId,
          destinationInventoryAccountId: debitInventory.inventoryAccountId,
          incomingStandardizedQuantityUnits: quantity.standardizedUnits,
          incomingActualPhysicalWeightUnits: quantity.physicalUnits,
          incomingAccessoryQuantityUnits: quantity.accessoryUnits,
          incomingMetalCostMinor: metalCost,
          incomingTotalCostMinor: assignedCost,
          adjustmentGainMinor: assignedCost,
          wacBeforeMinorPerDisplayUnit: null,
          wacAfterMinorPerDisplayUnit: state.totalWacMinorPerDisplayUnit,
        });
        results.push(result);
        continue;
      }

      if (classification === 'transfer' || classification === 'tafyeet') {
        if (!debitInventory || !creditInventory) {
          fail('missing_inventory_account_id', 'Transfer/Tafyeet requires source and destination accountIds', entry);
        }
        if (debitInventory.kind !== creditInventory.kind) {
          fail('unknown_inventory_operation', 'Cross-type inventory transfer is not supported', entry);
        }
        if (debitInventory.inventoryAccountId === creditInventory.inventoryAccountId) {
          fail('unknown_inventory_operation', 'Transfer source and destination must differ', entry);
        }
        const sourceQuantity = movementQuantity(entry, creditInventory);
        const destinationQuantity = movementQuantity(entry, debitInventory);
        validateSameMovement(sourceQuantity, destinationQuantity, entry, classification === 'tafyeet');
        const sourceOriginal = states[creditInventory.inventoryAccountId];
        const destinationOriginal = states[debitInventory.inventoryAccountId];
        const source = cloneState(sourceOriginal);
        const destination = cloneState(destinationOriginal);
        const removed = calculateRemoval(source, sourceQuantity, entry);
        applyRemoval(source, sourceQuantity, removed, entry);
        addIncoming(
          destination,
          destinationQuantity,
          removed.metalCostMinor,
          removed.workmanshipCostMinor,
          removed.accessoryCostMinor,
          entry,
        );
        states[creditInventory.inventoryAccountId] = source;
        states[debitInventory.inventoryAccountId] = destination;
        const result = blankResult(entry, classification);
        Object.assign(result, {
          sourceInventoryAccountId: creditInventory.inventoryAccountId,
          destinationInventoryAccountId: debitInventory.inventoryAccountId,
          outgoingStandardizedQuantityUnits: sourceQuantity.standardizedUnits,
          outgoingActualPhysicalWeightUnits: sourceQuantity.physicalUnits,
          outgoingAccessoryQuantityUnits: sourceQuantity.accessoryUnits,
          incomingStandardizedQuantityUnits: destinationQuantity.standardizedUnits,
          incomingActualPhysicalWeightUnits: destinationQuantity.physicalUnits,
          incomingAccessoryQuantityUnits: destinationQuantity.accessoryUnits,
          outgoingMetalCostMinor: removed.metalCostMinor,
          outgoingWorkmanshipCostMinor: removed.workmanshipCostMinor,
          outgoingTotalCostMinor: removed.totalCostMinor,
          incomingMetalCostMinor: removed.metalCostMinor,
          incomingWorkmanshipCostMinor: removed.workmanshipCostMinor,
          incomingTotalCostMinor: removed.totalCostMinor,
        });
        results.push(result);
        continue;
      }

      if (classification === 'merchant_delivery') {
        if (!creditInventory) fail('missing_inventory_account_id', 'Merchant delivery inventory accountId is missing', entry);
        const state = states[creditInventory.inventoryAccountId];
        const quantity = movementQuantity(entry, creditInventory);
        const removed = calculateRemoval(state, quantity, entry);
        const merchantAccountId = entry.debitAccountId;
        if (!merchantAccountId) fail('missing_inventory_account_id', 'Merchant delivery requires merchant accountId', entry);
        const liability = merchantState(merchantAccountId);
        if (quantity.standardizedUnits > liability.standardizedWeightUnits) {
          if (!isLegacyEntry(entry)) fail('insufficient_inventory', 'Merchant delivery exceeds merchant liability weight', entry);
          const gap = quantity.standardizedUnits - liability.standardizedWeightUnits;
          liability.standardizedWeightUnits += gap;
          liability.physicalWeightUnits += Math.max(0, quantity.physicalUnits - liability.physicalWeightUnits);
          liability.unresolvedWeightUnits += gap;
          unresolvedCostData.push({
            code: 'unresolved_merchant_cost', operationId: getPhase5OperationId(entry),
            inventoryAccountId: creditInventory.inventoryAccountId,
            message: 'Historical merchant delivery has no complete opening liability book value',
            requiredCorrection: 'أدخل رصيد التزام التاجر الافتتاحي وقيمته الدفترية قبل التسوية.',
          });
        }
        const liabilityDecrease = liability.standardizedWeightUnits === quantity.standardizedUnits
          ? liability.bookValueMinor
          : proportionalCost(liability.bookValueMinor, quantity.standardizedUnits, liability.standardizedWeightUnits, entry, 'merchant liability settlement');
        applyRemoval(state, quantity, removed, entry);
        liability.standardizedWeightUnits -= quantity.standardizedUnits;
        liability.physicalWeightUnits = Math.max(0, liability.physicalWeightUnits - quantity.physicalUnits);
        liability.bookValueMinor -= liabilityDecrease;
        liability.unresolvedWeightUnits = Math.max(0, liability.unresolvedWeightUnits - quantity.standardizedUnits);
        const settlementDifference = liabilityDecrease - removed.totalCostMinor;
        const result = blankResult(entry, classification);
        Object.assign(result, {
          sourceInventoryAccountId: creditInventory.inventoryAccountId,
          outgoingStandardizedQuantityUnits: quantity.standardizedUnits,
          outgoingActualPhysicalWeightUnits: quantity.physicalUnits,
          outgoingMetalCostMinor: removed.metalCostMinor,
          outgoingWorkmanshipCostMinor: removed.workmanshipCostMinor,
          outgoingTotalCostMinor: removed.totalCostMinor,
          merchantLiabilityDecreaseMinor: liabilityDecrease,
          merchantSettlementGainMinor: Math.max(0, settlementDifference),
          merchantSettlementLossMinor: Math.max(0, -settlementDifference),
          adjustmentGainMinor: Math.max(0, settlementDifference),
          adjustmentLossMinor: Math.max(0, -settlementDifference),
        });
        results.push(result);
        continue;
      }

      if (classification === 'two_sided_adjustment') {
        if (!debitInventory || !creditInventory) {
          fail('missing_inventory_account_id', 'Two-sided adjustment requires both inventory accountIds', entry);
        }
        if (debitInventory.kind !== creditInventory.kind) {
          fail('unknown_inventory_operation', 'Cross-type two-sided adjustment is not supported', entry);
        }
        const sourceQuantity = movementQuantity(entry, creditInventory);
        const destinationQuantity = movementQuantity(entry, debitInventory);
        const source = cloneState(states[creditInventory.inventoryAccountId]);
        validateSameMovement(sourceQuantity, destinationQuantity, entry, false);
        const destination = cloneState(states[debitInventory.inventoryAccountId]);
        const shortageCost = calculateRemoval(source, sourceQuantity, entry);
        const surplusCost = shortageCost;
        applyRemoval(source, sourceQuantity, shortageCost, entry);
        addIncoming(
          destination,
          destinationQuantity,
          surplusCost.metalCostMinor,
          surplusCost.workmanshipCostMinor,
          surplusCost.accessoryCostMinor,
          entry,
        );
        states[creditInventory.inventoryAccountId] = source;
        states[debitInventory.inventoryAccountId] = destination;
        const result = blankResult(entry, classification);
        Object.assign(result, {
          sourceInventoryAccountId: creditInventory.inventoryAccountId,
          destinationInventoryAccountId: debitInventory.inventoryAccountId,
          outgoingStandardizedQuantityUnits: sourceQuantity.standardizedUnits,
          outgoingActualPhysicalWeightUnits: sourceQuantity.physicalUnits,
          outgoingAccessoryQuantityUnits: sourceQuantity.accessoryUnits,
          incomingStandardizedQuantityUnits: destinationQuantity.standardizedUnits,
          incomingActualPhysicalWeightUnits: destinationQuantity.physicalUnits,
          incomingAccessoryQuantityUnits: destinationQuantity.accessoryUnits,
          outgoingMetalCostMinor: shortageCost.metalCostMinor,
          outgoingWorkmanshipCostMinor: shortageCost.workmanshipCostMinor,
          outgoingTotalCostMinor: shortageCost.totalCostMinor,
          incomingMetalCostMinor: surplusCost.metalCostMinor,
          incomingWorkmanshipCostMinor: surplusCost.workmanshipCostMinor,
          incomingTotalCostMinor: surplusCost.totalCostMinor,
          adjustmentLossMinor: 0,
          adjustmentGainMinor: 0,
        });
        results.push(result);
      }
    }
    const appliedOverlayIds = new Set(historicalInventoryOverlays.map(item => item.overlayId));
    for (const sourceOperationId of activeOverlayBySourceOperationId.keys()) {
      const directive = activeOverlayBySourceOperationId.get(sourceOperationId)!;
      if (!appliedOverlayIds.has(directive.overlayId)) {
        fail('invalid_historical_overlay', `Overlay ${directive.overlayId} source deficit operation was not found`);
      }
    }
  } catch (error) {
    diagnostics.push(error instanceof CostEngineError
      ? error.diagnostic
      : { code: 'unknown_inventory_operation', message: error instanceof Error ? error.message : String(error) });
  }

  const valid = diagnostics.length === 0;
  const excludedAccounts = [...excludedAccountReasons].map(([accountId, reason]) => ({ accountId, reason }));
  const accountValuations = Object.fromEntries([
    ...Object.values(states).map(state => {
      const quantityUnits = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
      const scale = state.kind === 'accessory' ? ACCESSORY_SCALE : GRAM_SCALE;
      return [state.inventoryAccountId, {
        accountId: state.inventoryAccountId,
        quantity: quantityUnits / scale,
        bookValue: state.remainingTotalCostMinor / 100,
        averageCost: state.totalWacMinorPerDisplayUnit === null ? null : state.totalWacMinorPerDisplayUnit / 100,
        valuationStatus: state.valuationStatus,
      }];
    }),
    ...[...catalog.invalidAccounts.keys()].map(accountId => [accountId, { accountId, quantity: 0, bookValue: 0, averageCost: null, valuationStatus: 'invalid-configuration' as const }]),
  ]);
  return {
    calculationVersion: INVENTORY_COST_CALCULATION_VERSION,
    orderedOperationIds: ordered.map(getPhase5OperationId),
    results: valid ? results : [],
    resultsByOperationId: valid ? Object.fromEntries(results.map(result => [result.operationId, result])) : {},
    finalStates: valid ? states : {},
    diagnostics,
    orderingDiagnostics,
    historicalInventoryOverlays: valid ? historicalInventoryOverlays : [],
    valid,
    merchantGoldLiabilities: valid ? merchantGoldLiabilities : {},
    unresolvedCostData,
    costDataComplete: valid && unresolvedCostData.length === 0,
    completeness: excludedAccounts.length === 0 ? 'complete' : 'partial',
    excludedAccounts,
    accountValuations: valid ? accountValuations : {},
  };
};

export const PHASE5_COST_CATALOG_VERSION =
  `${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}`;
