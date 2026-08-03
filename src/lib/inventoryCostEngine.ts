import type { Account, Entry } from '../types';
import {
  isHistoricalOverlayActive,
  sealAppliedHistoricalInventoryOverlay,
} from './historicalInventoryOverlay';
import { normalizeNumerals } from './accounting';
import {
  buildInventoryRuntimeCatalog,
  CURRENT_DATASET_INVENTORY_BINDINGS,
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
  entry: Entry,
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
  standardizedQuantityUnits: 0,
  actualPhysicalWeightUnits: 0,
  accessoryQuantityUnits: 0,
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
  state.hasReliableCostBasis = true;
  state.lastProcessedOperationId = getPhase5OperationId(entry);
  updateDerivedState(state);
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
  if (!state.hasReliableCostBasis) fail('missing_wac', 'Inventory account has no reliable WAC', entry, state.inventoryAccountId);
  if (state.kind === 'accessory') {
    if (quantity.accessoryUnits <= 0) fail('invalid_quantity', 'Accessory outgoing quantity must be positive', entry, state.inventoryAccountId);
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

const calculateAtCurrentWac = (
  state: InventoryCostState,
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
  if (entry.tx === 'تاجر ذهب' || entry.tx === 'تاجر فضة') return 'merchant_receipt';
  if (entry.tx === 'حساب تاجر ذهب' || entry.tx === 'حساب تاجر فضة') {
    return creditInventory ? 'merchant_delivery' : 'non_cost';
  }
  if (isOpeningEntry(entry)) return 'opening';
  if (entry.operationKind === 'sale' || ['بيع ذهب', 'بيع فضة', 'بيع ملحقات'].includes(entry.tx)) return 'sale';
  if (entry.operationKind === 'purchase' || ['شراء ذهب', 'شراء فضة', 'شراء ملحقات'].includes(entry.tx)) return 'customer_purchase';
  if (entry.operationKind === 'tifeet' || entry.tx === 'تيفيت') return 'tafyeet';
  if (entry.operationKind === 'transfer' || entry.tx === 'تحويل') return 'transfer';
  if (entry.operationKind === 'adjustment' || ['تسوية', 'تسوية عجز', 'تسوية زيادة'].includes(entry.tx)) {
    if (debitInventory && creditInventory) return 'two_sided_adjustment';
    if (creditInventory) return 'shortage';
    if (debitInventory) return 'surplus';
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
      if (segment.length > 0) reorderedDay.push(...reorderLegacySegment(segment, catalog));
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
  allowPendingFinalApprovalForSimulation?: boolean;
  calculationGenerationId?: number;
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
  const catalog = buildInventoryRuntimeCatalog(
    accounts,
    options.bindings ?? CURRENT_DATASET_INVENTORY_BINDINGS,
  );
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
    };
  }

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
    const ordering = orderEntriesWithLegacySameDayPolicy(entries, catalog);
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

      const classification = classify(entry, debitInventory, creditInventory);
      if (!debitInventory && !creditInventory) continue;
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
          const costs = openingCosts(entry, debitInventory, quantity, openingConfig);
          metalCost = costs.metal;
          workmanshipCost = costs.workmanship;
          accessoryCost = costs.accessory;
        } else if (classification === 'customer_purchase') {
          const amount = parseMoneyMinor(entry.cash, entry, false);
          if (debitInventory.kind === 'accessory') accessoryCost = amount;
          else metalCost = amount;
        } else {
          if (debitInventory.kind === 'accessory') {
            fail('unknown_inventory_operation', 'Merchant receipt does not support accessories', entry);
          }
          workmanshipCost = parseMoneyMinor(entry.cash, entry, true);
          if (workmanshipCost > 0 && quantity.physicalUnits <= 0) {
            fail('merchant_workmanship_without_weight', 'Merchant workmanship requires positive physical weight', entry);
          }
          // Merchant metal principal is acquired at the related inventory's
          // existing WAC. A stored transaction price is a narrow historical
          // fallback only when no prior WAC exists; current market prices are
          // never read here.
          if (state.standardizedQuantityUnits > 0 && state.remainingMetalCostMinor > 0) {
            metalCost = proportionalCost(
              state.remainingMetalCostMinor,
              quantity.standardizedUnits,
              state.standardizedQuantityUnits,
              entry,
              'merchant metal principal at WAC',
            );
          } else if (Number.isFinite(entry.marketPrice) && Number(entry.marketPrice) > 0) {
            metalCost = Math.round(Number(entry.marketPrice) * quantity.physicalUnits);
            if (!Number.isSafeInteger(metalCost)) fail('invalid_amount', 'Merchant metal principal overflow', entry, state.inventoryAccountId);
          }
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

      if (classification === 'surplus') {
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
        const current = calculateAtCurrentWac(state, quantity, entry);
        addIncoming(
          state,
          quantity,
          current.metalCostMinor,
          current.workmanshipCostMinor,
          current.accessoryCostMinor,
          entry,
        );
        const result = blankResult(entry, classification);
        Object.assign(result, {
          inventoryAccountId: debitInventory.inventoryAccountId,
          destinationInventoryAccountId: debitInventory.inventoryAccountId,
          incomingStandardizedQuantityUnits: quantity.standardizedUnits,
          incomingActualPhysicalWeightUnits: quantity.physicalUnits,
          incomingAccessoryQuantityUnits: quantity.accessoryUnits,
          incomingMetalCostMinor: current.metalCostMinor,
          incomingWorkmanshipCostMinor: current.workmanshipCostMinor,
          incomingTotalCostMinor: current.totalCostMinor,
          adjustmentGainMinor: current.totalCostMinor,
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
        applyRemoval(state, quantity, removed, entry);
        const result = blankResult(entry, classification);
        Object.assign(result, {
          sourceInventoryAccountId: creditInventory.inventoryAccountId,
          outgoingStandardizedQuantityUnits: quantity.standardizedUnits,
          outgoingActualPhysicalWeightUnits: quantity.physicalUnits,
          outgoingMetalCostMinor: removed.metalCostMinor,
          outgoingWorkmanshipCostMinor: removed.workmanshipCostMinor,
          outgoingTotalCostMinor: removed.totalCostMinor,
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
        const destination = cloneState(states[debitInventory.inventoryAccountId]);
        const shortageCost = calculateRemoval(source, sourceQuantity, entry);
        const surplusCost = calculateAtCurrentWac(destination, destinationQuantity, entry);
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
          adjustmentLossMinor: shortageCost.totalCostMinor,
          adjustmentGainMinor: surplusCost.totalCostMinor,
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
  };
};

export const PHASE5_COST_CATALOG_VERSION =
  `${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}`;
