import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { findHistoricalCostReviewItems } from '../historicalCostReview';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import type { InventoryRuntimeBinding } from '../inventoryCostTypes';
import {
  calculateMerchantInvoiceMetalValueMinor,
  resolveMerchantReceiptMetal,
} from '../merchantInvoiceValuation';

const accounts: Account[] = [
  { id: 'gold18', name: 'ذهب 18', mainType: 'اصول', subType: 'مخزون ذهب', balanceNature: 'جرام ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '18' },
  { id: 'silver', name: 'مشغولات فضة', mainType: 'اصول', subType: 'مخزون فضة', balanceNature: 'جرام فضة', userId: 'u', type: 'silver', is_inventory: true, metal: 'silver', karat: 'silver' },
  { id: 'goldMerchant', name: 'تاجر ذهب', mainType: 'خصوم', subType: 'تجار ذهب', balanceNature: 'جرام ذهب', userId: 'u', type: 'merchant', metal: 'gold' },
  { id: 'samir', name: 'سمير ناشد', mainType: 'خصوم', subType: 'تجار فضة', balanceNature: 'جرام فضة', userId: 'u', type: 'merchant', metal: 'silver' },
];
const bindings: InventoryRuntimeBinding[] = [
  { inventoryAccountId: 'gold18', taxonomyKey: 'gold.product.ring_women' },
  { inventoryAccountId: 'silver', taxonomyKey: 'silver.product.ring' },
];
const entry = (value: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, tx: 'تاجر ذهب', debit: 'ذهب 18', debitAccountId: 'gold18',
  credit: 'تاجر ذهب', creditAccountId: 'goldMerchant', date: '2026-01-01', cash: '0',
  weight: '100', arabicWeight: '85.71', multiplier: 18 / 21, count: '0', notes: '', userId: 'u',
  ...value,
});

describe('merchant invoice valuation', () => {
  it('values a new gold receipt at official invoice price times Standard-21 weight', () => {
    const receipt = entry({ invoiceOfficialPricePerGramEgp: 6600 });
    expect(resolveMerchantReceiptMetal(receipt, accounts)).toBe('gold');
    expect(calculateMerchantInvoiceMetalValueMinor(receipt, accounts)).toBe(56_568_600);

    const timeline = rebuildInventoryCostTimeline([receipt], accounts, {}, { bindings });
    expect(timeline.valid).toBe(true);
    expect(timeline.resultsByOperationId.entry.incomingMetalCostMinor).toBe(56_568_600);
    expect(timeline.resultsByOperationId.entry.merchantLiabilityIncreaseMinor).toBe(56_568_600);
  });

  it('uses Samir Nashed silver metadata and actual silver weight even if the tx label says gold', () => {
    const receipt = entry({
      id: 'samir-silver', debit: 'مشغولات فضة', debitAccountId: 'silver',
      credit: 'سمير ناشد', creditAccountId: 'samir', weight: '100', arabicWeight: '100',
      invoiceOfficialPricePerGramEgp: 80,
    });
    expect(resolveMerchantReceiptMetal(receipt, accounts)).toBe('silver');
    expect(calculateMerchantInvoiceMetalValueMinor(receipt, accounts)).toBe(800_000);

    const timeline = rebuildInventoryCostTimeline([receipt], accounts, {}, { bindings });
    expect(timeline.valid).toBe(true);
    expect(timeline.resultsByOperationId['samir-silver'].incomingMetalCostMinor).toBe(800_000);
    expect(timeline.merchantGoldLiabilities.samir.bookValueMinor).toBe(800_000);
  });

  it('uses legacy invoice marketPrice with actual weight and removes priced receipts from Historical Cost Review', () => {
    const historical = entry({ id: 'legacy-priced', imported: true, seq: null, marketPrice: 5_657.14 });
    expect(calculateMerchantInvoiceMetalValueMinor(historical, accounts)).toBe(56_571_400);
    expect(findHistoricalCostReviewItems([historical], accounts)).toEqual([]);
  });

  it('remains fail-closed when the invoice has no valid official price', () => {
    const missing = entry({ id: 'missing-price', imported: true, seq: null });
    expect(calculateMerchantInvoiceMetalValueMinor(missing, accounts)).toBeNull();
    expect(findHistoricalCostReviewItems([missing], accounts)).toHaveLength(1);
  });
});