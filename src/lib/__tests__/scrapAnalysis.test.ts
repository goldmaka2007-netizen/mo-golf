import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import {
  analyzeGoldScrapMovements,
  buildScrapAnalysisModel,
  buildWeightedPartyBalances,
} from '../scrapAnalysis';

const account = (overrides: Partial<Account>): Account => ({
  id: 'account',
  name: 'account',
  mainType: 'legacy',
  subType: 'legacy',
  balanceNature: 'legacy',
  userId: 'test-user',
  is_inventory: false,
  metal: null,
  ...overrides,
});

const scrap = account({
  id: 'scrap-18',
  name: '\u0643\u0633\u0631 \u0627\u0641\u0631\u0646\u062c\u064a 18',
  type: 'gold_raw',
  canonicalMainType: 'assets',
  canonicalSubType: 'inventory_gold',
  is_inventory: true,
  metal: 'gold',
  karat: '18',
});
const product = account({
  id: 'product-18',
  name: 'product-18',
  type: 'gold_product',
  canonicalMainType: 'assets',
  canonicalSubType: 'inventory_gold',
  is_inventory: true,
  metal: 'gold',
  karat: '18',
});
const silverScrap = account({
  id: 'silver-scrap',
  name: '\u0643\u0633\u0631 \u0641\u0636\u0629',
  type: 'silver',
  canonicalMainType: 'assets',
  canonicalSubType: 'inventory_silver',
  is_inventory: true,
  metal: 'silver',
  karat: 'silver',
});
const goldMerchant = account({
  id: 'gold-merchant',
  name: '\u062e\u0627\u0644\u062f \u062d\u0645\u064a\u062f\u0648',
  type: 'merchant',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'merchant_gold',
  merchantDirection: 'payable',
  metal: 'gold',
});
const silverMerchant = account({
  id: 'silver-merchant',
  name: '\u0633\u0645\u064a\u0631 \u0646\u0627\u0634\u062f',
  type: 'merchant',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'merchant_silver',
  merchantDirection: 'payable',
  metal: 'silver',
});
const otherDue = account({
  id: 'alaa-yasser',
  name: '\u0627\u0644\u0627\u0621 \u064a\u0627\u0633\u0631',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'other_due',
  merchantDirection: 'payable',
  metal: 'gold',
});
const receivableMerchant = account({
  id: 'receivable-merchant',
  name: 'receivable merchant',
  type: 'merchant',
  canonicalMainType: 'assets',
  canonicalSubType: 'merchant_gold',
  merchantDirection: 'receivable',
  metal: 'gold',
});
const accounts = [scrap, product, silverScrap, goldMerchant, silverMerchant, otherDue, receivableMerchant];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: 'entry',
  tx: 'test',
  operationKind: 'adjustment',
  debit: '',
  credit: '',
  date: '2026-01-01',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'test-user',
  ...overrides,
});

const structuralOpening = entry({
  id: 'gold-opening',
  tx: '\u0634\u0631\u0627\u0621 \u0630\u0647\u0628',
  operationKind: 'purchase',
  debit: scrap.name,
  debitAccountId: scrap.id,
  credit: goldMerchant.name,
  creditAccountId: goldMerchant.id,
  date: '2026-01-10',
  weight: '10',
  karat: 18,
});
const structuralSettlement = entry({
  id: 'gold-settlement',
  tx: '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628',
  operationKind: 'merchant_settlement',
  debit: goldMerchant.name,
  debitAccountId: goldMerchant.id,
  credit: scrap.name,
  creditAccountId: scrap.id,
  date: '2026-02-02',
  weight: '3',
  karat: 18,
});
const legacySettlement = entry({
  id: 'legacy-settlement',
  tx: '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628',
  operationKind: undefined,
  debit: goldMerchant.name,
  credit: scrap.name,
  date: '2026-02-03',
  weight: '1',
  karat: 18,
});
const fixtureEntries = [
  structuralOpening,
  structuralSettlement,
  legacySettlement,
  entry({
    id: 'other-due-opening',
    operationKind: 'purchase',
    debit: scrap.name,
    debitAccountId: scrap.id,
    credit: otherDue.name,
    creditAccountId: otherDue.id,
    date: '2026-01-15',
    weight: '4',
    karat: 18,
  }),
  entry({
    id: 'silver-opening',
    operationKind: 'purchase',
    debit: silverScrap.name,
    debitAccountId: silverScrap.id,
    credit: silverMerchant.name,
    creditAccountId: silverMerchant.id,
    date: '2026-01-16',
    weight: '8',
  }),
  entry({
    id: 'silver-settlement',
    operationKind: 'merchant_settlement',
    debit: silverMerchant.name,
    debitAccountId: silverMerchant.id,
    credit: silverScrap.name,
    creditAccountId: silverScrap.id,
    date: '2026-02-04',
    weight: '2',
  }),
  entry({
    id: 'receivable-balance',
    debit: receivableMerchant.name,
    debitAccountId: receivableMerchant.id,
    credit: scrap.name,
    creditAccountId: scrap.id,
    date: '2026-02-05',
    weight: '2',
    karat: 18,
  }),
  entry({
    id: 'future-opening',
    operationKind: 'purchase',
    debit: scrap.name,
    debitAccountId: scrap.id,
    credit: goldMerchant.name,
    creditAccountId: goldMerchant.id,
    date: '2026-03-01',
    weight: '100',
    karat: 18,
  }),
];

const oldEquivalentTotals = (entries: Entry[]) => {
  let totalIn = 0;
  let totalOut = 0;
  for (const item of entries) {
    const debitScrap = item.debit.includes('\u0643\u0633\u0631') && !item.debit.includes('\u0641\u0636\u0629');
    const creditScrap = item.credit.includes('\u0643\u0633\u0631') && !item.credit.includes('\u0641\u0636\u0629');
    const weight = Number(item.weight);
    if (debitScrap) totalIn += weight;
    if (creditScrap) totalOut += weight;
  }
  return { totalIn, totalOut };
};

describe('structural scrap analysis', () => {
  it('classifies an ID-first merchant settlement and preserves equivalent old totals', () => {
    const equivalentFixture = [structuralOpening, structuralSettlement];
    const oldTotals = oldEquivalentTotals(equivalentFixture);
    const current = analyzeGoldScrapMovements(equivalentFixture, accounts, '18');

    expect(current.toMerchants).toBe(3);
    expect({ totalIn: current.totalIn, totalOut: current.totalOut }).toEqual(oldTotals);
    expect(current.legacyFallbacks).toEqual([]);
  });

  it('counts a legacy entry without IDs and aggregates every fallback reason', () => {
    const result = analyzeGoldScrapMovements([legacySettlement], accounts);

    expect(result.toMerchants).toBe(1);
    expect(result.legacyFallbacks).toEqual(expect.arrayContaining([
      expect.objectContaining({ entryId: 'legacy-settlement', missingField: 'debitAccountId' }),
      expect.objectContaining({ entryId: 'legacy-settlement', missingField: 'creditAccountId' }),
      expect.objectContaining({ entryId: 'legacy-settlement', missingField: 'operationKind', classification: 'merchant_settlement' }),
    ]));
  });

  it('separates merchants from other dues, keeps direction, and avoids double counting', () => {
    const parties = buildWeightedPartyBalances(fixtureEntries.slice(0, 7), accounts);
    const gold = parties.merchants.find(item => item.accountId === 'gold-merchant');
    const silver = parties.merchants.find(item => item.accountId === 'silver-merchant');
    const receivable = parties.merchants.find(item => item.accountId === 'receivable-merchant');

    expect(gold?.actualBalance).toBe(6);
    expect(gold?.goldE21Balance).toBeCloseTo(36 / 7);
    expect(silver?.actualBalance).toBe(6);
    expect(silver?.goldE21Balance).toBe(0);
    expect(receivable).toMatchObject({ actualBalance: 2, direction: 'receivable', directionDescription: '\u0644\u0635\u0627\u0644\u062d \u0627\u0644\u0645\u062d\u0644' });
    expect(receivable?.goldE21Balance).toBeCloseTo(12 / 7);
    expect(parties.otherDues).toEqual([
      expect.objectContaining({ accountId: 'alaa-yasser', actualBalance: 4 }),
    ]);
    expect(parties.otherDues[0].goldE21Balance).toBeCloseTo(24 / 7);
    expect(parties.merchants.some(item => item.accountId === 'alaa-yasser')).toBe(false);
    expect(new Set([...parties.merchants, ...parties.otherDues].map(item => item.accountId)).size)
      .toBe(parties.merchants.length + parties.otherDues.length);
    expect(parties.unclassifiedAccounts).toEqual([]);
    expect(parties.classificationConflicts).toEqual([]);
  });

  it('limits movement to the month while balances remain cumulative through month end', () => {
    const february = buildScrapAnalysisModel(fixtureEntries, accounts, '2026-02', 'all');

    expect(february.periodEntries.every(item => item.date.startsWith('2026-02'))).toBe(true);
    expect(february.movement.toMerchants).toBe(4);
    expect(february.movement.totalIn).toBe(0);
    expect(february.weightedParties.merchants.find(item => item.accountId === 'gold-merchant')?.actualBalance).toBe(6);
    expect(buildWeightedPartyBalances(fixtureEntries, accounts).merchants
      .find(item => item.accountId === 'gold-merchant')?.actualBalance).toBe(106);
    expect(february.movement.totalOut).toBe(6);
  });
});
