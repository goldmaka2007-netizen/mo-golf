import { describe, expect, it } from 'vitest';
import { analyzeProfitability, processCostBasis, processInventory } from '../engine';
import { compareEntriesForCost, parseMoneyToMinorBigInt, parseMoneyToMinorUnits, rebuildCostTimeline } from '../weightedAverageCost';
import { buildOpeningCostConfig, parseEgpToMinorUnits } from '../openingCostConfig';
import { buildGoldEquivalent21Audit, calculateGoldEquivalent21, compareLegacyGoldEquivalent21, GOLD_EQUIVALENT_21_CALCULATION_VERSION } from '../goldEquivalent';
import { belongsToMetric, getAccountTypeDetails, getMetricValue } from '../../utils/accountLogic';
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
    expect(result.snapshots['gold18-raw'].arabicWeight).toBe(8.57);
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

  it('does not produce equivalent-21 weight for accessory entries even when weight is nonzero', () => {
    const result = processInventory([
      entry({ operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', count: '1', weight: '5', karat: 18 }),
    ], accounts);

    expect(result.snapshots.accessory.weight).toBe(5);
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
    expect(result.merchantWeightLiabilities['merchant-gold'].arabicWeight).toBeCloseTo(5.14, 5);
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

    expect(basis.getCost('gold18-product')).toBeCloseTo(3500.58, 2);
    expect(basis.getCost('gold18-raw')).toBeCloseTo(3500.58, 2);
  });
});


describe('weighted average cost engine MKA-34', () => {
  const gold24: Account = { id: 'gold24-product', name: 'gold24-product', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', is_inventory: true, karat: '24', metal: 'gold', userId: 'u1' };
  const wacAccounts = [...accounts, gold24];
  const cfg = { gold21PriceByYearMinor: { '2026': 600000 }, silverPriceByYearMinor: { '2026': 6000 } };
  const result = (entries: Entry[]) => rebuildCostTimeline(entries, wacAccounts, cfg);
  const state = (entries: Entry[], accountId: string) => result(entries).finalStates[accountId];
  const op = (entries: Entry[], id: string) => result(entries).resultsByOperationId[id];

  it('opening inventory then purchase updates total cost and average', () => {
    const entries = [
      entry({ id: 'o1', operationKind: 'opening', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'equity-draw', creditAccountId: 'equity-draw', weight: '10.00', seq: 1 }),
      entry({ id: 'p1', operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '40000', seq: 2 }),
    ];
    expect(op(entries, 'o1')).toMatchObject({ quantityAfterUnits: 1000, incomingCostMinor: 6000000, averageCostAfter: 6000 });
    expect(op(entries, 'p1')).toMatchObject({ quantityAfterUnits: 2000, totalCostAfterMinor: 10000000, averageCostAfter: 5000 });
  });

  it('two purchases at different prices produce weighted average', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '40000', seq: 1 }),
      entry({ id: 'p2', operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '5.00', cash: '25000', seq: 2 }),
    ];
    expect(op(entries, 'p2')).toMatchObject({ quantityAfterUnits: 1500, totalCostAfterMinor: 6500000 });
    expect(op(entries, 'p2').averageCostAfter).toBeCloseTo(4333.333333, 5);
  });

  it('tracks total cost and average after every incoming operation', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '2.00', cash: '100', seq: 1 }),
      entry({ id: 'p2', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '3.00', cash: '210', seq: 2 }),
    ];
    expect(op(entries, 'p1')).toMatchObject({ totalCostAfterMinor: 10000, averageCostAfter: 50 });
    expect(op(entries, 'p2')).toMatchObject({ totalCostAfterMinor: 31000, quantityAfterUnits: 500, averageCostAfter: 62 });
  });

  it('sale uses pre-sale average for COGS', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '40000', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold21-product', creditAccountId: 'gold21-product', weight: '4.00', cash: '20000', seq: 2 }),
    ];
    expect(op(entries, 's1')).toMatchObject({ averageCostBefore: 4000, cogsMinor: 1600000, totalCostAfterMinor: 2400000 });
  });

  it('sale does not change remaining average cost', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '40000', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold21-product', creditAccountId: 'gold21-product', weight: '4.00', cash: '20000', seq: 2 }),
    ];
    expect(op(entries, 's1').averageCostAfter).toBe(4000);
  });

  it('partial sale reduces quantity and total cost proportionally', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '500', seq: 1 }), entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '2.50', cash: '200', seq: 2 })];
    expect(op(entries, 's1')).toMatchObject({ cogsMinor: 12500, quantityAfterUnits: 750, totalCostAfterMinor: 37500 });
  });

  it('multiple sales consume cost from rebuilt state', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '500', seq: 1 }), entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '2.00', seq: 2 }), entry({ id: 's2', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '3.00', seq: 3 })];
    expect(op(entries, 's1').cogsMinor).toBe(10000);
    expect(op(entries, 's2')).toMatchObject({ cogsMinor: 15000, quantityAfterUnits: 500 });
  });

  it('full sale resets quantity and total cost to zero', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '75', seq: 1 }), entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '1.00', seq: 2 })];
    expect(op(entries, 's1')).toMatchObject({ quantityAfterUnits: 0, totalCostAfterMinor: 0, averageCostAfter: null });
    expect(state(entries, 'silver').hasReliableCostBasis).toBe(false);
  });

  it('rejects sale larger than inventory', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '75', seq: 1 }), entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '1.01', seq: 2 })];
    expect(op(entries, 's1').status).toBe('insufficient_inventory');
  });

  it('rejects sale without cost basis', () => {
    const entries = [entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '1.00' })];
    expect(op(entries, 's1').status).toBe('missing_cost_basis');
  });

  it('uses equivalent-21 units for 18K, 21K, and 24K gold', () => {
    const entries = [entry({ id: 'g18', operationKind: 'purchase', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '36000', karat: 18 }), entry({ id: 'g21', operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '40000', karat: 21 }), entry({ id: 'g24', operationKind: 'purchase', debit: 'gold24-product', debitAccountId: 'gold24-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '48000', karat: 24 })];
    expect(op(entries, 'g18').quantityChangeUnits).toBe(857);
    expect(op(entries, 'g21').quantityChangeUnits).toBe(1000);
    expect(op(entries, 'g24').quantityChangeUnits).toBe(1143);
  });

  it('does not use physical weight as gold cost quantity', () => {
    const entries = [entry({ id: 'g18', operationKind: 'purchase', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '36000', karat: 18 })];
    expect(op(entries, 'g18').quantityChangeUnits).not.toBe(1000);
  });

  it('uses annual 21K opening price for opening gold', () => {
    const entries = [entry({ id: 'o1', operationKind: 'opening', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'equity-draw', creditAccountId: 'equity-draw', weight: '10.00', karat: 18 })];
    expect(op(entries, 'o1')).toMatchObject({ quantityChangeUnits: 857, incomingCostMinor: 5142000 });
  });

  it('missing opening gold price returns missing cost basis without market fallback', () => {
    const entries = [entry({ id: 'o1', operationKind: 'opening', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'equity-draw', creditAccountId: 'equity-draw', weight: '1.00' })];
    expect(rebuildCostTimeline(entries, wacAccounts).resultsByOperationId.o1.status).toBe('missing_cost_basis');
  });

  it('calculates silver weighted average on physical weight', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '1000' }), entry({ id: 'p2', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '2000', seq: 2 })];
    expect(op(entries, 'p2').averageCostAfter).toBe(150);
  });

  it('silver does not use the gold equivalent engine', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '1000', karat: 18 })];
    expect(op(entries, 'p1').quantityChangeUnits).toBe(1000);
  });

  it('calculates accessory weighted average by count', () => {
    const entries = [entry({ id: 'a1', operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', count: '2', cash: '100' }), entry({ id: 'a2', operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', count: '2', cash: '300', seq: 2 })];
    expect(op(entries, 'a2')).toMatchObject({ quantityAfterUnits: 4000, totalCostAfterMinor: 40000, averageCostAfter: 10000 });
  });

  it('accessory sale calculates COGS by piece count', () => {
    const entries = [entry({ id: 'a1', operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', count: '4', cash: '400' }), entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'accessory', creditAccountId: 'accessory', count: '3', seq: 2 })];
    expect(op(entries, 's1').cogsMinor).toBe(30000);
  });

  it('full transfer moves all cost to destination', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '36000', karat: 18 }), entry({ id: 't1', operationKind: 'transfer', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'gold18-product', creditAccountId: 'gold18-product', weight: '10.00', karat: 18, seq: 2 })];
    expect(state(entries, 'gold18-product').totalCostMinor).toBe(0);
    expect(state(entries, 'gold18-raw').totalCostMinor).toBe(3600000);
  });

  it('partial transfer moves proportional cost', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '36000', karat: 18 }), entry({ id: 't1', operationKind: 'transfer', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'gold18-product', creditAccountId: 'gold18-product', weight: '5.00', karat: 18, seq: 2 })];
    expect(op(entries, 't1').outgoingCostMinor).toBe(1802100);
  });

  it('transfer preserves total cost', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '36000', karat: 18 }), entry({ id: 't1', operationKind: 'transfer', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'gold18-product', creditAccountId: 'gold18-product', weight: '5.00', karat: 18, seq: 2 })];
    const total = Object.values(result(entries).finalStates).reduce((sum, s) => sum + s.totalCostMinor, 0);
    expect(total).toBe(3600000);
  });

  it('rejects transfer with insufficient source inventory', () => {
    const entries = [entry({ id: 't1', operationKind: 'transfer', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'gold18-product', creditAccountId: 'gold18-product', weight: '5.00', karat: 18 })];
    expect(op(entries, 't1').status).toBe('missing_cost_basis');
  });

  it('rejects cross-karat transfer when equivalent-21 quantities differ', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '36000', karat: 18 }), entry({ id: 't1', operationKind: 'transfer', debit: 'gold24-product', debitAccountId: 'gold24-product', credit: 'gold18-product', creditAccountId: 'gold18-product', weight: '5.00', karat: 18, seq: 2 })];
    expect(op(entries, 't1').status).toBe('quantity_mismatch');
    expect(state(entries, 'gold24-product').quantityUnits).toBe(0);
  });

  it('tafiet carries raw cost to product', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '30000', karat: 18 }), entry({ id: 'tf1', operationKind: 'tifeet', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '5.00', karat: 18, seq: 2 })];
    expect(op(entries, 'tf1').incomingCostMinor).toBe(op(entries, 'tf1').outgoingCostMinor);
    expect(state(entries, 'gold18-product').totalCostMinor).toBe(op(entries, 'tf1').outgoingCostMinor);
  });

  it('tafiet does not add workmanship cost', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '30000', karat: 18 }), entry({ id: 'tf1', operationKind: 'tifeet', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '5.00', cash: '999', karat: 18, seq: 2 })];
    expect(op(entries, 'tf1').incomingCostMinor).toBe(1501750);
  });

  it('tafiet creates no profit or loss', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '30000', karat: 18 }), entry({ id: 'tf1', operationKind: 'tifeet', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '5.00', karat: 18, seq: 2 })];
    expect(op(entries, 'tf1')).toMatchObject({ cogsMinor: 0, adjustmentGainMinor: 0, adjustmentLossMinor: 0 });
  });

  it('rejects tafiet without source cost basis', () => {
    const entries = [entry({ id: 'tf1', operationKind: 'tifeet', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '1.00', karat: 18 })];
    expect(op(entries, 'tf1').status).toBe('missing_cost_basis');
  });

  it('rejects tafiet larger than source', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'gold18-raw', debitAccountId: 'gold18-raw', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '3000', karat: 18 }), entry({ id: 'tf1', operationKind: 'tifeet', debit: 'gold18-product', debitAccountId: 'gold18-product', credit: 'gold18-raw', creditAccountId: 'gold18-raw', weight: '2.00', karat: 18, seq: 2 })];
    expect(op(entries, 'tf1').status).toBe('insufficient_inventory');
  });

  it('shortage uses current average and creates adjustment loss', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '500' }), entry({ id: 'sh1', operationKind: 'adjustment', debit: 'adjustment', debitAccountId: 'adjustment', credit: 'silver', creditAccountId: 'silver', weight: '2.00', seq: 2 })];
    expect(op(entries, 'sh1')).toMatchObject({ adjustmentLossMinor: 10000, cogsMinor: 0 });
  });

  it('surplus uses current average and creates adjustment gain', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '500' }), entry({ id: 'su1', operationKind: 'adjustment', debit: 'silver', debitAccountId: 'silver', credit: 'adjustment', creditAccountId: 'adjustment', weight: '2.00', seq: 2 })];
    expect(op(entries, 'su1')).toMatchObject({ adjustmentGainMinor: 10000, quantityAfterUnits: 1200 });
  });

  it('surplus on zero balance without basis returns missing cost basis', () => {
    const entries = [entry({ id: 'su1', operationKind: 'adjustment', debit: 'silver', debitAccountId: 'silver', credit: 'adjustment', creditAccountId: 'adjustment', weight: '2.00' })];
    expect(op(entries, 'su1').status).toBe('missing_cost_basis');
  });

  it('supports weight-only adjustment', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '2.00', cash: '100' }), entry({ id: 'sh1', operationKind: 'adjustment', debit: 'adjustment', debitAccountId: 'adjustment', credit: 'silver', creditAccountId: 'silver', weight: '1.00', count: '0', seq: 2 })];
    expect(op(entries, 'sh1').quantityChangeUnits).toBe(-100);
  });

  it('supports count-only adjustment', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', count: '5', cash: '500' }), entry({ id: 'sh1', operationKind: 'adjustment', debit: 'adjustment', debitAccountId: 'adjustment', credit: 'accessory', creditAccountId: 'accessory', count: '2', seq: 2 })];
    expect(op(entries, 'sh1')).toMatchObject({ quantityChangeUnits: -2000, adjustmentLossMinor: 20000 });
  });

  it('orders same-date operations by seq', () => {
    const entries = [entry({ id: 's1', seq: 2, operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '1.00' }), entry({ id: 'p1', seq: 1, operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50' })];
    expect(op(entries, 's1').status).toBe('valid');
  });

  it('orders same date and seq by createdAt then id', () => {
    const a = entry({ id: 'b', seq: 1, createdAt: { seconds: 2, nanoseconds: 0 } });
    const b = entry({ id: 'a', seq: 1, createdAt: { seconds: 1, nanoseconds: 0 } });
    expect([a, b].sort(compareEntriesForCost).map(e => e.id)).toEqual(['a', 'b']);
  });

  it('rebuild after deleting an operation changes subsequent state', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50' }), entry({ id: 'p2', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '150', seq: 2 })];
    expect(state(entries, 'silver').totalCostMinor).toBe(20000);
    expect(state(entries.slice(0, 1), 'silver').totalCostMinor).toBe(5000);
  });

  it('rebuild after editing an old operation changes average', () => {
    const base = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50' }), entry({ id: 'p2', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '150', seq: 2 })];
    const edited = [{ ...base[0], cash: '100' }, base[1]];
    expect(state(base, 'silver').totalCostMinor).toBe(20000);
    expect(state(edited, 'silver').totalCostMinor).toBe(25000);
  });

  it('parses cash minor units as piasters', () => {
    expect(parseMoneyToMinorUnits('123.45')).toBe(12345);
  });

  it('parses money above safe integer with BigInt before serialization', () => {
    expect(parseMoneyToMinorBigInt('90071992547409.92')).toBe(9007199254740992n);
    expect(() => parseMoneyToMinorUnits('90071992547409.92')).toThrow(/safe integer/);
  });

  it('rounds fractional average COGS to nearest piaster', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '0.03', cash: '1.00' }), entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.01', seq: 2 })];
    expect(op(entries, 's1').cogsMinor).toBe(33);
  });

  it('conserves rounded cost for 3 units / 100 minor consumed as 1 + 1 + 1', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '0.03', cash: '1.00', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.01', seq: 2 }),
      entry({ id: 's2', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.01', seq: 3 }),
      entry({ id: 's3', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.01', seq: 4 }),
    ];
    expect(op(entries, 's1').cogsMinor + op(entries, 's2').cogsMinor + op(entries, 's3').cogsMinor).toBe(100);
    expect(state(entries, 'silver')).toMatchObject({ quantityUnits: 0, totalCostMinor: 0 });
  });

  it('conserves rounded cost for 7 units / 100 minor consumed as 2 + 2 + 3', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '0.07', cash: '1.00', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.02', seq: 2 }),
      entry({ id: 's2', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.02', seq: 3 }),
      entry({ id: 's3', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.03', seq: 4 }),
    ];
    expect(op(entries, 's1').cogsMinor + op(entries, 's2').cogsMinor + op(entries, 's3').cogsMinor).toBe(100);
    expect(state(entries, 'silver')).toMatchObject({ quantityUnits: 0, totalCostMinor: 0 });
  });

  it('does not show floating-point drift in repeated decimal movements', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '0.10', cash: '10.00' }), ...Array.from({ length: 10 }, (_, i) => entry({ id: `s${i}`, operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.01', seq: i + 2 }))];
    expect(state(entries, 'silver')).toMatchObject({ quantityUnits: 0, totalCostMinor: 0 });
  });

  it('zero inventory reset clears cost basis', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'accessory', debitAccountId: 'accessory', credit: 'cash', creditAccountId: 'cash', count: '1', cash: '10' }), entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'accessory', creditAccountId: 'accessory', count: '1', seq: 2 })];
    expect(state(entries, 'accessory')).toMatchObject({ quantityUnits: 0, totalCostMinor: 0, hasReliableCostBasis: false });
  });

  it('processCostBasis passes annual opening config through to the timeline', () => {
    const openingConfig = buildOpeningCostConfig([{ year: 2026, gold21PriceMinorPerGram: 600000 }]);
    const entries = [entry({ id: 'o1', operationKind: 'opening', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'equity-draw', creditAccountId: 'equity-draw', weight: '1.00' })];
    const basis = processCostBasis(entries, wacAccounts, 1, 1, openingConfig);
    expect(basis.getResult('o1')?.status).toBe('valid');
    expect(basis.getResult('o1')?.incomingCostMinor).toBe(600000);
  });

  it('rejects duplicate opening config years instead of silently using the last value', () => {
    expect(() => buildOpeningCostConfig([
      { year: 2026, gold21PriceMinorPerGram: 600000 },
      { year: 2026, gold21PriceMinorPerGram: 700000 },
    ])).toThrow(/Duplicate opening cost year/);
  });

  it('rebuilds the same entries after adding opening config and gives later sale valid COGS', () => {
    const entries = [
      entry({ id: 'o1', operationKind: 'opening', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'equity-draw', creditAccountId: 'equity-draw', weight: '2.00', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold21-product', creditAccountId: 'gold21-product', weight: '1.00', cash: '7000', seq: 2 }),
    ];

    const missing = rebuildCostTimeline(entries, wacAccounts);
    expect(missing.resultsByOperationId.o1.status).toBe('missing_cost_basis');
    expect(missing.resultsByOperationId.s1.status).toBe('missing_cost_basis');

    const configured = rebuildCostTimeline(entries, wacAccounts, buildOpeningCostConfig([{ year: 2026, gold21PriceMinorPerGram: 600000 }]));
    expect(configured.resultsByOperationId.o1.status).toBe('valid');
    expect(configured.resultsByOperationId.s1).toMatchObject({ status: 'valid', cogsMinor: 600000 });
  });

  it('converts EGP opening price input to piaster minor units', () => {
    expect(parseEgpToMinorUnits('4000')).toBe(400000);
    expect(parseEgpToMinorUnits('60.25')).toBe(6025);
  });

  it('opening silver uses the configured annual silver opening price', () => {
    const openingConfig = buildOpeningCostConfig([{ year: 2026, silverPriceMinorPerGram: '6000' }]);
    const entries = [entry({ id: 'o1', operationKind: 'opening', debit: 'silver', debitAccountId: 'silver', credit: 'equity-draw', creditAccountId: 'equity-draw', weight: '2.00' })];
    expect(rebuildCostTimeline(entries, wacAccounts, openingConfig).resultsByOperationId.o1).toMatchObject({ status: 'valid', incomingCostMinor: 12000 });
  });

  it('missing sale cost basis marks profit as incomplete instead of revenue profit', () => {
    const entries = [entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '1.00', cash: '100' })];
    const analysis = analyzeProfitability(entries, wacAccounts, 9999, 9999, '2026-01-01', '2026-12-31', cfg);
    expect(analysis.profitStatus).toBe('incomplete_cost_basis');
    expect(analysis.accData.silver.grossProfit).toBeNull();
    expect(analysis.accData.silver.cogs).toBe(0);
  });

  it('rejects source and destination being the same account', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50', seq: 1 }),
      entry({ id: 't1', operationKind: 'transfer', debit: 'silver', debitAccountId: 'silver', credit: 'silver', creditAccountId: 'silver', weight: '1.00', seq: 2 }),
    ];
    expect(op(entries, 't1').status).toBe('invalid_operation');
  });

  it('rejects cross-metal transfer without changing cost state', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50', seq: 1 }),
      entry({ id: 't1', operationKind: 'transfer', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'silver', creditAccountId: 'silver', weight: '1.00', seq: 2 }),
    ];
    expect(op(entries, 't1').status).toBe('invalid_operation');
    expect(state(entries, 'silver')).toMatchObject({ quantityUnits: 100, totalCostMinor: 5000 });
  });

  it('keeps transfer source unchanged when destination state would overflow', () => {
    const sourceAccessory: Account = { id: 'accessory-source', name: 'accessory-source', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, karat: null, metal: null, userId: 'u1' };
    const destinationAccessory: Account = { id: 'accessory-destination', name: 'accessory-destination', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, karat: null, metal: null, userId: 'u1' };
    const localAccounts = [...accounts, sourceAccessory, destinationAccessory];
    const entries = [
      entry({ id: 'dest-seed', operationKind: 'purchase', debit: 'accessory-destination', debitAccountId: 'accessory-destination', credit: 'cash', creditAccountId: 'cash', count: '1', cash: '90071992547409.91', seq: 1 }),
      entry({ id: 'source-seed', operationKind: 'purchase', debit: 'accessory-source', debitAccountId: 'accessory-source', credit: 'cash', creditAccountId: 'cash', count: '1', cash: '0.01', seq: 2 }),
      entry({ id: 'transfer-overflow', operationKind: 'transfer', debit: 'accessory-destination', debitAccountId: 'accessory-destination', credit: 'accessory-source', creditAccountId: 'accessory-source', count: '1', seq: 3 }),
    ];
    const timeline = rebuildCostTimeline(entries, localAccounts, cfg);

    expect(timeline.resultsByOperationId['transfer-overflow'].status).toBe('invalid_operation');
    expect(timeline.finalStates['accessory-source']).toMatchObject({ quantityUnits: 1000, totalCostMinor: 1 });
    expect(timeline.finalStates['accessory-destination']).toMatchObject({ quantityUnits: 1000, totalCostMinor: Number.MAX_SAFE_INTEGER });
  });

  it('keeps tafiet source unchanged when destination state would overflow', () => {
    const sourceAccessory: Account = { id: 'tafiet-source', name: 'tafiet-source', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, karat: null, metal: null, userId: 'u1' };
    const destinationAccessory: Account = { id: 'tafiet-destination', name: 'tafiet-destination', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, karat: null, metal: null, userId: 'u1' };
    const localAccounts = [...accounts, sourceAccessory, destinationAccessory];
    const entries = [
      entry({ id: 'dest-seed', operationKind: 'purchase', debit: 'tafiet-destination', debitAccountId: 'tafiet-destination', credit: 'cash', creditAccountId: 'cash', count: '1', cash: '90071992547409.91', seq: 1 }),
      entry({ id: 'source-seed', operationKind: 'purchase', debit: 'tafiet-source', debitAccountId: 'tafiet-source', credit: 'cash', creditAccountId: 'cash', count: '1', cash: '0.01', seq: 2 }),
      entry({ id: 'tafiet-overflow', operationKind: 'tifeet', debit: 'tafiet-destination', debitAccountId: 'tafiet-destination', credit: 'tafiet-source', creditAccountId: 'tafiet-source', count: '1', seq: 3 }),
    ];
    const timeline = rebuildCostTimeline(entries, localAccounts, cfg);

    expect(timeline.resultsByOperationId['tafiet-overflow'].status).toBe('invalid_operation');
    expect(timeline.finalStates['tafiet-source']).toMatchObject({ quantityUnits: 1000, totalCostMinor: 1 });
    expect(timeline.finalStates['tafiet-destination']).toMatchObject({ quantityUnits: 1000, totalCostMinor: Number.MAX_SAFE_INTEGER });
  });

  it('invalid legacy seq does not produce a NaN comparator result', () => {
    const a = entry({ id: 'a', seq: 'bad' as unknown as number, createdAt: { seconds: 2 } });
    const b = entry({ id: 'b', seq: 'also-bad' as unknown as number, createdAt: { seconds: 1 } });
    expect(Number.isNaN(compareEntriesForCost(a, b))).toBe(false);
    expect([a, b].sort(compareEntriesForCost).map(e => e.id)).toEqual(['b', 'a']);
  });

  it('same entries in different array orders rebuild an identical timeline', () => {
    const entries = [
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.50', seq: 2 }),
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50', seq: 1 }),
    ];
    expect(rebuildCostTimeline(entries, wacAccounts, cfg).results).toEqual(rebuildCostTimeline([...entries].reverse(), wacAccounts, cfg).results);
  });

  it('February report uses January cost basis for February sales', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50', date: '2026-01-10', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '0.50', cash: '40', date: '2026-02-10', seq: 2 }),
    ];
    const analysis = analyzeProfitability(entries, wacAccounts, 1, 1, '2026-02-01', '2026-02-28', cfg);
    expect(analysis.accData.silver.cogs).toBe(25);
    expect(analysis.accData.silver.grossProfit).toBe(15);
  });

  it('legacy entry missing cost is reported as missing cost basis', () => {
    const entries = [entry({ id: 'legacy', operationKind: 'purchase', debit: 'gold21-product', debitAccountId: 'gold21-product', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '0' })];
    expect(op(entries, 'legacy').status).toBe('missing_cost_basis');
  });
});
describe('gold equivalent-21 calculation engine', () => {
  it('calculates 18K equivalent using centigram units', () => {
    const result = calculateGoldEquivalent21('10.50', 18);
    expect(result.physicalWeight).toBe('10.50');
    expect(result.physicalWeightUnits).toBe(1050);
    expect(result.equivalent21).toBe('9.00');
    expect(result.equivalent21Units).toBe(900);
  });

  it('calculates 21K equivalent without changing the weight', () => {
    expect(calculateGoldEquivalent21('10.50', 21).equivalent21).toBe('10.50');
  });

  it('calculates 24K equivalent rounded to two decimals', () => {
    const result = calculateGoldEquivalent21('10.50', 24);
    expect(result.equivalent21).toBe('12.00');
    expect(result.equivalent21Units).toBe(1200);
  });

  it('accepts the smallest valid physical weight', () => {
    const result = calculateGoldEquivalent21('0.01', 18);
    expect(result.physicalWeightUnits).toBe(1);
    expect(result.equivalent21).toBe('0.01');
  });

  it('rounds equivalent weights to centigrams without accepting over-precise input', () => {
    expect(calculateGoldEquivalent21('0.01', 24).equivalent21).toBe('0.01');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid weight %s', (weight) => {
    expect(() => calculateGoldEquivalent21(weight, 21)).toThrow();
  });

  it('rejects unsupported karats', () => {
    expect(() => calculateGoldEquivalent21('1.00', 22)).toThrow();
  });

  it('does not expose floating-point drift for repeated decimal cases', () => {
    const outputs = Array.from({ length: 10 }, () => calculateGoldEquivalent21('0.10', 18).equivalent21);
    expect(outputs).toEqual(Array(10).fill('0.09'));
  });

  it('returns all required snapshot fields', () => {
    const result = calculateGoldEquivalent21('2.00', 24);
    expect(result).toMatchObject({
      physicalWeight: '2.00',
      physicalWeightUnits: 200,
      karat: 24,
      equivalent21: '2.29',
      equivalent21Units: 229,
      roundingScale: '0.01g',
      calculationVersion: GOLD_EQUIVALENT_21_CALCULATION_VERSION,
    });
  });

  it('reports legacy matches', () => {
    const calculated = calculateGoldEquivalent21('10.50', 18);
    expect(compareLegacyGoldEquivalent21('9.00', calculated)).toMatchObject({
      legacyValue: '9.00',
      calculatedValue: '9.00',
      difference: '0.00',
      mismatch: false,
    });
  });

  it('reports legacy mismatches without changing the legacy value', () => {
    const calculated = calculateGoldEquivalent21('10.50', 18);
    expect(compareLegacyGoldEquivalent21('8.99', calculated)).toMatchObject({
      legacyValue: '8.99',
      calculatedValue: '9.00',
      difference: '0.01',
      mismatch: true,
    });
  });
  it.each(['1.005', '10abc', '1e2', '', '0', '-1'])('rejects invalid string weight %s', (weight) => {
    expect(() => calculateGoldEquivalent21(weight, 21)).toThrow();
  });

  it.each(['1', '1.2', '1.20', '0.01'])('accepts valid string weight %s', (weight) => {
    expect(calculateGoldEquivalent21(weight, 21).physicalWeight).toBe(Number(weight).toFixed(2));
  });

  it('does not create a legacy mismatch for a new entry without a real legacy value', () => {
    const audit = buildGoldEquivalent21Audit('10.50', 18);
    expect(audit?.snapshot.equivalent21).toBe('9.00');
    expect(audit?.legacyComparison).toBeNull();
  });

  it('compares edited old entries against the original stored legacy value', () => {
    const audit = buildGoldEquivalent21Audit('10.50', 18, '8.99');
    expect(audit?.legacyComparison).toMatchObject({ legacyValue: '8.99', calculatedValue: '9.00', mismatch: true });
  });

  it('uses legacy arabicWeight fallback for old records without snapshot, karat, or reliable multiplier', () => {
    const oldEntry = entry({ debit: 'gold18-product', credit: 'cash', weight: '10.00', arabicWeight: '8.50', multiplier: undefined, karat: undefined });
    expect(getMetricValue(oldEntry, 'gold', accounts)).toBe(8.5);
  });

  it('does not route silver entries through the gold equivalent engine', () => {
    const silverEntry = entry({ debit: 'silver', credit: 'cash', weight: '3.00', karat: undefined, multiplier: undefined });
    expect(getMetricValue(silverEntry, 'gold', accounts)).toBe(0);
    expect(getMetricValue(silverEntry, 'silver', accounts)).toBe(3);
  });
});
