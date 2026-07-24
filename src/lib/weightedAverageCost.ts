import { Account, AccountingOperationKind, Entry } from '../types';
import { OPERATION_RULES } from '../constants';
import { normalizeNumerals } from './accounting';
import { canCalculateGoldEquivalent21, calculateGoldEquivalent21, gramsToCentigramUnits } from './goldEquivalent';

export const WAC_CALCULATION_VERSION = 'weighted-average-cost-v1';

export type CostUnitBasis = 'gold_equivalent21_centigram' | 'silver_centigram' | 'accessory_count';
export type CostOperationStatus = 'valid' | 'missing_cost_basis' | 'insufficient_inventory' | 'invalid_operation' | 'quantity_mismatch';

export interface CostState {
  accountId: string;
  accountName: string;
  unitBasis: CostUnitBasis;
  quantityUnits: number;
  totalCostMinor: number;
  hasReliableCostBasis: boolean;
}

export interface OperationCostResult {
  operationId: string;
  calculationVersion: typeof WAC_CALCULATION_VERSION;
  unitBasis: CostUnitBasis | null;
  quantityBeforeUnits: number;
  quantityChangeUnits: number;
  quantityAfterUnits: number;
  totalCostBeforeMinor: number;
  incomingCostMinor: number;
  outgoingCostMinor: number;
  totalCostAfterMinor: number;
  averageCostBefore: number | null;
  averageCostAfter: number | null;
  cogsMinor: number;
  adjustmentGainMinor: number;
  adjustmentLossMinor: number;
  sourceAccountId?: string;
  destinationAccountId?: string;
  status: CostOperationStatus;
  message?: string;
  entry: Entry;
}

export interface CostTimelineResult {
  results: OperationCostResult[];
  finalStates: Record<string, CostState>;
  resultsByOperationId: Record<string, OperationCostResult>;
}

export interface OpeningCostConfig {
  gold21PriceByYearMinor?: Record<string, number | string>;
  silverPriceByYearMinor?: Record<string, number | string>;
  accessoryUnitCostByYearAndAccountMinor?: Record<string, Record<string, number | string | undefined>>;
}

const isInventoryAccount = (account?: Account | null): boolean => !!account?.is_inventory;
const isAccessoryAccount = (account?: Account | null): boolean => account?.type === 'accessory';
const isGoldAccount = (account?: Account | null): boolean => account?.metal === 'gold';
const isSilverAccount = (account?: Account | null): boolean => account?.metal === 'silver';

const buildAccountIndex = (accountsDb: Account[]) => ({
  byName: new Map(accountsDb.map(account => [account.name, account])),
  byId: new Map(accountsDb.filter(account => account.id).map(account => [account.id as string, account])),
});

const resolveAccount = (
  entry: Entry,
  side: 'debit' | 'credit',
  index: ReturnType<typeof buildAccountIndex>,
): Account | undefined => {
  const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const name = side === 'debit' ? entry.debit : entry.credit;
  return (id ? index.byId.get(id) : undefined) ?? index.byName.get(name);
};

const resolveOperationKind = (entry: Entry): AccountingOperationKind => {
  if (entry.operationKind) return entry.operationKind;

  const txKey = entry.subTx ? `\u0631\u0635\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D\u064A ${entry.subTx}` : (entry.tx || '');
  const rule = OPERATION_RULES[txKey] ?? OPERATION_RULES[entry.tx || ''];
  if (rule?.isOpening) return 'opening';
  if (rule?.isPurchase) return 'purchase';
  if (rule?.isSale) return 'sale';

  switch (entry.tx) {
    case '\u062A\u064A\u0641\u064A\u062A': return 'tifeet';
    case '\u062A\u062D\u0648\u064A\u0644': return 'transfer';
    case '\u062A\u0633\u0648\u064A\u0629':
    case '\u062A\u0633\u0648\u064A\u0629 \u0639\u062C\u0632':
    case '\u062A\u0633\u0648\u064A\u0629 \u0632\u064A\u0627\u062F\u0629':
      return 'adjustment';
    case '\u062D\u0633\u0627\u0628 \u062A\u0627\u062C\u0631 \u0630\u0647\u0628':
    case '\u062D\u0633\u0627\u0628 \u062A\u0627\u062C\u0631 \u0641\u0636\u0629':
      return 'merchant_settlement';
    case '\u0645\u0633\u062D\u0648\u0628\u0627\u062A':
      return 'personal_withdrawal';
    case '\u0645 \u062A':
    case '\u0645 \u0627 \u0639':
      return 'expense';
    default:
      return rule?.affectsInventory ? 'transfer' : 'other';
  }
};
const emptyResult = (entry: Entry, status: CostOperationStatus, message?: string): OperationCostResult => ({
  operationId: getOperationId(entry),
  calculationVersion: WAC_CALCULATION_VERSION,
  unitBasis: null,
  quantityBeforeUnits: 0,
  quantityChangeUnits: 0,
  quantityAfterUnits: 0,
  totalCostBeforeMinor: 0,
  incomingCostMinor: 0,
  outgoingCostMinor: 0,
  totalCostAfterMinor: 0,
  averageCostBefore: null,
  averageCostAfter: null,
  cogsMinor: 0,
  adjustmentGainMinor: 0,
  adjustmentLossMinor: 0,
  status,
  message,
  entry,
});

export const getOperationId = (entry: Entry): string => entry.id ?? String(entry.seq ?? `${entry.date}-${entry.tx}`);

const safeInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
  return value;
};

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

export const assertSafeSerializableInteger = (value: bigint, label: string): number => {
  if (value > MAX_SAFE_BIGINT || value < MIN_SAFE_BIGINT) {
    throw new Error(`${label} exceeds safe integer serialization bounds`);
  }
  return Number(value);
};

export const roundDivideBigInt = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= 0n) return 0n;
  return (numerator + denominator / 2n) / denominator;
};

const roundDivide = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return assertSafeSerializableInteger(roundDivideBigInt(BigInt(numerator), BigInt(denominator)), 'rounded division result');
};

const normalizeMoney = (value: string | number | undefined): string => normalizeNumerals(String(value ?? '0')).trim();

export const parseMoneyToMinorBigInt = (value: string | number | undefined): bigint => {
  const normalized = normalizeMoney(value);
  if (!normalized) return 0n;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return 0n;
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

export const parseMoneyToMinorUnits = (value: string | number | undefined): number => {
  return assertSafeSerializableInteger(parseMoneyToMinorBigInt(value), 'money minor units');
};

export const ACCESSORY_QUANTITY_SCALE = 1000;

export const parseAccessoryQuantityUnits = (value: string | number | undefined): number => {
  const normalized = normalizeNumerals(String(value ?? '0')).trim();
  if (!normalized) return 0;
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return 0;
  const [whole, fraction = ''] = normalized.split('.');
  return safeInteger(Number(whole) * ACCESSORY_QUANTITY_SCALE + Number(fraction.padEnd(3, '0')), 'accessory quantity units');
};

export const formatAccessoryQuantityUnits = (units: number): number => units / ACCESSORY_QUANTITY_SCALE;

export const parseQuantityStepUnits = (value: string | number | undefined): number => {
  const units = parseAccessoryQuantityUnits(value ?? '1');
  return units > 0 ? units : ACCESSORY_QUANTITY_SCALE;
};

export const isQuantityAlignedToStep = (quantity: string | number | undefined, step: string | number | undefined): boolean => {
  const quantityUnits = parseAccessoryQuantityUnits(quantity);
  const stepUnits = parseQuantityStepUnits(step);
  return quantityUnits === 0 || quantityUnits % stepUnits === 0;
};

const parseCountUnits = parseAccessoryQuantityUnits;

const getCreatedAtComparable = (entry: Entry): string => {
  const value: any = entry.createdAt;
  if (!value) return '';
  if (value instanceof Date) return String(value.getTime()).padStart(15, '0');
  if (typeof value === 'number') return String(value).padStart(15, '0');
  if (typeof value === 'string') return value;
  if (typeof value.seconds === 'number') return `${String(value.seconds).padStart(12, '0')}.${String(value.nanoseconds ?? 0).padStart(9, '0')}`;
  if (typeof value.toMillis === 'function') return String(value.toMillis());
  return '';
};

const normalizeDateComparable = (value: string | undefined): string => {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '9999-99-99';
};

const parseOrderingNumber = (entry: Entry): number => {
  const raw = (entry as any).operationNo ?? (entry as any).journalNo ?? entry.seq;
  const normalized = normalizeNumerals(String(raw ?? '')).trim();
  if (!/^\d+$/.test(normalized)) return Number.MAX_SAFE_INTEGER;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const compareAscii = (a: string, b: string): number => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

export const compareEntriesForCost = (a: Entry, b: Entry): number => {
  const dateCompare = compareAscii(normalizeDateComparable(a.date), normalizeDateComparable(b.date));
  if (dateCompare !== 0) return dateCompare;
  const seqCompare = parseOrderingNumber(a) - parseOrderingNumber(b);
  if (seqCompare !== 0) return seqCompare;
  const createdCompare = compareAscii(getCreatedAtComparable(a), getCreatedAtComparable(b));
  if (createdCompare !== 0) return createdCompare;
  return compareAscii(getOperationId(a), getOperationId(b));
};

const getAccountKey = (account: Account): string => account.id ?? account.name;

const getUnitBasis = (account?: Account | null): CostUnitBasis | null => {
  if (!isInventoryAccount(account)) return null;
  if (isAccessoryAccount(account)) return 'accessory_count';
  if (isGoldAccount(account)) return 'gold_equivalent21_centigram';
  if (isSilverAccount(account)) return 'silver_centigram';
  return null;
};

const getQuantityUnits = (entry: Entry, account: Account): number => {
  const basis = getUnitBasis(account);
  if (basis === 'accessory_count') return parseCountUnits(entry.count);
  if (basis === 'silver_centigram') {
    try {
      return gramsToCentigramUnits(entry.weight || '0', 'silverWeight');
    } catch {
      return 0;
    }
  }
  if (basis === 'gold_equivalent21_centigram') {
    const karat = account.karat ?? entry.karat;
    if (entry.goldEquivalent21Snapshot && String(entry.goldEquivalent21Snapshot.karat) === String(karat).replace('.0', '')) {
      return entry.goldEquivalent21Snapshot.equivalent21Units;
    }
    if (canCalculateGoldEquivalent21(entry.weight || '0', karat)) {
      return calculateGoldEquivalent21(entry.weight || '0', karat as string | number).equivalent21Units;
    }
  }
  return 0;
};

const makeState = (account: Account): CostState => ({
  accountId: getAccountKey(account),
  accountName: account.name,
  unitBasis: getUnitBasis(account) as CostUnitBasis,
  quantityUnits: 0,
  totalCostMinor: 0,
  hasReliableCostBasis: false,
});

const getAverage = (state: CostState): number | null => {
  if (state.quantityUnits <= 0 || !state.hasReliableCostBasis) return null;
  const perInternalUnit = state.totalCostMinor / state.quantityUnits;
  return state.unitBasis === 'accessory_count' ? perInternalUnit * ACCESSORY_QUANTITY_SCALE : perInternalUnit;
};

const multiplyDivideToSafeInteger = (left: number, right: number | bigint, denominator: number, label: string): number => {
  const rightBigInt = typeof right === 'bigint' ? right : BigInt(right);
  return assertSafeSerializableInteger(roundDivideBigInt(BigInt(left) * rightBigInt, BigInt(denominator)), label);
};

const parseConfigMinor = (value: number | string | undefined, label: string): bigint | null => {
  if (value === undefined) return null;
  const normalized = normalizeNumerals(String(value)).trim();
  if (!/^\d+$/.test(normalized)) throw new Error(`${label} must be an integer minor-unit amount`);
  return BigInt(normalized);
};

const addIncoming = (state: CostState, quantityUnits: number, costMinor: number): OperationCostResult['status'] => {
  if (quantityUnits <= 0) return 'invalid_operation';
  if (costMinor < 0) return 'invalid_operation';
  state.quantityUnits = safeInteger(state.quantityUnits + quantityUnits, 'quantity units');
  state.totalCostMinor = safeInteger(state.totalCostMinor + costMinor, 'total cost minor');
  state.hasReliableCostBasis = true;
  return 'valid';
};

const removeOutgoing = (state: CostState, quantityUnits: number): { status: CostOperationStatus; outgoingCostMinor: number } => {
  if (quantityUnits <= 0) return { status: 'invalid_operation', outgoingCostMinor: 0 };
  if (!state.hasReliableCostBasis || state.quantityUnits <= 0) return { status: 'missing_cost_basis', outgoingCostMinor: 0 };
  if (quantityUnits > state.quantityUnits) return { status: 'insufficient_inventory', outgoingCostMinor: 0 };

  const outgoingCostMinor = quantityUnits === state.quantityUnits
    ? state.totalCostMinor
    : multiplyDivideToSafeInteger(state.totalCostMinor, quantityUnits, state.quantityUnits, 'outgoing cost minor');
  state.quantityUnits -= quantityUnits;
  state.totalCostMinor -= outgoingCostMinor;
  if (state.quantityUnits === 0) {
    state.totalCostMinor = 0;
    state.hasReliableCostBasis = false;
  }
  return { status: 'valid', outgoingCostMinor };
};

const getOpeningCost = (entry: Entry, account: Account, quantityUnits: number, config: OpeningCostConfig): number | null => {
  const year = (entry.date || '').slice(0, 4);
  if (getUnitBasis(account) === 'gold_equivalent21_centigram') {
    const priceMinor = parseConfigMinor(config.gold21PriceByYearMinor?.[year], 'gold opening price');
    return priceMinor === null ? null : multiplyDivideToSafeInteger(quantityUnits, priceMinor, 100, 'gold opening cost minor');
  }
  if (getUnitBasis(account) === 'silver_centigram') {
    const priceMinor = parseConfigMinor(config.silverPriceByYearMinor?.[year], 'silver opening price');
    return priceMinor === null ? null : multiplyDivideToSafeInteger(quantityUnits, priceMinor, 100, 'silver opening cost minor');
  }
  return null;
};

const isShortageAdjustment = (debitAcc?: Account, creditAcc?: Account): boolean =>
  !!creditAcc && isInventoryAccount(creditAcc) && !isInventoryAccount(debitAcc);

const isSurplusAdjustment = (debitAcc?: Account, creditAcc?: Account): boolean =>
  !!debitAcc && isInventoryAccount(debitAcc) && !isInventoryAccount(creditAcc);

export function rebuildCostTimeline(
  entries: Entry[],
  accountsDb: Account[],
  openingConfig: OpeningCostConfig = {},
): CostTimelineResult {
  const index = buildAccountIndex(accountsDb);
  const states: Record<string, CostState> = {};
  accountsDb.forEach(account => {
    if (getUnitBasis(account)) states[getAccountKey(account)] = makeState(account);
  });

  const results: OperationCostResult[] = [];

  [...entries].sort(compareEntriesForCost).forEach(entry => {
    const kind = resolveOperationKind(entry);
    const debitAcc = resolveAccount(entry, 'debit', index);
    const creditAcc = resolveAccount(entry, 'credit', index);
    const debitBasis = getUnitBasis(debitAcc);
    const creditBasis = getUnitBasis(creditAcc);

    const push = (result: OperationCostResult) => results.push(result);

    const incomingAccount = debitBasis ? debitAcc : undefined;
    const outgoingAccount = creditBasis ? creditAcc : undefined;

    if (kind === 'purchase' || kind === 'opening') {
      if (!incomingAccount) return;
      const state = states[getAccountKey(incomingAccount)];
      const quantity = getQuantityUnits(entry, incomingAccount);
      const beforeQty = state.quantityUnits;
      const beforeCost = state.totalCostMinor;
      const beforeAvg = getAverage(state);
      let incomingCost: number | null;
      try {
        incomingCost = kind === 'opening'
          ? getOpeningCost(entry, incomingAccount, quantity, openingConfig)
          : parseMoneyToMinorUnits(entry.cash);
      } catch {
        push({
          ...emptyResult(entry, 'invalid_operation', 'Cost amount exceeds safe integer bounds'),
          unitBasis: state.unitBasis,
          quantityBeforeUnits: beforeQty,
          quantityChangeUnits: quantity,
          quantityAfterUnits: beforeQty,
          totalCostBeforeMinor: beforeCost,
          totalCostAfterMinor: beforeCost,
          averageCostBefore: beforeAvg,
          averageCostAfter: beforeAvg,
          sourceAccountId: creditAcc ? getAccountKey(creditAcc) : undefined,
          destinationAccountId: getAccountKey(incomingAccount),
        });
        return;
      }
      if (quantity <= 0) {
        push({ ...emptyResult(entry, 'invalid_operation', 'Invalid incoming quantity'), unitBasis: state.unitBasis, sourceAccountId: creditAcc ? getAccountKey(creditAcc) : undefined, destinationAccountId: getAccountKey(incomingAccount) });
        return;
      }
      if (incomingCost === null || incomingCost <= 0) {
        push({
          ...emptyResult(entry, 'missing_cost_basis', kind === 'opening' ? 'Missing opening cost basis' : 'Missing purchase cash cost'),
          unitBasis: state.unitBasis,
          quantityBeforeUnits: beforeQty,
          quantityChangeUnits: quantity,
          quantityAfterUnits: beforeQty,
          totalCostBeforeMinor: beforeCost,
          totalCostAfterMinor: beforeCost,
          averageCostBefore: beforeAvg,
          averageCostAfter: beforeAvg,
          sourceAccountId: creditAcc ? getAccountKey(creditAcc) : undefined,
          destinationAccountId: getAccountKey(incomingAccount),
        });
        return;
      }
      const status = addIncoming(state, quantity, incomingCost);
      push({
        operationId: getOperationId(entry),
        calculationVersion: WAC_CALCULATION_VERSION,
        unitBasis: state.unitBasis,
        quantityBeforeUnits: beforeQty,
        quantityChangeUnits: quantity,
        quantityAfterUnits: state.quantityUnits,
        totalCostBeforeMinor: beforeCost,
        incomingCostMinor: incomingCost,
        outgoingCostMinor: 0,
        totalCostAfterMinor: state.totalCostMinor,
        averageCostBefore: beforeAvg,
        averageCostAfter: getAverage(state),
        cogsMinor: 0,
        adjustmentGainMinor: 0,
        adjustmentLossMinor: 0,
        sourceAccountId: creditAcc ? getAccountKey(creditAcc) : undefined,
        destinationAccountId: getAccountKey(incomingAccount),
        status,
        entry,
      });
      return;
    }

    if (kind === 'sale' || (kind === 'adjustment' && isShortageAdjustment(debitAcc, creditAcc))) {
      if (!outgoingAccount) return;
      const state = states[getAccountKey(outgoingAccount)];
      const quantity = getQuantityUnits(entry, outgoingAccount);
      const beforeQty = state.quantityUnits;
      const beforeCost = state.totalCostMinor;
      const beforeAvg = getAverage(state);
      const { status, outgoingCostMinor } = removeOutgoing(state, quantity);
      push({
        operationId: getOperationId(entry),
        calculationVersion: WAC_CALCULATION_VERSION,
        unitBasis: state.unitBasis,
        quantityBeforeUnits: beforeQty,
        quantityChangeUnits: -quantity,
        quantityAfterUnits: status === 'valid' ? state.quantityUnits : beforeQty,
        totalCostBeforeMinor: beforeCost,
        incomingCostMinor: 0,
        outgoingCostMinor,
        totalCostAfterMinor: status === 'valid' ? state.totalCostMinor : beforeCost,
        averageCostBefore: beforeAvg,
        averageCostAfter: status === 'valid' ? getAverage(state) : beforeAvg,
        cogsMinor: kind === 'sale' ? outgoingCostMinor : 0,
        adjustmentGainMinor: 0,
        adjustmentLossMinor: kind === 'adjustment' ? outgoingCostMinor : 0,
        sourceAccountId: getAccountKey(outgoingAccount),
        destinationAccountId: debitAcc ? getAccountKey(debitAcc) : undefined,
        status,
        message: status === 'valid' ? undefined : status === 'missing_cost_basis' ? 'Missing cost basis for outgoing inventory' : 'Insufficient inventory',
        entry,
      });
      return;
    }

    if (kind === 'transfer' || kind === 'tifeet') {
      if (!incomingAccount || !outgoingAccount || debitBasis !== creditBasis) {
        push(emptyResult(entry, 'invalid_operation', 'Transfer/Tafiet requires matching inventory unit basis'));
        return;
      }
      if (getAccountKey(incomingAccount) === getAccountKey(outgoingAccount)) {
        push(emptyResult(entry, 'invalid_operation', 'Transfer/Tafiet source and destination must differ'));
        return;
      }
      const source = states[getAccountKey(outgoingAccount)];
      const destination = states[getAccountKey(incomingAccount)];
      const sourceQuantity = getQuantityUnits(entry, outgoingAccount);
      const destinationQuantity = getQuantityUnits(entry, incomingAccount);
      if (sourceQuantity <= 0 || destinationQuantity <= 0) {
        push(emptyResult(entry, 'invalid_operation', 'Transfer/Tafiet quantity must be positive on both sides'));
        return;
      }
      if (sourceQuantity !== destinationQuantity) {
        push({
          ...emptyResult(entry, 'quantity_mismatch', 'Transfer/Tafiet source and destination quantities differ'),
          unitBasis: source.unitBasis,
          sourceAccountId: getAccountKey(outgoingAccount),
          destinationAccountId: getAccountKey(incomingAccount),
        });
        return;
      }
      const quantity = sourceQuantity;
      const beforeQty = source.quantityUnits;
      const beforeCost = source.totalCostMinor;
      const beforeAvg = getAverage(source);
      const sourceNext = { ...source };
      const destinationNext = { ...destination };
      const { status, outgoingCostMinor } = removeOutgoing(sourceNext, quantity);
      if (status !== 'valid') {
        push({
          ...emptyResult(entry, status, status === 'missing_cost_basis' ? 'Missing source cost basis' : 'Insufficient source inventory'),
          unitBasis: source.unitBasis,
          quantityBeforeUnits: beforeQty,
          quantityChangeUnits: -quantity,
          quantityAfterUnits: beforeQty,
          totalCostBeforeMinor: beforeCost,
          totalCostAfterMinor: beforeCost,
          averageCostBefore: beforeAvg,
          averageCostAfter: beforeAvg,
          sourceAccountId: getAccountKey(outgoingAccount),
          destinationAccountId: getAccountKey(incomingAccount),
        });
        return;
      }
      try {
        addIncoming(destinationNext, quantity, outgoingCostMinor);
      } catch {
        push({
          ...emptyResult(entry, 'invalid_operation', 'Destination cost state exceeds safe integer bounds'),
          unitBasis: source.unitBasis,
          quantityBeforeUnits: beforeQty,
          quantityChangeUnits: -quantity,
          quantityAfterUnits: beforeQty,
          totalCostBeforeMinor: beforeCost,
          totalCostAfterMinor: beforeCost,
          averageCostBefore: beforeAvg,
          averageCostAfter: beforeAvg,
          sourceAccountId: getAccountKey(outgoingAccount),
          destinationAccountId: getAccountKey(incomingAccount),
        });
        return;
      }
      Object.assign(source, sourceNext);
      Object.assign(destination, destinationNext);
      push({
        operationId: getOperationId(entry),
        calculationVersion: WAC_CALCULATION_VERSION,
        unitBasis: source.unitBasis,
        quantityBeforeUnits: beforeQty,
        quantityChangeUnits: -quantity,
        quantityAfterUnits: sourceNext.quantityUnits,
        totalCostBeforeMinor: beforeCost,
        incomingCostMinor: outgoingCostMinor,
        outgoingCostMinor,
        totalCostAfterMinor: sourceNext.totalCostMinor,
        averageCostBefore: beforeAvg,
        averageCostAfter: getAverage(sourceNext),
        cogsMinor: 0,
        adjustmentGainMinor: 0,
        adjustmentLossMinor: 0,
        sourceAccountId: getAccountKey(outgoingAccount),
        destinationAccountId: getAccountKey(incomingAccount),
        status: 'valid',
        entry,
      });
      return;
    }

    if (kind === 'adjustment' && isSurplusAdjustment(debitAcc, creditAcc)) {
      if (!incomingAccount) return;
      const state = states[getAccountKey(incomingAccount)];
      const quantity = getQuantityUnits(entry, incomingAccount);
      const beforeQty = state.quantityUnits;
      const beforeCost = state.totalCostMinor;
      const beforeAvg = getAverage(state);
      if (!state.hasReliableCostBasis || state.quantityUnits <= 0) {
        push({
          ...emptyResult(entry, 'missing_cost_basis', 'Missing current average for surplus'),
          unitBasis: state.unitBasis,
          quantityBeforeUnits: beforeQty,
          quantityChangeUnits: quantity,
          quantityAfterUnits: beforeQty,
          totalCostBeforeMinor: beforeCost,
          totalCostAfterMinor: beforeCost,
          averageCostBefore: beforeAvg,
          averageCostAfter: beforeAvg,
          destinationAccountId: getAccountKey(incomingAccount),
        });
        return;
      }
      let incomingCost: number;
      try {
        incomingCost = multiplyDivideToSafeInteger(state.totalCostMinor, quantity, state.quantityUnits, 'surplus incoming cost minor');
      } catch {
        push({
          ...emptyResult(entry, 'invalid_operation', 'Surplus cost exceeds safe integer bounds'),
          unitBasis: state.unitBasis,
          quantityBeforeUnits: beforeQty,
          quantityChangeUnits: quantity,
          quantityAfterUnits: beforeQty,
          totalCostBeforeMinor: beforeCost,
          totalCostAfterMinor: beforeCost,
          averageCostBefore: beforeAvg,
          averageCostAfter: beforeAvg,
          destinationAccountId: getAccountKey(incomingAccount),
        });
        return;
      }
      addIncoming(state, quantity, incomingCost);
      push({
        operationId: getOperationId(entry),
        calculationVersion: WAC_CALCULATION_VERSION,
        unitBasis: state.unitBasis,
        quantityBeforeUnits: beforeQty,
        quantityChangeUnits: quantity,
        quantityAfterUnits: state.quantityUnits,
        totalCostBeforeMinor: beforeCost,
        incomingCostMinor: incomingCost,
        outgoingCostMinor: 0,
        totalCostAfterMinor: state.totalCostMinor,
        averageCostBefore: beforeAvg,
        averageCostAfter: getAverage(state),
        cogsMinor: 0,
        adjustmentGainMinor: incomingCost,
        adjustmentLossMinor: 0,
        destinationAccountId: getAccountKey(incomingAccount),
        status: 'valid',
        entry,
      });
    }
  });

  return {
    results,
    finalStates: states,
    resultsByOperationId: Object.fromEntries(results.map(result => [result.operationId, result])),
  };
}
