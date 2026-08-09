import type { Account, Entry } from '../types';
import { getEntryArabicWeight, resolveMerchantGoldOperationSemantic } from './engine';
import { compareEntriesForPhase5Cost, getPhase5OperationId } from './inventoryCostEngine';
import type { InventoryCostTimeline, OperationCostResultV2 } from './inventoryCostTypes';

export type MerchantGoldLiabilityMovementKind =
  | 'opening'
  | 'receipt'
  | 'weight_settlement'
  | 'cash_settlement'
  | 'merchant_transfer';

export interface MerchantGoldLiabilityState {
  merchantAccountId: string;
  merchantName: string;
  goldE21BalanceUnits: number;
  goldE21Balance: number;
  goldLiabilityBookValueMinor: number;
  goldLiabilityWacMinorPerE21Unit: number | null;
}

export interface MerchantGoldLiabilityMovement {
  operationId: string;
  entry: Entry;
  kind: MerchantGoldLiabilityMovementKind;
  sourceMerchantAccountId?: string;
  destinationMerchantAccountId?: string;
  quantityUnits: number;
  carryingValueMinor: number;
  merchantLiabilityReleasedValueMinor: number;
  inventoryBookValueReleasedMinor: number;
  settlementGainMinor: number;
  settlementLossMinor: number;
  valuationSource?: 'opening_cost_compatibility' | 'operation_price_snapshot' | 'historical_cost_compatibility' | 'source_merchant_wac';
}

export interface MerchantGoldLiabilityDiagnostic {
  code:
    | 'ambiguous_account_reference'
    | 'missing_approved_historical_price'
    | 'missing_opening_price'
    | 'insufficient_merchant_liability'
    | 'inventory_cost_result_missing'
    | 'zero_weight_book_value_residue';
  severity: 'warning' | 'error';
  operationId?: string;
  merchantAccountId?: string;
  message: string;
}

export interface MerchantGoldLiabilityTimeline {
  calculationVersion: 'merchant-gold-liability-wac-v1';
  movements: MerchantGoldLiabilityMovement[];
  movementsByOperationId: Record<string, MerchantGoldLiabilityMovement>;
  finalStates: Record<string, MerchantGoldLiabilityState>;
  diagnostics: MerchantGoldLiabilityDiagnostic[];
}

interface MutableMerchantState {
  merchantAccountId: string;
  merchantName: string;
  goldE21BalanceUnits: number;
  goldLiabilityBookValueMinor: number;
}

const GRAM_SCALE = 100;
const normalize = (value: unknown): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const isGoldMerchant = (account?: Account): boolean => !!account
  && account.type === 'merchant'
  && (account.metal === 'gold' || account.canonicalSubType === 'merchant_gold');

const roundDivide = (numerator: bigint, denominator: bigint): bigint =>
  (numerator + denominator / 2n) / denominator;

const safeRatio = (totalMinor: number, units: number): number | null =>
  units > 0 ? totalMinor / units : null;

const stateSnapshot = (state: MutableMerchantState): MerchantGoldLiabilityState => ({
  ...state,
  goldE21Balance: state.goldE21BalanceUnits / GRAM_SCALE,
  goldLiabilityWacMinorPerE21Unit: safeRatio(state.goldLiabilityBookValueMinor, state.goldE21BalanceUnits),
});

const quantityUnits = (entry: Entry): number => Math.round(Math.abs(getEntryArabicWeight(entry)) * GRAM_SCALE);

const accountIndexes = (accounts: Account[]) => {
  const byId = new Map(accounts.flatMap(account => account.id ? [[account.id, account] as const] : []));
  const byName = new Map<string, Account[]>();
  accounts.forEach(account => {
    const key = normalize(account.name);
    byName.set(key, [...(byName.get(key) ?? []), account]);
  });
  return { byId, byName };
};

const openingPriceCompatibility = (
  timeline: InventoryCostTimeline | null | undefined,
): Map<string, { costMinor: number; quantityUnits: number }> => {
  const byYear = new Map<string, { costMinor: number; quantityUnits: number }>();
  if (!timeline?.valid) return byYear;
  timeline.results.filter(result => result.classification === 'opening').forEach(result => {
    const inventoryId = result.destinationInventoryAccountId || result.inventoryAccountId;
    if (!inventoryId || timeline.finalStates[inventoryId]?.kind !== 'gold') return;
    if (result.incomingStandardizedQuantityUnits <= 0 || result.incomingMetalCostMinor <= 0) return;
    const year = result.entry.date.slice(0, 4);
    const current = byYear.get(year) ?? { costMinor: 0, quantityUnits: 0 };
    current.costMinor += result.incomingMetalCostMinor;
    current.quantityUnits += result.incomingStandardizedQuantityUnits;
    byYear.set(year, current);
  });
  return byYear;
};

const receiptCost = (
  entry: Entry,
  result: OperationCostResultV2 | undefined,
): { valueMinor: number; source?: MerchantGoldLiabilityMovement['valuationSource'] } => {
  if (result?.classification === 'merchant_receipt' && result.incomingMetalCostMinor > 0) {
    return {
      valueMinor: result.incomingMetalCostMinor,
      source: Number(entry.marketPrice) > 0 ? 'operation_price_snapshot' : 'historical_cost_compatibility',
    };
  }
  const price = Number(entry.marketPrice);
  const physicalUnits = Math.round(Math.abs(Number(entry.weight) || 0) * GRAM_SCALE);
  if (Number.isFinite(price) && price > 0 && physicalUnits > 0) {
    return { valueMinor: Math.round(price * physicalUnits), source: 'operation_price_snapshot' };
  }
  return { valueMinor: 0 };
};

/** Pure in-memory carrying-value timeline. Inventory and merchant liability are
 * deliberately separate WAC pools; Firestore rows are never mutated. */
export const buildMerchantGoldLiabilityTimeline = (
  entries: Entry[],
  accounts: Account[],
  inventoryTimeline: InventoryCostTimeline | null | undefined,
): MerchantGoldLiabilityTimeline => {
  const diagnostics: MerchantGoldLiabilityDiagnostic[] = [];
  const movements: MerchantGoldLiabilityMovement[] = [];
  const states = new Map<string, MutableMerchantState>();
  const { byId, byName } = accountIndexes(accounts);
  const costByOperationId = new Map((inventoryTimeline?.results ?? []).map(result => [result.operationId || getPhase5OperationId(result.entry), result]));
  const openingPrices = openingPriceCompatibility(inventoryTimeline);

  const resolveSide = (entry: Entry, side: 'debit' | 'credit'): Account | undefined => {
    const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
    const name = side === 'debit' ? entry.debit : entry.credit;
    if (id) return byId.get(id);
    const candidates = byName.get(normalize(name)) ?? [];
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) diagnostics.push({
      code: 'ambiguous_account_reference', severity: 'error', operationId: getPhase5OperationId(entry),
      message: `Ambiguous legacy account name on ${side}: ${name}`,
    });
    return undefined;
  };

  const ensureState = (account: Account): MutableMerchantState => {
    const accountId = account.id || `legacy-name:${normalize(account.name)}`;
    const existing = states.get(accountId);
    if (existing) return existing;
    const state = { merchantAccountId: accountId, merchantName: account.name, goldE21BalanceUnits: 0, goldLiabilityBookValueMinor: 0 };
    states.set(accountId, state);
    return state;
  };

  const addLiability = (state: MutableMerchantState, units: number, valueMinor: number): void => {
    state.goldE21BalanceUnits += units;
    state.goldLiabilityBookValueMinor += valueMinor;
  };

  const releaseLiability = (state: MutableMerchantState, requestedUnits: number, entry: Entry): { units: number; valueMinor: number } => {
    const units = Math.min(requestedUnits, state.goldE21BalanceUnits);
    if (units < requestedUnits) diagnostics.push({
      code: 'insufficient_merchant_liability', severity: 'error', operationId: getPhase5OperationId(entry),
      merchantAccountId: state.merchantAccountId,
      message: `Merchant gold settlement/transfer exceeds available E21 liability for ${state.merchantName}.`,
    });
    if (units <= 0) return { units: 0, valueMinor: 0 };
    const valueMinor = units === state.goldE21BalanceUnits
      ? state.goldLiabilityBookValueMinor
      : Number(roundDivide(
        BigInt(state.goldLiabilityBookValueMinor) * BigInt(units),
        BigInt(state.goldE21BalanceUnits),
      ));
    state.goldE21BalanceUnits -= units;
    state.goldLiabilityBookValueMinor -= valueMinor;
    if (state.goldE21BalanceUnits === 0 && state.goldLiabilityBookValueMinor !== 0) {
      diagnostics.push({
        code: 'zero_weight_book_value_residue', severity: 'error', operationId: getPhase5OperationId(entry),
        merchantAccountId: state.merchantAccountId,
        message: `Zero E21 merchant balance retained ${state.goldLiabilityBookValueMinor} minor units.`,
      });
    }
    return { units, valueMinor };
  };

  [...entries].sort(compareEntriesForPhase5Cost).forEach(entry => {
    const operationId = getPhase5OperationId(entry);
    const debit = resolveSide(entry, 'debit');
    const credit = resolveSide(entry, 'credit');
    const semantic = resolveMerchantGoldOperationSemantic(entry, debit, credit);
    const requestedUnits = quantityUnits(entry);
    const blank = (kind: MerchantGoldLiabilityMovementKind): MerchantGoldLiabilityMovement => ({
      operationId, entry, kind, quantityUnits: requestedUnits, carryingValueMinor: 0,
      merchantLiabilityReleasedValueMinor: 0, inventoryBookValueReleasedMinor: 0,
      settlementGainMinor: 0, settlementLossMinor: 0,
    });

    if (semantic === 'cash_settlement') {
      movements.push(blank('cash_settlement'));
      return;
    }

    if (semantic === 'gold_liability_opening' && isGoldMerchant(credit)) {
      const movement = blank('opening');
      const state = ensureState(credit);
      const price = openingPrices.get(entry.date.slice(0, 4));
      if (price && requestedUnits > 0) {
        movement.carryingValueMinor = Number(roundDivide(BigInt(price.costMinor) * BigInt(requestedUnits), BigInt(price.quantityUnits)));
        movement.valuationSource = 'opening_cost_compatibility';
      } else {
        diagnostics.push({
          code: 'missing_opening_price', severity: 'warning', operationId, merchantAccountId: state.merchantAccountId,
          message: 'No approved opening gold cost source was available; legacy liability weight was preserved without inventing a price.',
        });
      }
      movement.destinationMerchantAccountId = state.merchantAccountId;
      addLiability(state, requestedUnits, movement.carryingValueMinor);
      movements.push(movement);
      return;
    }

    if (semantic === 'gold_liability_receipt' && isGoldMerchant(credit)) {
      const movement = blank('receipt');
      const state = ensureState(credit);
      const valued = receiptCost(entry, costByOperationId.get(operationId));
      movement.destinationMerchantAccountId = state.merchantAccountId;
      movement.carryingValueMinor = valued.valueMinor;
      movement.valuationSource = valued.source;
      if (!valued.source || valued.source === 'historical_cost_compatibility') diagnostics.push({
        code: 'missing_approved_historical_price', severity: 'warning', operationId, merchantAccountId: state.merchantAccountId,
        message: valued.source
          ? 'Immutable official-price snapshot was missing; the existing approved historical inventory-cost compatibility value was preserved.'
          : 'No approved historical price source was available; no merchant liability price was invented.',
      });
      addLiability(state, requestedUnits, valued.valueMinor);
      movements.push(movement);
      return;
    }

    if (semantic === 'merchant_transfer' && isGoldMerchant(debit) && isGoldMerchant(credit)) {
      const movement = blank('merchant_transfer');
      const source = ensureState(debit);
      const destination = ensureState(credit);
      const released = releaseLiability(source, requestedUnits, entry);
      addLiability(destination, released.units, released.valueMinor);
      movement.sourceMerchantAccountId = source.merchantAccountId;
      movement.destinationMerchantAccountId = destination.merchantAccountId;
      movement.quantityUnits = released.units;
      movement.carryingValueMinor = released.valueMinor;
      movement.merchantLiabilityReleasedValueMinor = released.valueMinor;
      movement.valuationSource = 'source_merchant_wac';
      movements.push(movement);
      return;
    }

    if (semantic === 'gold_weight_settlement' && isGoldMerchant(debit)) {
      const movement = blank('weight_settlement');
      const state = ensureState(debit);
      const released = releaseLiability(state, requestedUnits, entry);
      const inventoryResult = costByOperationId.get(operationId);
      if (!inventoryResult || inventoryResult.classification !== 'merchant_delivery') diagnostics.push({
        code: 'inventory_cost_result_missing', severity: 'error', operationId, merchantAccountId: state.merchantAccountId,
        message: 'Merchant weight settlement is missing its authoritative Inventory WAC result.',
      });
      const inventoryBookValue = inventoryResult?.classification === 'merchant_delivery'
        ? inventoryResult.outgoingTotalCostMinor
        : 0;
      const difference = released.valueMinor - inventoryBookValue;
      movement.sourceMerchantAccountId = state.merchantAccountId;
      movement.quantityUnits = released.units;
      movement.carryingValueMinor = released.valueMinor;
      movement.merchantLiabilityReleasedValueMinor = released.valueMinor;
      movement.inventoryBookValueReleasedMinor = inventoryBookValue;
      movement.settlementGainMinor = Math.max(0, difference);
      movement.settlementLossMinor = Math.max(0, -difference);
      movement.valuationSource = 'source_merchant_wac';
      movements.push(movement);
    }
  });

  const finalStates = Object.fromEntries([...states].map(([accountId, state]) => [accountId, stateSnapshot(state)]));
  return {
    calculationVersion: 'merchant-gold-liability-wac-v1',
    movements,
    movementsByOperationId: Object.fromEntries(movements.map(movement => [movement.operationId, movement])),
    finalStates,
    diagnostics,
  };
};
