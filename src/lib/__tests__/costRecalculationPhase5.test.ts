import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import {
  areOperationWritesLocked,
  commitCostCalculationRun,
  createCostInputRevision,
  executeCostCalculationRun,
  findEarliestCostAffectedOperationId,
  isCostReportAvailable,
} from '../costRecalculation';

const goldId = 'seed-account-f7259c51816b3eca60b0';
const accessoryId = 'seed-account-8d4a16e5eb12e1278df0';
const accounts: Account[] = [
  { id: goldId, name: 'خاتم حريمي', mainType: 'اصول', subType: 'مخزون ذهب', balanceNature: 'جرام ذهب', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '18' },
  { id: accessoryId, name: 'حلق طبي', mainType: 'اصول', subType: 'مخزون ملحقات', balanceNature: 'قطعة', userId: 'u', type: 'accessory', is_inventory: true, metal: null, karat: null },
  { id: 'equity', name: 'رأس المال', mainType: 'حقوق ملكية', subType: 'رأس المال', balanceNature: 'جنيه', userId: 'u', type: 'other', is_inventory: false },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: 'op',
  seq: 1,
  tx: 'قيد افتتاحي',
  debit: 'خاتم حريمي',
  debitAccountId: goldId,
  credit: 'رأس المال',
  creditAccountId: 'equity',
  date: '2026-01-01',
  cash: '0',
  weight: '10',
  count: '1',
  arabicWeight: '8.57',
  karat: 18,
  notes: '',
  userId: 'u',
  ...overrides,
});

describe('Phase 5 recalculation coordinator', () => {
  it('does not invalidate cost for a gold count-only edit', () => {
    const before = [entry({ count: '1' })];
    const after = [{ ...entry({ count: '2' }), updatedAt: '2026-07-24T00:00:00.000Z' } as Entry];
    const config = { gold21PriceByYearMinor: { '2026': 600000 } };
    expect(createCostInputRevision(before, accounts, config))
      .toBe(createCostInputRevision(after, accounts, config));
    expect(findEarliestCostAffectedOperationId(before, after)).toBeUndefined();
  });

  it('invalidates cost for accessory quantity edits', () => {
    const before = [entry({ id: 'accessory', debit: 'حلق طبي', debitAccountId: accessoryId, weight: '1', count: '1', karat: undefined, arabicWeight: '0' })];
    const after = [{ ...before[0], count: '2' }];
    const config = { accessoryUnitCostByYearAndAccountMinor: { '2026': { [accessoryId]: 500 } } };
    expect(createCostInputRevision(before, accounts, config))
      .not.toBe(createCostInputRevision(after, accounts, config));
    expect(findEarliestCostAffectedOperationId(before, after)).toBe('accessory');
  });

  it('keeps current market price outside book-cost input revision', () => {
    const before = [entry({ marketPrice: 6000 })];
    const after = [entry({ marketPrice: 9000 })];
    const config = { gold21PriceByYearMinor: { '2026': 600000 } };
    expect(createCostInputRevision(before, accounts, config))
      .toBe(createCostInputRevision(after, accounts, config));
    expect(findEarliestCostAffectedOperationId(before, after)).toBeUndefined();
  });

  it('finds the earliest affected operation for edits and deletions', () => {
    const first = entry({ id: 'first', seq: 1 });
    const second = entry({ id: 'second', seq: 2, date: '2026-01-02' });
    expect(findEarliestCostAffectedOperationId([first, second], [first, { ...second, cash: '1' }])).toBe('second');
    expect(findEarliestCostAffectedOperationId([first, second], [second])).toBe('second');
  });

  it('rejects a stale generation commit', () => {
    const result = commitCostCalculationRun(2, {
      generationId: 1,
      inputRevision: 'old',
      catalogVersion: 'test',
      status: 'valid',
    });
    expect(result.accepted).toBe(false);
    if ('diagnostic' in result) expect(result.diagnostic.code).toBe('stale_generation');
  });

  it('keeps writes and reports locked after failed recomputation', () => {
    const inputRevision = createCostInputRevision([entry({})], accounts, {});
    const failed = executeCostCalculationRun({
      generationId: 1,
      inputRevision,
      entries: [entry({})],
      accounts,
      openingConfig: {},
    });
    expect(failed.status).toBe('failed');
    expect(failed.error?.code).toBe('missing_opening_cost');
    expect(areOperationWritesLocked(failed)).toBe(true);
    expect(isCostReportAvailable(failed, inputRevision)).toBe(false);
  });

  it('exposes reports only for the exact current valid input revision', () => {
    const openingConfig = {
      gold21PriceByYearMinor: { '2026': 600000 },
      accessoryUnitCostByYearAndAccountMinor: { '2026': { [accessoryId]: 500 } },
    };
    const entries = [
      entry({}),
      entry({ id: 'accessory', seq: 2, debit: 'حلق طبي', debitAccountId: accessoryId, weight: '1', count: '1', karat: undefined, arabicWeight: '0' }),
    ];
    const inputRevision = createCostInputRevision(entries, accounts, openingConfig);
    const valid = executeCostCalculationRun({
      generationId: 2,
      inputRevision,
      entries,
      accounts,
      openingConfig,
    });
    expect(valid.status).toBe('valid');
    expect(areOperationWritesLocked(valid)).toBe(false);
    expect(isCostReportAvailable(valid, inputRevision)).toBe(true);
    expect(isCostReportAvailable(valid, 'newer-input')).toBe(false);
  });
});
