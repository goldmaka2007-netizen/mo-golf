import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import type { EquityStatementReport } from '../equityStatementReport';
import {
  buildFinancialPositionReport,
  type FinancialPositionDetail,
  type FinancialPositionDimension,
} from '../financialPositionReport';

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

const goldInventory = account({
  id: 'gold-inventory',
  name: 'gold-inventory',
  type: 'gold_product',
  canonicalMainType: 'assets',
  canonicalSubType: 'inventory_gold',
  is_inventory: true,
  metal: 'gold',
  karat: '21',
});
const silverInventory = account({
  id: 'silver-inventory',
  name: 'silver-inventory',
  type: 'silver',
  canonicalMainType: 'assets',
  canonicalSubType: 'inventory_silver',
  is_inventory: true,
  metal: 'silver',
});
const payable = (id: string, name: string, metal: 'gold' | 'silver' = 'gold'): Account => account({
  id,
  name,
  type: 'merchant',
  canonicalMainType: 'liabilities',
  canonicalSubType: metal === 'gold' ? 'merchant_gold' : 'merchant_silver',
  merchantDirection: 'payable',
  metal,
});
const khaled = payable('khaled', '\u062e\u0627\u0644\u062f \u062d\u0645\u064a\u062f\u0648');
const mohamed = payable('mohamed', '\u0645\u062d\u0645\u062f \u0627\u0644\u0633\u064a\u062f');
const alaaSaleh = payable('alaa-saleh', '\u0639\u0644\u0627\u0621 \u0635\u0627\u0644\u062d');
const samir = payable('samir', '\u0633\u0645\u064a\u0631 \u0646\u0627\u0634\u062f', 'silver');
const alaaYasser = account({
  id: 'alaa-yasser',
  name: '\u0627\u0644\u0627\u0621 \u064a\u0627\u0633\u0631',
  canonicalMainType: 'liabilities',
  canonicalSubType: 'other_due',
  merchantDirection: 'payable',
  metal: 'gold',
});
const receivable = account({
  id: 'receivable',
  name: 'gold-receivable',
  type: 'merchant',
  canonicalMainType: 'assets',
  canonicalSubType: 'merchant_gold',
  merchantDirection: 'receivable',
  metal: 'gold',
});
const retainedGold = account({
  id: 'retained-gold',
  name: 'retained-gold',
  canonicalMainType: 'equity',
  canonicalSubType: 'retained_earnings',
  metal: 'gold',
});
const retainedSilver = account({
  id: 'retained-silver',
  name: 'retained-silver',
  canonicalMainType: 'equity',
  canonicalSubType: 'retained_earnings',
  metal: 'silver',
});
const zeroActualMerchant = payable('zero-actual', 'zero-actual');
const unclassified = account({
  id: 'unclassified-gold',
  name: 'unclassified-gold',
  metal: 'gold',
});

const accounts = [
  goldInventory,
  silverInventory,
  khaled,
  mohamed,
  alaaSaleh,
  samir,
  alaaYasser,
  receivable,
  retainedGold,
  retainedSilver,
  zeroActualMerchant,
  unclassified,
];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: 'entry',
  tx: 'structural-test',
  operationKind: 'purchase',
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

const goldCredit = (id: string, creditor: Account, weight: number, karat = 21): Entry => entry({
  id,
  debit: goldInventory.name,
  debitAccountId: goldInventory.id,
  credit: creditor.name,
  creditAccountId: creditor.id,
  weight: String(weight),
  karat,
});

const entries: Entry[] = [
  goldCredit('khaled-opening', khaled, 10),
  goldCredit('mohamed-opening', mohamed, 20),
  goldCredit('alaa-saleh-opening', alaaSaleh, 30),
  entry({
    id: 'samir-opening',
    debit: silverInventory.name,
    debitAccountId: silverInventory.id,
    credit: samir.name,
    creditAccountId: samir.id,
    weight: '40',
  }),
  goldCredit('alaa-yasser-opening', alaaYasser, 50),
  entry({
    id: 'receivable-opening',
    operationKind: 'transfer',
    debit: receivable.name,
    debitAccountId: receivable.id,
    credit: goldInventory.name,
    creditAccountId: goldInventory.id,
    weight: '6',
    karat: 21,
  }),
  goldCredit('retained-gold-opening', retainedGold, 7),
  entry({
    id: 'retained-silver-opening',
    debit: silverInventory.name,
    debitAccountId: silverInventory.id,
    credit: retainedSilver.name,
    creditAccountId: retainedSilver.id,
    weight: '8',
  }),
  goldCredit('unclassified-opening', unclassified, 3),
  goldCredit('zero-actual-credit', zeroActualMerchant, 10, 18),
  entry({
    id: 'zero-actual-debit',
    operationKind: 'merchant_settlement',
    debit: zeroActualMerchant.name,
    debitAccountId: zeroActualMerchant.id,
    credit: goldInventory.name,
    creditAccountId: goldInventory.id,
    weight: '10',
    karat: 21,
  }),
];

const emptyEquityDimension = () => ({
  additions: { total: 0, accounts: {} },
  deductions: { total: 0, accounts: {} },
  netProfit: 0,
  totalChange: 0,
});
const equityStatement: EquityStatementReport = {
  cash: emptyEquityDimension(),
  gold: emptyEquityDimension(),
  silver: emptyEquityDimension(),
  accs: emptyEquityDimension(),
};
const report = buildFinancialPositionReport(entries, accounts, equityStatement);

const sectionDetails = (dimension: FinancialPositionDimension): FinancialPositionDetail[] => [
  ...Object.values(dimension.assets.categories).flatMap(category => category.details),
  ...Object.values(dimension.liabilities.categories).flatMap(category => category.details),
  ...Object.values(dimension.equity.categories).flatMap(category => category.details),
  ...dimension.uncategorized,
];
const findDetail = (
  dimension: FinancialPositionDimension,
  section: 'assets' | 'liabilities' | 'equity' | 'uncategorized',
  accountId: string,
): FinancialPositionDetail | undefined => {
  if (section === 'uncategorized') {
    return dimension.uncategorized.find(detail => detail.accountId === accountId);
  }
  return Object.values(dimension[section].categories)
    .flatMap(category => category.details)
    .find(detail => detail.accountId === accountId);
};

describe('financial position centralized account balances', () => {
  it('shows payable gold merchants under gold liabilities with fixture balances', () => {
    expect(findDetail(report.gold, 'liabilities', 'khaled')).toMatchObject({
      name: khaled.name,
      val: 10,
      actualVal: 10,
    });
    expect(findDetail(report.gold, 'liabilities', 'mohamed')).toMatchObject({
      name: mohamed.name,
      val: 20,
      actualVal: 20,
    });
    expect(findDetail(report.gold, 'liabilities', 'alaa-saleh')).toMatchObject({
      name: alaaSaleh.name,
      val: 30,
      actualVal: 30,
    });
    expect(findDetail(report.silver, 'liabilities', 'samir')).toMatchObject({
      name: samir.name,
      val: 40,
      actualVal: 40,
    });
  });

  it('shows a receivable gold merchant under gold assets', () => {
    expect(findDetail(report.gold, 'assets', 'receivable')).toMatchObject({
      name: receivable.name,
      val: 6,
      actualVal: 6,
    });
    expect(findDetail(report.gold, 'liabilities', 'receivable')).toBeUndefined();
  });

  it('shows alaa yasser once under gold liabilities as other_due', () => {
    expect(report.gold.liabilities.categories.other_due.details).toEqual([
      expect.objectContaining({
        accountId: 'alaa-yasser',
        name: alaaYasser.name,
        val: 50,
        actualVal: 50,
      }),
    ]);
  });

  it('shows retained earnings in equity for their correct dimensions', () => {
    expect(findDetail(report.gold, 'equity', 'retained-gold')).toMatchObject({
      val: 7,
      actualVal: 7,
    });
    expect(findDetail(report.silver, 'equity', 'retained-silver')).toMatchObject({
      val: 8,
      actualVal: 8,
    });
    expect(findDetail(report.silver, 'equity', 'retained-gold')).toBeUndefined();
    expect(findDetail(report.gold, 'equity', 'retained-silver')).toBeUndefined();
  });

  it('keeps an unclassified account visible in uncategorized', () => {
    expect(findDetail(report.gold, 'uncategorized', 'unclassified-gold')).toMatchObject({
      name: unclassified.name,
      val: -3,
      actualVal: -3,
    });
    expect(report.balanceDiagnostics.unclassifiedAccounts).toContainEqual(
      expect.objectContaining({ accountId: 'unclassified-gold' }),
    );
  });

  it('does not zero gold E21 when actual weight nets to exactly zero', () => {
    const detail = findDetail(report.gold, 'liabilities', 'zero-actual');

    expect(detail?.actualVal).toBe(0);
    expect(detail?.val).toBeCloseTo(-1.43, 8);
  });

  it('does not double count merchants or other_due accounts', () => {
    for (const accountId of ['khaled', 'mohamed', 'alaa-saleh', 'alaa-yasser']) {
      expect(sectionDetails(report.gold).filter(detail => detail.accountId === accountId)).toHaveLength(1);
    }
    expect(sectionDetails(report.silver).filter(detail => detail.accountId === 'samir')).toHaveLength(1);
  });

  it('has no legacy fallbacks or classification conflicts in the structural fixture', () => {
    expect(report.balanceDiagnostics.legacyNameMatchedEntries).toEqual([]);
    expect(report.balanceDiagnostics.classificationConflicts).toEqual([]);
  });
});
