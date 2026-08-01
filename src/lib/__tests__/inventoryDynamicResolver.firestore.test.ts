import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';

const account = (overrides: Partial<Account>): Account => ({
  id: 'other', name: 'other', mainType: 'assets', subType: 'other', balanceNature: 'EGP', userId: 'test', ...overrides,
});
const cash = account({ id: 'cash', name: 'cash', type: 'cash', is_inventory: false });
const baselineAccounts: Account[] = [
  account({ id: 'gold', name: 'gold', type: 'gold_product', metal: 'gold', karat: '21', is_inventory: true }),
  account({ id: 'silver', name: 'silver', type: 'silver', metal: 'silver', karat: null, is_inventory: true }),
  account({ id: 'old-accessory', name: 'old accessory', type: 'accessory', metal: null, karat: null, is_inventory: true }),
  cash,
];
let seq = 0;
const entry = (overrides: Partial<Entry>): Entry => ({
  id: `dynamic-${++seq}`, seq, date: '2026-01-01', tx: '', debit: '', credit: '', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'test', ...overrides,
});
const purchase = (id: string, inventory: Account, quantity: string, amount: string): Entry => entry({
  id, operationKind: 'purchase', tx: 'purchase', debit: inventory.name, debitAccountId: inventory.id,
  credit: cash.name, creditAccountId: cash.id, cash: amount,
  ...(inventory.type === 'accessory' || inventory.inventoryKind === 'accessory' ? { count: quantity } : { weight: quantity, arabicWeight: quantity }),
});
const sale = (id: string, inventory: Account, quantity: string, amount: string): Entry => entry({
  id, operationKind: 'sale', tx: 'sale', debit: cash.name, debitAccountId: cash.id,
  credit: inventory.name, creditAccountId: inventory.id, cash: amount,
  ...(inventory.type === 'accessory' || inventory.inventoryKind === 'accessory' ? { count: quantity } : { weight: quantity, arabicWeight: quantity }),
});
const total = (timeline: ReturnType<typeof rebuildInventoryCostTimeline>) => ({
  cogs: timeline.results.reduce((sum, result) => sum + result.totalCogsMinor, 0) / 100,
  bookValue: Object.values(timeline.finalStates).reduce((sum, state) => sum + state.remainingTotalCostMinor, 0) / 100,
  profit: timeline.results.reduce((sum, result) => sum + (result.profitMinor ?? 0), 0) / 100,
});

const gold = baselineAccounts[0];
const silver = baselineAccounts[1];
const oldAccessory = baselineAccounts[2];
const baselineEntries = [
  purchase('base-gold-buy', gold, '10', '1000'), sale('base-gold-sale', gold, '2', '400'),
  purchase('base-silver-buy', silver, '5', '500'),
  purchase('base-accessory-buy', oldAccessory, '4', '200'), sale('base-accessory-sale', oldAccessory, '1', '100'),
];
const randomAccessory = account({
  id: 'random-7f2d9', name: 'totally random inventory name', is_inventory: true,
  inventoryKind: 'accessory', measurementDimension: 'quantity', costingMethod: 'fixed-opening-cost',
});

describe.runIf(Boolean(process.env.FIRESTORE_EMULATOR_HOST))('dynamic inventory account resolver regression on Firestore Emulator', () => {

  it('1. records the unchanged gold/silver/accessory baseline', () => {
    const timeline = rebuildInventoryCostTimeline(baselineEntries, baselineAccounts);
    expect(timeline.valid).toBe(true);
    expect(total(timeline)).toEqual({ cogs: 250, bookValue: 1450, profit: 250 });
  });

  it('2. discovers a new zero-balance account without changing the baseline', () => {
    const timeline = rebuildInventoryCostTimeline(baselineEntries, [...baselineAccounts, randomAccessory]);
    expect(timeline.diagnostics.some(item => item.code === 'unknown_inventory_account')).toBe(false);
    expect(total(timeline)).toEqual({ cogs: 250, bookValue: 1450, profit: 250 });
    expect(timeline.accountValuations?.[randomAccessory.id!]).toEqual({
      accountId: randomAccessory.id, quantity: 0, bookValue: 0, averageCost: null, valuationStatus: 'empty-uninitialized',
    });
    expect(timeline.completeness).toBe('complete');
  });

  it('3. establishes cost basis from the first actual purchase', () => {
    const timeline = rebuildInventoryCostTimeline([purchase('new-first-buy', randomAccessory, '10', '1000')], [randomAccessory, cash]);
    expect(timeline.accountValuations?.[randomAccessory.id!]).toEqual({
      accountId: randomAccessory.id, quantity: 10, bookValue: 1000, averageCost: 100, valuationStatus: 'ready',
    });
  });

  it('4. calculates partial-sale COGS and ending balance', () => {
    const timeline = rebuildInventoryCostTimeline([
      purchase('new-buy-for-sale', randomAccessory, '10', '1000'),
      sale('new-partial-sale', randomAccessory, '4', '600'),
    ], [randomAccessory, cash]);
    expect(timeline.resultsByOperationId['new-partial-sale']).toMatchObject({ totalCogsMinor: 40000, profitMinor: 20000 });
    expect(timeline.accountValuations?.[randomAccessory.id!]).toMatchObject({ quantity: 6, bookValue: 600, averageCost: 100, valuationStatus: 'ready' });
  });

  it('5. isolates a positive legacy balance with no cost basis and blocks its sale specifically', () => {
    const legacy = account({ ...randomAccessory, id: 'legacy-missing-basis', name: 'legacy missing basis' });
    const opening = entry({ id: 'legacy-opening', operationKind: 'opening', tx: 'opening', debit: legacy.name, debitAccountId: legacy.id, credit: 'equity', creditAccountId: 'equity', count: '10' });
    const timeline = rebuildInventoryCostTimeline([...baselineEntries, opening], [...baselineAccounts, legacy]);
    expect(timeline.valid).toBe(true);
    expect(total(timeline)).toEqual({ cogs: 250, bookValue: 1450, profit: 250 });
    expect(timeline.accountValuations?.[legacy.id!]).toMatchObject({ quantity: 10, bookValue: 0, averageCost: null, valuationStatus: 'missing-cost-basis' });
    expect(timeline.completeness).toBe('partial');
    expect(timeline.excludedAccounts).toContainEqual({ accountId: legacy.id, reason: 'missing_cost_basis' });
    const rejected = rebuildInventoryCostTimeline([opening, sale('legacy-sale', legacy, '1', '100')], [legacy, cash]);
    expect(rejected.diagnostics[0]).toMatchObject({ code: 'inventory_cost_basis_required', inventoryAccountId: legacy.id });
  });

  it('6. isolates missing metadata and prevents saving to that account', () => {
    const invalid = account({ id: 'metadata-missing', name: 'metadata missing', is_inventory: true });
    const report = rebuildInventoryCostTimeline(baselineEntries, [...baselineAccounts, invalid]);
    expect(report.valid).toBe(true);
    expect(total(report)).toEqual({ cogs: 250, bookValue: 1450, profit: 250 });
    expect(report.completeness).toBe('partial');
    expect(report.excludedAccounts).toContainEqual({ accountId: invalid.id, reason: 'missing_inventory_type' });
    expect(report.accountValuations?.[invalid.id!]?.valuationStatus).toBe('invalid-configuration');
    const pending = purchase('__pending_invalid__', invalid, '1', '100');
    const rejected = rebuildInventoryCostTimeline([pending], [invalid, cash], {}, { saveValidationOperationId: pending.id });
    expect(rejected.diagnostics[0]).toMatchObject({ code: 'missing_inventory_type', inventoryAccountId: invalid.id });
  });

  it('7. accepts arbitrary id and name solely from valid metadata', () => {
    const arbitrary = account({ ...randomAccessory, id: 'X-random-934857', name: 'random name 934857' });
    const timeline = rebuildInventoryCostTimeline([purchase('arbitrary-buy', arbitrary, '2', '240')], [arbitrary, cash]);
    expect(timeline.valid).toBe(true);
    expect(timeline.accountValuations?.[arbitrary.id!]).toMatchObject({ quantity: 2, bookValue: 240, averageCost: 120, valuationStatus: 'ready' });
    expect(timeline.diagnostics.some(item => item.code === 'unknown_inventory_account')).toBe(false);
  });
});