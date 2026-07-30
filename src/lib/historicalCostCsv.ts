import type { Account, Entry } from '../types';
import {
  createHistoricalCostReviewOverlay,
  findHistoricalCostReviewItems,
  nextOverlayVersion,
  type HistoricalCostReviewOverlay,
  type HistoricalCostSourceType,
} from './historicalCostReview';
import type { InventoryCostTimeline } from './inventoryCostTypes';

const headers = [
  'operationId', 'operationNo', 'date', 'type', 'merchant/account',
  'actualWeight', 'standard21Weight', 'approvedCostEgp',
  'source', 'sourceReference', 'approver', 'notes',
] as const;
const quote = (value: unknown): string => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const exportHistoricalCostReviewCsv = (
  entries: Entry[],
  accounts: Account[],
  timeline?: InventoryCostTimeline | null,
  blockingDiagnostics: readonly { code: string; inventoryAccountId?: string }[] = [],
): string => {
  const accountNames = new Map(accounts.map(item => [item.id, item.name]));
  const rows = findHistoricalCostReviewItems(entries, accounts, timeline, blockingDiagnostics).map(item => [
    item.operationId,
    item.operation.operationNo ?? item.operation.legacyOperationNo ?? '',
    item.operation.date,
    item.kind,
    item.kind === 'merchant_receipt'
      ? accountNames.get(item.operation.creditAccountId) ?? item.operation.credit
      : accountNames.get(item.operation.debitAccountId) ?? item.operation.debit,
    item.operation.weight,
    item.operation.arabicWeight,
    '', '', '', '', '',
  ]);
  return '\uFEFF' + [headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n');
};

const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value); value = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += char;
  }
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const sourceTypes = new Set<HistoricalCostSourceType>([
  'original_invoice', 'merchant_statement', 'manual_records',
  'bank_or_cash_evidence', 'approved_accounting_estimate', 'other',
]);

export interface HistoricalCostCsvImportResult {
  drafts: HistoricalCostReviewOverlay[];
  errors: Array<{ row: number; message: string }>;
}

export const importHistoricalCostReviewCsvAsDrafts = (args: {
  text: string;
  entries: Entry[];
  accounts: Account[];
  overlays: HistoricalCostReviewOverlay[];
  createdAt: string;
  createOverlayId: (operationId: string, row: number) => string;
  userId?: string;
}): HistoricalCostCsvImportResult => {
  const rows = parseCsv(args.text.replace(/^\uFEFF/, ''));
  const header = rows.shift() ?? [];
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  const required = ['operationId', 'approvedCostEgp', 'source', 'approver'];
  if (required.some(name => index[name] === undefined)) {
    return { drafts: [], errors: [{ row: 1, message: 'missing_required_columns' }] };
  }
  const items = new Map(findHistoricalCostReviewItems(args.entries, args.accounts)
    .map(item => [item.operationId, item]));
  const seen = new Set<string>();
  const result: HistoricalCostCsvImportResult = { drafts: [], errors: [] };
  rows.forEach((row, rowIndex) => {
    const line = rowIndex + 2;
    const operationId = row[index.operationId]?.trim();
    const item = items.get(operationId);
    if (!operationId || !item) {
      result.errors.push({ row: line, message: 'unknown_operation_id' }); return;
    }
    if (seen.has(operationId)) {
      result.errors.push({ row: line, message: 'duplicate_operation_id' }); return;
    }
    seen.add(operationId);
    const egp = Number(row[index.approvedCostEgp]);
    const minor = Math.round(egp * 100);
    if (!Number.isFinite(egp) || egp <= 0 || !Number.isSafeInteger(minor)) {
      result.errors.push({ row: line, message: 'invalid_cost_value' }); return;
    }
    const source = row[index.source]?.trim() as HistoricalCostSourceType;
    if (!sourceTypes.has(source)) {
      result.errors.push({ row: line, message: 'invalid_source' }); return;
    }
    const approver = row[index.approver]?.trim();
    if (!approver) {
      result.errors.push({ row: line, message: 'missing_approver' }); return;
    }
    result.drafts.push(createHistoricalCostReviewOverlay({
      overlayId: args.createOverlayId(operationId, line),
      overlayVersion: nextOverlayVersion([...args.overlays, ...result.drafts], operationId),
      targetOperationId: operationId,
      overlayType: item.kind === 'merchant_receipt'
        ? 'merchant_receipt_cost' : 'inventory_surplus_cost',
      originalDiagnosticCode: item.diagnosticCode,
      approvedInterpretedCostMinor: minor,
      pricePerGramMinor: null,
      valueBasis: 'total',
      sourceType: source,
      sourceReference: row[index.sourceReference]?.trim() ?? '',
      approver,
      createdAt: args.createdAt,
      approvedAt: null,
      supersedesOverlayId: null,
      status: 'draft',
      sourceInventoryAccountId: null,
      notes: row[index.notes]?.trim() ?? '',
      confidenceNote: '',
      historicalAssignmentConfirmed: false,
      userId: args.userId,
      ownerId: args.userId,
      createdBy: args.userId,
    }));
  });
  return result;
};
