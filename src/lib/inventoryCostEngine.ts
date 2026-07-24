import type { Account, Entry } from '../types';
import { normalizeNumerals } from './accounting';
import {
  buildInventoryRuntimeCatalog,
  CURRENT_DATASET_INVENTORY_BINDINGS,
  INVENTORY_COST_TAXONOMY_VERSION,
  type InventoryRuntimeCatalog,
} from './inventoryCostCatalog';
import {
  INVENTORY_COST_CALCULATION_VERSION,
  type InventoryCostDiagnostic,
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

const isOpeningOperation = (entry: Entry): boolean =>
  entry.operationKind === 'opening'
  || entry.tx === 'قيد افتتاحي'
  || entry.subTx?.startsWith('رصيد افتتاحي') === true;

export const compareEntriesForPhase5Cost = (left: Entry, right: Entry): number => {
  const date = compareText(left.date, right.date);
  if (date !== 0) return date;
  // Opening layers are effective at the start of their date. This is an
  // explicit accounting order, required because the approved legacy export
  // has no seq and its source rows are not guaranteed to place openings first.
  const openingOrder = Number(isOpeningOperation(right)) - Number(isOpeningOperation(left));
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
    let quantity = parseScaledDecimal(entry.count, ACCESSORY_SCALE, 3, 'accessory quantity', entry, true);
    if (quantity === 0 && isLegacyEntry(entry)) {
      quantity = parseScaledDecimal(entry.weight, ACCESSORY_SCALE, 3, 'legacy accessory quantity', entry, true, true);
    }
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
      fail('insufficient_inventory', 'Accessory movement exceeds costed inventory', entry, state.inventoryAccountId);
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
    fail('insufficient_inventory', 'Metal movement exceeds costed inventory', entry, state.inventoryAccountId);
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
  if (!state.hasReliableCostBasis) fail('missing_wac', 'Inventory account has no reliable WAC', entry, state.inventoryAccountId);
  if (state.kind === 'accessory') {
    if (quantity.accessoryUnits <= 0 || state.accessoryQuantityUnits <= 0) {
      fail('invalid_quantity', 'Accessory surplus quantity must be positive', entry, state.inventoryAccountId);
    }
    const accessoryCostMinor = toSafeInteger(
      roundDivide(
        BigInt(state.remainingAccessoryCostMinor) * BigInt(quantity.accessoryUnits),
        BigInt(state.accessoryQuantityUnits),
      ),
      'accessory surplus cost',
      entry,
    );
    return { metalCostMinor: 0, workmanshipCostMinor: 0, accessoryCostMinor, totalCostMinor: accessoryCostMinor };
  }
  if (
    quantity.standardizedUnits <= 0
    || quantity.physicalUnits <= 0
    || state.standardizedQuantityUnits <= 0
    || state.actualPhysicalWeightUnits <= 0
  ) {
    fail('invalid_quantity', 'Metal surplus weight must be positive', entry, state.inventoryAccountId);
  }
  const metalCostMinor = toSafeInteger(
    roundDivide(
      BigInt(state.remainingMetalCostMinor) * BigInt(quantity.standardizedUnits),
      BigInt(state.standardizedQuantityUnits),
    ),
    'metal surplus cost',
    entry,
  );
  const workmanshipCostMinor = toSafeInteger(
    roundDivide(
      BigInt(state.remainingWorkmanshipCostMinor) * BigInt(quantity.physicalUnits),
      BigInt(state.actualPhysicalWeightUnits),
    ),
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
  if (entry.operationKind === 'opening' || entry.tx === 'قيد افتتاحي' || entry.subTx?.startsWith('رصيد افتتاحي')) return 'opening';
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
  const unitCost = parseConfigMinor(
    config.accessoryUnitCostByYearAndAccountMinor?.[year]?.[account.inventoryAccountId],
    `accessory opening unit cost for ${account.inventoryAccountId}`,
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

export interface RebuildInventoryCostOptions {
  bindings?: readonly InventoryRuntimeBinding[];
}

export const rebuildInventoryCostTimeline = (
  entries: Entry[],
  accounts: Account[],
  openingConfig: Phase5OpeningCostConfig = {},
  options: RebuildInventoryCostOptions = {},
): InventoryCostTimeline => {
  const diagnostics: InventoryCostDiagnostic[] = [];
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
    validateOrdering(entries);
    ordered = [...entries].sort(compareEntriesForPhase5Cost);
    for (const entry of ordered) {
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
        applyZeroCostMerchantDelivery(state, quantity, entry);
        const result = blankResult(entry, classification);
        Object.assign(result, {
          sourceInventoryAccountId: creditInventory.inventoryAccountId,
          outgoingStandardizedQuantityUnits: quantity.standardizedUnits,
          outgoingActualPhysicalWeightUnits: quantity.physicalUnits,
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
    valid,
  };
};

export const PHASE5_COST_CATALOG_VERSION =
  `${INVENTORY_COST_TAXONOMY_VERSION}:${INVENTORY_COST_CALCULATION_VERSION}`;
