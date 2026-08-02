import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { computeAccountBalances, computePeriodAccountBalances } from '../engine';
import { formatWeight } from '../formatting';
import { buildIncomeStatementReport } from '../incomeStatementReport';
import { buildEquityStatementReport } from '../equityStatementReport';
import { buildFinancialPositionReport } from '../financialPositionReport';
import { buildLedgerReport } from '../ledgerReport';
import { buildWeightedPartyBalances } from '../scrapAnalysis';
import { buildTrialBalanceReport } from '../trialBalanceReport';
import {
  GOLD_EQUIVALENT_21_CALCULATION_VERSION,
  GOLD_EQUIVALENT_21_ROUNDING_SCALE,
  type GoldEquivalent21Snapshot,
} from '../goldEquivalent';

const merchant: Account = {
  id: 'alaa', name: 'علاء صالح', mainType: 'خصوم', subType: 'تجار ذهب',
  canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold',
  balanceNature: 'جرام ذهب', type: 'merchant', merchantDirection: 'payable',
  metal: 'gold', is_inventory: false, userId: 'u',
};
const inventory: Account = {
  id: 'gold', name: 'خاتم عربي', mainType: 'اصول', subType: 'مخزون ذهب',
  canonicalMainType: 'assets', canonicalSubType: 'inventory_gold',
  balanceNature: 'جرام ذهب', type: 'gold_product', metal: 'gold', karat: '21',
  is_inventory: true, userId: 'u',
};
const scrap: Account = {
  ...inventory, id: 'scrap', name: 'كسر عربي', type: 'gold_raw',
};
const capital: Account = {
  id: 'capital', name: 'رأس المال ذهب', mainType: 'حقوق ملكية', subType: 'رأس المال',
  canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'جرام ذهب',
  type: 'other', metal: 'gold', is_inventory: false, userId: 'u',
};
const accounts = [merchant, inventory, scrap, capital];

const snapshot = (physicalWeight: string, karat: 18 | 21 | 24, equivalent21Units: number): GoldEquivalent21Snapshot => ({
  physicalWeight,
  physicalWeightUnits: Math.round(Number(physicalWeight) * 100),
  karat,
  equivalent21: (equivalent21Units / 100).toFixed(2),
  equivalent21Units,
  roundingScale: GOLD_EQUIVALENT_21_ROUNDING_SCALE,
  calculationVersion: GOLD_EQUIVALENT_21_CALCULATION_VERSION,
});

const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', operationNo: 'OP', tx: 'اختبار', operationKind: 'transfer', date: '2026-06-01',
  debit: inventory.name, debitAccountId: inventory.id, credit: merchant.name, creditAccountId: merchant.id,
  cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});

const projections = (entries: Entry[]) => {
  const computed = computeAccountBalances(entries, accounts);
  const period = computePeriodAccountBalances(entries, accounts, '2026-01-01', '2026-12-31');
  const central = computed.balances.get(merchant.id!)!.goldE21Balance;
  const trialRow = buildTrialBalanceReport(period, 'gold').groups.flatMap(group => group.rows)
    .find(row => row.entityId === `merchant:${merchant.id}`)!;
  const ledger = buildLedgerReport(entries, accounts, merchant, 'gold', '2026-01-01', '2026-12-31');
  const income = buildIncomeStatementReport(computed);
  const position = buildFinancialPositionReport(computed, buildEquityStatementReport(computed, income));
  const balanceSheet = position.gold.liabilities.categories.merchant_gold.details
    .find(row => row.accountId === merchant.id)!.val;
  const scrapAnalysis = buildWeightedPartyBalances(computed).merchants
    .find(row => row.accountId === merchant.id)!.goldE21Balance;
  return {
    computed,
    central,
    trial: trialRow.closingCredit - trialRow.closingDebit,
    ledger: ledger.closingBalance,
    ledgerFinal: ledger.rows.at(-1)?.balance ?? ledger.openingBalance,
    balanceSheet,
    scrapAnalysis,
  };
};

describe('merchant gold raw balance consistency', () => {
  it('reproduces Alaa Saleh legacy arabicWeight mismatch without leaking it into Trial Balance', () => {
    const entries = [
      entry({ id: 'TX1714', operationNo: 'TX1714', operationKind: 'purchase', weight: '57.90', arabicWeight: '57.91', karat: 21, goldEquivalent21Snapshot: snapshot('57.90', 21, 5790) }),
      entry({ id: 'TX1721', operationNo: 'TX1721', date: '2026-06-09', debit: merchant.name, debitAccountId: merchant.id, credit: inventory.name, creditAccountId: inventory.id, weight: '57.90', arabicWeight: '57.90', karat: 21, goldEquivalent21Snapshot: snapshot('57.90', 21, 5790) }),
      entry({ id: 'TX1746', operationNo: 'TX1746', date: '2026-06-14', operationKind: 'purchase', weight: '51.00', arabicWeight: '51.00', karat: 21, goldEquivalent21Snapshot: snapshot('51.00', 21, 5100) }),
    ];
    const result = projections(entries);
    expect([result.central, result.trial, result.ledger, result.balanceSheet, result.scrapAnalysis]).toEqual([51, 51, 51, 51, 51]);
    expect(result.ledgerFinal).toBe(result.central);
  });

  it('formats a floating-point value near 51.005 consistently without mutating raw balances', () => {
    const result = projections([entry({ id: 'floating', weight: '51.005', arabicWeight: '51.005', karat: 21 })]);
    expect([result.trial, result.ledger, result.balanceSheet, result.scrapAnalysis]).toEqual(Array(4).fill(result.central));
    expect([result.central, result.trial, result.ledger, result.balanceSheet, result.scrapAnalysis].map(value => formatWeight(value))).toEqual(Array(5).fill(formatWeight(result.central)));
    expect(result.computed.balances.get(merchant.id!)!.goldE21Balance).toBe(51.005);
  });

  it('keeps opening, scrap-in, scrap-out, and settlement in one period on the same raw path', () => {
    const entries = [
      entry({ id: 'opening', operationKind: 'opening', debit: inventory.name, debitAccountId: inventory.id, weight: '10', arabicWeight: '10', karat: 21 }),
      entry({ id: 'scrap-in', operationKind: 'purchase', date: '2026-06-02', debit: scrap.name, debitAccountId: scrap.id, weight: '5', arabicWeight: '5', karat: 21 }),
      entry({ id: 'scrap-out', operationKind: 'transfer', date: '2026-06-03', debit: merchant.name, debitAccountId: merchant.id, credit: scrap.name, creditAccountId: scrap.id, weight: '2', arabicWeight: '2', karat: 21 }),
      entry({ id: 'settlement', operationKind: 'merchant_settlement', date: '2026-06-04', debit: merchant.name, debitAccountId: merchant.id, credit: inventory.name, creditAccountId: inventory.id, weight: '1', arabicWeight: '1', karat: 21 }),
    ];
    const result = projections(entries);
    expect([result.central, result.trial, result.ledger, result.balanceSheet, result.scrapAnalysis]).toEqual([12, 12, 12, 12, 12]);
  });

  it('uses standard21Weight once and never double-converts actualWeight', () => {
    const result = projections([entry({ id: '18k', weight: '59.50', arabicWeight: '60.00', karat: 18, goldEquivalent21Snapshot: snapshot('59.50', 18, 5100) })]);
    expect([result.central, result.trial, result.ledger, result.balanceSheet, result.scrapAnalysis]).toEqual([51, 51, 51, 51, 51]);
  });

  it('does not change closing balance when journal order changes', () => {
    const entries = [
      entry({ id: 'a', operationNo: '1', weight: '12.34', arabicWeight: '12.34', karat: 21 }),
      entry({ id: 'b', operationNo: '2', debit: merchant.name, debitAccountId: merchant.id, credit: inventory.name, creditAccountId: inventory.id, weight: '2.11', arabicWeight: '2.11', karat: 21 }),
      entry({ id: 'c', operationNo: '3', weight: '40.77', arabicWeight: '40.77', karat: 21 }),
    ];
    expect(projections(entries).central).toBe(projections([...entries].reverse()).central);
    expect(projections(entries).trial).toBe(projections([...entries].reverse()).trial);
  });

  it('ends Ledger running balance at the exact AccountBalancesResult raw value', () => {
    const result = projections([entry({ id: 'running', weight: '51.00', arabicWeight: '51.00', karat: 21 })]);
    expect(result.ledgerFinal).toBe(result.central);
  });

  it('rounds only through formatWeight and preserves the engine raw value', () => {
    const result = projections([entry({ id: 'presentation', weight: '51.005', arabicWeight: '51.005', karat: 21 })]);
    const before = result.computed.balances.get(merchant.id!)!.goldE21Balance;
    formatWeight(before);
    expect(result.computed.balances.get(merchant.id!)!.goldE21Balance).toBe(before);
    expect(before).toBe(51.005);
  });
});
