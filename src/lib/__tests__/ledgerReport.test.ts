import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildLedgerAccountSelection, buildLedgerCsv, buildLedgerReport, filterLedgerRows, formatBalance, formatLedgerAmount, getAvailableDimensions, getVisibleOperationNumber } from '../ledgerReport';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'ذهب عيار 18', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', userId: 'u' },
  { id: 'silver', name: 'فضة', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', metal: 'silver', userId: 'u' },
  { id: 'accessory', name: 'ملحقات', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', userId: 'u' },
  { id: 'sales', name: 'مبيعات', mainType: 'revenue', subType: 'sales', balanceNature: 'cash', type: 'other', userId: 'u' },
  { id: 'mixed', name: 'حساب مختلط', mainType: 'asset', subType: 'other', balanceNature: 'مختلط (ذهب + نقدي)', type: 'other', userId: 'u' },
];
const entry = (value: Partial<Entry>): Entry => ({ seq: 1, tx: 'بيع', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...value });

describe('ledger report', () => {
  const cash = accounts[0], gold = accounts[1], silver = accounts[2], accessory = accounts[3], mixed = accounts[5];
  it('shows dynamic dimensions including accessory quantity', () => {
    expect(getAvailableDimensions(cash, [entry({ debit: 'الخزنة', credit: 'مبيعات', cash: '100' })], accounts)).toEqual(['cash']);
    expect(getAvailableDimensions(gold, [entry({ debit: 'ذهب عيار 18', credit: 'الخزنة', weight: '10', karat: 18 })], accounts)).toEqual(['gold']);
    expect(getAvailableDimensions(mixed, [entry({ debit: 'حساب مختلط', credit: 'الخزنة', cash: '100', weight: '10', karat: 18 })], accounts)).toEqual(['cash', 'gold']);
    expect(getAvailableDimensions(accessory, [entry({ debit: 'ملحقات', credit: 'الخزنة', weight: '5' })], accounts)).toEqual(['quantity']);
  });
  it('keeps a historical tab even at zero balance and calculates opening/running balances oldest first', () => {
    const entries = [entry({ date: '2026-01-03', seq: 3, invoiceNumber: 'A3', debit: 'الخزنة', credit: 'مبيعات', cash: '50' }), entry({ date: '2026-01-01', seq: 1, invoiceNumber: 'A1', debit: 'الخزنة', credit: 'مبيعات', cash: '100' }), entry({ date: '2026-01-02', seq: 2, invoiceNumber: 'A2', debit: 'مبيعات', credit: 'الخزنة', cash: '100' })];
    expect(getAvailableDimensions(cash, entries, accounts)).toEqual(['cash']);
    const report = buildLedgerReport(entries, accounts, cash, 'cash', '2026-01-03', '2026-01-03');
    expect(report.openingBalance).toBe(0); expect(report.rows[0].balance).toBe(50); expect(report.rows[0].operationNumber).toBe('A3');
  });
  it('supports one day, opposite account labels, filters, and credit nature labels', () => {
    const rows = buildLedgerReport([entry({ invoiceNumber: 'OP-1', debit: 'الخزنة', credit: 'مبيعات', cash: '20' })], accounts, cash, 'cash', '2026-01-01', '2026-01-01');
    expect(rows.rows[0].oppositeAccount).toBe('مبيعات'); expect(filterLedgerRows(rows.rows, 'بيع', 'مبيعات')).toHaveLength(1); expect(formatBalance(-10, 'cash')).toContain('دائن');
  });
  it('uses 21-equivalent gold by default and original weight only for movement display metadata', () => {
    const report = buildLedgerReport([entry({ debit: 'ذهب عيار 18', credit: 'الخزنة', weight: '10', karat: 18, arabicWeight: '8.57' })], accounts, gold, 'gold', '2026-01-01', '2026-01-01');
    expect(report.rows[0].debit).toBe(8.57); expect(report.rows[0].originalWeight).toBe(10); expect(report.closingBalance).toBe(8.57);
  });
  it('uses actual silver grams, safely lacks original gold data, and exports BOM CSV', () => {
    const silverReport = buildLedgerReport([entry({ debit: 'فضة', credit: 'الخزنة', weight: '7.5' })], accounts, silver, 'silver', '2026-01-01', '2026-01-01');
    expect(silverReport.rows[0].debit).toBe(7.5);
    const goldReport = buildLedgerReport([entry({ debit: 'ذهب عيار 18', credit: 'الخزنة', arabicWeight: '4' })], accounts, gold, 'gold', '2026-01-01', '2026-01-01');
    expect(goldReport.rows[0].originalWeight).toBeUndefined();
    const csv = buildLedgerCsv({ accountName: 'الخزنة', dimension: 'cash', startDate: '2026-01-01', endDate: '2026-01-01', report: silverReport, rows: [], goldDisplayMode: 'equivalent21' });
    expect(csv.startsWith('\uFEFF')).toBe(true); expect(csv).toContain('اسم الحساب');
  });
});

describe('ledger account selection and account-specific dimensions', () => {
  const merchant: Account = { id: 'merchant-1', name: 'merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' };
  it('deduplicates only canonical IDs and never derives selectable accounts from entries', () => {
    const selection = buildLedgerAccountSelection([accounts[1], { ...accounts[1] }, accounts[0]]);
    expect(selection.flatMap(group => group.accounts).filter(entity => entity.sourceEntityId === 'gold')).toHaveLength(1);
    expect(selection.flatMap(group => group.accounts).map(entity => entity.sourceEntityId)).not.toContain('entry-only-account');
  });
  it('keeps merchant cash and gold while product sale cash never creates a product cash tab', () => {
    const productSale = entry({ debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', cash: '1000', weight: '2', karat: 21 });
    const merchantEntry = entry({ debit: 'merchant', debitAccountId: 'merchant-1', credit: 'cash', creditAccountId: 'cash', cash: '50', weight: '1', karat: 21 });
    const master = [...accounts, merchant];
    expect(getAvailableDimensions(accounts[1], [productSale], master)).toEqual(['cash', 'gold']);
    expect(getAvailableDimensions(merchant, [merchantEntry], master)).toEqual(['cash', 'gold']);
    expect(buildLedgerReport([productSale], master, accounts[1], 'cash', '2026-01-01', '2026-01-01').rows).toHaveLength(1);
  });
  it('keeps the metal carrying value out of the operational merchant cash statement', () => {
    const receipt = entry({
      id: 'merchant-receipt',
      tx: 'تاجر ذهب',
      debit: accounts[1].name,
      debitAccountId: accounts[1].id,
      credit: merchant.name,
      creditAccountId: merchant.id,
      cash: '125',
      weight: '10',
      arabicWeight: '10',
      transactionGoldValueMinor: 500_000,
      workmanshipCostMinor: 12_500,
    });
    const costTimeline = {
      valid: true,
      costDataComplete: true,
      results: [{
        operationId: 'merchant-receipt',
        entry: receipt,
        classification: 'merchant_receipt',
        inventoryAccountId: accounts[1].id,
        destinationInventoryAccountId: accounts[1].id,
        merchantLiabilityIncreaseMinor: 500_000,
      }],
    } as any;
    const master = [...accounts, merchant];
    const financial = buildLedgerReport([receipt], master, merchant, 'cash', receipt.date, receipt.date, [], {
      enableFinancialProjection: true,
      costTimeline,
      merchantStatementMode: 'financial',
    });
    const operational = buildLedgerReport([receipt], master, merchant, 'cash', receipt.date, receipt.date, [], {
      enableFinancialProjection: true,
      costTimeline,
      merchantStatementMode: 'operational',
    });

    expect(financial.totalCredit).toBe(5_125);
    expect(operational.totalCredit).toBe(125);
    expect(operational.rows).toHaveLength(1);
  });
  it('uses invoiceNumber before the legacy seq fallback', () => {
    expect(getVisibleOperationNumber(entry({ invoiceNumber: 'INV-4', seq: 9 }))).toBe('INV-4');
    expect(getVisibleOperationNumber(entry({ invoiceNumber: undefined, seq: 9 }))).toBe('9');
  });
});
describe('canonical ledger entities', () => {
  it('collapses account and adapter records that share the canonical product or merchant entity ID', () => {
    const productAdapter = { ...accounts[1], id: 'adapter-product', productId: 'gold' } as Account & { productId: string };
    const merchant: Account = { id: 'merchant-1', name: 'merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' };
    const merchantAdapter = { ...merchant, id: 'adapter-merchant', merchantId: 'merchant-1' } as Account & { merchantId: string };
    const entities = buildLedgerAccountSelection([accounts[1], productAdapter, merchant, merchantAdapter]).flatMap(group => group.accounts);
    expect(entities.filter(entity => entity.ledgerEntityId === 'product:gold')).toHaveLength(1);
    expect(entities.filter(entity => entity.ledgerEntityId === 'merchant:merchant-1')).toHaveLength(1);
  });
});
describe('merchant metal classification', () => {
  const goldMerchant: Account = { id: 'mg', name: 'gold merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' };
  const silverMerchant: Account = { id: 'ms', name: 'silver merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'silver', type: 'merchant', metal: 'silver', userId: 'u' };
  const legacySilver: Account = { id: 'legacy-silver', name: 'legacy merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'cash', type: 'merchant', userId: 'u' };

  it('shows cash plus gold for a gold merchant and cash plus silver for a silver merchant', () => {
    expect(getAvailableDimensions(goldMerchant, [], [goldMerchant])).toEqual(['cash', 'gold']);
    expect(getAvailableDimensions(silverMerchant, [], [silverMerchant])).toEqual(['cash', 'silver']);
  });
  it('never applies the generic merchant fallback as gold to a silver merchant', () => {
    expect(getAvailableDimensions(silverMerchant, [entry({ debit: 'silver merchant', debitAccountId: 'ms', credit: 'cash', cash: '10', weight: '2', karat: 21 })], [silverMerchant, accounts[0]])).not.toContain('gold');
  });
  it('uses canonical silver history for a legacy merchant without metal metadata', () => {
    const history = entry({ debit: 'legacy merchant', debitAccountId: 'legacy-silver', credit: 'silver inventory', creditAccountId: 'silver', weight: '4', karat: undefined });
    expect(getAvailableDimensions(legacySilver, [history], [legacySilver, accounts[2]])).toEqual(['cash', 'silver']);
  });
  it('keeps silver visible after historical silver activity returns the balance to zero', () => {
    const movements = [
      entry({ debit: 'silver merchant', debitAccountId: 'ms', credit: 'silver inventory', creditAccountId: 'silver', weight: '4' }),
      entry({ debit: 'silver inventory', debitAccountId: 'silver', credit: 'silver merchant', creditAccountId: 'ms', weight: '4' }),
    ];
    expect(getAvailableDimensions(silverMerchant, movements, [silverMerchant, accounts[2]])).toEqual(['cash', 'silver']);
  });
});

describe('final ledger selection model', () => {
  const sameEntity = (id: string): Account => ({ id, name: 'one merchant', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' });
  it('has exactly one visible row for duplicate Firestore documents of one entity', () => {
    expect(buildLedgerAccountSelection([sameEntity('firestore-a'), sameEntity('firestore-b')]).flatMap(group => group.accounts)).toHaveLength(1);
  });
  it('renders one row when adapters run twice, including React StrictMode-like repeat execution', () => {
    const first = buildLedgerAccountSelection([sameEntity('firestore-a'), { ...sameEntity('adapter'), merchantId: 'firestore-a' } as Account & { merchantId: string }]);
    const second = buildLedgerAccountSelection([sameEntity('firestore-a'), { ...sameEntity('adapter'), merchantId: 'firestore-a' } as Account & { merchantId: string }]);
    expect(first.flatMap(group => group.accounts)).toHaveLength(1);
    expect(second.flatMap(group => group.accounts)).toHaveLength(1);
  });
});

describe('ledger opening-balance presentation', () => {
  const openingCash = entry({ id: 'open-1', operationKind: 'opening', date: '2026-01-01', debit: 'الخزنة', credit: 'مبيعات', cash: '100' });
  const cashMove = entry({ id: 'move-1', date: '2026-01-02', debit: 'الخزنة', credit: 'مبيعات', cash: '25' });
  it('keeps an opening-kind entry on the period start date in opening balance only', () => {
    const report = buildLedgerReport([openingCash, cashMove], accounts, accounts[0], 'cash', '2026-01-01', '2026-01-31');
    expect(report.openingBalance).toBe(100); expect(report.rows).toHaveLength(1); expect(report.totalDebit).toBe(25); expect(report.closingBalance).toBe(125);
  });
  it('adds all openings and prior non-opening activity for later periods', () => {
    const report = buildLedgerReport([openingCash, entry({ ...openingCash, id: 'open-2', cash: '20' }), cashMove, entry({ id: 'march', date: '2026-03-01', debit: 'الخزنة', credit: 'مبيعات', cash: '5' })], accounts, accounts[0], 'cash', '2026-03-01', '2026-03-31');
    expect(report.openingBalance).toBe(145); expect(report.rows).toHaveLength(1); expect(report.totalDebit).toBe(5); expect(report.rows[0].balance).toBe(150);
  });
  it('excludes voided openings and formats cash/weight explicitly', () => {
    const report = buildLedgerReport([openingCash, entry({ ...openingCash, id: 'void', cash: '99', isVoided: true } as Entry & { isVoided: boolean })], accounts, accounts[0], 'cash', '2026-01-01', '2026-01-31');
    expect(report.openingBalance).toBe(100); expect(formatLedgerAmount(125000.75, 'cash')).toContain('125,001'); expect(formatLedgerAmount(10.5, 'gold')).toContain('10.50'); expect(formatLedgerAmount(348.1, 'silver')).toContain('348.10');
  });
  it('exports one opening balance row and no opening movement row', () => {
    const report = buildLedgerReport([openingCash, cashMove], accounts, accounts[0], 'cash', '2026-01-01', '2026-01-31');
    const csv = buildLedgerCsv({ accountName: accounts[0].name, dimension: 'cash', startDate: '2026-01-01', endDate: '2026-01-31', report, rows: report.rows, goldDisplayMode: 'equivalent21' });
    expect(csv).toContain('رصيد أول المدة'); expect(csv).toContain('100 جنيه'); expect(csv).not.toContain('open-1');
  });
});
