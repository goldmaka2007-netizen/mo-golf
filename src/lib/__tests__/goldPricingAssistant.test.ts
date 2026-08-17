import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import { buildAccountRegistry } from '../accountRegistry';
import {
  buildGoldAssistantEntryPrefill,
  calculateActualPurchaseValues,
  calculateProposedPurchaseTotal,
  calculateSalePricing,
  changeGoldAssistantProduct,
  createEmptyGoldAssistantState,
  createGoldAssistantSession,
  DEFAULT_GOLD_SALE_TAX_STAMP_PER_GRAM_EGP,
  goldSaleTaxStampRate,
  normalizeGoldSaleTaxStampPerGramEgp,
  normalizeGoldPricingConfig,
  workmanshipForUnitWeight,
  totalWeightForAssistant,
  bullionInternalWorkmanshipTotal,
  APPROVED_BULLION_UNIT_WEIGHTS,
  APPROVED_COIN_UNIT_WEIGHTS,
  calculateActualSaleWorkmanship,
  SMART_PURCHASE_TAXONOMY_KEYS,
  officialGoldKaratPrice,
  purchaseValuesFromDiscountPerGram,
  purchaseValuesFromDiscountPercent,
  purchaseValuesFromPricePerGram,
  resetGoldAssistantState,
  resolveGoldAssistantProducts,
  transferredCountForProduct,
  workmanshipPerGramFromPiece,
  workmanshipPieceFromPerGram,
} from '../goldPricingAssistant';

const taxSettings = { 18: 15, 21: 12 } as const;

const product = (overrides: Partial<ReturnType<typeof makeProduct>> = {}) => ({
  ...makeProduct(),
  ...overrides,
});

function makeProduct() {
  return {
    accountId: 'gold-21',
    taxonomyKey: undefined as string | undefined,
    pricingKey: 'gold.product.test',
    name: 'ذهب 21',
    karat: 21 as const,
    multiplier: 1,
    tracksQuantity: false,
  };
}

describe('gold sale pricing assistant', () => {
  it('calculates 21k gold, workmanship, and configured tax', () => {
    expect(calculateSalePricing({
      weight: 5,
      officialPrice: 6000,
      workmanshipTotal: 500,
      taxStampEnabled: true,
      karat: 21,
      taxStampSettings: taxSettings,
    })).toEqual({ goldValue: 30000, workmanshipTotal: 500, taxStampTotal: 60, suggestedTotal: 30560 });
  });

  it('uses the configured 18k rate and the existing karat price calculation', () => {
    const official18 = officialGoldKaratPrice(7000, 0.857142857);
    expect(official18).toBe(6000);
    expect(calculateSalePricing({
      weight: 2,
      officialPrice: official18!,
      workmanshipTotal: 100,
      taxStampEnabled: true,
      karat: 18,
      taxStampSettings: taxSettings,
    })?.taxStampTotal).toBe(30);
  });

  it('always makes 24k tax/stamp zero', () => {
    expect(goldSaleTaxStampRate(24, taxSettings)).toBe(0);
    expect(calculateSalePricing({
      weight: 3,
      officialPrice: 7000,
      workmanshipTotal: 0,
      taxStampEnabled: true,
      karat: 24,
      taxStampSettings: taxSettings,
    })?.taxStampTotal).toBe(0);
  });

  it('links workmanship in both directions and guards zero weight', () => {
    expect(workmanshipPieceFromPerGram(5, 20)).toBe(100);
    expect(workmanshipPerGramFromPiece(5, 100)).toBe(20);
    expect(workmanshipPieceFromPerGram(0, 20)).toBeNull();
    expect(workmanshipPerGramFromPiece(0, 100)).toBeNull();
  });
});

describe('gold purchase pricing assistant', () => {
  it('links discount percent, EGP/gram, and purchase price in every direction', () => {
    expect(purchaseValuesFromDiscountPercent(6000, 10)).toEqual({
      discountPercent: 10,
      discountPerGram: 600,
      purchasePricePerGram: 5400,
    });
    expect(purchaseValuesFromDiscountPerGram(6000, 300)).toEqual({
      discountPercent: 5,
      discountPerGram: 300,
      purchasePricePerGram: 5700,
    });
    expect(purchaseValuesFromPricePerGram(6000, 5500)).toEqual({
      discountPercent: 8.33,
      discountPerGram: 500,
      purchasePricePerGram: 5500,
    });
    expect(purchaseValuesFromPricePerGram(6000, -1)).toBeNull();
  });

  it('calculates the proposed total and final negotiated information', () => {
    expect(calculateProposedPurchaseTotal(2.5, 5500)).toBe(13750);
    expect(calculateActualPurchaseValues(14000, 2.5, 6000)).toEqual({
      discountPercent: 6.67,
      discountPerGram: 400,
      purchasePricePerGram: 5600,
    });
    expect(calculateActualPurchaseValues(14000, 0, 6000)).toBeNull();
    expect(calculateProposedPurchaseTotal(0, 5500)).toBeNull();
  });
});

describe('assistant quantity, reset, and session behavior', () => {
  it('uses tracksQuantity for defaults and transferred count', () => {
    const countProduct = product({ tracksQuantity: true });
    const weightProduct = product({ tracksQuantity: false });
    expect(changeGoldAssistantProduct(countProduct).count).toBe('1');
    expect(changeGoldAssistantProduct(weightProduct).count).toBe('0');
    expect(transferredCountForProduct(countProduct, '0')).toBe('1');
    expect(transferredCountForProduct(weightProduct, '9')).toBe('0');
  });

  it('clears all temporary values on reset and product change', () => {
    const dirty = {
      ...createEmptyGoldAssistantState(product({ tracksQuantity: true })),
      weight: '4',
      workmanshipPerGram: '20',
      pieceWorkmanship: '80',
      taxStampEnabled: true,
      discountPercent: '5',
      discountPerGram: '300',
      purchasePricePerGram: '5700',
      finalTotal: '23000',
    };
    expect(resetGoldAssistantState()).toEqual(createEmptyGoldAssistantState());
    const changed = changeGoldAssistantProduct(product({ accountId: 'other', tracksQuantity: true }));
    expect(changed).toEqual(createEmptyGoldAssistantState(product({ accountId: 'other', tracksQuantity: true })));
    expect(dirty.weight).toBe('4');
  });

  it('creates a fresh immutable price/time snapshot for every new session', () => {
    const first = createGoldAssistantSession('sale', 6000, 1000);
    const second = createGoldAssistantSession('sale', 6100, 2000);
    expect(first).toEqual({ mode: 'sale', gold21PriceSnapshot: 6000, capturedAt: 1000 });
    expect(second).toEqual({ mode: 'sale', gold21PriceSnapshot: 6100, capturedAt: 2000 });
  });

  it('does not implement assistant draft persistence', () => {
    const source = readFileSync(new URL('../../components/views/GoldPricingAssistant.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });
});

describe('account rules and EntryForm handoff', () => {
  const seededInventory = (name: string, id: string): Account => ({
    ...(SEED_ACCOUNTS.find(account => account.name === name)! as Account),
    id,
    userId: 'u',
  });
  const accounts: Account[] = [
    { id: 'cash', name: 'الخزنة', mainType: 'اصول', subType: 'نقدية', balanceNature: 'جنيه', type: 'cash', is_inventory: false, karat: null, metal: null, userId: 'u' },
    seededInventory('كسر افرنجي', 'raw18'),
    seededInventory('كسر عربي', 'raw21'),
    seededInventory('جنية', 'coin'),
    seededInventory('سبيكة', 'bar'),
    { id: 'unrelated-direct', name: 'ذهب مباشر إضافي', mainType: 'اصول', subType: 'مخزون ذهب', balanceNature: 'جرام ذهب', type: 'gold_direct', is_inventory: true, karat: '21', metal: 'gold', quantityStep: 1, cloneSourceAccountId: 'coin', userId: 'u' },
  ];
  const registry = buildAccountRegistry(accounts);
  const purchaseRules = accounts.slice(1).map(account => ({
    tx: 'شراء ذهب',
    debit: account.name,
    debitAccountId: account.id,
    credit: 'الخزنة',
    creditAccountId: 'cash',
    karat: Number(account.karat),
    multiplier: Number(account.karat) / 21,
  }));

  it('resolves only the four approved purchase products and excludes an unrelated fifth gold rule', () => {
    const products = resolveGoldAssistantProducts({ mode: 'purchase', accounts, registry, rules: purchaseRules });
    expect(products.map(item => item.accountId).sort()).toEqual(['bar', 'coin', 'raw18', 'raw21']);
    expect(products.some(item => item.accountId === 'unrelated-direct')).toBe(false);
    expect(products.find(item => item.accountId === 'coin')?.tracksQuantity).toBe(true);
    expect(products.find(item => item.accountId === 'raw18')?.tracksQuantity).toBe(false);
  });

  it('builds the sale prefill with cash debit and no pricing-only fields', () => {
    const prefill = buildGoldAssistantEntryPrefill({
      mode: 'sale',
      product: product(),
      cashAccount: accounts[0],
      weight: '5.00',
      count: '7',
      finalTotal: '30500',
      officialKaratPrice: 6000,
    });
    expect(prefill).toEqual({
      tx: 'بيع ذهب', debit: 'الخزنة', debitAccountId: 'cash', credit: 'ذهب 21', creditAccountId: 'gold-21',
      cash: '30500', weight: '5.00', count: '0', karat: 21, multiplier: 1, marketPrice: 6000,
    });
    expect(prefill).not.toHaveProperty('workmanship');
    expect(prefill).not.toHaveProperty('taxStamp');
  });

  it('builds the purchase prefill with inventory debit and conditional count', () => {
    const prefill = buildGoldAssistantEntryPrefill({
      mode: 'purchase',
      product: product({ accountId: 'coin', name: 'جنية', tracksQuantity: true }),
      cashAccount: accounts[0],
      weight: '8.00',
      count: '2',
      finalTotal: '46000',
      officialKaratPrice: 6000,
    });
    expect(prefill).toMatchObject({
      tx: 'شراء ذهب', debit: 'جنية', debitAccountId: 'coin', credit: 'الخزنة', creditAccountId: 'cash',
      cash: '46000', weight: '8.00', count: '2', marketPrice: 6000,
    });
  });

  it('keeps persistence in the existing EntryForm only', () => {
    const assistantSource = readFileSync(new URL('../../components/views/GoldPricingAssistant.tsx', import.meta.url), 'utf8');
    const entryFormSource = readFileSync(new URL('../../components/views/EntryForm.tsx', import.meta.url), 'utf8');
    expect(assistantSource).not.toContain('addDoc');
    expect(assistantSource).not.toContain("collection(db, 'entries')");
    expect(entryFormSource).toContain('renderStep3');
    expect(entryFormSource).toContain("addDoc(collection(db, 'entries')");
  });
});

describe('sale pricing settings', () => {
  it('keeps the approved fixed-weight lists exact and excludes legacy 100g', () => {
    expect(APPROVED_BULLION_UNIT_WEIGHTS).toEqual([0.25, 0.5, 1, 2.5, 5, 10, 20, 31.1, 50]);
    expect(APPROVED_BULLION_UNIT_WEIGHTS).not.toContain(100);
    expect(APPROVED_COIN_UNIT_WEIGHTS).toEqual([2, 4, 8]);
  });

  it('links jewelry defaults by the manual pricing weight only, not count', () => {
    expect(workmanshipForUnitWeight({ mode: 'perPiece', value: 400 }, 1)).toEqual({ perGram: 400, perPiece: 400 });
    expect(workmanshipForUnitWeight({ mode: 'perPiece', value: 400 }, 2)).toEqual({ perGram: 200, perPiece: 400 });
    expect(workmanshipForUnitWeight({ mode: 'perGram', value: 200 }, 2)).toEqual({ perGram: 200, perPiece: 400 });
    const jewelry = product({ taxonomyKey: 'gold.product.ring_children' });
    expect(totalWeightForAssistant(jewelry, 2, 9)).toBe(2);
    expect(bullionInternalWorkmanshipTotal(jewelry, 400, 9)).toBe(400);
  });

  it('calculates actual workmanship under the distinct jewelry and bullion rules', () => {
    expect(calculateActualSaleWorkmanship({ finalTotal: 1250, goldValue: 700, taxStampTotal: 150, totalWeight: 2, unitWeight: 2, count: 9, fixedWeight: false })).toMatchObject({ amount: 400, perGram: 200, perPiece: 400, negative: false });
    expect(calculateActualSaleWorkmanship({ finalTotal: 5250, goldValue: 4500, taxStampTotal: 0, totalWeight: 0.75, unitWeight: 0.25, count: 3, fixedWeight: true })).toMatchObject({ amount: 750, perGram: 1000, perPiece: 250, negative: false });
    expect(calculateActualSaleWorkmanship({ finalTotal: 4400, goldValue: 4500, taxStampTotal: 0, totalWeight: 0.75, unitWeight: 0.25, count: 3, fixedWeight: true })).toMatchObject({ amount: -100, negative: true });
  });

  it('keeps the purchase assistant contract closed to the four configured taxonomies', () => {
    expect(SMART_PURCHASE_TAXONOMY_KEYS).toEqual(['gold.raw.scrap_foreign', 'gold.raw.scrap_arabic', 'gold.direct.coin', 'gold.direct.bar']);
    const seeded = purchaseValuesFromDiscountPercent(6000, 5);
    expect(seeded).toEqual({ discountPercent: 5, discountPerGram: 300, purchasePricePerGram: 5700 });
    expect(calculateProposedPurchaseTotal(totalWeightForAssistant(product({ taxonomyKey: 'gold.direct.coin' }), 2, 3)!, seeded!.purchasePricePerGram)).toBe(34200);
  });
  it('normalizes pricing config safely without creating any persisted value', () => {
    expect(normalizeGoldPricingConfig(undefined)).toMatchObject({ version: 1, saleWorkmanshipDefaults: {}, bullionWorkmanshipByWeight: {}, coinWorkmanshipByWeight: {}, purchaseDiscountPercent: {} });
    expect(normalizeGoldPricingConfig({ saleWorkmanshipDefaults: { 'gold.product.ring_children': { mode: 'perPiece', value: 400 }, bad: { mode: 'bad', value: -1 } }, purchaseDiscountPercent: { good: 5, bad: -1 } })).toEqual({ version: 1, saleWorkmanshipDefaults: { 'gold.product.ring_children': { mode: 'perPiece', value: 400 } }, bullionWorkmanshipByWeight: {}, coinWorkmanshipByWeight: {}, purchaseDiscountPercent: { good: 5 } });
  });

  it('keeps bullion unit rates separate from total count pricing', () => {
    expect(workmanshipForUnitWeight({ mode: 'perPiece', value: 250 }, 0.25)).toEqual({ perGram: 1000, perPiece: 250 });
    const bullion = product({ taxonomyKey: 'gold.direct.bar' });
    expect(totalWeightForAssistant(bullion, 0.25, 3)).toBe(0.75);
    expect(bullionInternalWorkmanshipTotal(bullion, 250, 3)).toBe(750);
  });
  it('uses safe defaults and ignores a configurable 24k field', () => {
    expect(normalizeGoldSaleTaxStampPerGramEgp(undefined)).toEqual(DEFAULT_GOLD_SALE_TAX_STAMP_PER_GRAM_EGP);
    expect(normalizeGoldSaleTaxStampPerGramEgp({ 18: 20, 21: 10, 24: 99 })).toEqual({ 18: 20, 21: 10 });
  });

  it('keeps sale pricing configuration separate from openingCostConfig', () => {
    const source = readFileSync(new URL('../../components/views/SettingsView.tsx', import.meta.url), 'utf8');
    const syncSource = readFileSync(new URL('../../hooks/useDataSync.ts', import.meta.url), 'utf8');
    expect(source).toContain("{ goldSaleTaxStampPerGramEgp: next }");
    expect(source).toContain("{ openingCostConfig: sorted }");
    expect(source).not.toContain('openingCostConfig: { goldSaleTaxStampPerGramEgp');
    expect(source).not.toContain('ضريبة ودمغة عيار 24');
    expect(syncSource).toContain('normalizeGoldSaleTaxStampPerGramEgp(data.goldSaleTaxStampPerGramEgp)');
  });
});
