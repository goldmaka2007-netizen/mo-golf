import { describe, expect, it } from 'vitest';
import { analyzeProfitability, processCostBasis, processInventory } from '../engine';
import { belongsToMetric, getAccountTypeDetails } from '../../utils/accountLogic';
import { Account, Entry } from '../../types';

const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', is_inventory: false, karat: null, metal: null, userId: 'u1' },
  { id: 'gold18-product', name: 'gold18-product', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', is_inventory: true, karat: '18', metal: 'gold', userId: 'u1' },
  { id: 'gold18-raw', name: 'gold18-raw', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_raw', is_inventory: true, karat: '18', metal: 'gold', userId: 'u1' },
  { id: 'gold21-product', name: 'gold21-product', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', is_inventory: true, karat: '21', metal: 'gold', userId: 'u1' },
  { id: 'silver', name: 'silver', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', is_inventory: true, karat: null, metal: 'silver', userId: 'u1' },
  { id: 'accessory', name: 'accessory', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, karat: null, metal: null, userId: 'u1' },
  { id: 'merchant-gold', name: 'merchant-gold', mainType: 'liability', subType: 'merchant', balanceNature: 'gold', type: 'merchant', is_inventory: false, karat: '18', metal: 'gold', userId: 'u1' },
  { id: 'merchant-silver', name: 'merchant-silver', mainType: 'liability', subType: 'merchant', balanceNature: 'silver', type: 'merchant', is_inventory: false, karat: null, metal: 'silver', userId: 'u1' },
  { id: 'equity-draw', name: 'equity-draw', mainType: 'equity', subType: 'drawings', balanceNature: 'cash', type: 'other', is_inventory: false, karat: null, metal: null, userId: 'u1' },
  { id: 'adjustment', name: 'adjustment', mainType: 'expense', subType: 'adjustment', balanceNature: 'gold', type: 'other', is_inventory: false, karat: null, metal: null, userId: 'u1' },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  seq: 1,
  tx: 'test',
  date: '2026-01-01',
  debit: '',
  credit: '',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u1',
  ...overrides,
});

describe('engine inventory movements', () => {
  it('records purchases by account metadata, not Arabic account names', () => {
    const result = processInventory([
      entry({ operationKind: 'purchase', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'cash', creditAccountId: 'cash', weight: '10', cash: '30000' }),
    ], accounts);

    expect(result.snapshots['gold18-raw'].weight).toBe(10);
    expect(result.snapshots['gold18-raw'].arabicWeight).toBeCloseTo(10 * 18 / 21, 5);
  });

  it('records sales as inventory outflow', () => {
    const result = processInventory([
      entry({ operationKind: 'opening', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'equity-draw', creditAccountId: 'equity-draw', weight: '7' }),
      entry({ operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold21-product', creditAccountId: 'gold21-product', weight: '2', cash: '9000' }),
    ], accounts);

    expect(result.snapshots['gold21-product'].weight).toBe(5);
    expect(result.snapshots['gold21-product'].arabicWeight).toBe(5);
  });

  it('records transfers between inventory accounts', () => {
    const result = processInventory([
      entry({ operationKind: 'transfer', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'gold18-product', creditAccountId: 'gold18-product', weight: '3' }),
    ], accounts);

    expect(result.snapshots['gold21-product'].weight).toBe(3);
    expect(result.snapshots['gold18-product'].weight).toBe(-3);
  });

  it('records tifeet as raw outflow and product inflow', () => {
    const result = processInventory([
      entry({ operationKind: 'tifeet', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '4' }),
    ], accounts);

    expect(result.snapshots['gold18-product'].weight).toBe(4);
    expect(result.snapshots['gold18-raw'].weight).toBe(-4);
  });

  it('records inventory adjustments without account-name rules', () => {
    const result = processInventory([
      entry({ operationKind: 'adjustment', debit: 'adjustment', debitAccountId: 'adjustment', credit: 'gold21-product', creditAccountId: 'gold21-product', weight: '1.5' }),
    ], accounts);

    expect(result.snapshots['gold21-product'].weight).toBe(-1.5);
  });

  it('tracks accessories by count without metal weight assumptions', () => {
    const result = processInventory([
      entry({ operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', count: '6', weight: '0' }),
      entry({ operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'accessory', creditAccountId: 'accessory', count: '2', weight: '0' }),
    ], accounts);

    expect(result.snapshots.accessory.count).toBe(4);
    expect(result.snapshots.accessory.arabicWeight).toBe(0);
  });

  it('keeps personal withdrawals cash-only and out of inventory', () => {
    const result = processInventory([
      entry({ operationKind: 'personal_withdrawal', debit: 'equity-draw', debitAccountId: 'equity-draw', credit: 'cash', creditAccountId: 'cash', cash: '1000' }),
    ], accounts);

    expect(Object.values(result.snapshots).every(snapshot => snapshot.weight === 0 && snapshot.count === 0)).toBe(true);
  });

  it('tracks merchant weight debt separately from physical shop inventory', () => {
    const result = processInventory([
      entry({ operationKind: 'purchase', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'merchant-gold', creditAccountId: 'merchant-gold', weight: '10', karat: 18 }),
      entry({ operationKind: 'merchant_settlement', debit: 'merchant-gold', debitAccountId: 'merchant-gold', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '4', karat: 18 }),
    ], accounts);

    expect(result.snapshots['gold18-product'].weight).toBe(10);
    expect(result.snapshots['gold18-raw'].weight).toBe(-4);
    expect(result.merchantWeightLiabilities['merchant-gold'].weight).toBe(6);
    expect(result.merchantWeightLiabilities['merchant-gold'].arabicWeight).toBeCloseTo(6 * 18 / 21, 5);
  });

  it('routes merchant weight accounts into the gold liability ledger by metadata', () => {
    expect(belongsToMetric('merchant-gold', 'gold', accounts)).toBe(true);
    expect(belongsToMetric('merchant-gold', 'cash', accounts)).toBe(false);
    expect(getAccountTypeDetails('merchant-gold', accounts).main).toBe('liabilities');
  });
});

describe('engine cost and profitability', () => {
  it('calculates weighted cost for purchases and sales', () => {
    const entries = [
      entry({ operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '10', cash: '40000' }),
      entry({ operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold21-product', creditAccountId: 'gold21-product', weight: '4', cash: '20000' }),
    ];

    const basis = processCostBasis(entries, accounts, 4000, 50);
    const analysis = analyzeProfitability(entries, accounts, 4000, 50, '2026-01-01', '2026-12-31');

    expect(basis.getCost('gold21-product')).toBe(4000);
    expect(analysis.karatData['21'].salesAr).toBe(4);
    expect(analysis.karatData['21'].salesCash).toBe(20000);
  });

  it('moves raw cost into products during tifeet', () => {
    const entries = [
      entry({ operationKind: 'purchase', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'cash', creditAccountId: 'cash', weight: '10', cash: '30000' }),
      entry({ operationKind: 'tifeet', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '5' }),
    ];

    const basis = processCostBasis(entries, accounts, 3500, 50);

    expect(basis.getCost('gold18-product')).toBe(3000);
    expect(basis.getCost('gold18-raw')).toBe(3000);
  });
});
