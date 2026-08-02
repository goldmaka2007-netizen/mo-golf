import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import {
  BALANCE_ENGINE_VERSION,
  buildBalanceEngineGoldenHashes,
  computeAccountBalances,
  computePeriodAccountBalances,
  type AccountBalancesResult,
} from '../engine';
import { buildTrialBalanceReport } from '../trialBalanceReport';
import { buildFinancialPositionReport } from '../financialPositionReport';
import { buildWeightedPartyBalances } from '../scrapAnalysis';
import { buildInventoryCycleReport } from '../inventoryCycleReport';
import { buildEquityStatementReport, type EquityStatementReport } from '../equityStatementReport';
import { buildIncomeStatementReport } from '../incomeStatementReport';
import { validateNewAccountMetadata } from '../accountMetadataValidation';

const account = (patch: Partial<Account>): Account => ({
  id: 'account', name: 'account', mainType: 'legacy', subType: 'legacy', balanceNature: 'legacy', userId: 'u',
  type: 'other', metal: null, is_inventory: false, ...patch,
});
const cash = account({ id: 'cash', name: 'Cash', type: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash' });
const gold = account({ id: 'gold', name: 'Gold', type: 'gold_product', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', metal: 'gold', is_inventory: true, karat: '21' });
const silver = account({ id: 'silver', name: 'Silver', type: 'silver', canonicalMainType: 'assets', canonicalSubType: 'inventory_silver', metal: 'silver', is_inventory: true });
const cashCapital = account({ id: 'cash-capital', name: 'Cash capital', canonicalMainType: 'equity', canonicalSubType: 'capital' });
const silverCapital = account({ id: 'silver-capital', name: 'Silver capital', canonicalMainType: 'equity', canonicalSubType: 'capital', metal: 'silver' });
const payable = account({ id: 'payable', name: 'Payable', type: 'merchant', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', merchantDirection: 'payable', metal: 'gold' });
const receivable = account({ id: 'receivable', name: 'Receivable', type: 'merchant', canonicalMainType: 'assets', canonicalSubType: 'merchant_gold', merchantDirection: 'receivable', metal: 'gold' });
const accounts = [cash, gold, silver, cashCapital, silverCapital, payable, receivable];
const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', tx: 'test', operationKind: 'opening', debit: '', credit: '', date: '2026-01-01', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});
const entries: Entry[] = [
  entry({ id: 'cash-opening', operationNo: '1', debit: cash.name, debitAccountId: cash.id, credit: cashCapital.name, creditAccountId: cashCapital.id, cash: '100' }),
  entry({ id: 'gold-opening', operationNo: '2', debit: gold.name, debitAccountId: gold.id, credit: payable.name, creditAccountId: payable.id, weight: '10', karat: 21 }),
  entry({ id: 'silver-opening', operationNo: '3', debit: silver.name, debitAccountId: silver.id, credit: silverCapital.name, creditAccountId: silverCapital.id, weight: '5' }),
  entry({ id: 'payable-settlement', operationNo: '4', date: '2026-02-01', operationKind: 'merchant_settlement', debit: payable.name, debitAccountId: payable.id, credit: gold.name, creditAccountId: gold.id, weight: '2', karat: 21 }),
  entry({ id: 'receivable-opening', operationNo: '5', date: '2026-02-02', debit: receivable.name, debitAccountId: receivable.id, credit: gold.name, creditAccountId: gold.id, weight: '1', karat: 21 }),
];
const emptyEquityDimension = () => ({ additions: { total: 0, accounts: {} }, deductions: { total: 0, accounts: {} }, netProfit: 0, totalChange: 0 });
const equity: EquityStatementReport = { cash: emptyEquityDimension(), gold: emptyEquityDimension(), silver: emptyEquityDimension(), accs: emptyEquityDimension() };
const dimensionValue = (result: AccountBalancesResult, id: string, dimension: 'cash' | 'gold' | 'silver'): number => {
  const row = result.balances.get(id)!;
  return dimension === 'cash' ? row.cashBalance : dimension === 'gold' ? row.goldE21Balance : row.silverBalance;
};
const totals = (result: AccountBalancesResult, dimension: 'cash' | 'gold' | 'silver') => {
  const output = { assets: 0, liabilities: 0, equity: 0 };
  result.balances.forEach(row => { if (row.mainType in output) output[row.mainType as keyof typeof output] += dimension === 'cash' ? row.cashBalance : dimension === 'gold' ? row.goldE21Balance : row.silverBalance; });
  return output;
};

describe('balance engine production hardening', () => {
  it('is deterministic across Firestore input ordering and has frozen golden hashes', () => {
    const first = computeAccountBalances(entries, accounts);
    const reversed = computeAccountBalances([...entries].reverse(), [...accounts].reverse());
    expect([...reversed.balances]).toEqual([...first.balances]);
    expect(buildBalanceEngineGoldenHashes(reversed)).toEqual(buildBalanceEngineGoldenHashes(first));
    expect(buildBalanceEngineGoldenHashes(first)).toEqual({ structuralHash: '743bd29b', numericHash: '082097e0' });
  });

  it('keeps ledger movements and balance engine closing balances invariant', () => {
    const result = computeAccountBalances(entries, accounts);
    for (const [accountId, row] of result.balances) {
      const movement = result.movements.get(accountId)!;
      const cashSigned = movement.cash.debit - movement.cash.credit;
      const goldSigned = movement.gold.debit - movement.gold.credit;
      const silverSigned = movement.silver.debit - movement.silver.credit;
      const nature = ['liabilities', 'equity', 'revenue'].includes(row.mainType) ? -1 : 1;
      expect(row.cashBalance * nature).toBeCloseTo(cashSigned, 8);
      expect(row.goldE21Balance * nature, accountId).toBeCloseTo(goldSigned, 8);
      expect(row.silverBalance * nature).toBeCloseTo(silverSigned, 8);
    }
  });

  it('satisfies Assets - Liabilities = Equity for cash, gold, and silver', () => {
    const result = computeAccountBalances(entries, accounts);
    for (const dimension of ['cash', 'gold', 'silver'] as const) {
      const value = totals(result, dimension);
      expect(value.assets - value.liabilities).toBeCloseTo(value.equity, 8);
    }
  });

  it('satisfies Opening + Transactions = Closing for every account and dimension', () => {
    const period = computePeriodAccountBalances(entries, accounts, '2026-02-01', '2026-02-28');
    for (const id of period.closing.balances.keys()) {
      for (const dimension of ['cash', 'gold', 'silver'] as const) {
        expect(dimensionValue(period.opening, id, dimension) + dimensionValue(period.period, id, dimension)).toBeCloseTo(dimensionValue(period.closing, id, dimension), 8);
      }
    }
  });

  it('derives merchant presentation direction from positive, negative, and zero balances', () => {
    const positive = computeAccountBalances([entry({ debit: gold.name, debitAccountId: gold.id, credit: payable.name, creditAccountId: payable.id, weight: '2', karat: 21 })], accounts);
    const negative = computeAccountBalances([entry({ debit: payable.name, debitAccountId: payable.id, credit: gold.name, creditAccountId: gold.id, weight: '2', karat: 21 })], accounts);
    const receivablePositive = computeAccountBalances([entry({ debit: receivable.name, debitAccountId: receivable.id, credit: gold.name, creditAccountId: gold.id, weight: '2', karat: 21 })], accounts);
    const receivableNegative = computeAccountBalances([entry({ debit: gold.name, debitAccountId: gold.id, credit: receivable.name, creditAccountId: receivable.id, weight: '2', karat: 21 })], accounts);
    expect(positive.balances.get('payable')?.actualMerchantDirection).toBe('payable');
    expect(negative.balances.get('payable')?.actualMerchantDirection).toBe('receivable');
    expect(receivablePositive.balances.get('receivable')?.actualMerchantDirection).toBe('receivable');
    expect(receivableNegative.balances.get('receivable')?.actualMerchantDirection).toBe('payable');
    expect(computeAccountBalances([], accounts).balances.get('payable')?.actualMerchantDirection).toBe('settled');
  });

  it('feeds Trial Balance, Balance Sheet, Merchant Report, and Inventory Report from the same engine version', () => {
    const central = computeAccountBalances(entries, accounts);
    const period = computePeriodAccountBalances(entries, accounts, '2026-01-01', '2026-12-31');
    const trial = buildTrialBalanceReport(period, 'gold');
    const income = buildIncomeStatementReport(central);
    const centralEquity = buildEquityStatementReport(central, income);
    const position = buildFinancialPositionReport(central, centralEquity);
    const merchants = buildWeightedPartyBalances(central);
    const inventory = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters: { periodPreset: 'custom', startDate: '2026-01-01', endDate: '2026-12-31', accountId: 'all', movementKind: 'all' }, goldPrice: 0, silverPrice: 0 });
    expect([trial.balanceEngineVersion, income.balanceEngineVersion, position.balanceEngineVersion, merchants.balanceEngineVersion, inventory.balanceEngineVersion]).toEqual(Array(5).fill(BALANCE_ENGINE_VERSION));
    expect(inventory.summary.closing).toBeCloseTo(central.balances.get('gold')!.goldE21Balance, 8);
  });

  it('keeps old incomplete accounts visible in Unclassified and reports fallback counts', () => {
    const oldAccounts = [account({ id: 'legacy-a', name: 'Legacy A', type: undefined, metal: undefined, is_inventory: undefined }), account({ id: 'legacy-b', name: 'Legacy B', canonicalMainType: undefined, type: undefined, metal: undefined, is_inventory: undefined })];
    const result = computeAccountBalances([], oldAccounts);
    expect(result.balances.size).toBe(oldAccounts.length);
    expect([...result.balances.values()].every(row => row.mainType === 'unclassified')).toBe(true);
    expect(result.legacyFallbackReport.unclassifiedAccountCount).toBe(2);
  });

  it('rejects only new accounts missing required metadata', () => {
    expect(validateNewAccountMetadata({ name: 'new' })).toEqual(expect.arrayContaining([
      'Missing required account metadata: canonicalMainType', 'Missing required account metadata: type', 'Missing required account metadata: metal', 'Missing required account metadata: is_inventory',
    ]));
    expect(validateNewAccountMetadata({ canonicalMainType: 'assets', type: 'other', metal: null, is_inventory: false })).toEqual([]);
  });
});