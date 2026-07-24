import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildLedgerReport } from '../ledgerReport';
import { buildTrialBalanceCsv, buildTrialBalanceReport } from '../trialBalanceReport';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold-merchant', name: 'تاجر الذهب', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' },
  { id: 'silver-merchant', name: 'تاجر الفضة', mainType: 'liability', subType: 'merchant', balanceNature: 'silver', type: 'merchant', metal: 'silver', userId: 'u' },
  { id: 'gold-product', name: 'صنف ذهب', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', userId: 'u' },
];
const entry = (value: Partial<Entry>): Entry => ({ seq: 1, tx: 'بيع', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...value });

describe('trial balance report', () => {
  const entries = [
    entry({ id: 'opening-1', operationKind: 'opening', debit: 'الخزنة', debitAccountId: 'cash', credit: 'تاجر الذهب', creditAccountId: 'gold-merchant', cash: '100', weight: '2', arabicWeight: '2', karat: 21 }),
    entry({ id: 'prior', date: '2026-01-10', debit: 'الخزنة', debitAccountId: 'cash', credit: 'تاجر الذهب', creditAccountId: 'gold-merchant', cash: '20', weight: '1', arabicWeight: '1', karat: 21 }),
    entry({ id: 'period', date: '2026-02-01', debit: 'الخزنة', debitAccountId: 'cash', credit: 'تاجر الذهب', creditAccountId: 'gold-merchant', cash: '30', weight: '3', arabicWeight: '3', karat: 21 }),
    entry({ id: 'void', date: '2026-02-01', debit: 'الخزنة', debitAccountId: 'cash', credit: 'تاجر الذهب', creditAccountId: 'gold-merchant', cash: '999', isVoided: true } as Entry & { isVoided: boolean }),
  ];
  it('reconciles every row with the shared general-ledger summary and keeps openings out of period movement', () => {
    const report = buildTrialBalanceReport(entries, accounts, 'cash', '2026-02-01', '2026-02-28');
    const row = report.groups.flatMap(group => group.rows).find(item => item.entityId === 'account:cash');
    const ledger = buildLedgerReport(entries, accounts, accounts[0], 'cash', '2026-02-01', '2026-02-28');
    expect(row).toMatchObject({ openingDebit: ledger.openingBalance, periodDebit: ledger.totalDebit, periodCredit: ledger.totalCredit, closingDebit: ledger.closingBalance });
    expect(row?.openingDebit).toBe(120); expect(row?.periodDebit).toBe(30);
  });
  it('allocates merchants by their real dimensions, excludes a gold product from cash, and hides zero-only rows', () => {
    const cash = buildTrialBalanceReport(entries, accounts, 'cash', '2026-02-01', '2026-02-28');
    const gold = buildTrialBalanceReport(entries, accounts, 'gold', '2026-02-01', '2026-02-28');
    const silver = buildTrialBalanceReport(entries, accounts, 'silver', '2026-02-01', '2026-02-28');
    expect(cash.groups.flatMap(group => group.rows).map(row => row.entityId)).toContain('merchant:gold-merchant');
    expect(cash.groups.flatMap(group => group.rows).map(row => row.entityId)).not.toContain('product:gold-product');
    expect(gold.groups.flatMap(group => group.rows).map(row => row.entityId)).toContain('merchant:gold-merchant');
    expect(silver.groups).toHaveLength(0);
  });
  it('exports Arabic-safe BOM CSV without entity or Firestore identifiers', () => {
    const report = buildTrialBalanceReport(entries, accounts, 'cash', '2026-02-01', '2026-02-28');
    const csv = buildTrialBalanceCsv([report], '2026-02-01', '2026-02-28');
    expect(csv.startsWith('\uFEFF')).toBe(true); expect(csv).toContain('الخزنة'); expect(csv).not.toContain('account:cash'); expect(csv).not.toContain('opening-1');
  });
});
describe('trial balance Arabic text integrity', () => {
  it('never emits mojibake markers in descriptions, group labels, or CSV labels', () => {
    const report = buildTrialBalanceReport([entry({ debit: 'cash', debitAccountId: 'cash', credit: 'gold-merchant', creditAccountId: 'gold-merchant', cash: '10' })], accounts, 'cash', '2026-01-01', '2026-01-01');
    const output = [
      ...report.groups.map(group => group.label),
      ...report.groups.flatMap(group => group.rows.map(row => row.description)),
      buildTrialBalanceCsv([report], '2026-01-01', '2026-01-01'),
    ].join('\n');
    expect(output).toContain('\u062e\u0632\u0646\u0629');
    expect(output).toContain('\u0627\u0644\u0623\u0635\u0648\u0644');
    expect(output).not.toMatch(/\u00c3|\u00c2|\u00d8|\u00d9|\ufffd/);
  });
});