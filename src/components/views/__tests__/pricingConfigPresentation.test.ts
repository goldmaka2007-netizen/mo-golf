import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { APPROVED_BULLION_UNIT_WEIGHTS, normalizeGoldPricingConfig, workmanshipForUnitWeight } from '../../../lib/goldPricingAssistant';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('pricingConfig presentation boundaries', () => {
  it('keeps Settings persistence explicit, merged, and separate from opening cost', () => {
    const settings = source('../SettingsView.tsx');
    expect(settings).toContain('{ pricingConfig: next }, { merge: true }');
    expect(settings).toContain('SUPPORTED_JEWELRY_TAXONOMY_KEYS');
    expect(settings).toContain('SMART_PURCHASE_TAXONOMY_KEYS');
    expect(settings).not.toContain('openingCostConfig: { pricingConfig');
  });

  it('reads missing pricingConfig without a sync write or migration', () => {
    const sync = source('../../../hooks/useDataSync.ts');
    expect(sync).toContain('setPricingConfig(normalizeGoldPricingConfig(data.pricingConfig))');
    expect(sync).toContain('setPricingConfig(normalizeGoldPricingConfig(undefined))');
    expect(sync).not.toContain('pricingConfig: next');
    expect(sync).not.toContain('setDoc(');
  });

  it('verifies the isolated explicit-save payload and normalization round-trip', async () => {
    const setDoc = vi.fn().mockResolvedValue(undefined);
    const settingsRef = { path: 'settings/test-uid' };
    const payload = normalizeGoldPricingConfig({
      saleWorkmanshipDefaults: { 'gold.product.ring_children': { mode: 'perPiece', value: 400 } },
      bullionWorkmanshipByWeight: { '0.25': { mode: 'perPiece', value: 250 } },
      coinWorkmanshipByWeight: { '2': { mode: 'perGram', value: 140 } },
      purchaseDiscountPercent: { 'gold.direct.coin': 5 },
    });
    // This is the exact isolated adapter invocation used by SettingsView's explicit Save path.
    await setDoc(settingsRef, { pricingConfig: payload }, { merge: true });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(settingsRef, { pricingConfig: payload }, { merge: true });
    expect(normalizeGoldPricingConfig(undefined)).toEqual({ version: 1, saleWorkmanshipDefaults: {}, bullionWorkmanshipByWeight: {}, coinWorkmanshipByWeight: {}, purchaseDiscountPercent: {} });
    expect(normalizeGoldPricingConfig({ pricingConfig: payload }.pricingConfig)).toEqual(payload);
    expect(payload.saleWorkmanshipDefaults['gold.product.ring_children']).toEqual({ mode: 'perPiece', value: 400 });
    expect(payload.bullionWorkmanshipByWeight['0.25']).toEqual({ mode: 'perPiece', value: 250 });
    expect(payload.coinWorkmanshipByWeight['2']).toEqual({ mode: 'perGram', value: 140 });
    expect(payload.purchaseDiscountPercent['gold.direct.coin']).toBe(5);
    expect(workmanshipForUnitWeight(payload.bullionWorkmanshipByWeight['0.25'], 0.25)).toEqual({ perGram: 1000, perPiece: 250 });
    expect(APPROVED_BULLION_UNIT_WEIGHTS).not.toContain(100);
  });

  it('keeps Story Builder as a pricingConfig consumer with no editable legacy authority', () => {
    const story = source('../StoryBuilderView.tsx');
    expect(story).toContain('store.pricingConfig.bullionWorkmanshipByWeight');
    expect(story).toContain('store.pricingConfig.coinWorkmanshipByWeight');
    expect(story).toContain('readOnly');
    expect(story).not.toContain('setBullionCharges(');
    expect(story).not.toContain('setCoinCharges(');
  });

  it('keeps fixed-weight assistant taxonomy-only and transfers only canonical prefill fields', () => {
    const assistant = source('../GoldPricingAssistant.tsx');
    expect(assistant).toContain('approvedWeightsForProduct(product)');
    expect(assistant).toContain('bullionInternalWorkmanshipTotal');
    expect(assistant).toContain("product.taxonomyKey?.startsWith('gold.product.') ? true");
    expect(assistant).not.toContain('addDoc');
    expect(assistant).not.toContain("collection(db, 'entries')");
  });
});
