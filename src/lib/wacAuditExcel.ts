import * as XLSX from 'xlsx';
import type { Account, Entry } from '../types';
import { buildMerchantMetalPositionTimeline, type MerchantGoldLiabilityState } from './merchantGoldLiability';
import { rebuildRuntimeInventoryCostTimeline } from './costRecalculation';
import { compareEntriesForPhase5Cost } from './inventoryCostEngine';
import type { InventoryCostState, InventoryCostTimeline, Phase5OpeningCostConfig } from './inventoryCostTypes';

const GRAM_SCALE = 100;
const EGP_SCALE = 100;

type ExcelValue = string | number | boolean | null;
type ExcelRow = Record<string, ExcelValue>;

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

const inventorySnapshot = (timeline: InventoryCostTimeline, accountId?: string): InventoryCostState | undefined =>
  accountId ? timeline.finalStates[accountId] : undefined;

const inventoryRows = (input: WacAuditWorkbookInput, accountsById: Map<string, Account>): ExcelRow[] => {
  const orderedEntries = input.inventoryTimeline.results.map(result => result.entry);
  const rebuild = input.rebuildInventoryTimeline
    ?? ((entries: Entry[]) => rebuildRuntimeInventoryCostTimeline(entries, input.accounts, input.openingCostConfig));
  let before = rebuild([]);

  return input.inventoryTimeline.results.map((result, index) => {
    const after = rebuild(orderedEntries.slice(0, index + 1));
    const snapshotAccountId = result.destinationInventoryAccountId ?? result.inventoryAccountId ?? result.sourceInventoryAccountId;
    const stateBefore = inventorySnapshot(before, snapshotAccountId);
    const stateAfter = inventorySnapshot(after, snapshotAccountId);
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
      'WAC قبل الحركة': wacPerGram(stateBefore?.totalWacMinorPerDisplayUnit),
      'WAC المستخدم في الخروج': result.outgoingStandardizedQuantityUnits > 0
        ? egp(result.outgoingTotalCostMinor)! / grams(result.outgoingStandardizedQuantityUnits)!
        : null,
      'WAC بعد الحركة': wacPerGram(stateAfter?.totalWacMinorPerDisplayUnit),
      'رصيد الوزن قبل': stateBefore?.kind === 'accessory' ? grams(stateBefore.accessoryQuantityUnits) : grams(stateBefore?.actualPhysicalWeightUnits),
      'رصيد الوزن بعد': stateAfter?.kind === 'accessory' ? grams(stateAfter.accessoryQuantityUnits) : grams(stateAfter?.actualPhysicalWeightUnits),
      'القيمة الدفترية قبل': egp(stateBefore?.remainingTotalCostMinor),
      'القيمة الدفترية بعد': egp(stateAfter?.remainingTotalCostMinor),
      'Calculation version': result.calculationVersion,
    };
    before = after;
    return row;
  });
};

const merchantRows = (input: WacAuditWorkbookInput, accountsById: Map<string, Account>): ExcelRow[] => {
  const orderedEntries = [...input.entries].sort(compareEntriesForPhase5Cost);
  const complete = buildMerchantMetalPositionTimeline(input.entries, input.accounts, input.inventoryTimeline);
  const rebuild = input.rebuildInventoryTimeline
    ?? ((entries: Entry[]) => rebuildRuntimeInventoryCostTimeline(entries, input.accounts, input.openingCostConfig));
  let previousEntries: Entry[] = [];

  return complete.movements.map(movement => {
    const operationIndex = orderedEntries.indexOf(movement.entry) >= 0
      ? orderedEntries.indexOf(movement.entry)
      : orderedEntries.findIndex(entry => String(entry.id ?? '') === movement.operationId || String(entry.legacyOperationId ?? '') === movement.operationId);
    const upto = operationIndex >= 0 ? orderedEntries.slice(0, operationIndex + 1) : previousEntries;
    const beforeInventory = rebuild(previousEntries);
    const afterInventory = rebuild(upto);
    const beforeMerchant = buildMerchantMetalPositionTimeline(previousEntries, input.accounts, beforeInventory);
    const afterMerchant = buildMerchantMetalPositionTimeline(upto, input.accounts, afterInventory);
    const accountId = movement.destinationMerchantAccountId ?? movement.sourceMerchantAccountId ?? '';
    const beforeState = beforeMerchant.finalStates[accountId];
    const afterState = afterMerchant.finalStates[accountId];
    previousEntries = upto;
    return {
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
    };
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
    'القيمة الدفترية بالجنيه': egp(state.remainingTotalCostMinor), 'WAC الحالي لكل جرام': state.kind === 'accessory' ? null : wacPerGram(state.totalWacMinorPerDisplayUnit),
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

const addSheet = (workbook: XLSX.WorkBook, name: string, rows: ExcelRow[], metadata: ExcelValue[][] = []): void => {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const sheet = XLSX.utils.aoa_to_sheet([...metadata, [], headers, ...rows.map(row => headers.map(header => row[header]))]);
  const headerRow = metadata.length + 2;
  const end = XLSX.utils.encode_cell({ r: Math.max(headerRow, headerRow + rows.length), c: Math.max(0, headers.length - 1) });
  sheet['!autofilter'] = { ref: `A${headerRow}:${end}` };
  sheet['!freeze'] = { xSplit: 0, ySplit: headerRow, topLeftCell: `A${headerRow + 1}`, activePane: 'bottomLeft', state: 'frozen' };
  sheet['!cols'] = headers.map(header => ({ wch: Math.min(38, Math.max(14, header.length + 4)) }));
  Object.keys(sheet).filter(key => key[0] !== '!').forEach(key => {
    const cell = sheet[key];
    if (typeof cell.v === 'string' && /(ID|رقم العملية|Account ID)/.test(headers[XLSX.utils.decode_cell(key).c] ?? '')) cell.t = 's';
    if (typeof cell.v === 'number') cell.z = /WAC/.test(headers[XLSX.utils.decode_cell(key).c] ?? '') ? '#,##0.00' : '#,##0.00;[Red]-#,##0.00';
  });
  XLSX.utils.book_append_sheet(workbook, sheet, name);
};

/** Builds only derived workbook bytes; no Firestore write and no accounting mutation. */
export const buildWacAuditWorkbook = (input: WacAuditWorkbookInput): XLSX.WorkBook => {
  const accountsById = new Map(input.accounts.flatMap(account => account.id ? [[account.id, account] as const] : []));
  const merchantTimeline = buildMerchantMetalPositionTimeline(input.entries, input.accounts, input.inventoryTimeline);
  const workbook = XLSX.utils.book_new();
  const exportedAt = input.exportedAt ?? new Date();
  addSheet(workbook, 'ملخص WAC', summaryRows(input, merchantTimeline, accountsById), [
    ['تاريخ ووقت التصدير', exportedAt.toISOString()],
    ['إصدار حساب المخزون', input.inventoryTimeline.calculationVersion],
    ['إصدار حساب التجار', merchantTimeline.calculationVersion],
    ['حالة Inventory timeline', input.inventoryTimeline.valid ? 'valid' : 'invalid'],
  ]);
  addSheet(workbook, 'حركات المخزون WAC', inventoryRows(input, accountsById));
  addSheet(workbook, 'حركات التجار WAC', merchantRows(input, accountsById));
  addSheet(workbook, 'Diagnostics', diagnosticsRows(input, merchantTimeline));
  return workbook;
};

export const wacAuditFilename = (date = new Date()): string => `makka_wac_audit_${date.toISOString().slice(0, 10)}.xlsx`;
