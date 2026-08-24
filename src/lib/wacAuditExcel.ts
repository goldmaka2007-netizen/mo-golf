import type { Account, Entry } from '../types';
import { buildMerchantMetalPositionTimeline, type MerchantGoldLiabilityState } from './merchantGoldLiability';
import type { InventoryCostState, InventoryCostTimeline, Phase5OpeningCostConfig } from './inventoryCostTypes';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';

const GRAM_SCALE = 100;
const EGP_SCALE = 100;

type ExcelValue = string | number | boolean | null;
type ExcelRow = Record<string, ExcelValue>;
export interface WacAuditCsv { rows: ExcelRow[]; }

export interface WacAuditWorkbookInput {
  entries: Entry[];
  accounts: Account[];
  openingCostConfig: Phase5OpeningCostConfig;
  inventoryTimeline: InventoryCostTimeline;
  /** Test-only injection; production uses the canonical runtime cost path. */
  rebuildInventoryTimeline?: (entries: Entry[]) => InventoryCostTimeline;
  exportedAt?: Date;
}

const egp = (minor: number | null | undefined): number | null =>
  minor === null || minor === undefined ? null : minor / EGP_SCALE;
const grams = (units: number | null | undefined): number | null =>
  units === null || units === undefined ? null : units / GRAM_SCALE;
const operationNumber = (entry: Entry): string => String(entry.operationNo ?? entry.invoiceNumber ?? entry.journalNo ?? entry.seq ?? entry.id ?? '');
const positionDirection = (side: MerchantGoldLiabilityState['positionSide']): string =>
  side === 'payable' ? 'مستحق للتاجر' : side === 'receivable' ? 'مستحق للمحل' : 'مسدد';
const inventoryAccountName = (accountsById: Map<string, Account>, accountId?: string): string =>
  accountId ? accountsById.get(accountId)?.name ?? '' : '';
const wacPerGram = (minorPerUnit: number | null | undefined): number | null =>
  minorPerUnit === null || minorPerUnit === undefined ? null : minorPerUnit;
// Inventory state stores WAC in minor EGP per display gram; Excel labels it EGP/g.
const inventoryWacPerGram = (minorPerGram: number | null | undefined): number | null =>
  egp(minorPerGram);

type InventoryAuditState = Pick<InventoryCostState,
  'kind' | 'standardizedQuantityUnits' | 'actualPhysicalWeightUnits' | 'accessoryQuantityUnits' | 'remainingTotalCostMinor'>;

const inventoryAuditSnapshot = (state: InventoryAuditState | undefined): InventoryAuditState | undefined =>
  state && { ...state };

const inventoryAuditWac = (state: InventoryAuditState | undefined): number | null => {
  if (!state) return null;
  const units = state.kind === 'accessory' ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
  if (units <= 0) return null;
  const minorPerDisplayUnit = state.kind === 'accessory'
    ? (state.remainingTotalCostMinor * 1000) / units
    : (state.remainingTotalCostMinor * GRAM_SCALE) / units;
  return egp(minorPerDisplayUnit);
};

const createInventoryAuditStates = (timeline: InventoryCostTimeline): Map<string, InventoryAuditState> =>
  new Map(Object.values(timeline.finalStates).map(state => [state.inventoryAccountId, {
    kind: state.kind,
    standardizedQuantityUnits: 0,
    actualPhysicalWeightUnits: 0,
    accessoryQuantityUnits: 0,
    remainingTotalCostMinor: 0,
  }]));

const applyInventoryAuditDelta = (
  states: Map<string, InventoryAuditState>,
  accountId: string | undefined,
  result: InventoryCostTimeline['results'][number],
  direction: 1 | -1,
): void => {
  if (!accountId) return;
  const state = states.get(accountId);
  if (!state) throw new Error(`WAC audit cannot find authoritative inventory state for ${accountId}.`);
  const incoming = direction === 1;
  state.standardizedQuantityUnits += direction * (incoming ? result.incomingStandardizedQuantityUnits : result.outgoingStandardizedQuantityUnits);
  state.actualPhysicalWeightUnits += direction * (incoming ? result.incomingActualPhysicalWeightUnits : result.outgoingActualPhysicalWeightUnits);
  state.accessoryQuantityUnits += direction * (incoming ? result.incomingAccessoryQuantityUnits : result.outgoingAccessoryQuantityUnits);
  state.remainingTotalCostMinor += direction * (incoming ? result.incomingTotalCostMinor : result.outgoingTotalCostMinor);
};

const inventoryRows = (input: WacAuditWorkbookInput, accountsById: Map<string, Account>): ExcelRow[] => {
  const states = createInventoryAuditStates(input.inventoryTimeline);

  return input.inventoryTimeline.results.map(result => {
    const snapshotAccountId = result.destinationInventoryAccountId ?? result.inventoryAccountId ?? result.sourceInventoryAccountId;
    const stateBefore = inventoryAuditSnapshot(states.get(snapshotAccountId ?? ''));
    // Every quantity and carrying-value delta below is already calculated by the canonical timeline.
    // This pass intentionally never invokes a cost engine or derives cost from raw entries.
    applyInventoryAuditDelta(states, result.sourceInventoryAccountId ?? (result.destinationInventoryAccountId ? undefined : result.inventoryAccountId), result, -1);
    applyInventoryAuditDelta(states, result.destinationInventoryAccountId ?? result.inventoryAccountId, result, 1);
    const stateAfter = inventoryAuditSnapshot(states.get(snapshotAccountId ?? ''));
    const row: ExcelRow = {
      'التاريخ': result.entry.date,
      'رقم العملية': operationNumber(result.entry),
      'Operation ID': result.operationId,
      'Classification': result.classification,
      'اسم حساب المخزون': inventoryAccountName(accountsById, snapshotAccountId),
      'Inventory Account ID': snapshotAccountId ?? '',
      'Source Inventory Account': inventoryAccountName(accountsById, result.sourceInventoryAccountId),
      'Destination Inventory Account': inventoryAccountName(accountsById, result.destinationInventoryAccountId),
      'الوزن الفعلي الداخل': grams(result.incomingActualPhysicalWeightUnits),
      'الوزن الفعلي الخارج': grams(result.outgoingActualPhysicalWeightUnits),
      'E21 / standardized quantity الداخل': grams(result.incomingStandardizedQuantityUnits),
      'E21 / standardized quantity الخارج': grams(result.outgoingStandardizedQuantityUnits),
      'تكلفة المعدن الداخلة': egp(result.incomingMetalCostMinor),
      'تكلفة المصنعية الداخلة': egp(result.incomingWorkmanshipCostMinor),
      'إجمالي التكلفة الداخلة': egp(result.incomingTotalCostMinor),
      'تكلفة المعدن الخارجة': egp(result.outgoingMetalCostMinor),
      'تكلفة المصنعية الخارجة': egp(result.outgoingWorkmanshipCostMinor),
      'إجمالي التكلفة الخارجة': egp(result.outgoingTotalCostMinor),
      'COGS المعدن': egp(result.metalCogsMinor),
      'COGS المصنعية': egp(result.workmanshipCogsMinor),
      'إجمالي COGS': egp(result.totalCogsMinor),
      'قيمة البيع': egp(result.saleAmountMinor),
      'الربح': egp(result.profitMinor),
      'مكسب التسوية/الزيادة': egp(result.adjustmentGainMinor),
      'خسارة التسوية/العجز': egp(result.adjustmentLossMinor),
      'WAC قبل الحركة': inventoryAuditWac(stateBefore),
      'WAC المستخدم في الخروج': result.outgoingStandardizedQuantityUnits > 0
        ? egp(result.outgoingTotalCostMinor)! / grams(result.outgoingStandardizedQuantityUnits)!
        : null,
      'WAC بعد الحركة': inventoryAuditWac(stateAfter),
      'رصيد الوزن قبل': stateBefore?.kind === 'accessory' ? grams(stateBefore.accessoryQuantityUnits) : grams(stateBefore?.actualPhysicalWeightUnits),
      'رصيد الوزن بعد': stateAfter?.kind === 'accessory' ? grams(stateAfter.accessoryQuantityUnits) : grams(stateAfter?.actualPhysicalWeightUnits),
      'القيمة الدفترية قبل': egp(stateBefore?.remainingTotalCostMinor),
      'القيمة الدفترية بعد': egp(stateAfter?.remainingTotalCostMinor),
      'Calculation version': result.calculationVersion,
    };
    return row;
  });
};

const merchantRows = (input: WacAuditWorkbookInput, accountsById: Map<string, Account>): ExcelRow[] => {
  const complete = buildMerchantMetalPositionTimeline(input.entries, input.accounts, input.inventoryTimeline);
  const states = new Map(Object.values(complete.finalStates).map(state => [state.merchantAccountId, {
    metal: state.metal, signedQuantityUnits: 0, signedCarryingValueMinor: 0,
  }]));
  const snapshot = (accountId: string): MerchantGoldLiabilityState | undefined => {
    const state = states.get(accountId);
    if (!state) return undefined;
    const signedQuantity = state.signedQuantityUnits / GRAM_SCALE;
    const side = state.signedQuantityUnits > 0 ? 'payable' : state.signedQuantityUnits < 0 ? 'receivable' : 'settled';
    return {
      merchantAccountId: accountId, merchantName: accountsById.get(accountId)?.name ?? '', metal: state.metal,
      signedQuantityUnits: state.signedQuantityUnits, signedQuantity, positionSide: side,
      signedCarryingValueMinor: state.signedCarryingValueMinor,
      payableBookValueMinor: side === 'payable' ? state.signedCarryingValueMinor : 0,
      receivableBookValueMinor: side === 'receivable' ? -state.signedCarryingValueMinor : 0,
      currentWacMinorPerUnit: state.signedQuantityUnits === 0 ? null : Math.abs(state.signedCarryingValueMinor) / Math.abs(state.signedQuantityUnits),
      goldE21BalanceUnits: state.metal === 'gold' ? state.signedQuantityUnits : 0, goldE21Balance: state.metal === 'gold' ? signedQuantity : 0,
      goldLiabilityBookValueMinor: state.metal === 'gold' && side === 'payable' ? state.signedCarryingValueMinor : 0,
      goldReceivableBookValueMinor: state.metal === 'gold' && side === 'receivable' ? -state.signedCarryingValueMinor : 0,
      goldLiabilityWacMinorPerE21Unit: state.metal === 'gold' && side === 'payable' ? Math.abs(state.signedCarryingValueMinor) / Math.abs(state.signedQuantityUnits) : null,
      goldReceivableWacMinorPerE21Unit: state.metal === 'gold' && side === 'receivable' ? Math.abs(state.signedCarryingValueMinor) / Math.abs(state.signedQuantityUnits) : null,
      silverBalanceUnits: state.metal === 'silver' ? state.signedQuantityUnits : 0, silverBalance: state.metal === 'silver' ? signedQuantity : 0,
      silverLiabilityBookValueMinor: state.metal === 'silver' && side === 'payable' ? state.signedCarryingValueMinor : 0,
      silverReceivableBookValueMinor: state.metal === 'silver' && side === 'receivable' ? -state.signedCarryingValueMinor : 0,
      silverLiabilityWacMinorPerUnit: state.metal === 'silver' && side === 'payable' ? Math.abs(state.signedCarryingValueMinor) / Math.abs(state.signedQuantityUnits) : null,
      silverReceivableWacMinorPerUnit: state.metal === 'silver' && side === 'receivable' ? Math.abs(state.signedCarryingValueMinor) / Math.abs(state.signedQuantityUnits) : null,
    };
  };
  const apply = (accountId: string | undefined, quantityDelta: number, valueDelta: number): void => {
    if (!accountId) return;
    const state = states.get(accountId);
    if (!state) throw new Error(`WAC audit cannot find authoritative merchant state for ${accountId}.`);
    state.signedQuantityUnits += quantityDelta;
    state.signedCarryingValueMinor += valueDelta;
  };
  const row = (movement: typeof complete.movements[number], accountId: string, beforeState: MerchantGoldLiabilityState | undefined, afterState: MerchantGoldLiabilityState | undefined): ExcelRow => ({
      'التاريخ': movement.entry.date,
      'رقم العملية': operationNumber(movement.entry),
      'Operation ID': movement.operationId,
      'التاجر المصدر': inventoryAccountName(accountsById, movement.sourceMerchantAccountId),
      'التاجر الوجهة': inventoryAccountName(accountsById, movement.destinationMerchantAccountId),
      'Merchant Account ID': accountId,
      'نوع الحركة': movement.kind,
      'المعدن': movement.metal ?? '',
      'الوزن / E21 للحركة': grams(movement.quantityUnits),
      'الرصيد قبل الحركة': grams(beforeState?.signedQuantityUnits),
      'الرصيد بعد الحركة': grams(afterState?.signedQuantityUnits),
      'اتجاه الرصيد قبل': beforeState ? positionDirection(beforeState.positionSide) : 'مسدد',
      'اتجاه الرصيد بعد': afterState ? positionDirection(afterState.positionSide) : 'مسدد',
      'القيمة الدفترية قبل': egp(beforeState?.signedCarryingValueMinor),
      'القيمة الدفترية بعد': egp(afterState?.signedCarryingValueMinor),
      'Merchant WAC قبل الحركة': wacPerGram(beforeState?.currentWacMinorPerUnit),
      'Carrying Value للحركة': egp(movement.carryingValueMinor),
      'Merchant Liability Released': egp(movement.merchantLiabilityReleasedValueMinor),
      'Merchant Receivable Released': egp(movement.merchantReceivableReleasedValueMinor),
      'Merchant Payable Created': egp(movement.merchantPayableCreatedValueMinor),
      'Merchant Receivable Created': egp(movement.merchantReceivableCreatedValueMinor),
      'Inventory Book Value Released': egp(movement.inventoryBookValueReleasedMinor),
      'Inventory Book Value Recognized': egp(movement.inventoryBookValueRecognizedMinor),
      'Settlement Gain': egp(movement.settlementGainMinor),
      'Settlement Loss': egp(movement.settlementLossMinor),
      'Valuation Source': movement.valuationSource ?? '',
      'Merchant WAC بعد الحركة': wacPerGram(afterState?.currentWacMinorPerUnit),
    });

  return complete.movements.flatMap(movement => {
    const source = movement.sourceMerchantAccountId;
    const destination = movement.destinationMerchantAccountId;
    const sourceBefore = source ? snapshot(source) : undefined;
    const destinationBefore = destination ? snapshot(destination) : undefined;
    apply(source, -movement.quantityUnits, -movement.merchantDebitValueMinor);
    apply(destination, movement.quantityUnits, movement.merchantCreditValueMinor);
    // Transfers intentionally emit both affected merchant buckets under the existing columns.
    if (source && destination && source !== destination) {
      return [row(movement, source, sourceBefore, snapshot(source)), row(movement, destination, destinationBefore, snapshot(destination))];
    }
    const accountId = destination ?? source ?? '';
    return accountId ? [row(movement, accountId, destination ? destinationBefore : sourceBefore, snapshot(accountId))] : [];
  });
};

const summaryRows = (
  input: WacAuditWorkbookInput,
  merchantTimeline: ReturnType<typeof buildMerchantMetalPositionTimeline>,
  accountsById: Map<string, Account>,
): ExcelRow[] => [
  ...Object.values(input.inventoryTimeline.finalStates).map(state => ({
    'نوع الحساب': 'مخزون', 'اسم الحساب': state.displayName, 'Account ID': state.inventoryAccountId,
    'المعدن': state.kind, 'العيار': accountsById.get(state.inventoryAccountId)?.karat ?? '',
    'الوزن الفعلي': state.kind === 'accessory' ? null : grams(state.actualPhysicalWeightUnits),
    'مكافئ عيار 21': state.kind === 'gold' ? grams(state.standardizedQuantityUnits) : null,
    'الرصيد الموقع': null, 'اتجاه الرصيد: مستحق للتاجر / مستحق للمحل / مسدد': '',
    'القيمة الدفترية بالجنيه': egp(state.remainingTotalCostMinor), 'WAC الحالي لكل جرام': state.kind === 'accessory' ? null : inventoryWacPerGram(state.totalWacMinorPerDisplayUnit),
    'Cost basis reliable': state.hasReliableCostBasis, 'Calculation version': state.calculationVersion,
  })),
  ...Object.values(merchantTimeline.finalStates).map(state => ({
    'نوع الحساب': 'تاجر', 'اسم الحساب': state.merchantName, 'Account ID': state.merchantAccountId,
    'المعدن': state.metal, 'العيار': state.metal === 'gold' ? 'مكافئ 21' : '',
    'الوزن الفعلي': state.metal === 'silver' ? state.signedQuantity : null,
    'مكافئ عيار 21': state.metal === 'gold' ? state.signedQuantity : null,
    'الرصيد الموقع': state.signedQuantity,
    'اتجاه الرصيد: مستحق للتاجر / مستحق للمحل / مسدد': positionDirection(state.positionSide),
    'القيمة الدفترية بالجنيه': egp(state.signedCarryingValueMinor), 'WAC الحالي لكل جرام': wacPerGram(state.currentWacMinorPerUnit),
    'Cost basis reliable': state.signedQuantity === 0 || state.currentWacMinorPerUnit !== null,
    'Calculation version': merchantTimeline.calculationVersion,
  })),
];

const diagnosticsRows = (input: WacAuditWorkbookInput, merchantTimeline: ReturnType<typeof buildMerchantMetalPositionTimeline>): ExcelRow[] => [
  ...input.inventoryTimeline.diagnostics.map(item => ({ 'المصدر': 'Inventory WAC', Severity: 'error', Code: item.code, 'التاريخ إن أمكن': '', 'Operation ID': item.operationId ?? '', 'Account ID': item.inventoryAccountId ?? '', 'المعدن': '', 'الرسالة': item.message })),
  ...input.inventoryTimeline.orderingDiagnostics.map(item => ({ 'المصدر': 'Inventory WAC', Severity: 'warning', Code: item.code, 'التاريخ إن أمكن': item.date, 'Operation ID': item.operationIdsAfter.join(', '), 'Account ID': item.inventoryAccountId, 'المعدن': '', 'الرسالة': item.message })),
  ...merchantTimeline.diagnostics.map(item => ({ 'المصدر': 'Merchant WAC', Severity: item.severity, Code: item.code, 'التاريخ إن أمكن': '', 'Operation ID': item.operationId ?? '', 'Account ID': item.merchantAccountId ?? '', 'المعدن': item.metal ?? '', 'الرسالة': item.message })),
];

const addSheet = (output: ExcelRow[], name: string, rows: ExcelRow[], metadata: ExcelValue[][] = []): void => {
  metadata.forEach(row => output.push({ التقرير: name, الحقل: row[0], القيمة: row[1] }));
  rows.forEach(row => output.push({ التقرير: name, ...row }));
};

/** Builds only derived workbook bytes; no Firestore write and no accounting mutation. */
export const buildWacAuditCsv = (input: WacAuditWorkbookInput): WacAuditCsv => {
  const normalizedAccounts = input.accounts.map(applyRuntimeAccountOverride);
  const accountsById = new Map(normalizedAccounts.flatMap(account => account.id ? [[account.id, account] as const] : []));
  const merchantTimeline = buildMerchantMetalPositionTimeline(input.entries, normalizedAccounts, input.inventoryTimeline);
  const rows: ExcelRow[] = [];
  const exportedAt = input.exportedAt ?? new Date();
  addSheet(rows, 'ملخص WAC', summaryRows(input, merchantTimeline, accountsById), [
    ['تاريخ ووقت التصدير', exportedAt.toISOString()],
    ['إصدار حساب المخزون', input.inventoryTimeline.calculationVersion],
    ['إصدار حساب التجار', merchantTimeline.calculationVersion],
    ['حالة Inventory timeline', input.inventoryTimeline.valid ? 'valid' : 'invalid'],
  ]);
  addSheet(rows, 'حركات المخزون WAC', inventoryRows(input, accountsById));
  addSheet(rows, 'حركات التجار WAC', merchantRows(input, accountsById));
  addSheet(rows, 'Diagnostics', diagnosticsRows(input, merchantTimeline));
  return { rows };
};

export const wacAuditFilename = (date = new Date()): string => `makka_wac_audit_${date.toISOString().slice(0, 10)}.csv`;
