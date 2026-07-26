import { describe, expect, it } from 'vitest';
import { Account, Entry, InventoryCheck } from '../../types';
import {
  buildInventoryAdjustmentDraftEntry,
  calculateInventoryCheckDiff,
  effectiveInventoryCheckStatus,
  prepareEntryForCentralSave,
  statusForInventoryCheck,
} from '../inventoryCheckSettlement';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import { buildOpeningCostConfig } from '../openingCostConfig';
import { buildDailyJournalReport } from '../dailyJournalReport';
import { buildLedgerReport } from '../ledgerReport';
import { buildTrialBalanceReport } from '../trialBalanceReport';

const userId = 'u1';

const account = (partial: Partial<Account>): Account => ({
  id: partial.id || partial.name || 'account',
  name: partial.name || partial.id || 'account',
  mainType: partial.mainType || 'اصول',
  subType: partial.subType || '',
  balanceNature: partial.balanceNature || 'جنية مصري',
  userId,
  type: partial.type || 'other',
  is_inventory: partial.is_inventory ?? false,
  metal: partial.metal ?? null,
  karat: partial.karat ?? null,
  quantityStep: partial.quantityStep,
});

const accounts: Account[] = [
  account({ id: 'seed-account-ea099bf0071894125ad3', name: 'ذهب 21', balanceNature: 'جرام ذهب', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' }),
  account({ id: 'seed-account-feed1210d025ed84e443', name: 'فضة', balanceNature: 'جرام فضة', type: 'silver', is_inventory: true, metal: 'silver' }),
  account({ id: 'seed-account-93c8c8cf9d87c00e1e88', name: 'ملحق', balanceNature: 'قطعة', type: 'accessory', is_inventory: true, quantityStep: 1 }),
  account({ id: 'equity', name: 'رأس المال', mainType: 'حقوق ملكية', balanceNature: 'جنية مصري' }),
  account({ id: 'gold-shortage', name: 'عجز-الذهب', mainType: 'مصروفات', subType: 'تسوية', balanceNature: 'جرام ذهب' }),
  account({ id: 'gold-surplus', name: 'زيادة-الذهب', mainType: 'ايرادات', subType: 'تسوية', balanceNature: 'جرام ذهب' }),
  account({ id: 'silver-shortage', name: 'عجز-الفضة', mainType: 'مصروفات', subType: 'تسوية', balanceNature: 'جرام فضة', metal: 'silver' }),
  account({ id: 'silver-surplus', name: 'زيادة-الفضة', mainType: 'ايرادات', subType: 'تسوية', balanceNature: 'جرام فضة', metal: 'silver' }),
];

const openingConfigRows = [{ year: 2026, gold21PriceEgp: 100, silverPriceEgp: 20, accessoryOpeningCosts: { 'seed-account-93c8c8cf9d87c00e1e88': 25 } }];

const entry = (partial: Partial<Entry>): Entry => ({
  id: partial.id,
  seq: partial.seq ?? 1,
  tx: partial.tx || 'قيد افتتاحي',
  operationKind: partial.operationKind,
  debit: partial.debit || '',
  debitAccountId: partial.debitAccountId,
  credit: partial.credit || '',
  creditAccountId: partial.creditAccountId,
  date: partial.date || '2026-01-01',
  cash: partial.cash || '0',
  weight: partial.weight || '0',
  count: partial.count || '0',
  arabicWeight: partial.arabicWeight || '0',
  karat: partial.karat,
  multiplier: partial.multiplier,
  invoiceNumber: partial.invoiceNumber,
  notes: partial.notes || '',
  userId,
  inventoryCheckId: partial.inventoryCheckId,
});

const defaultCostedEntries = (): Entry[] => [
  entry({ id: 'open-gold-default', debit: 'ذهب 21', debitAccountId: 'seed-account-ea099bf0071894125ad3', credit: 'رأس المال', creditAccountId: 'equity', weight: '10', karat: 21 }),
  entry({ id: 'open-silver-default', seq: 2, debit: 'فضة', debitAccountId: 'seed-account-feed1210d025ed84e443', credit: 'رأس المال', creditAccountId: 'equity', weight: '10' }),
  entry({ id: 'open-acc-default', seq: 3, debit: 'ملحق', debitAccountId: 'seed-account-93c8c8cf9d87c00e1e88', credit: 'رأس المال', creditAccountId: 'equity', count: '4' }),
];

const prepare = (check: InventoryCheck, entries: Entry[] = []) => {
  const validationEntries = entries.length ? entries : defaultCostedEntries();
  const draft = buildInventoryAdjustmentDraftEntry({ check, accountsDb: accounts, entries, userId, now: 10 });
  expect(draft.ok).toBe(true);
  if (!draft.ok) throw new Error(draft.message);
  const prepared = prepareEntryForCentralSave({
    entry: draft.entry,
    entries: validationEntries,
    accountsDb: accounts,
    openingCostConfig: openingConfigRows,
    canonicalAccounts: [],
  });
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) throw new Error(prepared.message);
  return prepared.entry;
};

describe('inventory check settlement flow', () => {
  it('keeps draft/matched checks out of entries until posting', () => {
    const draftCheck = { systemWeight: 10, actualWeight: 9, systemCount: 2, actualCount: 2 };
    const matchedCheck = { systemWeight: 10, actualWeight: 10, systemCount: 2, actualCount: 2 };
    expect(statusForInventoryCheck(draftCheck)).toBe('draft');
    expect(statusForInventoryCheck(matchedCheck)).toBe('matched');
    expect(calculateInventoryCheckDiff(draftCheck)).toMatchObject({ weightDiff: -1, countDiff: 0, hasDiff: true });
    expect(buildInventoryAdjustmentDraftEntry({
      check: { id: 'm1', accountId: 'ذهب 21', date: '2026-01-02', ...matchedCheck, notes: '', userId },
      accountsDb: accounts,
      entries: [],
      userId,
    }).ok).toBe(false);
  });

  it('builds gold shortage and surplus adjustment entries with central metadata', () => {
    const shortage = prepare({ id: 'c1', accountId: 'ذهب 21', accountDbId: 'seed-account-ea099bf0071894125ad3', date: '2026-01-02', systemWeight: 10, actualWeight: 9, systemCount: 1, actualCount: 3, notes: '', userId });
    expect(shortage).toMatchObject({ tx: 'تسوية', operationKind: 'adjustment', debit: 'عجز-الذهب', credit: 'ذهب 21', debitAccountId: 'gold-shortage', creditAccountId: 'seed-account-ea099bf0071894125ad3', weight: '1.00', count: '2.00', inventoryCheckId: 'c1' });
    expect(shortage.invoiceNumber).toBe('ADJ-2026-0001');
    expect(shortage.goldEquivalent21Snapshot?.equivalent21).toBe('1.00');

    const surplus = prepare({ id: 'c2', accountId: 'ذهب 21', accountDbId: 'seed-account-ea099bf0071894125ad3', date: '2026-01-02', systemWeight: 10, actualWeight: 11, systemCount: 1, actualCount: 1, notes: '', userId });
    expect(surplus).toMatchObject({ debit: 'ذهب 21', credit: 'زيادة-الذهب', debitAccountId: 'seed-account-ea099bf0071894125ad3', creditAccountId: 'gold-surplus', weight: '1.00' });
  });

  it('builds silver shortage and surplus adjustment entries', () => {
    const shortage = prepare({ id: 's1', accountId: 'فضة', accountDbId: 'seed-account-feed1210d025ed84e443', date: '2026-01-02', systemWeight: 5, actualWeight: 4, systemCount: 0, actualCount: 0, notes: '', userId });
    expect(shortage).toMatchObject({ debit: 'عجز-الفضة', credit: 'فضة', debitAccountId: 'silver-shortage', creditAccountId: 'seed-account-feed1210d025ed84e443', weight: '1.00' });

    const surplus = prepare({ id: 's2', accountId: 'فضة', accountDbId: 'seed-account-feed1210d025ed84e443', date: '2026-01-02', systemWeight: 5, actualWeight: 6, systemCount: 0, actualCount: 0, notes: '', userId });
    expect(surplus).toMatchObject({ debit: 'فضة', credit: 'زيادة-الفضة', debitAccountId: 'seed-account-feed1210d025ed84e443', creditAccountId: 'silver-surplus', weight: '1.00' });
  });

  it('keeps metal count-only adjustments out of cost movement', () => {
    const opening = entry({ id: 'open-gold', debit: 'ذهب 21', debitAccountId: 'seed-account-ea099bf0071894125ad3', credit: 'رأس المال', creditAccountId: 'equity', weight: '10', karat: 21 });
    const countOnly = prepare({ id: 'count-only', accountId: 'ذهب 21', accountDbId: 'seed-account-ea099bf0071894125ad3', date: '2026-01-02', systemWeight: 10, actualWeight: 10, systemCount: 1, actualCount: 2, notes: '', userId }, [opening]);
    const timeline = rebuildInventoryCostTimeline([opening, { ...countOnly, id: 'count-only-entry' }], accounts, buildOpeningCostConfig(openingConfigRows, accounts));
    expect(timeline.resultsByOperationId['count-only-entry']).toMatchObject({ classification: 'quantity_only', adjustmentGainMinor: 0, adjustmentLossMinor: 0 });
  });

  it('uses accessory WAC per piece for posted inventory checks', () => {
    const opening = entry({ id: 'open-acc', debit: 'ملحق', debitAccountId: 'seed-account-93c8c8cf9d87c00e1e88', credit: 'رأس المال', creditAccountId: 'equity', count: '4' });
    const shortage = prepare({ id: 'acc-short', accountId: 'ملحق', accountDbId: 'seed-account-93c8c8cf9d87c00e1e88', date: '2026-01-02', systemWeight: 0, actualWeight: 0, systemCount: 4, actualCount: 3, notes: '', userId }, [opening]);
    const timeline = rebuildInventoryCostTimeline([opening, { ...shortage, id: 'acc-short-entry' }], accounts, buildOpeningCostConfig(openingConfigRows, accounts));
    expect(timeline.resultsByOperationId['acc-short-entry'].adjustmentLossMinor).toBe(2500);
  });

  it('prevents double post via effective posted status', () => {
    expect(effectiveInventoryCheckStatus({ id: 'posted', accountId: 'ذهب 21', date: '2026-01-02', systemWeight: 10, actualWeight: 9, systemCount: 0, actualCount: 0, notes: '', userId, postedEntryId: 'entry-1' })).toBe('posted');
  });

  it('posted settlement appears in journal, ledger and trial balance', () => {
    const opening = entry({ id: 'open-gold', debit: 'ذهب 21', debitAccountId: 'seed-account-ea099bf0071894125ad3', credit: 'رأس المال', creditAccountId: 'equity', weight: '10', karat: 21 });
    const settlement = { ...prepare({ id: 'report-check', accountId: 'ذهب 21', accountDbId: 'seed-account-ea099bf0071894125ad3', date: '2026-01-02', systemWeight: 10, actualWeight: 9, systemCount: 0, actualCount: 0, notes: '', userId }, [opening]), id: 'settlement-entry' };
    const all = [opening, settlement];
    const journal = buildDailyJournalReport(all, accounts, '2026-01-02');
    expect(journal.dimensions.gold.periodLegs.some(leg => leg.sourceEntryId === 'settlement-entry')).toBe(true);

    const ledger = buildLedgerReport(all, accounts, accounts[0], 'gold', '2026-01-01', '2026-12-31');
    expect(ledger.rows.some(row => row.entry.id === 'settlement-entry')).toBe(true);

    const trial = buildTrialBalanceReport(all, accounts, 'gold', '2026-01-01', '2026-12-31');
    expect(trial.groups.flatMap(group => group.rows).some(row => row.accountName === 'عجز-الذهب')).toBe(true);
  });
});
