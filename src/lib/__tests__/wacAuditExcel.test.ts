import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { Account, Entry } from '../../types';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding, Phase5OpeningCostConfig } from '../inventoryCostTypes';
import { buildWacAuditWorkbook } from '../wacAuditExcel';

const accounts: Account[] = [
  { id: 'gold-a', name: 'ذهب أ', mainType: 'assets', subType: 'inventory_gold', balanceNature: 'gold', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'gold-b', name: 'ذهب ب', mainType: 'assets', subType: 'inventory_gold', balanceNature: 'gold', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'merchant-a', name: 'التاجر أ', mainType: 'liabilities', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', balanceNature: 'gold', userId: 'u', type: 'merchant', metal: 'gold' },
  { id: 'merchant-b', name: 'التاجر ب', mainType: 'liabilities', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', balanceNature: 'gold', userId: 'u', type: 'merchant', metal: 'gold' },
  { id: 'cash', name: 'الخزنة', mainType: 'assets', subType: 'cash', balanceNature: 'cash', userId: 'u', type: 'cash', is_inventory: false },
  { id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'capital', balanceNature: 'cash', userId: 'u', type: 'other', is_inventory: false },
];
const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'gold-a', taxonomyKey: 'gold.product.ring_arabic' },
  { inventoryAccountId: 'gold-b', taxonomyKey: 'gold.product.earring_arabic' },
];
const config: Phase5OpeningCostConfig = { gold21PriceByYearMinor: { '2026': 10000 } };
const entry = (id: string, seq: number, patch: Partial<Entry>): Entry => ({
  id, seq, tx: '', debit: '', credit: '', date: '2026-01-01', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});
const entries: Entry[] = [
  entry('opening', 1, { operationKind: 'opening', tx: 'قيد افتتاحي', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'رأس المال', creditAccountId: 'capital', weight: '10', arabicWeight: '10' }),
  entry('receipt', 2, { tx: 'تاجر ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'التاجر أ', creditAccountId: 'merchant-a', weight: '2', arabicWeight: '2', invoiceOfficialPricePerGramEgp: 120 }),
  entry('sale', 3, { operationKind: 'sale', tx: 'بيع ذهب', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '1', arabicWeight: '1', cash: '200' }),
  entry('tafyeet', 4, { operationKind: 'tifeet', tx: 'تيفيت', debit: 'ذهب ب', debitAccountId: 'gold-b', credit: 'ذهب أ', creditAccountId: 'gold-a', weight: '2', arabicWeight: '2' }),
  entry('merchant-transfer', 5, { operationKind: 'transfer', tx: 'حوالة', debit: 'التاجر أ', debitAccountId: 'merchant-a', credit: 'التاجر ب', creditAccountId: 'merchant-b', weight: '1', arabicWeight: '1' }),
  entry('settlement', 6, { operationKind: 'merchant_settlement', tx: 'تاجر ذهب', debit: 'التاجر ب', debitAccountId: 'merchant-b', credit: 'ذهب ب', creditAccountId: 'gold-b', weight: '1', arabicWeight: '1', invoiceOfficialPricePerGramEgp: 120 }),
];
const rebuild = (rows: Entry[]) => rebuildInventoryCostTimeline(rows, accounts, config, { bindings });
const workbook = () => buildWacAuditWorkbook({ entries, accounts, openingCostConfig: config, inventoryTimeline: rebuild(entries), rebuildInventoryTimeline: rebuild, exportedAt: new Date('2026-08-12T10:00:00.000Z') });
const records = (sheetName: string): Record<string, unknown>[] => {
  const sheet = workbook().Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const headerIndex = rows.findIndex(row => row.includes('Operation ID'));
  const headers = rows[headerIndex] as string[];
  return rows.slice(headerIndex + 1).filter(row => row.some(value => value !== null && value !== '')).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
};

describe('WAC audit Excel export', () => {
  it('reconciles final inventory weight, book value, and WAC to the authoritative final state', () => {
    const final = rebuild(entries).finalStates['gold-b'];
    const movement = records('حركات المخزون WAC').find(row => row['Operation ID'] === 'settlement')!;
    expect(movement['رصيد الوزن بعد']).toBe(final.actualPhysicalWeightUnits / 100);
    expect(movement['القيمة الدفترية بعد']).toBe(final.remainingTotalCostMinor / 100);
    expect(movement['WAC بعد الحركة']).toBe(final.totalWacMinorPerDisplayUnit! / 100);
  });

  it('exports sale outgoing cost from the authoritative inventory WAC result', () => {
    const result = rebuild(entries).resultsByOperationId.sale;
    const movement = records('حركات المخزون WAC').find(row => row['Operation ID'] === 'sale')!;
    expect(movement['إجمالي COGS']).toBe(result.totalCogsMinor / 100);
    expect(movement['WAC المستخدم في الخروج']).toBeCloseTo((result.totalCogsMinor / 100) / (result.outgoingStandardizedQuantityUnits / 100));
  });

  it('exports tafyeet as a carrying-cost-preserving inventory transfer', () => {
    const movement = records('حركات المخزون WAC').find(row => row['Operation ID'] === 'tafyeet')!;
    expect(movement['إجمالي التكلفة الداخلة']).toBe(movement['إجمالي التكلفة الخارجة']);
    expect(movement['إجمالي COGS']).toBe(0);
  });

  it('exposes merchant receipt carrying value and Merchant WAC', () => {
    const movement = records('حركات التجار WAC').find(row => row['Operation ID'] === 'receipt')!;
    expect(movement['Carrying Value للحركة']).toBe(240);
    expect(movement['Merchant WAC بعد الحركة']).toBe(120);
  });

  it('carries merchant-to-merchant value without inventory movement or P&L', () => {
    const movement = records('حركات التجار WAC').find(row => row['Operation ID'] === 'merchant-transfer')!;
    expect(movement['Carrying Value للحركة']).toBe(120);
    expect(movement['Inventory Book Value Released']).toBe(0);
    expect(movement['Settlement Gain']).toBe(0);
    expect(movement['Settlement Loss']).toBe(0);
  });

  it('shows authoritative before/after state for both sides of a merchant transfer', () => {
    const movements = records('حركات التجار WAC').filter(row => row['Operation ID'] === 'merchant-transfer');
    const source = movements.find(row => row['Merchant Account ID'] === 'merchant-a')!;
    const destination = movements.find(row => row['Merchant Account ID'] === 'merchant-b')!;
    expect(movements).toHaveLength(2);
    expect(source['الرصيد بعد الحركة']).toBe(1);
    expect(source['القيمة الدفترية بعد']).toBe(120);
    expect(destination['الرصيد قبل الحركة']).toBe(0);
    expect(destination['الرصيد بعد الحركة']).toBe(1);
    expect(destination['القيمة الدفترية بعد']).toBe(120);
  });

  it('exports separate merchant and inventory WAC values with exact physical-settlement gain/loss', () => {
    const movement = records('حركات التجار WAC').find(row => row['Operation ID'] === 'settlement')!;
    expect(movement['Merchant Liability Released']).toBe(120);
    expect(movement['Inventory Book Value Released']).toBe(103.34);
    expect(movement['Settlement Gain']).toBe(16.66);
    expect(movement['Merchant WAC قبل الحركة']).toBe(120);
  });

  it('exports a 2,000-operation history without any per-row inventory timeline rebuild', () => {
    const largeEntries: Entry[] = [entries[0], ...Array.from({ length: 2_000 }, (_, index) => entry(`large-${index}`, index + 2, {
      tx: 'تاجر ذهب', debit: 'ذهب أ', debitAccountId: 'gold-a', credit: 'التاجر أ', creditAccountId: 'merchant-a',
      weight: '1', arabicWeight: '1', invoiceOfficialPricePerGramEgp: 120,
    }))];
    const timeline = rebuild(largeEntries);
    let rebuildCalls = 0;

    const exported = buildWacAuditWorkbook({
      entries: largeEntries,
      accounts,
      openingCostConfig: config,
      inventoryTimeline: timeline,
      rebuildInventoryTimeline: () => {
        rebuildCalls += 1;
        throw new Error('Export must not rebuild inventory timelines per row.');
      },
    });

    expect(rebuildCalls).toBe(0);
    expect(exported.SheetNames).toContain('حركات المخزون WAC');
    expect(exported.SheetNames).toContain('حركات التجار WAC');
  });
});
