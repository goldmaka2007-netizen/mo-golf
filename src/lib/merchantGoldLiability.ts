import type { Account, Entry } from '../types';
import {
  getEntryArabicWeight,
  resolveMerchantMetalOperationSemantic,
  type MerchantMetal,
} from './engine';
import { compareEntriesForPhase5Cost, getPhase5OperationId } from './inventoryCostEngine';
import type { InventoryCostTimeline, OperationCostResultV2 } from './inventoryCostTypes';

export type MerchantGoldLiabilityMovementKind =
  | 'opening'
  | 'receipt'
  | 'weight_settlement'
  | 'cash_settlement'
  | 'merchant_transfer';

export type MerchantMetalPositionSide = 'payable' | 'receivable' | 'settled';

export interface MerchantGoldLiabilityState {
  merchantAccountId: string;
  merchantName: string;
  metal: MerchantMetal;
  signedQuantityUnits: number;
  signedQuantity: number;
  positionSide: MerchantMetalPositionSide;
  signedCarryingValueMinor: number;
  payableBookValueMinor: number;
  receivableBookValueMinor: number;
  currentWacMinorPerUnit: number | null;
  goldE21BalanceUnits: number;
  goldE21Balance: number;
  goldLiabilityBookValueMinor: number;
  goldReceivableBookValueMinor: number;
  goldLiabilityWacMinorPerE21Unit: number | null;
  goldReceivableWacMinorPerE21Unit: number | null;
  silverBalanceUnits: number;
  silverBalance: number;
  silverLiabilityBookValueMinor: number;
  silverReceivableBookValueMinor: number;
  silverLiabilityWacMinorPerUnit: number | null;
  silverReceivableWacMinorPerUnit: number | null;
}

export interface MerchantGoldLiabilityMovement {
  operationId: string;
  entry: Entry;
  kind: MerchantGoldLiabilityMovementKind;
  metal: MerchantMetal | null;
  sourceMerchantAccountId?: string;
  destinationMerchantAccountId?: string;
  quantityUnits: number;
  carryingValueMinor: number;
  merchantDebitValueMinor: number;
  merchantCreditValueMinor: number;
  merchantLiabilityReleasedValueMinor: number;
  merchantReceivableReleasedValueMinor: number;
  merchantPayableCreatedValueMinor: number;
  merchantReceivableCreatedValueMinor: number;
  inventoryBookValueReleasedMinor: number;
  inventoryBookValueRecognizedMinor: number;
  settlementGainMinor: number;
  settlementLossMinor: number;
  transferInvoiceValueMinor: number;
  transferGainMinor: number;
  transferLossMinor: number;
  sourceTransferGainMinor: number;
  sourceTransferLossMinor: number;
  destinationTransferGainMinor: number;
  destinationTransferLossMinor: number;
  sourceMerchantReleasedQuantityUnits: number;
  sourceMerchantReleasedValueMinor: number;
  sourceMerchantCreatedValueMinor: number;
  destinationMerchantReleasedQuantityUnits: number;
  destinationMerchantReleasedValueMinor: number;
  destinationMerchantCreatedValueMinor: number;
  valuationSource?: 'opening_cost_compatibility' | 'operation_price_snapshot' | 'historical_cost_compatibility' | 'source_merchant_wac' | 'transfer_operation_price_snapshot';
}

export interface MerchantGoldLiabilityDiagnostic {
  code:
    | 'ambiguous_account_reference'
    | 'missing_approved_historical_price'
    | 'missing_opening_price'
    | 'missing_transfer_carrying_basis'
    | 'missing_transfer_invoice_price'
    | 'inventory_cost_result_missing'
    | 'transfer_carrying_value_sign_mismatch'
    | 'zero_weight_book_value_residue';
  severity: 'warning' | 'error';
  operationId?: string;
  merchantAccountId?: string;
  metal?: MerchantMetal;
  message: string;
}

export interface MerchantGoldLiabilityTimeline {
  calculationVersion: 'merchant-metal-signed-wac-v3';
  movements: MerchantGoldLiabilityMovement[];
  movementsByOperationId: Record<string, MerchantGoldLiabilityMovement>;
  finalStates: Record<string, MerchantGoldLiabilityState>;
  diagnostics: MerchantGoldLiabilityDiagnostic[];
}

/** Immutable Firestore identity of Makka's single approved transfer hub. */
export const AL_SAFI_TRANSFER_HUB_ACCOUNT_ID = '3zGclNk6qdAuNxM6y5iP';

interface SignedInvoiceTransition {
  bookValueChangeMinor: number;
  releasedQuantityUnits: number;
  releasedValueMinor: number;
  createdValueMinor: number;
  gainMinor: number;
  lossMinor: number;
}

interface MutableMerchantState {
  merchantAccountId: string;
  merchantName: string;
  metal: MerchantMetal;
  signedQuantityUnits: number;
  signedCarryingValueMinor: number;
}

const GRAM_SCALE = 100;
const normalize = (value: unknown): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const roundDivide = (numerator: bigint, denominator: bigint): bigint =>
  numerator >= 0n
    ? (numerator + denominator / 2n) / denominator
    : -((-numerator + denominator / 2n) / denominator);
const proportionalValue = (totalMinor: number, totalUnits: number, requestedUnits: number): number => {
  if (totalMinor <= 0 || totalUnits <= 0 || requestedUnits <= 0) return 0;
  if (requestedUnits === totalUnits) return totalMinor;
  return Number(roundDivide(BigInt(totalMinor) * BigInt(requestedUnits), BigInt(totalUnits)));
};
const positionSide = (units: number): MerchantMetalPositionSide => units > 0 ? 'payable' : units < 0 ? 'receivable' : 'settled';
const currentWac = (state: MutableMerchantState): number | null =>
  state.signedQuantityUnits === 0 ? null : Math.abs(state.signedCarryingValueMinor) / Math.abs(state.signedQuantityUnits);

const stateSnapshot = (state: MutableMerchantState): MerchantGoldLiabilityState => {
  const side = positionSide(state.signedQuantityUnits);
  const carrying = Math.abs(state.signedCarryingValueMinor);
  const wac = currentWac(state);
  const gold = state.metal === 'gold';
  const silver = state.metal === 'silver';
  return {
    ...state,
    signedQuantity: state.signedQuantityUnits / GRAM_SCALE,
    positionSide: side,
    payableBookValueMinor: side === 'payable' ? carrying : 0,
    receivableBookValueMinor: side === 'receivable' ? carrying : 0,
    currentWacMinorPerUnit: wac,
    goldE21BalanceUnits: gold ? state.signedQuantityUnits : 0,
    goldE21Balance: gold ? state.signedQuantityUnits / GRAM_SCALE : 0,
    goldLiabilityBookValueMinor: gold && side === 'payable' ? carrying : 0,
    goldReceivableBookValueMinor: gold && side === 'receivable' ? carrying : 0,
    goldLiabilityWacMinorPerE21Unit: gold && side === 'payable' ? wac : null,
    goldReceivableWacMinorPerE21Unit: gold && side === 'receivable' ? wac : null,
    silverBalanceUnits: silver ? state.signedQuantityUnits : 0,
    silverBalance: silver ? state.signedQuantityUnits / GRAM_SCALE : 0,
    silverLiabilityBookValueMinor: silver && side === 'payable' ? carrying : 0,
    silverReceivableBookValueMinor: silver && side === 'receivable' ? carrying : 0,
    silverLiabilityWacMinorPerUnit: silver && side === 'payable' ? wac : null,
    silverReceivableWacMinorPerUnit: silver && side === 'receivable' ? wac : null,
  };
};

const isMerchantFor = (account: Account | undefined, metal: MerchantMetal): boolean => !!account
  && account.type === 'merchant'
  && (account.metal === metal || account.canonicalSubType === `merchant_${metal}`);

const quantityUnits = (entry: Entry, metal: MerchantMetal, account?: Account): number =>
  metal === 'silver'
    ? Math.round(Math.abs(Number(entry.weight) || 0) * GRAM_SCALE)
    : Math.round(Math.abs(getEntryArabicWeight(entry, account)) * GRAM_SCALE);

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
  const byYearAndMetal = new Map<string, { costMinor: number; quantityUnits: number }>();
  if (!timeline?.valid) return byYearAndMetal;
  timeline.results.filter(result => result.classification === 'opening').forEach(result => {
    const inventoryId = result.destinationInventoryAccountId || result.inventoryAccountId;
    const metal = inventoryId ? timeline.finalStates[inventoryId]?.kind : undefined;
    if (metal !== 'gold' && metal !== 'silver') return;
    if (result.incomingStandardizedQuantityUnits <= 0 || result.incomingMetalCostMinor <= 0) return;
    const key = `${result.entry.date.slice(0, 4)}:${metal}`;
    const current = byYearAndMetal.get(key) ?? { costMinor: 0, quantityUnits: 0 };
    current.costMinor += result.incomingMetalCostMinor;
    current.quantityUnits += result.incomingStandardizedQuantityUnits;
    byYearAndMetal.set(key, current);
  });
  return byYearAndMetal;
};

const snapshotValue = (
  entry: Entry,
  metal: MerchantMetal,
  requestedUnits: number,
  totalUnits: number,
): { valueMinor: number; source?: MerchantGoldLiabilityMovement['valuationSource'] } => {
  const official = Number(entry.invoiceOfficialPricePerGramEgp);
  if (Number.isFinite(official) && official > 0 && requestedUnits > 0) {
    return { valueMinor: Math.round(official * requestedUnits), source: 'operation_price_snapshot' };
  }
  const saved = Number(entry.marketPrice);
  const physicalUnits = Math.round(Math.abs(Number(entry.weight) || 0) * GRAM_SCALE);
  if (Number.isFinite(saved) && saved > 0 && physicalUnits > 0 && totalUnits > 0) {
    const fullValue = Math.round(saved * physicalUnits);
    return { valueMinor: proportionalValue(fullValue, totalUnits, requestedUnits), source: 'operation_price_snapshot' };
  }
  return { valueMinor: 0 };
};

const receiptCost = (
  entry: Entry,
  result: OperationCostResultV2 | undefined,
  metal: MerchantMetal,
  units: number,
): { valueMinor: number; source?: MerchantGoldLiabilityMovement['valuationSource'] } => {
  const direct = snapshotValue(entry, metal, units, units);
  if (direct.source) return direct;
  if (result?.classification === 'merchant_receipt' && result.incomingMetalCostMinor > 0) {
    return { valueMinor: result.incomingMetalCostMinor, source: 'historical_cost_compatibility' };
  }
  return { valueMinor: 0 };
};

const applySignedInvoiceTransition = (
  state: MutableMerchantState,
  deltaUnits: number,
  invoiceValueMinor: number,
): SignedInvoiceTransition => {
  const movedUnits = Math.abs(deltaUnits);
  const deltaSign = Math.sign(deltaUnits);
  const beforeUnits = state.signedQuantityUnits;
  const beforeValue = state.signedCarryingValueMinor;
  const beforeSign = Math.sign(beforeUnits);

  if (beforeUnits === 0 || beforeSign === deltaSign) {
    state.signedQuantityUnits += deltaUnits;
    state.signedCarryingValueMinor += deltaSign * invoiceValueMinor;
    return {
      bookValueChangeMinor: invoiceValueMinor,
      releasedQuantityUnits: 0,
      releasedValueMinor: 0,
      createdValueMinor: invoiceValueMinor,
      gainMinor: 0,
      lossMinor: 0,
    };
  }

  const releasedQuantityUnits = Math.min(Math.abs(beforeUnits), movedUnits);
  const releasedValueMinor = proportionalValue(
    Math.abs(beforeValue),
    Math.abs(beforeUnits),
    releasedQuantityUnits,
  );
  const realizedInvoiceValueMinor = proportionalValue(
    invoiceValueMinor,
    movedUnits,
    releasedQuantityUnits,
  );
  const excessUnits = movedUnits - releasedQuantityUnits;
  const createdValueMinor = invoiceValueMinor - realizedInvoiceValueMinor;
  const difference = realizedInvoiceValueMinor - releasedValueMinor;

  if (excessUnits === 0) {
    state.signedQuantityUnits += deltaUnits;
    state.signedCarryingValueMinor -= beforeSign * releasedValueMinor;
    if (state.signedQuantityUnits === 0) state.signedCarryingValueMinor = 0;
  } else {
    state.signedQuantityUnits = deltaSign * excessUnits;
    state.signedCarryingValueMinor = deltaSign * createdValueMinor;
  }

  return {
    bookValueChangeMinor: releasedValueMinor + createdValueMinor,
    releasedQuantityUnits,
    releasedValueMinor,
    createdValueMinor,
    gainMinor: beforeSign > 0 ? Math.max(0, -difference) : Math.max(0, difference),
    lossMinor: beforeSign > 0 ? Math.max(0, difference) : Math.max(0, -difference),
  };
};

/** Pure in-memory signed carrying-value timeline. Gold, silver, inventory,
 * merchant cash, payable pools, and receivable pools remain independent. */
export const buildMerchantMetalPositionTimeline = (
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

  const ensureState = (account: Account, metal: MerchantMetal): MutableMerchantState => {
    const accountId = account.id || `legacy-name:${normalize(account.name)}`;
    const existing = states.get(accountId);
    if (existing) return existing;
    const state: MutableMerchantState = {
      merchantAccountId: accountId,
      merchantName: account.name,
      metal,
      signedQuantityUnits: 0,
      signedCarryingValueMinor: 0,
    };
    states.set(accountId, state);
    return state;
  };

  const assertState = (state: MutableMerchantState, entry: Entry): void => {
    if (state.signedQuantityUnits === 0 && state.signedCarryingValueMinor !== 0) diagnostics.push({
      code: 'zero_weight_book_value_residue', severity: 'error', operationId: getPhase5OperationId(entry),
      merchantAccountId: state.merchantAccountId, metal: state.metal,
      message: `Zero merchant ${state.metal} balance retained ${state.signedCarryingValueMinor} signed minor units.`,
    });
    if (state.signedQuantityUnits !== 0
      && Math.sign(state.signedQuantityUnits) !== Math.sign(state.signedCarryingValueMinor)) diagnostics.push({
      code: 'transfer_carrying_value_sign_mismatch', severity: 'error', operationId: getPhase5OperationId(entry),
      merchantAccountId: state.merchantAccountId, metal: state.metal,
      message: `Merchant ${state.metal} transfer produced a carrying-value sign inconsistent with its signed weight.`,
    });
  };

  const releasePayable = (state: MutableMerchantState, requestedUnits: number): { units: number; valueMinor: number } => {
    const units = Math.min(requestedUnits, Math.max(0, state.signedQuantityUnits));
    const valueMinor = proportionalValue(Math.max(0, state.signedCarryingValueMinor), state.signedQuantityUnits, units);
    state.signedQuantityUnits -= units;
    state.signedCarryingValueMinor -= valueMinor;
    if (state.signedQuantityUnits === 0) state.signedCarryingValueMinor = 0;
    return { units, valueMinor };
  };
  const releaseReceivable = (state: MutableMerchantState, requestedUnits: number): { units: number; valueMinor: number } => {
    const available = Math.max(0, -state.signedQuantityUnits);
    const units = Math.min(requestedUnits, available);
    const valueMinor = proportionalValue(Math.max(0, -state.signedCarryingValueMinor), available, units);
    state.signedQuantityUnits += units;
    state.signedCarryingValueMinor += valueMinor;
    if (state.signedQuantityUnits === 0) state.signedCarryingValueMinor = 0;
    return { units, valueMinor };
  };
  const addPayable = (state: MutableMerchantState, units: number, valueMinor: number): void => {
    state.signedQuantityUnits += units;
    state.signedCarryingValueMinor += valueMinor;
  };
  const addReceivable = (state: MutableMerchantState, units: number, valueMinor: number): void => {
    state.signedQuantityUnits -= units;
    state.signedCarryingValueMinor -= valueMinor;
  };

  [...entries].sort(compareEntriesForPhase5Cost).forEach(entry => {
    const operationId = getPhase5OperationId(entry);
    const debit = resolveSide(entry, 'debit');
    const credit = resolveSide(entry, 'credit');
    const semantic = resolveMerchantMetalOperationSemantic(entry, debit, credit);
    const metal = semantic.metal;
    const requestedUnits = metal ? quantityUnits(entry, metal, debit ?? credit) : 0;
    const blank = (kind: MerchantGoldLiabilityMovementKind): MerchantGoldLiabilityMovement => ({
      operationId, entry, kind, metal, quantityUnits: requestedUnits, carryingValueMinor: 0,
      merchantDebitValueMinor: 0, merchantCreditValueMinor: 0,
      merchantLiabilityReleasedValueMinor: 0, merchantReceivableReleasedValueMinor: 0,
      merchantPayableCreatedValueMinor: 0, merchantReceivableCreatedValueMinor: 0,
      inventoryBookValueReleasedMinor: 0, inventoryBookValueRecognizedMinor: 0,
      settlementGainMinor: 0, settlementLossMinor: 0,
      transferInvoiceValueMinor: 0, transferGainMinor: 0, transferLossMinor: 0,
      sourceTransferGainMinor: 0, sourceTransferLossMinor: 0,
      destinationTransferGainMinor: 0, destinationTransferLossMinor: 0,
      sourceMerchantReleasedQuantityUnits: 0, sourceMerchantReleasedValueMinor: 0,
      sourceMerchantCreatedValueMinor: 0,
      destinationMerchantReleasedQuantityUnits: 0, destinationMerchantReleasedValueMinor: 0,
      destinationMerchantCreatedValueMinor: 0,
    });

    if (semantic.kind === 'cash_settlement') {
      movements.push(blank('cash_settlement'));
      return;
    }
    if (!metal || requestedUnits <= 0) return;

    if (semantic.kind === 'opening') {
      const merchant = isMerchantFor(credit, metal) ? credit : isMerchantFor(debit, metal) ? debit : undefined;
      if (!merchant) return;
      const movement = blank('opening');
      const state = ensureState(merchant, metal);
      const price = openingPrices.get(`${entry.date.slice(0, 4)}:${metal}`);
      const valueMinor = price
        ? proportionalValue(price.costMinor, price.quantityUnits, requestedUnits)
        : 0;
      if (!price) diagnostics.push({
        code: 'missing_opening_price', severity: 'error', operationId, merchantAccountId: state.merchantAccountId, metal,
        message: `No approved Settings opening ${metal} cost was available.`,
      });
      movement.carryingValueMinor = valueMinor;
      movement.valuationSource = price ? 'opening_cost_compatibility' : undefined;
      if (merchant === credit) {
        movement.destinationMerchantAccountId = state.merchantAccountId;
        movement.merchantCreditValueMinor = valueMinor;
        addPayable(state, requestedUnits, valueMinor);
      } else {
        movement.sourceMerchantAccountId = state.merchantAccountId;
        movement.merchantDebitValueMinor = valueMinor;
        addReceivable(state, requestedUnits, valueMinor);
      }
      assertState(state, entry);
      movements.push(movement);
      return;
    }

    if (semantic.kind === 'receipt' && isMerchantFor(credit, metal)) {
      const movement = blank('receipt');
      const state = ensureState(credit, metal);
      const inventoryResult = costByOperationId.get(operationId);
      const valued = receiptCost(entry, inventoryResult, metal, requestedUnits);
      movement.destinationMerchantAccountId = state.merchantAccountId;
      movement.inventoryBookValueRecognizedMinor = inventoryResult?.classification === 'merchant_receipt'
        ? inventoryResult.incomingTotalCostMinor : valued.valueMinor;
      movement.valuationSource = valued.source;
      if (!valued.source || valued.source === 'historical_cost_compatibility') diagnostics.push({
        code: 'missing_approved_historical_price', severity: 'warning', operationId,
        merchantAccountId: state.merchantAccountId, metal,
        message: 'Immutable operation price is missing; exact-date historical price backfill is required.',
      });

      const released = state.signedQuantityUnits < 0 ? releaseReceivable(state, requestedUnits) : { units: 0, valueMinor: 0 };
      const settlementIncomingValue = proportionalValue(valued.valueMinor, requestedUnits, released.units);
      const excessUnits = requestedUnits - released.units;
      const excessValue = valued.valueMinor - settlementIncomingValue;
      if (excessUnits > 0) addPayable(state, excessUnits, excessValue);
      const difference = settlementIncomingValue - released.valueMinor;
      movement.merchantReceivableReleasedValueMinor = released.valueMinor;
      movement.merchantPayableCreatedValueMinor = excessValue;
      movement.merchantCreditValueMinor = released.valueMinor + excessValue;
      movement.carryingValueMinor = movement.merchantCreditValueMinor;
      movement.settlementGainMinor = Math.max(0, difference);
      movement.settlementLossMinor = Math.max(0, -difference);
      assertState(state, entry);
      movements.push(movement);
      return;
    }

    if (semantic.kind === 'merchant_transfer' && isMerchantFor(debit, metal) && isMerchantFor(credit, metal)) {
      const movement = blank('merchant_transfer');
      const source = ensureState(debit, metal);
      const destination = ensureState(credit, metal);
      const throughAlSafi = source.merchantAccountId === AL_SAFI_TRANSFER_HUB_ACCOUNT_ID
        || destination.merchantAccountId === AL_SAFI_TRANSFER_HUB_ACCOUNT_ID;
      if (throughAlSafi) {
        const transferValue = snapshotValue(entry, metal, requestedUnits, requestedUnits);
        if (!transferValue.source) {
          diagnostics.push({
            code: 'missing_transfer_invoice_price', severity: 'error', operationId,
            merchantAccountId: AL_SAFI_TRANSFER_HUB_ACCOUNT_ID, metal,
            message: 'Al-Safi transfer has no usable immutable invoice price snapshot.',
          });
          movements.push(movement);
          return;
        }

        const sourceTransition = applySignedInvoiceTransition(source, -requestedUnits, transferValue.valueMinor);
        const destinationTransition = applySignedInvoiceTransition(destination, requestedUnits, transferValue.valueMinor);
        movement.sourceMerchantAccountId = source.merchantAccountId;
        movement.destinationMerchantAccountId = destination.merchantAccountId;
        movement.carryingValueMinor = transferValue.valueMinor;
        movement.transferInvoiceValueMinor = transferValue.valueMinor;
        movement.merchantDebitValueMinor = sourceTransition.bookValueChangeMinor;
        movement.merchantCreditValueMinor = destinationTransition.bookValueChangeMinor;
        movement.sourceMerchantReleasedQuantityUnits = sourceTransition.releasedQuantityUnits;
        movement.sourceMerchantReleasedValueMinor = sourceTransition.releasedValueMinor;
        movement.sourceMerchantCreatedValueMinor = sourceTransition.createdValueMinor;
        movement.destinationMerchantReleasedQuantityUnits = destinationTransition.releasedQuantityUnits;
        movement.destinationMerchantReleasedValueMinor = destinationTransition.releasedValueMinor;
        movement.destinationMerchantCreatedValueMinor = destinationTransition.createdValueMinor;
        movement.sourceTransferGainMinor = sourceTransition.gainMinor;
        movement.sourceTransferLossMinor = sourceTransition.lossMinor;
        movement.destinationTransferGainMinor = destinationTransition.gainMinor;
        movement.destinationTransferLossMinor = destinationTransition.lossMinor;
        movement.transferGainMinor = sourceTransition.gainMinor + destinationTransition.gainMinor;
        movement.transferLossMinor = sourceTransition.lossMinor + destinationTransition.lossMinor;
        movement.valuationSource = 'transfer_operation_price_snapshot';
        assertState(source, entry);
        assertState(destination, entry);
        movements.push(movement);
        return;
      }
      const wac = currentWac(source);
      if (wac === null) diagnostics.push({
        code: 'missing_transfer_carrying_basis', severity: 'error', operationId,
        merchantAccountId: source.merchantAccountId, metal,
        message: `Merchant ${metal} transfer source has no carrying-value basis.`,
      });
      // Transfers are valued exclusively from the source signed carrying pool.
      // A destination zero-crossing is an algebraic combination with its existing
      // receivable/payable carrying value; it never changes the value released by source.
      const transferredValue = wac === null ? 0 : Math.round(wac * requestedUnits);
      if (source.signedQuantityUnits > 0 && requestedUnits <= source.signedQuantityUnits) {
        const released = releasePayable(source, requestedUnits);
        // `releasePayable` closes the full pool exactly, avoiding a rounding residue.
        addPayable(destination, requestedUnits, released.valueMinor);
        movement.carryingValueMinor = released.valueMinor;
        movement.merchantDebitValueMinor = released.valueMinor;
        movement.merchantCreditValueMinor = released.valueMinor;
      } else {
        source.signedQuantityUnits -= requestedUnits;
        source.signedCarryingValueMinor -= transferredValue;
        destination.signedQuantityUnits += requestedUnits;
        destination.signedCarryingValueMinor += transferredValue;
        movement.carryingValueMinor = transferredValue;
        movement.merchantDebitValueMinor = transferredValue;
        movement.merchantCreditValueMinor = transferredValue;
      }
      movement.sourceMerchantAccountId = source.merchantAccountId;
      movement.destinationMerchantAccountId = destination.merchantAccountId;
      movement.valuationSource = 'source_merchant_wac';
      assertState(source, entry);
      assertState(destination, entry);
      movements.push(movement);
      return;
    }

    if (semantic.kind === 'weight_settlement' && isMerchantFor(debit, metal)) {
      const movement = blank('weight_settlement');
      const state = ensureState(debit, metal);
      const released = state.signedQuantityUnits > 0 ? releasePayable(state, requestedUnits) : { units: 0, valueMinor: 0 };
      const excessUnits = requestedUnits - released.units;
      const excessValued = snapshotValue(entry, metal, excessUnits, requestedUnits);
      if (excessUnits > 0 && !excessValued.source) diagnostics.push({
        code: 'missing_approved_historical_price', severity: 'error', operationId,
        merchantAccountId: state.merchantAccountId, metal,
        message: 'Physical overdelivery creates/increases a receivable and requires an immutable operation price.',
      });
      if (excessUnits > 0) addReceivable(state, excessUnits, excessValued.valueMinor);
      const inventoryResult = costByOperationId.get(operationId);
      if (!inventoryResult || inventoryResult.classification !== 'merchant_delivery') diagnostics.push({
        code: 'inventory_cost_result_missing', severity: 'error', operationId,
        merchantAccountId: state.merchantAccountId, metal,
        message: 'Merchant physical settlement is missing its authoritative Inventory WAC result.',
      });
      const inventoryBookValue = inventoryResult?.classification === 'merchant_delivery'
        ? inventoryResult.outgoingTotalCostMinor : 0;
      const merchantDebit = released.valueMinor + excessValued.valueMinor;
      const difference = merchantDebit - inventoryBookValue;
      movement.sourceMerchantAccountId = state.merchantAccountId;
      movement.merchantLiabilityReleasedValueMinor = released.valueMinor;
      movement.merchantReceivableCreatedValueMinor = excessValued.valueMinor;
      movement.merchantDebitValueMinor = merchantDebit;
      movement.carryingValueMinor = merchantDebit;
      movement.inventoryBookValueReleasedMinor = inventoryBookValue;
      movement.settlementGainMinor = Math.max(0, difference);
      movement.settlementLossMinor = Math.max(0, -difference);
      movement.valuationSource = excessUnits > 0 ? excessValued.source : 'source_merchant_wac';
      assertState(state, entry);
      movements.push(movement);
    }
  });

  const finalStates = Object.fromEntries([...states].map(([accountId, state]) => [accountId, stateSnapshot(state)]));
  return {
    calculationVersion: 'merchant-metal-signed-wac-v3',
    movements,
    movementsByOperationId: Object.fromEntries(movements.map(movement => [movement.operationId, movement])),
    finalStates,
    diagnostics,
  };
};

/** Backward-compatible export name retained for downstream consumers. */
export const buildMerchantGoldLiabilityTimeline = buildMerchantMetalPositionTimeline;
