import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { balanceDirectionLabel, resolveBalanceDirection } from '../balanceDirection';
import { computeAccountBalances, computePeriodAccountBalances } from '../engine';
import { buildEquityStatementReport } from '../equityStatementReport';
import { buildFinancialPositionReport } from '../financialPositionReport';
import { buildIncomeStatementReport } from '../incomeStatementReport';
import { buildLedgerCsv, buildLedgerReport, formatBalance } from '../ledgerReport';
import { buildTrialBalanceReport } from '../trialBalanceReport';

const cash: Account = {
  id: 'cash', name: 'الخزنة', mainType: 'asset', canonicalMainType: 'assets',
  subType: 'cash', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash',
  metal: null, is_inventory: false, userId: 'u',
};

const merchant = (
  id: string,
  name: string,
  direction: 'payable' | 'receivable',
): Account => ({
  id,
  name,
  mainType: direction === 'payable' ? 'liability' : 'asset',
  canonicalMainType: direction === 'payable' ? 'liabilities' : 'assets',
  subType: 'merchant',
  canonicalSubType: 'merchant_gold',
  balanceNature: 'gold',
  type: 'merchant',
  merchantDirection: direction,
  metal: 'gold',
  is_inventory: false,
  userId: 'u',
});

const settlement = (
  id: string,
  merchantAccount: Account,
  merchantSide: 'debit' | 'credit',
  amount: number,
): Entry => ({
  id,
  seq: Number(id.replace(/D/g, '')) || 1,
  operationNo: id,
  operationKind: 'merchant_settlement',
  tx: 'حساب تاجر ذهب',
  date: '2026-01-10',
  debit: merchantSide === 'debit' ? merchantAccount.name : cash.name,
  debitAccountId: merchantSide === 'debit' ? merchantAccount.id : cash.id,
  credit: merchantSide === 'credit' ? merchantAccount.name : cash.name,
  creditAccountId: merchantSide === 'credit' ? merchantAccount.id : cash.id,
  cash: String(amount),
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u',
});

const directionFor = (signedBalance: number, account: Account) =>
  resolveBalanceDirection({ signedBalance, account });

describe('central balance direction contract across merchant reports', () => {
  it('keeps Alaa Saleh 11,225 credit in Trial Balance, Ledger, Balance Sheet, and merchant projection', () => {
    const alaa = merchant('alaa-saleh', 'علاء صالح', 'payable');
    const accounts = [cash, alaa];
    const entries = [settlement('alaa-11225', alaa, 'credit', 11225)];
    const computed = computeAccountBalances(entries, accounts);
    const period = computePeriodAccountBalances(entries, accounts, '2026-01-01', '2026-12-31');
    const engineBalance = computed.balances.get(alaa.id!)!;
    const ledger = buildLedgerReport(entries, accounts, alaa, 'cash', '2026-01-01', '2026-12-31');
    const trial = buildTrialBalanceReport(period, 'cash');
    const trialRow = trial.groups.flatMap(group => group.rows).find(row => row.accountName === alaa.name)!;
    const income = buildIncomeStatementReport(computed);
    const position = buildFinancialPositionReport(computed, buildEquityStatementReport(computed, income));
    const liability = position.cash.liabilities.categories.merchant_gold.details.find(row => row.accountId === alaa.id);

    expect(engineBalance.cashBalance).toBe(11225);
    expect(directionFor(engineBalance.cashBalance, alaa)).toBe('credit');
    expect(trialRow.closingDebit).toBe(0);
    expect(trialRow.closingCredit).toBe(11225);
    expect(ledger.closingBalance).toBe(engineBalance.cashBalance);
    expect(formatBalance(ledger.closingBalance, 'cash', ledger.normalBalance)).toContain('دائن');
    expect(liability?.val).toBe(11225);
    expect(balanceDirectionLabel(directionFor(engineBalance.cashBalance, alaa))).toBe('دائن');
  });

  it('shows an actual debit merchant balance as debit everywhere', () => {
    const payable = merchant('payable-debit', 'Payable temporarily debit', 'payable');
    const entries = [settlement('move-2', payable, 'debit', 2000)];
    const accounts = [cash, payable];
    const computed = computeAccountBalances(entries, accounts);
    const balance = computed.balances.get(payable.id!)!;
    const ledger = buildLedgerReport(entries, accounts, payable, 'cash', '2026-01-01', '2026-12-31');

    expect(balance.cashBalance).toBe(-2000);
    expect(directionFor(balance.cashBalance, payable)).toBe('debit');
    expect(ledger.closingBalance).toBe(balance.cashBalance);
    expect(formatBalance(ledger.closingBalance, 'cash', ledger.normalBalance)).toContain('مدين');
    expect(balanceDirectionLabel(directionFor(balance.cashBalance, payable))).toBe('مدين');
  });

  it('shows a zero merchant balance as settled', () => {
    const payable = merchant('settled', 'Settled merchant', 'payable');
    const computed = computeAccountBalances([], [cash, payable]);
    const balance = computed.balances.get(payable.id!)!;
    expect(directionFor(balance.cashBalance, payable)).toBe('settled');
    expect(balanceDirectionLabel(directionFor(balance.cashBalance, payable))).toBe('مسدد');
    expect(formatBalance(0, 'cash', 'credit')).toContain('مسدد');
    expect(balance.actualMerchantDirection).toBe('settled');
  });

  it('does not let payable metadata override an actual debit sign', () => {
    const payable = merchant('payable-opposite', 'Payable opposite', 'payable');
    const balance = computeAccountBalances([settlement('move-4', payable, 'debit', 750)], [cash, payable]).balances.get(payable.id!)!;
    expect(balance.merchantDirection).toBe('payable');
    expect(directionFor(balance.cashBalance, payable)).toBe('debit');
  });

  it('does not let receivable metadata override an actual credit sign', () => {
    const receivable = merchant('receivable-opposite', 'Receivable opposite', 'receivable');
    const balance = computeAccountBalances([settlement('move-5', receivable, 'credit', 900)], [cash, receivable]).balances.get(receivable.id!)!;
    expect(balance.merchantDirection).toBe('receivable');
    expect(balance.cashBalance).toBe(-900);
    expect(directionFor(balance.cashBalance, receivable)).toBe('credit');
    expect(balanceDirectionLabel(directionFor(balance.cashBalance, receivable))).toBe('دائن');
  });

  it('preserves the engine sign instead of applying an absolute-value conversion', () => {
    const payable = merchant('signed', 'Signed merchant', 'payable');
    const balance = computeAccountBalances([settlement('move-6', payable, 'debit', 333)], [cash, payable]).balances.get(payable.id!)!;
    expect(balance.cashBalance).toBe(-333);
  });

  it('keeps Ledger final balance exactly equal to AccountBalancesResult', () => {
    const payable = merchant('engine-equality', 'Engine equality merchant', 'payable');
    const entries = [
      settlement('move-7', payable, 'credit', 12000),
      settlement('move-8', payable, 'debit', 775),
    ];
    const computed = computeAccountBalances(entries, [cash, payable]);
    const ledger = buildLedgerReport(entries.reverse(), [cash, payable], payable, 'cash', '2026-01-01', '2026-12-31');
    expect(ledger.closingBalance).toBe(computed.balances.get(payable.id!)?.cashBalance);
    expect(ledger.closingBalance).toBe(11225);
    expect(ledger.rows.at(-1)?.balance).toBe(ledger.closingBalance);
  });

  it('uses the same direction in Ledger CSV export', () => {
    const alaa = merchant('alaa-csv', 'علاء صالح', 'payable');
    const entries = [settlement('move-9', alaa, 'credit', 11225)];
    const report = buildLedgerReport(entries, [cash, alaa], alaa, 'cash', '2026-01-01', '2026-12-31');
    const csv = buildLedgerCsv({ accountName: alaa.name, dimension: 'cash', startDate: '2026-01-01', endDate: '2026-12-31', report, rows: report.rows, goldDisplayMode: 'equivalent21' });
    expect(csv).toContain('11,225');
    expect(csv).toContain('دائن');
  });
});
