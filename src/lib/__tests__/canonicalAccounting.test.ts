import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { auditAccountingCoverage, auditEntityClassification, auditGoldSurplusOperations, buildCanonicalAccountRegistry, buildCanonicalAccountingLegs, diagnoseMetalPostings, findUnbalancedMetalPostings } from '../canonicalAccounting';
import { loadPhase5GoldenDataset } from '../../test-fixtures/phase5GoldenDataset';
import { buildTrialBalanceReport } from '../trialBalanceReport';
const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: '', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold-product', name: 'حلق أطفال', mainType: 'asset', subType: '', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, userId: 'u' },
  { id: 'silver-scrap', name: 'كسر فضة', mainType: 'asset', subType: '', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' },
  { id: 'silver-equity', name: 'راس المال فضة', mainType: 'equity', subType: '', balanceNature: 'silver', type: 'other', metal: 'silver', userId: 'u' },
  { id: 'gold-equity', name: 'راس المال ذهب', mainType: 'equity', subType: '', balanceNature: 'gold', type: 'other', metal: 'gold', userId: 'u' },
];
const entry = (value: Partial<Entry>): Entry => ({ seq: 1, tx: '', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...value });
describe('canonical accounting legs', () => {
  it('includes an historical-only gold creditor without leaking it to cash or silver', () => {
    const entries = [entry({ id: 'alaa', operationKind: 'opening', debit: 'راس المال ذهب', debitAccountId: 'gold-equity', credit: 'الاء ياسر', arabicWeight: '25.19714286' })];
    const gold = buildTrialBalanceReport(entries, accounts, 'gold', '2026-01-01', '2026-12-31');
    const row = gold.groups.flatMap(g => g.rows).find(r => r.accountName === 'الاء ياسر');
    expect(row).toMatchObject({ group: 'liabilities', openingCredit: 25.19714286, closingCredit: 25.19714286 });
    expect(buildTrialBalanceReport(entries, accounts, 'cash', '2026-01-01', '2026-12-31').groups.flatMap(g => g.rows).some(r => r.accountName === 'الاء ياسر')).toBe(false);
    expect(buildTrialBalanceReport(entries, accounts, 'silver', '2026-01-01', '2026-12-31').groups.flatMap(g => g.rows).some(r => r.accountName === 'الاء ياسر')).toBe(false);
  });
  it('keeps silver opening assets and equity balanced', () => {
    const entries = [entry({ operationKind: 'opening', debit: 'كسر فضة', debitAccountId: 'silver-scrap', credit: 'راس المال فضة', creditAccountId: 'silver-equity', weight: '305' })];
    const report = buildTrialBalanceReport(entries, accounts, 'silver', '2026-01-01', '2026-12-31');
    expect(report.balanced).toBe(true); expect(report.groups.flatMap(g => g.rows).find(r => r.accountName === 'كسر فضة')?.openingDebit).toBe(305); expect(report.groups.flatMap(g => g.rows).find(r => r.accountName === 'راس المال فضة')?.openingCredit).toBe(305);
  });
  it('isolates cash and gold/silver ownership for sales and purchases', () => {
    const sale = entry({ operationKind: 'sale', debit: 'الخزنة', debitAccountId: 'cash', credit: 'حلق أطفال', creditAccountId: 'gold-product', cash: '14100', arabicWeight: '1.99' });
    const purchase = entry({ operationKind: 'purchase', debit: 'كسر فضة', debitAccountId: 'silver-scrap', credit: 'الخزنة', creditAccountId: 'cash', cash: '100', weight: '1.25' });
    const registry = buildCanonicalAccountRegistry(accounts, [sale, purchase]); const legs = buildCanonicalAccountingLegs([sale, purchase], registry);
    expect(legs.filter(l => l.sourceEntryId === '1' && l.dimension === 'cash').map(l => [l.accountName, l.side, l.amount])).toContainEqual(['الخزنة', 'debit', 14100]);
    expect(legs.some(l => l.accountName === 'حلق أطفال' && l.dimension === 'cash')).toBe(false); expect(legs.some(l => l.accountName === 'الخزنة' && l.dimension === 'gold')).toBe(false);
    expect(legs.some(l => l.accountName === 'كسر فضة' && l.dimension === 'silver' && l.side === 'debit' && l.amount === 1.25)).toBe(true); expect(legs.some(l => l.accountName === 'الخزنة' && l.dimension === 'cash' && l.side === 'credit' && l.amount === 100)).toBe(true);
    expect(auditAccountingCoverage([sale, purchase], registry, legs).namesWithValidMovementButNoLeg).toEqual([]);
  });
  it('does not flag valid cash sale and purchase metal movements', () => {
    const operations = [
      entry({ id: 'gold-sale', operationKind: 'sale', debit: 'الخزنة', debitAccountId: 'cash', credit: 'حلق أطفال', creditAccountId: 'gold-product', cash: '14100', arabicWeight: '1.99' }),
      entry({ id: 'gold-purchase', operationKind: 'purchase', debit: 'حلق أطفال', debitAccountId: 'gold-product', credit: 'الخزنة', creditAccountId: 'cash', cash: '12000', arabicWeight: '1.5' }),
      entry({ id: 'silver-sale', operationKind: 'sale', debit: 'الخزنة', debitAccountId: 'cash', credit: 'كسر فضة', creditAccountId: 'silver-scrap', cash: '200', weight: '2.5' }),
      entry({ id: 'silver-purchase', operationKind: 'purchase', debit: 'كسر فضة', debitAccountId: 'silver-scrap', credit: 'الخزنة', creditAccountId: 'cash', cash: '100', weight: '1.25' }),
    ];
    const registry = buildCanonicalAccountRegistry(accounts, operations); const legs = buildCanonicalAccountingLegs(operations, registry); const audit = auditAccountingCoverage(operations, registry, legs);
    expect(diagnoseMetalPostings(operations, registry, legs).flatMap(item => item.droppedReasons)).toEqual([]);
    expect(findUnbalancedMetalPostings(operations, legs)).toEqual([]);
    expect(audit.disallowedDimensionRecords).toEqual([]);
  });
});
describe('canonical classification guards', () => {
  const accessories: Account[] = [
    { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: '', balanceNature: 'cash', type: 'cash', userId: 'u' },
    { id: 'silicone', name: 'سيليكون', mainType: 'asset', subType: 'مخزون ملحقات', balanceNature: 'قطعة', type: 'accessory', is_inventory: true, userId: 'u' },
    { id: 'tungsten', name: 'دبلة تنجستين', mainType: 'asset', subType: 'مخزون ملحقات', balanceNature: 'قطعة', type: 'accessory', is_inventory: true, userId: 'u' },
    { id: 'medical', name: 'حلق طبي', mainType: 'asset', subType: 'مخزون ملحقات', balanceNature: 'قطعة', type: 'accessory', is_inventory: true, userId: 'u' },
    { id: 'silver-product', name: 'خاتم فضة', mainType: 'asset', subType: '', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'u' },
    { id: 'samir', name: 'سمير ناشد', mainType: 'liability', subType: 'تاجر فضة', balanceNature: 'silver', type: 'merchant', metal: 'silver', userId: 'u' },
  ];
  it('never turns accessories with misleading legacy weight into gold or silver', () => {
    const entries = ['سيليكون', 'دبلة تنجستين', 'حلق طبي'].map((name, index) => entry({ id: `a-${index}`, operationKind: 'sale', debit: 'الخزنة', debitAccountId: 'cash', credit: name, creditAccountId: ['silicone', 'tungsten', 'medical'][index], cash: '10', weight: '1', arabicWeight: '1', count: '1' }));
    const registry = buildCanonicalAccountRegistry(accessories, entries); const legs = buildCanonicalAccountingLegs(entries, registry); const audit = auditEntityClassification(registry, entries);
    expect(registry.entities.filter(entity => ['سيليكون', 'دبلة تنجستين', 'حلق طبي'].includes(entity.canonicalName)).every(entity => entity.metal === 'accessory' && entity.trackingMode === 'quantity' && entity.allowedDimensions.join() === 'quantity')).toBe(true);
    expect(legs.some(leg => ['سيليكون', 'دبلة تنجستين', 'حلق طبي'].includes(leg.accountName) && leg.dimension !== 'cash')).toBe(false);
    expect(audit.accessoryEntitiesWithMetalLegs).toEqual([]); expect(audit.passed).toBe(true);
    expect(buildTrialBalanceReport(entries, accessories, 'gold', '2026-01-01', '2026-12-31').groups.flatMap(g => g.rows).some(r => ['سيليكون', 'دبلة تنجستين', 'حلق طبي'].includes(r.accountName))).toBe(false);
    expect(buildTrialBalanceReport(entries, accessories, 'silver', '2026-01-01', '2026-12-31').groups.flatMap(g => g.rows).some(r => ['سيليكون', 'دبلة تنجستين', 'حلق طبي'].includes(r.accountName))).toBe(false);
  });
  it('keeps Samir Nashed only in silver plus workmanship cash, never gold', () => {
    const receipt = entry({ id: 'samir-silver', operationKind: 'purchase', debit: 'خاتم فضة', debitAccountId: 'silver-product', credit: 'سمير ناشد', creditAccountId: 'samir', weight: '5', cash: '20' });
    const settlement = entry({ id: 'samir-cash', operationKind: 'merchant_settlement', debit: 'سمير ناشد', credit: 'الخزنة', debitAccountId: 'samir', creditAccountId: 'cash', cash: '20' });
    const registry = buildCanonicalAccountRegistry(accessories, [receipt, settlement]); const legs = buildCanonicalAccountingLegs([receipt, settlement], registry); const audit = auditEntityClassification(registry, [receipt, settlement]);
    expect(legs.some(leg => leg.accountName === 'سمير ناشد' && leg.dimension === 'silver')).toBe(true); expect(legs.some(leg => leg.accountName === 'سمير ناشد' && leg.dimension === 'gold')).toBe(false); expect(legs.some(leg => leg.accountName === 'سمير ناشد' && leg.dimension === 'cash')).toBe(true);
    expect(audit.silverEntitiesWithGoldLegs).toEqual([]); expect(buildTrialBalanceReport([receipt, settlement], accessories, 'gold', '2026-01-01', '2026-12-31').groups.flatMap(g => g.rows).some(r => r.accountName === 'سمير ناشد')).toBe(false);
  });
  it('does not default an unknown merchant to gold from legacy weight alone', () => {
    const unknown = entry({ id: 'unknown', operationKind: 'merchant_settlement', debit: 'تاجر غير مصنف', credit: 'الخزنة', debitAccountId: 'unknown', creditAccountId: 'cash', weight: '7', arabicWeight: '7' });
    const registry = buildCanonicalAccountRegistry(accessories, [unknown]); const legs = buildCanonicalAccountingLegs([unknown], registry);
    expect(registry.byLegacyName.get('تاجر غير مصنف')?.metal).toBeNull(); expect(legs.some(leg => leg.accountName === 'تاجر غير مصنف' && leg.dimension !== 'cash')).toBe(false);
  });
  it('posts accessory opening inventory to quantity and historical opening equity', () => {
    const accessoryAccounts: Account[] = [
      { id: 'accessory', name: 'Accessory item', mainType: 'asset', subType: 'accessories', balanceNature: 'piece', type: 'accessory', is_inventory: true, userId: 'u' },
    ];
    const opening = entry({ id: 'accessory-opening', operationKind: 'opening', debit: 'Accessory item', debitAccountId: 'accessory', credit: 'Accessory opening equity', creditAccountId: 'missing-equity', count: '3', weight: '0', arabicWeight: '0', cash: '0' });
    const registry = buildCanonicalAccountRegistry(accessoryAccounts, [opening]); const legs = buildCanonicalAccountingLegs([opening], registry); const audit = auditAccountingCoverage([opening], registry, legs);
    expect(legs.map(leg => [leg.accountName, leg.side, leg.dimension, leg.amount, leg.group])).toEqual([
      ['Accessory item', 'debit', 'quantity', 3, 'assets'],
      ['Accessory opening equity', 'credit', 'quantity', 3, 'equity'],
    ]);
    expect(audit.zeroLegRecords).toEqual([]);
    expect(audit.disallowedDimensionRecords).toEqual([]);
  });

  it('covers TX28, TX30, and TX31 accessory opening fixtures with canonical legs', () => {
    const ids = [
      'csvref-entry-b933ee71879ad729575ccded9ef256e3',
      'csvref-entry-28cb29a01785ba9a31e6db2dbf79e8fc',
      'csvref-entry-369084c2cfc8efd74e8d03455e4f68bc',
    ];
    const { entries, accounts } = loadPhase5GoldenDataset();
    const targets = entries.filter(item => ids.includes(item.id ?? ''));
    const registry = buildCanonicalAccountRegistry(accounts, targets); const legs = buildCanonicalAccountingLegs(targets, registry); const audit = auditAccountingCoverage(targets, registry, legs);
    expect(targets.map(item => item.id)).toEqual(ids);
    ids.forEach(id => {
      const recordLegs = legs.filter(leg => leg.sourceEntryId === id);
      expect(recordLegs.map(leg => [leg.side, leg.dimension, leg.group])).toEqual([
        ['debit', 'quantity', 'assets'],
        ['credit', 'quantity', 'equity'],
      ]);
    });
    expect(audit.zeroLegRecords).toEqual([]);
    expect(audit.disallowedDimensionRecords).toEqual([]);
  });
  it('still reports invalid accessory opening cash payloads when quantity legs are absent', () => {
    const accessoryAccounts: Account[] = [
      { id: 'accessory', name: 'Accessory item', mainType: 'asset', subType: 'accessories', balanceNature: 'piece', type: 'accessory', is_inventory: true, userId: 'u' },
    ];
    const opening = entry({ id: 'invalid-accessory-opening', operationKind: 'opening', debit: 'Accessory item', debitAccountId: 'accessory', credit: 'Accessory opening equity', cash: '100', count: '0', weight: '0', arabicWeight: '0' });
    const registry = buildCanonicalAccountRegistry(accessoryAccounts, [opening]); const legs = buildCanonicalAccountingLegs([opening], registry); const audit = auditAccountingCoverage([opening], registry, legs);
    expect(legs).toEqual([]);
    expect(audit.disallowedDimensionRecords).toEqual(['invalid-accessory-opening']);
  });
});
describe('gold counterpart coverage', () => {
  const goldAccounts: Account[] = [
    { id: 'scrap', name: 'كسر ذهب', mainType: 'asset', subType: '', balanceNature: 'gold', type: 'gold_raw', is_inventory: true, userId: 'u' },
    { id: 'ring', name: 'خاتم ذهب', mainType: 'asset', subType: '', balanceNature: 'gold', type: 'gold_product', is_inventory: true, userId: 'u' },
    { id: 'capital', name: 'راس المال ذهب', mainType: 'equity', subType: '', balanceNature: 'gold', type: 'other', userId: 'u' },
    { id: 'merchant', name: 'محمد السيد', mainType: 'liability', subType: '', balanceNature: 'gold', type: 'merchant', userId: 'u' },
  ];
  it('posts opening gold to both asset and equity even when equity is credited', () => {
    const opening = entry({ id: 'opening-gold', operationKind: 'opening', debit: 'كسر ذهب', debitAccountId: 'scrap', credit: 'راس المال ذهب', creditAccountId: 'capital', arabicWeight: '100' });
    const registry = buildCanonicalAccountRegistry(goldAccounts, [opening]); const legs = buildCanonicalAccountingLegs([opening], registry); const report = buildTrialBalanceReport([opening], goldAccounts, 'gold', '2026-01-01', '2026-12-31');
    expect(legs.map(leg => [leg.accountName, leg.side, leg.amount])).toContainEqual(['كسر ذهب', 'debit', 100]); expect(legs.map(leg => [leg.accountName, leg.side, leg.amount])).toContainEqual(['راس المال ذهب', 'credit', 100]); expect(report.groups.map(group => group.id)).toEqual(expect.arrayContaining(['assets', 'equity'])); expect(report.closingDebit).toBe(report.closingCredit); expect(findUnbalancedMetalPostings([opening], legs)).toEqual([]);
  });
  it('posts gold merchant and historical creditor credit counterparts without filtering reversed equity side', () => {
    const merchant = entry({ id: 'merchant-gold', operationKind: 'purchase', debit: 'خاتم ذهب', debitAccountId: 'ring', credit: 'محمد السيد', creditAccountId: 'merchant', arabicWeight: '10' });
    const creditor = entry({ id: 'alaa-gold', operationKind: 'opening', debit: 'راس المال ذهب', debitAccountId: 'capital', credit: 'الاء ياسر', arabicWeight: '25.19714286' });
    const registry = buildCanonicalAccountRegistry(goldAccounts, [merchant, creditor]); const legs = buildCanonicalAccountingLegs([merchant, creditor], registry); const report = buildTrialBalanceReport([merchant, creditor], goldAccounts, 'gold', '2026-01-01', '2026-12-31');
    expect(legs.some(leg => leg.accountName === 'محمد السيد' && leg.side === 'credit' && leg.dimension === 'gold' && leg.amount === 10)).toBe(true); expect(legs.some(leg => leg.accountName === 'الاء ياسر' && leg.side === 'credit' && leg.amount === 25.19714286)).toBe(true); expect(report.groups.map(group => group.id)).toEqual(expect.arrayContaining(['assets', 'liabilities', 'equity'])); expect(findUnbalancedMetalPostings([merchant, creditor], legs)).toEqual([]);
  });
});
describe('gold adjustment and cash-expense isolation', () => {
  const accounts: Account[] = [
    { id: 'gold-product', name: 'خاتم ذهب', mainType: 'asset', subType: '', balanceNature: 'gold', type: 'gold_product', is_inventory: true, userId: 'u' },
    { id: 'surplus', name: 'زيادة-الذهب', mainType: 'revenue', subType: 'adjustment', balanceNature: 'gold', type: 'other', userId: 'u' },
    { id: 'shortage', name: 'عجز-الذهب', mainType: 'expense', subType: 'adjustment', balanceNature: 'gold', type: 'other', userId: 'u' },
    { id: 'electricity', name: 'كهرباء', mainType: 'expense', subType: '', balanceNature: 'cash', type: 'other', userId: 'u' },
    { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: '', balanceNature: 'cash', type: 'cash', userId: 'u' },
    { id: 'capital', name: 'راس المال ذهب', mainType: 'equity', subType: '', balanceNature: 'gold', type: 'other', userId: 'u' },
  ];
  it('posts gold surplus 8.97 as inventory debit and revenue credit, balanced', () => {
    const surplus = entry({ id: 'surplus-897', operationKind: 'adjustment', debit: 'خاتم ذهب', debitAccountId: 'gold-product', credit: 'زيادة-الذهب', creditAccountId: 'surplus', arabicWeight: '8.97', weight: '10.465', karat: 18 });
    const registry = buildCanonicalAccountRegistry(accounts, [surplus]); const legs = buildCanonicalAccountingLegs([surplus], registry); const report = buildTrialBalanceReport([surplus], accounts, 'gold', '2026-01-01', '2026-12-31');
    expect(legs.map(leg => [leg.accountName, leg.side, leg.amount])).toContainEqual(['خاتم ذهب', 'debit', 8.97]); expect(legs.map(leg => [leg.accountName, leg.side, leg.amount])).toContainEqual(['زيادة-الذهب', 'credit', 8.97]); expect(report.groups.map(group => group.id)).toEqual(expect.arrayContaining(['assets', 'revenue'])); expect(report.balanced).toBe(true); expect(auditGoldSurplusOperations([surplus], registry, legs)[0]).toMatchObject({ equivalent21Weight: 8.97, missingCreditReason: undefined }); expect(findUnbalancedMetalPostings([surplus], legs)).toEqual([]);
  });
  it('posts gold shortage to expense debit and inventory credit, balanced', () => {
    const shortage = entry({ id: 'shortage-3', operationKind: 'adjustment', debit: 'عجز-الذهب', debitAccountId: 'shortage', credit: 'خاتم ذهب', creditAccountId: 'gold-product', arabicWeight: '3' });
    const registry = buildCanonicalAccountRegistry(accounts, [shortage]); const legs = buildCanonicalAccountingLegs([shortage], registry); const report = buildTrialBalanceReport([shortage], accounts, 'gold', '2026-01-01', '2026-12-31');
    expect(legs.map(leg => [leg.accountName, leg.side, leg.amount])).toContainEqual(['عجز-الذهب', 'debit', 3]); expect(legs.map(leg => [leg.accountName, leg.side, leg.amount])).toContainEqual(['خاتم ذهب', 'credit', 3]); expect(report.groups.map(group => group.id)).toEqual(expect.arrayContaining(['assets', 'expenses'])); expect(report.balanced).toBe(true); expect(findUnbalancedMetalPostings([shortage], legs)).toEqual([]);
  });
  it('keeps ordinary cash expenses out of both metal dimensions in a mixed period', () => {
    const opening = entry({ id: 'open', operationKind: 'opening', debit: 'خاتم ذهب', debitAccountId: 'gold-product', credit: 'راس المال ذهب', creditAccountId: 'capital', arabicWeight: '10' });
    const surplus = entry({ id: 'surplus', operationKind: 'adjustment', debit: 'خاتم ذهب', debitAccountId: 'gold-product', credit: 'زيادة-الذهب', creditAccountId: 'surplus', arabicWeight: '8.97' });
    const shortage = entry({ id: 'shortage', operationKind: 'adjustment', debit: 'عجز-الذهب', debitAccountId: 'shortage', credit: 'خاتم ذهب', creditAccountId: 'gold-product', arabicWeight: '3' });
    const expense = entry({ id: 'power', operationKind: 'expense', debit: 'كهرباء', debitAccountId: 'electricity', credit: 'الخزنة', creditAccountId: 'cash', cash: '500', weight: '1', arabicWeight: '1' });
    const entries = [opening, surplus, shortage, expense]; const registry = buildCanonicalAccountRegistry(accounts, entries); const legs = buildCanonicalAccountingLegs(entries, registry); const gold = buildTrialBalanceReport(entries, accounts, 'gold', '2026-01-01', '2026-12-31');
    expect(legs.some(leg => leg.accountName === 'كهرباء' && leg.dimension !== 'cash')).toBe(false); expect(gold.groups.flatMap(group => group.rows).some(row => row.accountName === 'كهرباء')).toBe(false); expect(gold.groups.map(group => group.id)).toEqual(expect.arrayContaining(['assets', 'equity', 'revenue', 'expenses'])); expect(gold.balanced).toBe(true); expect(findUnbalancedMetalPostings(entries, legs)).toEqual([]);
  });
});
describe('trial balance end-to-end revenue coverage', () => {
  const accounts: Account[] = [
    { id: 'product', name: 'خاتم ذهب', mainType: 'asset', subType: '', balanceNature: 'gold', type: 'gold_product', is_inventory: true, userId: 'u' },
    { id: 'surplus', name: 'زيادة-الذهب', mainType: 'revenue', subType: '', balanceNature: 'gold', type: 'other', userId: 'u' },
    { id: 'shortage', name: 'عجز-الذهب', mainType: 'expense', subType: '', balanceNature: 'gold', type: 'other', userId: 'u' },
    { id: 'equity', name: 'راس المال ذهب', mainType: 'equity', subType: '', balanceNature: 'gold', type: 'other', userId: 'u' },
    { id: 'creditor', name: 'دائن ذهب', mainType: 'liability', subType: '', balanceNature: 'gold', type: 'other', userId: 'u' },
  ];
  it('traces raw surplus alias through ledger legs to a revenue trial-balance row', () => {
    const entry = { ...({ seq: 1, tx: 'تسوية', operationKind: 'adjustment', date: '2026-01-01', debit: 'خاتم ذهب', debitAccountId: 'product', credit: 'زيادة الذهب', cash: '0', weight: '0', arabicWeight: '8.97', count: '0', notes: '', userId: 'u' } as Entry), id: 'actual-shaped-surplus' };
    const registry = buildCanonicalAccountRegistry(accounts, [entry]); const legs = buildCanonicalAccountingLegs([entry], registry); const report = buildTrialBalanceReport([entry], accounts, 'gold', '2026-01-01', '2026-12-31');
    const row = report.groups.find(group => group.id === 'revenue')?.rows[0];
    expect(registry.byLegacyName.get('زيادة الذهب')?.canonicalName).toBe('زيادة-الذهب'); expect(legs.some(leg => leg.accountName === 'زيادة-الذهب' && leg.side === 'credit' && leg.amount === 8.97)).toBe(true); expect(row).toMatchObject({ periodCredit: 8.97, closingCredit: 8.97 }); expect(report.balanced).toBe(true);
  });
  it('supports all five canonical groups when each has gold movement', () => {
    const entries = [
      entry({ id: 'asset-equity', operationKind: 'opening', debit: 'خاتم ذهب', debitAccountId: 'product', credit: 'راس المال ذهب', creditAccountId: 'equity', arabicWeight: '10' }),
      entry({ id: 'surplus', operationKind: 'adjustment', debit: 'خاتم ذهب', debitAccountId: 'product', credit: 'زيادة-الذهب', creditAccountId: 'surplus', arabicWeight: '2' }),
      entry({ id: 'shortage', operationKind: 'adjustment', debit: 'عجز-الذهب', debitAccountId: 'shortage', credit: 'خاتم ذهب', creditAccountId: 'product', arabicWeight: '1' }),
      entry({ id: 'liability', operationKind: 'opening', debit: 'راس المال ذهب', debitAccountId: 'equity', credit: 'دائن ذهب', creditAccountId: 'creditor', arabicWeight: '1' }),
    ];
    expect(buildTrialBalanceReport(entries, accounts, 'gold', '2026-01-01', '2026-12-31').groups.map(group => group.id)).toEqual(['assets', 'liabilities', 'equity', 'revenue', 'expenses']);
  });
});
