import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildDailyJournalSmartDashboard, resolveDailyJournalMarketPrice } from '../dailyJournalSmartDashboard';

const accounts: Account[] = [
  { id: 'cash', name: 'Cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'Gold', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21', userId: 'u' },
  { id: 'customer', name: 'Customer', mainType: 'liability', subType: 'customer', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'expense', name: 'Expense', mainType: 'expenses', subType: 'expense', balanceNature: 'expense', type: 'other', userId: 'u' },
  { id: 'repair-income', name: 'Repair Income', mainType: 'revenue', subType: 'revenue', canonicalSubType: 'revenue', balanceNature: 'value', type: 'other', userId: 'u' },
  { id: 'equity', name: 'Equity', mainType: 'equity', subType: 'capital', balanceNature: 'value', type: 'other', userId: 'u' },
  { id: 'merchant-gold', name: 'Merchant Gold', mainType: 'liabilities', subType: 'merchant_gold', balanceNature: 'gold', type: 'merchant', metal: 'gold', canonicalSubType: 'merchant_gold', userId: 'u' },
  { id: 'merchant-silver', name: 'Merchant Silver', mainType: 'liabilities', subType: 'merchant_silver', balanceNature: 'silver', type: 'merchant', metal: 'silver', canonicalSubType: 'merchant_silver', userId: 'u' },
  { id: 'silver', name: 'Silver', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', is_inventory: true, metal: 'silver', userId: 'u' },
  { id: 'scrap', name: 'Scrap', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_raw', is_inventory: true, metal: 'gold', karat: '18', userId: 'u' },
  { id: 'finished', name: 'Finished', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21', userId: 'u' },
];
const entry = (value: Partial<Entry>): Entry => ({ id: value.id || Math.random().toString(), tx: 'x', debit: 'Cash', credit: 'Gold', debitAccountId: 'cash', creditAccountId: 'gold', date: '2026-08-18', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...value });

describe('smart daily dashboard', () => {
  it('uses canonical cash legs for opening + in - out', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'open', operationKind: 'opening', date: '2026-08-18', cash: '100', credit: 'Equity', creditAccountId: 'equity' }),
      entry({ id: 'sale', operationKind: 'sale', cash: '50', weight: '1', arabicWeight: '1' }),
      entry({ id: 'expense', operationKind: 'expense', debit: 'Expense', debitAccountId: 'expense', credit: 'Cash', creditAccountId: 'cash', cash: '20' }),
    ], accounts, '2026-08-18');
    expect(result.cash).toMatchObject({ opening: 100, cashIn: 50, cashOut: 20, closing: 130 });
    expect(result.cash.categories.reduce((n, row) => n + row.cashIn, 0)).toBe(result.cash.cashIn);
    expect(result.cash.categories.reduce((n, row) => n + row.cashOut, 0)).toBe(result.cash.cashOut);
  });

  it('classifies canonical cash sales by metal and repair income without changing cash totals', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'gold-sale', operationKind: 'sale', cash: '14680', weight: '10', arabicWeight: '10' }),
      entry({ id: 'silver-sale', operationKind: 'sale', tx: '\u0628\u064a\u0639 \u0641\u0636\u0629', debit: 'Cash', debitAccountId: 'cash', credit: 'Silver', creditAccountId: 'silver', cash: '700', weight: '4.4', arabicWeight: '4.4' }),
      entry({ id: 'repair-income', operationKind: 'other', tx: '\u0627\u064a\u0631\u0627\u062f\u0627\u062a \u0627\u062e\u0631\u0649', debit: 'Cash', debitAccountId: 'cash', credit: 'Repair Income', creditAccountId: 'repair-income', cash: '20' }),
    ], accounts, '2026-08-18');
    const category = (label: string) => result.cash.categories.find(row => row.label === label)?.cashIn || 0;
    expect(category('\u0645\u0628\u064a\u0639\u0627\u062a \u0630\u0647\u0628')).toBe(14680);
    expect(category('\u0645\u0628\u064a\u0639\u0627\u062a \u0641\u0636\u0629')).toBe(700);
    expect(category('\u0625\u064a\u0631\u0627\u062f \u062a\u0635\u0644\u064a\u062d')).toBe(20);
    expect(result.cash.categories.reduce((total, row) => total + row.cashIn, 0)).toBe(result.cash.cashIn);
    expect(result.cash.cashIn).toBe(15400);
  });

  it('calculates weighted customer sale and purchase values and conservative guards', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'sale', operationKind: 'sale', cash: '1000', weight: '10', arabicWeight: '10' }),
      entry({ id: 'purchase', operationKind: 'purchase', debit: 'Gold', debitAccountId: 'gold', credit: 'Customer', creditAccountId: 'customer', cash: '700', weight: '10', arabicWeight: '10' }),
    ], accounts, '2026-08-18', { minimumEgpPerE21: 10, minimumPercent: 20 });
    expect(result.gold.sales.today.average).toBe(100);
    expect(result.gold.purchases.today.average).toBe(70);
    expect(result.decision.historicalSpread).toBe(30);
    expect(result.decision.suggestedPurchase).toBe(70);
    expect(result.decision.binding).toBe('historical');
  });

  it('weights overlapping today/7d/30d windows by E21 volume', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'today-small', operationKind: 'sale', date: '2026-08-18', cash: '1000', weight: '10', arabicWeight: '10' }),
      entry({ id: 'history-large', operationKind: 'sale', date: '2026-08-12', cash: '8000', weight: '100', arabicWeight: '100' }),
    ], accounts, '2026-08-18');
    expect(result.gold.sales.today.average).toBe(100);
    expect(result.gold.sales.last7Days.e21).toBe(110);
    expect(result.decision.blendedSell).toBeLessThan(100);
  });

  it('supports fixed and percentage guardrails independently', () => {
    const entries = [entry({ id: 'sell', operationKind: 'sale', cash: '1000', weight: '10', arabicWeight: '10' })];
    const fixed = buildDailyJournalSmartDashboard(entries, accounts, '2026-08-18', { minimumEgpPerE21: 60, minimumPercent: 1 });
    expect(fixed.decision.binding).toBe('fixed');
    const percentage = buildDailyJournalSmartDashboard(entries, accounts, '2026-08-18', { minimumEgpPerE21: 1, minimumPercent: 60 });
    expect(percentage.decision.binding).toBe('percentage');
  });

  it('excludes incomplete monetary or E21 rows without zero/NaN distortion', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'no-money', operationKind: 'sale', cash: '0', weight: '2', arabicWeight: '2' }),
      entry({ id: 'no-weight', operationKind: 'sale', cash: '100', weight: '0', arabicWeight: '0' }),
    ], accounts, '2026-08-18');
    expect(result.gold.sales.today.average).toBeNull();
    expect(Number.isNaN(result.gold.sales.today.average as number)).toBe(false);
    expect(result.decision.suggestedPurchase).toBeNull();
  });

  it('does not fabricate a recommendation without valid sell data', () => {
    const result = buildDailyJournalSmartDashboard([entry({ id: 'bad', operationKind: 'sale', cash: '0', weight: '2', arabicWeight: '2' })], accounts, '2026-08-18');
    expect(result.decision.suggestedPurchase).toBeNull();
    expect(result.gold.sales.today.average).toBeNull();
  });

  it('separates merchant gold/silver and workmanship from customer metrics', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'merchant-receipt', operationKind: 'purchase', debit: 'Gold', debitAccountId: 'gold', credit: 'Merchant Gold', creditAccountId: 'merchant-gold', cash: '900', weight: '2', arabicWeight: '2' }),
      entry({ id: 'merchant-cash', operationKind: 'merchant_settlement', debit: 'Merchant Gold', debitAccountId: 'merchant-gold', credit: 'Cash', creditAccountId: 'cash', cash: '40' }),
      entry({ id: 'merchant-silver', operationKind: 'purchase', debit: 'Silver', debitAccountId: 'silver', credit: 'Merchant Silver', creditAccountId: 'merchant-silver', cash: '50', weight: '3' }),
    ], accounts, '2026-08-18');
    expect(result.gold.purchases.today.operations).toBe(0);
    expect(result.merchants.goldReceived).toBe(2);
    expect(result.merchants.workmanshipCash).toBe(40);
    expect(result.silver.purchasesWeight).toBe(0);
    expect(result.silver.merchantReceived).toBe(3);
    expect(result.cash.cashOut).toBe(40);
  });

  it('keeps transfers out of commercial metrics and reports semantic internal directions', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'transfer', operationKind: 'transfer', debit: 'Finished', debitAccountId: 'finished', credit: 'Scrap', creditAccountId: 'scrap', weight: '1', arabicWeight: '1' }),
      entry({ id: 'adjustment', operationKind: 'adjustment', debit: 'Finished', debitAccountId: 'finished', credit: 'Cash', creditAccountId: 'cash', cash: '25', weight: '1', arabicWeight: '1' }),
    ], accounts, '2026-08-18');
    expect(result.gold.sales.today.operations).toBe(0);
    expect(result.internal.transfers).toBe(1);
    expect(result.internal.directions['finished → scrap'].movements).toBeGreaterThan(0);
    expect(result.cash.cashOut).toBe(25);
  });

  it('excludes conflicting karat sources from karat buckets but keeps aggregate merchant movement', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'merchant-conflict', operationKind: 'purchase', debit: 'Gold', debitAccountId: 'gold', credit: 'Merchant Gold', creditAccountId: 'merchant-gold', cash: '900', weight: '2', arabicWeight: '2', karat: 18, goldEquivalent21Snapshot: { physicalWeight: '2', physicalWeightUnits: 200, karat: 21, equivalent21: '2', equivalent21Units: 200, roundingScale: '0.01g', calculationVersion: 'gold-equivalent-21-centigram-v1' } }),
    ], accounts, '2026-08-18');
    expect(result.merchants.goldReceived).toBe(2);
    expect(result.merchants.karatConflicts).toBe(1);
    expect(result.merchants.goldByKarat['18'].movements + result.merchants.goldByKarat['21'].movements + result.merchants.goldByKarat['24'].movements).toBe(0);
  });

  it('uses market price only for today, never as a historical substitute', () => {
    expect(resolveDailyJournalMarketPrice('2026-08-18', '2026-08-18', 5000)).toBe(5000);
    expect(resolveDailyJournalMarketPrice('2026-08-17', '2026-08-18', 5000)).toBeNull();
  });

  it('excludes a synthetic multi-leg gold transaction from commercial metrics while preserving one canonical cash movement', () => {
    const result = buildDailyJournalSmartDashboard([
      entry({ id: 'baseline-sale', operationKind: 'sale', cash: '1000', weight: '10', arabicWeight: '10' }),
      entry({ id: 'baseline-purchase', operationKind: 'purchase', debit: 'Gold', debitAccountId: 'gold', credit: 'Customer', creditAccountId: 'customer', cash: '700', weight: '10', arabicWeight: '10' }),
      // Same source id represents two qualifying inventory-out legs in one synthetic transaction.
      entry({ id: 'multi-leg-sale', operationKind: 'sale', cash: '500', weight: '5', arabicWeight: '5' }),
      entry({ id: 'multi-leg-sale', operationKind: 'sale', cash: '0', weight: '5', arabicWeight: '5' }),
    ], accounts, '2026-08-18');
    expect(result.gold.sales.today.operations).toBe(1);
    expect(result.gold.purchases.today.operations).toBe(1);
    expect(result.gold.sales.today.average).toBe(100);
    expect(result.gold.purchases.today.average).toBe(70);
    expect(result.decision.historicalSpread).toBe(30);
    expect(result.decision.suggestedPurchase).toBe(70);
    expect(result.cash.cashIn).toBe(1500);
    expect(result.cash.categories.reduce((total, category) => total + category.cashIn, 0)).toBe(result.cash.cashIn);
    expect(result.cash.categories.reduce((total, category) => total + category.cashOut, 0)).toBe(result.cash.cashOut);
    expect(result.cash.categories.filter(category => category.label === 'مبيعات ذهب').reduce((total, category) => total + category.cashIn, 0)).toBe(1500);
    expect(result.gold.sales.today.average).not.toBeNaN();
    expect(result.gold.purchases.today.average).not.toBeNaN();
  });
});
