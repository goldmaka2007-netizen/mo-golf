import { describe, expect, it } from 'vitest';
import { analyzeProfitability, processCostBasis, processInventory } from '../engine';
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

    expect(basis.getCost('gold18-product')).toBe(3000);
    expect(basis.getCost('gold18-raw')).toBe(3000);
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