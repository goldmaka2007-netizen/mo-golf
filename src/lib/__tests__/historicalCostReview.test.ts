import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import {
  buildHistoricalOverlayRebuildPlan,
  APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS,
  calculateHistoricalPriceTotalMinor,
  createHistoricalCostReviewOverlay,
  effectiveApprovedHistoricalCostOverlays,
  previewAutomaticInventorySurplusWac,
  previewHistoricalCostOverlay,
  projectEntriesWithHistoricalCostOverlays,
  validateHistoricalCostOverlayTarget,
  validateHistoricalCostReviewOverlay,
  type HistoricalCostReviewOverlay,
} from '../historicalCostReview';
import {
  exportHistoricalCostReviewCsv,
  importHistoricalCostReviewCsvAsDrafts,
} from '../historicalCostCsv';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding } from '../inventoryCostTypes';
import { createAnnualCostSnapshot } from '../annualCostSnapshots';

const accounts: Account[] = [
  { id: 'gold', name: 'ذهب 21', mainType: 'اصول', subType: 'مخزون', balanceNature: 'ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'gold-b', name: 'ذهب 21 ب', mainType: 'اصول', subType: 'مخزون', balanceNature: 'ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: 'merchant', name: 'تاجر', mainType: 'خصوم', subType: 'تاجر ذهب', balanceNature: 'ذهب', userId: 'u', type: 'merchant', metal: 'gold' },
  { id: 'adjustment', name: 'تسويات', mainType: 'ايرادات', subType: 'تسويات', balanceNature: 'جنيه', userId: 'u', type: 'other' },
  { id: 'cash', name: 'الخزنة', mainType: 'اصول', subType: 'نقدية', balanceNature: 'جنيه', userId: 'u', type: 'cash' },
];
const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'gold', taxonomyKey: 'gold.product.ring_arabic' },
  { inventoryAccountId: 'gold-b', taxonomyKey: 'gold.product.earring_arabic' },
];
const entry = (value: Partial<Entry>): Entry => ({
  id: '', seq: 1, tx: '', debit: '', credit: '', date: '2024-01-01',
  cash: '0', weight: '0', arabicWeight: '0', count: '0', notes: '',
  userId: 'u', ...value,
});
const merchantReceipt = entry({
  id: 'merchant-old', imported: true, seq: null, tx: 'تاجر ذهب',
  debit: 'ذهب 21', debitAccountId: 'gold', credit: 'تاجر',
  creditAccountId: 'merchant', weight: '10', arabicWeight: '10',
  workmanshipCostMinor: 5000, notes: 'invoice M-1',
});
const surplus = entry({
  id: 'surplus-old', imported: true, seq: null, date: '2025-02-01',
  operationKind: 'adjustment', tx: 'تسوية زيادة', debit: 'ذهب 21',
  debitAccountId: 'gold', credit: 'تسويات', creditAccountId: 'adjustment',
  weight: '2', arabicWeight: '2',
});
const run = (values: Entry[]) =>
  rebuildInventoryCostTimeline(values, accounts, {}, { bindings });

const overlay = (
  targetOperationId: string,
  overlayType: HistoricalCostReviewOverlay['overlayType'],
  status: HistoricalCostReviewOverlay['status'] = 'approved',
  version = 1,
  overrides: Partial<Omit<HistoricalCostReviewOverlay, 'auditHash' | 'schemaVersion'>> = {},
) => createHistoricalCostReviewOverlay({
  overlayId: `overlay-${targetOperationId}-${version}`,
  overlayVersion: version,
  targetOperationId,
  overlayType,
  originalDiagnosticCode: overlayType === 'merchant_receipt_cost'
    ? 'unresolved_merchant_cost' : 'pending_surplus_cost',
  approvedInterpretedCostMinor:
    ['merchant_receipt_cost', 'inventory_surplus_cost'].includes(overlayType) ? 100000 : null,
  pricePerGramMinor: null,
  valueBasis: overlayType === 'inventory_two_sided_correction'
    ? 'carrying_cost_transfer' : overlayType.includes('exclusion') ? 'exclusion' : 'total',
  sourceType: 'original_invoice',
  sourceReference: 'DOC-1',
  approver: status === 'draft' ? '' : 'Owner',
  createdAt: '2026-07-29T00:00:00.000Z',
  approvedAt: status === 'approved' ? '2026-07-29T00:00:00.000Z' : null,
  supersedesOverlayId: version > 1 ? `overlay-${targetOperationId}-${version - 1}` : null,
  status,
  sourceInventoryAccountId: overlayType === 'inventory_two_sided_correction' ? 'gold-b' : null,
  notes: 'reviewed',
  confidenceNote: '',
  historicalAssignmentConfirmed: status === 'approved',
  userId: 'u',
  ...overrides,
});

describe('historical cost-resolution workflow', () => {
  it('calculates the approved total only from price per gram and selected weight basis', () => {
    expect(calculateHistoricalPriceTotalMinor(12_345, 'actual_weight', {
      ...merchantReceipt,
      weight: '10.5',
      arabicWeight: '9.25',
    })).toBe(129_623);
    expect(calculateHistoricalPriceTotalMinor(12_345, 'standard21_weight', {
      ...merchantReceipt,
      weight: '10.5',
      arabicWeight: '9.25',
    })).toBe(114_191);
  });

  it('previews the selected record independently from an unrelated blocking diagnostic', () => {
    const targetAccountId = 'seed-account-ea099bf0071894125ad3';
    const unrelatedAccountId = 'seed-account-ff66eba547be9e799aba';
    const previewAccounts = accounts.map(account => ({
      ...account,
      id: account.id === 'gold'
        ? targetAccountId
        : account.id === 'gold-b' ? unrelatedAccountId : account.id,
    }));
    const previewReceipt = { ...merchantReceipt, debitAccountId: targetAccountId };
    const unrelatedBlockingSale = entry({
      id: 'unrelated-blocker',
      date: '2023-01-01',
      tx: 'بيع ذهب',
      debit: 'الخزنة',
      debitAccountId: 'cash',
      credit: 'ذهب 21 ب',
      creditAccountId: unrelatedAccountId,
      weight: '1',
      arabicWeight: '1',
      cash: '1000',
    });
    const candidate = overlay('merchant-old', 'merchant_receipt_cost', 'approved', 1, {
      approvedInterpretedCostMinor: 1_250_000,
      pricePerGramMinor: 125_000,
      valueBasis: 'actual_weight',
    });

    const preview = previewHistoricalCostOverlay({
      entries: [unrelatedBlockingSale, previewReceipt],
      accounts: previewAccounts,
      overlays: [],
      candidate,
    });

    expect(preview.timeline.valid).toBe(false);
    expect(preview.recordImpact).toMatchObject({
      inventoryBookCostIncreaseMinor: 1_250_000,
      merchantLiabilityBookValueIncreaseMinor: 1_250_000,
      resolved: true,
    });
    expect(preview.recordImpact.wacAfterMinorPerDisplayUnit).not.toBeNull();
    expect(preview.resolvesTargetDiagnostic).toBe(true);
    expect(preview.officialReportsAvailable).toBe(false);
    expect(preview.officialReportsBlockedByOtherRecords).toBe(true);
  });
  it('calculates a surplus from its account prefix even when another account blocks the global run', () => {
    const targetAccountId = 'seed-account-ea099bf0071894125ad3';
    const unrelatedAccountId = 'seed-account-ff66eba547be9e799aba';
    const previewAccounts = accounts.map(account => ({
      ...account,
      id: account.id === 'gold'
        ? targetAccountId
        : account.id === 'gold-b' ? unrelatedAccountId : account.id,
    }));
    const unrelatedBlockingSale = entry({
      id: 'unrelated-sale', date: '2023-01-01', operationKind: 'sale',
      tx: 'بيع ذهب', debit: 'الخزنة', debitAccountId: 'cash',
      credit: 'ذهب ب', creditAccountId: unrelatedAccountId,
      weight: '1', arabicWeight: '1', cash: '1000',
    });
    const targetPurchase = entry({
      id: 'target-purchase', date: '2024-01-01', operationKind: 'purchase',
      tx: 'شراء ذهب', debit: 'ذهب', debitAccountId: targetAccountId,
      credit: 'الخزنة', creditAccountId: 'cash',
      weight: '1', arabicWeight: '1', cash: '100',
    });
    const targetSurplus = entry({
      ...surplus,
      id: 'target-surplus', date: '2024-01-02', debitAccountId: targetAccountId,
    });
    const entries = [unrelatedBlockingSale, targetPurchase, targetSurplus];

    expect(rebuildInventoryCostTimeline(entries, previewAccounts).valid).toBe(false);
    expect(previewAutomaticInventorySurplusWac({
      entries,
      accounts: previewAccounts,
      overlays: [],
      targetOperationId: 'target-surplus',
    })).toEqual({
      costMinor: 20_000,
      gainMinor: 20_000,
      wacBeforeMinorPerDisplayUnit: 10_000,
      wacAfterMinorPerDisplayUnit: 10_000,
    });
  });

  it('never mutates original historical operations', () => {
    const original = structuredClone(merchantReceipt);
    const projected = projectEntriesWithHistoricalCostOverlays(
      [merchantReceipt], accounts, [overlay('merchant-old', 'merchant_receipt_cost')],
    );
    expect(merchantReceipt).toEqual(original);
    expect(projected[0]).not.toBe(merchantReceipt);
    expect(projected[0].transactionGoldValueMinor).toBe(100000);
  });

  it('keeps drafts out of Cost Run and admits approved merchant value equally', () => {
    const draftEntries = projectEntriesWithHistoricalCostOverlays(
      [merchantReceipt], accounts, [overlay('merchant-old', 'merchant_receipt_cost', 'draft')],
    );
    expect(run(draftEntries).costDataComplete).toBe(false);
    const approved = run(projectEntriesWithHistoricalCostOverlays(
      [merchantReceipt], accounts, [overlay('merchant-old', 'merchant_receipt_cost')],
    ));
    expect(approved.costDataComplete).toBe(true);
    expect(approved.resultsByOperationId['merchant-old'].incomingMetalCostMinor).toBe(100000);
    expect(approved.resultsByOperationId['merchant-old'].merchantLiabilityIncreaseMinor).toBe(100000);
    expect(approved.merchantGoldLiabilities.merchant.bookValueMinor).toBe(100000);
  });

  it('applies the two owner-approved nearest prior carrying costs without mutating source rows', () => {
    const scrap = {
      ...surplus,
      id: 'csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed',
      weight: '0.78',
      arabicWeight: '0.78',
    };
    const gouache = {
      ...surplus,
      id: 'csvref-entry-a0336b0baa791eb94f70774c2f34d730',
      weight: '0.02',
      arabicWeight: '0.02',
    };
    const source = [scrap, gouache];
    const before = structuredClone(source);
    const projected = projectEntriesWithHistoricalCostOverlays(source, accounts, []);

    expect(source).toEqual(before);
    expect(projected[0]).toMatchObject({
      manualCostAssignmentMinor: 528_214,
      costAssignmentStatus: 'approved',
    });
    expect(projected[1]).toMatchObject({
      manualCostAssignmentMinor: 12_517,
      costAssignmentStatus: 'approved',
    });
    expect(APPROVED_SYSTEM_HISTORICAL_COST_OVERLAYS.filter(
      item => item.overlayType === 'inventory_surplus_cost',
    )).toHaveLength(2);
  });

  it('preserves superseded versions and applies only the latest approved version', () => {
    const first = overlay('merchant-old', 'merchant_receipt_cost');
    const second = overlay('merchant-old', 'merchant_receipt_cost', 'approved', 2, {
      approvedInterpretedCostMinor: 125000,
    });
    expect([first, second]).toHaveLength(2);
    expect(second.supersedesOverlayId).toBe(first.overlayId);
    expect(effectiveApprovedHistoricalCostOverlays([first, second])).toEqual([second]);
    const timeline = run(projectEntriesWithHistoricalCostOverlays(
      [merchantReceipt], accounts, [first, second],
    ));
    expect(timeline.finalStates.gold.remainingMetalCostMinor).toBe(125000);
  });

  it('seals deterministic SHA-256 audit hashes and rejects tampering', () => {
    const first = overlay('merchant-old', 'merchant_receipt_cost');
    const second = overlay('merchant-old', 'merchant_receipt_cost');
    expect(first.auditHash).toBe(second.auditHash);
    expect(first.auditHash).toMatch(/^[a-f0-9]{64}$/);
    expect(validateHistoricalCostReviewOverlay(first)).toBe(true);
    expect(validateHistoricalCostReviewOverlay({ ...first, notes: 'tampered' })).toBe(false);
  });

  it('excludes surplus before approval and enters approved surplus once', () => {
    const pending = run(projectEntriesWithHistoricalCostOverlays([surplus], accounts, []));
    expect(pending.finalStates.gold.standardizedQuantityUnits).toBe(0);
    expect(pending.finalStates.gold.pendingStandardizedQuantityUnits).toBe(200);
    const approvedOverlay = overlay('surplus-old', 'inventory_surplus_cost');
    const approved = run(projectEntriesWithHistoricalCostOverlays(
      [surplus], accounts, [approvedOverlay, approvedOverlay],
    ));
    expect(approved.finalStates.gold.standardizedQuantityUnits).toBe(200);
    expect(approved.finalStates.gold.remainingTotalCostMinor).toBe(100000);
    expect(approved.results.filter(item => item.operationId === 'surplus-old')).toHaveLength(1);
  });

  it('reclassifies a two-sided correction at carrying cost with no gain or loss', () => {
    const opening = entry({
      id: 'buy', operationKind: 'purchase', tx: 'شراء ذهب', debit: 'ذهب 21 ب',
      debitAccountId: 'gold-b', credit: 'الخزنة', creditAccountId: 'cash',
      weight: '10', arabicWeight: '10', cash: '1000',
    });
    const correction = overlay('surplus-old', 'inventory_two_sided_correction');
    const timeline = run(projectEntriesWithHistoricalCostOverlays(
      [opening, surplus], accounts, [correction],
    ));
    expect(timeline.resultsByOperationId['surplus-old']).toMatchObject({
      outgoingTotalCostMinor: 20000,
      incomingTotalCostMinor: 20000,
      adjustmentGainMinor: 0,
      adjustmentLossMinor: 0,
    });
  });

  it('excludes duplicate/import overlays without deleting the source record', () => {
    const original = structuredClone(surplus);
    const projected = projectEntriesWithHistoricalCostOverlays(
      [surplus], accounts, [overlay('surplus-old', 'inventory_duplicate_exclusion')],
    );
    expect(projected).toEqual([]);
    expect(surplus).toEqual(original);
  });

  it('rejects invalid operation IDs and invalid cost values', () => {
    expect(() => validateHistoricalCostOverlayTarget(
      { targetOperationId: 'unknown', overlayType: 'merchant_receipt_cost' },
      [merchantReceipt], accounts,
    )).toThrow('unknown_operation_id');
    expect(() => overlay('merchant-old', 'merchant_receipt_cost', 'approved', 1, {
      approvedInterpretedCostMinor: -1,
    })).toThrow('invalid_cost_value');
  });

  it('exports review fields and imports validated rows as drafts only', () => {
    const exported = exportHistoricalCostReviewCsv([merchantReceipt], accounts);
    expect(exported).toContain('operationId');
    const completed = exported.replace(
      '\"\",\"\",\"\",\"\",\"\"',
      '\"1000\",\"original_invoice\",\"M-1\",\"Owner\",\"reviewed\"',
    );
    const imported = importHistoricalCostReviewCsvAsDrafts({
      text: completed,
      entries: [merchantReceipt],
      accounts,
      overlays: [],
      createdAt: '2026-07-29T00:00:00.000Z',
      createOverlayId: () => 'csv-draft-1',
      userId: 'u',
    });
    expect(imported.errors).toEqual([]);
    expect(imported.drafts).toHaveLength(1);
    expect(imported.drafts[0]).toMatchObject({
      status: 'draft',
      approvedAt: null,
      historicalAssignmentConfirmed: false,
      approvedInterpretedCostMinor: 100000,
    });
  });

  it('rejects duplicate, unknown and negative CSV rows', () => {
    const csv = [
      'operationId,approvedCostEgp,source,approver',
      'merchant-old,-1,original_invoice,Owner',
      'unknown,10,original_invoice,Owner',
      'merchant-old,10,original_invoice,Owner',
      'merchant-old,10,original_invoice,Owner',
    ].join('\n');
    const imported = importHistoricalCostReviewCsvAsDrafts({
      text: csv, entries: [merchantReceipt], accounts, overlays: [],
      createdAt: '2026-07-29T00:00:00.000Z',
      createOverlayId: (_, row) => `row-${row}`,
    });
    expect(imported.errors.map(item => item.message)).toEqual(expect.arrayContaining([
      'invalid_cost_value', 'unknown_operation_id', 'duplicate_operation_id',
    ]));
    expect(imported.drafts).toHaveLength(0);
  });

  it('is deterministic, unblocks only after every material item, and invalidates later snapshots', () => {
    const merchantApproved = overlay('merchant-old', 'merchant_receipt_cost');
    const oneResolved = run(projectEntriesWithHistoricalCostOverlays(
      [merchantReceipt, surplus], accounts, [merchantApproved],
    ));
    expect(oneResolved.costDataComplete).toBe(true);
    expect(oneResolved.resultsByOperationId['surplus-old']).toMatchObject({
      classification: 'surplus',
      incomingTotalCostMinor: 21000,
      adjustmentGainMinor: 21000,
    });
    const all = [merchantApproved, overlay('surplus-old', 'inventory_surplus_cost')];
    const first = run(projectEntriesWithHistoricalCostOverlays([merchantReceipt, surplus], accounts, all));
    const second = run(projectEntriesWithHistoricalCostOverlays([merchantReceipt, surplus], accounts, all));
    expect(first).toEqual(second);
    expect(first.costDataComplete).toBe(true);

    const priorRun = run(projectEntriesWithHistoricalCostOverlays([merchantReceipt], accounts, [merchantApproved]));
    const snapshot = createAnnualCostSnapshot(priorRun, '2024', '2024-12-31T23:59:59Z', 'Owner');
    const plan = buildHistoricalOverlayRebuildPlan(
      merchantApproved,
      [merchantReceipt, entry({ id: 'later', date: '2026-01-01' })],
      [snapshot],
    );
    expect(plan.affectedYears).toEqual(['2024', '2025', '2026']);
    expect(plan.snapshots[0].status).toBe('requires_recalculation');
  });

  it('keeps legacy operational reports visible with their warning and exposes known fixtures', () => {
    const reportsSource = readFileSync(
      new URL('../../components/views/ReportsView.tsx', import.meta.url),
      'utf8',
    );
    const reviewSource = readFileSync(
      new URL('../../components/views/reports/HistoricalCostReviewView.tsx', import.meta.url),
      'utf8',
    );
    expect(reportsSource).toContain('LegacyReportNotice');
    expect(reportsSource).toContain("id: 'legacy-income'");
    expect(reportsSource).toContain('historical-cost-review');
    expect(reviewSource).toContain('csvref-entry-5e60e797bdd890736a846cf479af173b');
    expect(reviewSource).toContain('seed-account-d1216eb4076ccdf40e20');
    expect(reviewSource).toContain('csvref-entry-f0b71d5ba66af5385c50a4c4e002d8ed');
    expect(reviewSource).not.toContain('إجمالي القيمة التاريخية');
    expect(reviewSource).toContain('سعر تاريخي للجرام');
    expect(reviewSource).toContain('إجمالي القيمة الدفترية المحسوبة تلقائيًا');
    expect(reviewSource).toContain("current.kind === 'merchant_receipt' ? 'standard21_weight'");
    expect(reviewSource).toContain('الوزن العربي المعتمد تلقائيًا');
    expect(reviewSource).toContain('approveMerchantPrice');
    expect(reviewSource).toContain('اعتماد السعر وحساب العملية');
    expect(reviewSource).toContain("item.kind === 'inventory_surplus'");
    expect(reviewSource).toContain('استثناءات بلا WAC سابق');
    expect(reviewSource).not.toContain('زيادات غير مسعرة');
  });
});
