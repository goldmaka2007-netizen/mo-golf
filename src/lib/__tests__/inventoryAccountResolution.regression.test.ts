import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import {
  PRODUCTION_INVENTORY_ACCOUNT_IDS_IN_SEED_ORDER,
  REPORTED_SILVER_BAND_ACCOUNT_ID,
} from '../../test-fixtures/productionInventoryAccountIds';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from '../inventoryCostCatalog';
import {
  auditSupportedInvoiceInventoryAccountCoverage,
  resolveRuntimeCostAccountInputs,
} from '../runtimeCostAccountResolver';
import { rebuildRuntimeInventoryCostTimeline } from '../costRecalculation';
import { resolveEntryIdentity } from '../entryIdentity';
import { buildAccountRegistry } from '../accountRegistry';
import { buildCanonicalPosting } from '../postingMatrix';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { buildUnifiedTrialBalance } from '../unifiedTrialBalance';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';

const inventorySeeds = SEED_ACCOUNTS.filter(account => account.is_inventory);
const runtimeInventoryAccounts: Account[] = inventorySeeds.map((seed, index) => ({
  ...seed,
  id: PRODUCTION_INVENTORY_ACCOUNT_IDS_IN_SEED_ORDER[index],
  userId: 'runtime-regression',
  quantityStep: seed.type === 'accessory' ? 1 : undefined,
})) as Account[];

const account = (patch: Partial<Account>): Account => ({
  id: 'account', name: 'account', mainType: 'assets', subType: 'other',
  balanceNature: 'cash', type: 'other', userId: 'runtime-regression',
  is_inventory: false, ...patch,
});
const cash = account({ id: 'cash', name: 'cash', type: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash' });
const customer = account({ id: 'customer', name: 'credit customer', canonicalMainType: 'assets', canonicalSubType: 'customer' });
const payable = account({ id: 'payable', name: 'credit supplier', mainType: 'liabilities', canonicalMainType: 'liabilities', canonicalSubType: 'other_due', merchantDirection: 'payable' });
const capital = account({ id: 'capital', name: 'capital', mainType: 'equity', canonicalMainType: 'equity', canonicalSubType: 'capital' });
const accounts = [...runtimeInventoryAccounts, cash, customer, payable, capital];

const TX_OPENING = '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a';
const TX_GOLD_SALE = '\u0628\u064a\u0639 \u0630\u0647\u0628';
const TX_GOLD_PURCHASE = '\u0634\u0631\u0627\u0621 \u0630\u0647\u0628';
const TX_SILVER_SALE = '\u0628\u064a\u0639 \u0641\u0636\u0629';
const TX_SILVER_PURCHASE = '\u0634\u0631\u0627\u0621 \u0641\u0636\u0629';
const TX_ACCESSORY_SALE = '\u0628\u064a\u0639 \u0645\u0644\u062d\u0642\u0627\u062a';
const TX_ACCESSORY_PURCHASE = '\u0634\u0631\u0627\u0621 \u0645\u0644\u062d\u0642\u0627\u062a';

const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, date: '2026-06-09', tx: 'operation', operationKind: 'other',
  debit: '', credit: '', cash: '0', weight: '0', arabicWeight: '0', count: '0',
  notes: '', userId: 'runtime-regression', ...patch,
});

const silverBand = runtimeInventoryAccounts[22];
const exactOpening = entry({
  id: 'opening', date: '2026-01-01', operationKind: 'opening', tx: TX_OPENING,
  debit: silverBand.name, debitAccountId: silverBand.id,
  credit: capital.name, creditAccountId: capital.id,
  weight: '10', arabicWeight: '10', count: '3',
});
const exactDraft = entry({
  id: '__pending_cost_validation__', seq: 2, operationKind: 'sale', tx: TX_SILVER_SALE,
  debit: cash.name, credit: silverBand.name, cash: '500', weight: '2.72',
  arabicWeight: '2.72', count: '1', invoiceNumber: 'S-RUNTIME-REGRESSION',
});

describe('reported unknown_inventory_account regression', () => {
  it('passes the complete save, WAC, Book Value, COGS and journal path exactly once', () => {
    expect(silverBand.id).toBe(REPORTED_SILVER_BAND_ACCOUNT_ID);
    const identity = resolveEntryIdentity(exactDraft, accounts);
    expect(identity.ok).toBe(true);
    if (identity.ok === false) throw new Error(identity.message);
    const pending = { ...exactDraft, ...identity.value };
    const posting = buildCanonicalPosting(pending, buildAccountRegistry(accounts));
    expect(posting.valid, JSON.stringify(posting.issues)).toBe(true);

    const timeline = rebuildRuntimeInventoryCostTimeline(
      [exactOpening, pending], accounts,
      { silverPriceByYearMinor: { '2026': 10000 } },
      { historicalInventoryOverlayDirectives: [] },
    );
    expect(timeline.valid, JSON.stringify(timeline.diagnostics)).toBe(true);
    expect(timeline.diagnostics.some(item => item.code === 'unknown_inventory_account')).toBe(false);
    expect(timeline.resultsByOperationId[pending.id!]).toMatchObject({
      classification: 'sale', sourceInventoryAccountId: REPORTED_SILVER_BAND_ACCOUNT_ID,
      totalCogsMinor: 27200,
    });
    expect(timeline.finalStates[REPORTED_SILVER_BAND_ACCOUNT_ID]).toMatchObject({
      actualPhysicalWeightUnits: 728,
      remainingTotalCostMinor: 72800,
      totalWacMinorPerDisplayUnit: 10000,
    });

    const saleLegs = buildLegacyLedgerLegs(
      [exactOpening, pending], accounts, [],
      { enableFinancialProjection: true, costTimeline: timeline },
    ).filter(leg => leg.sourceEntryId === pending.id);
    expect(saleLegs.filter(leg => leg.entityId === `account:${silverBand.id}::cogs` && leg.side === 'debit')).toHaveLength(1);
    expect(saleLegs.filter(leg => leg.entityId === `account:${silverBand.id}::sales` && leg.side === 'credit')).toHaveLength(1);
    expect(saleLegs.filter(leg => leg.entityId === `product:${silverBand.id}` && leg.dimension === 'book_value' && leg.side === 'credit')).toHaveLength(1);
    const bookDebit = saleLegs.filter(leg => leg.dimension === 'book_value' && leg.side === 'debit').reduce((sum, leg) => sum + leg.amountMinor, 0);
    const bookCredit = saleLegs.filter(leg => leg.dimension === 'book_value' && leg.side === 'credit').reduce((sum, leg) => sum + leg.amountMinor, 0);
    expect(bookDebit).toBe(27200);
    expect(bookCredit).toBe(27200);

    const trial = buildUnifiedTrialBalance([exactOpening, pending], accounts, '2026-01-01', '2026-12-31', { timeline });
    const statements = buildFinancialStatementsEgp([exactOpening, pending], accounts, { timeline, balanceEndDate: '2026-12-31' });
    expect(trial.financialBalanced).toBe(true);
    expect(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity).toBe(0);
  });

  it('still rejects a genuinely unknown entry accountId', () => {
    const invalid = { ...exactDraft, creditAccountId: 'random-invalid-inventory-account' };
    const timeline = rebuildRuntimeInventoryCostTimeline(
      [exactOpening, invalid], accounts,
      { silverPriceByYearMinor: { '2026': 10000 } },
      { historicalInventoryOverlayDirectives: [] },
    );
    expect(timeline.valid).toBe(false);
    expect(timeline.diagnostics[0].code).toBe('unknown_inventory_account');
  });
});

describe('invoice inventory-account resolver audit', () => {
  it('covers every active production gold, silver and accessory account emitted by invoice mappings', () => {
    const audit = auditSupportedInvoiceInventoryAccountCoverage(runtimeInventoryAccounts);
    expect(audit.errors).toEqual([]);
    expect(audit.coverage).toHaveLength(32);
    expect(audit.coverage.filter(item => item.kind === 'gold')).toHaveLength(20);
    expect(audit.coverage.filter(item => item.kind === 'silver')).toHaveLength(9);
    expect(audit.coverage.filter(item => item.kind === 'accessory')).toHaveLength(3);
    expect(new Set(audit.coverage.map(item => item.emittedAccountId))).toEqual(
      new Set(PRODUCTION_INVENTORY_ACCOUNT_IDS_IN_SEED_ORDER),
    );
  });

  it('supports item-specific cloned inventory through its audited source taxonomy', () => {
    const clone: Account = {
      ...silverBand, id: 'item-specific-silver-band', name: 'custom silver band',
      cloneSourceAccountId: silverBand.id,
    };
    const cloneAccounts = [...accounts, clone];
    const cloneOpening = entry({
      id: 'clone-opening', operationKind: 'opening', tx: TX_OPENING,
      debit: clone.name, debitAccountId: clone.id, credit: capital.name, creditAccountId: capital.id,
      weight: '4', arabicWeight: '4',
    });
    const cloneSale = entry({
      id: 'clone-sale', seq: 2, operationKind: 'sale', tx: TX_SILVER_SALE,
      debit: cash.name, debitAccountId: cash.id, credit: clone.name, creditAccountId: clone.id,
      cash: '300', weight: '1', arabicWeight: '1',
    });
    const resolution = resolveRuntimeCostAccountInputs([cloneOpening, cloneSale], cloneAccounts);
    expect(resolution.errors).toEqual([]);
    expect(resolution.bindings).toContainEqual({
      inventoryAccountId: clone.id, taxonomyKey: 'silver.product.band',
    });
    const timeline = rebuildRuntimeInventoryCostTimeline(
      [cloneOpening, cloneSale], cloneAccounts,
      { silverPriceByYearMinor: { '2026': 10000 } },
      { historicalInventoryOverlayDirectives: [] },
    );
    expect(timeline.valid, JSON.stringify(timeline.diagnostics)).toBe(true);
    expect(timeline.resultsByOperationId['clone-sale'].sourceInventoryAccountId).toBe(clone.id);
  });
});

const matrixCases = [
  ['gold', runtimeInventoryAccounts[12], TX_GOLD_SALE, TX_GOLD_PURCHASE],
  ['silver', silverBand, TX_SILVER_SALE, TX_SILVER_PURCHASE],
  ['accessory', runtimeInventoryAccounts[29], TX_ACCESSORY_SALE, TX_ACCESSORY_PURCHASE],
] as const;

describe('gold, silver and accessories cash/credit invoice matrix', () => {
  it.each(matrixCases)('%s purchase and sale variants use the canonical resolver', (kind, inventory, saleTx, purchaseTx) => {
    const quantity = kind === 'accessory' ? { weight: '10', count: '0' } : { weight: '10', arabicWeight: '10' };
    const movement = kind === 'accessory' ? { weight: '2', count: '0' } : { weight: '2', arabicWeight: '2' };
    const rows: Entry[] = [
      entry({ id: `${kind}-opening`, date: '2026-01-01', operationKind: 'opening', tx: TX_OPENING, debit: inventory.name, debitAccountId: inventory.id, credit: capital.name, creditAccountId: capital.id, ...quantity }),
      entry({ id: `${kind}-cash-purchase`, seq: 2, date: '2026-01-02', operationKind: 'purchase', tx: purchaseTx, debit: inventory.name, debitAccountId: inventory.id, credit: cash.name, creditAccountId: cash.id, cash: '200', ...movement }),
      entry({ id: `${kind}-credit-purchase`, seq: 3, date: '2026-01-03', operationKind: 'purchase', tx: purchaseTx, debit: inventory.name, debitAccountId: inventory.id, credit: payable.name, creditAccountId: payable.id, cash: '220', ...movement }),
      entry({ id: `${kind}-cash-sale`, seq: 4, date: '2026-01-04', operationKind: 'sale', tx: saleTx, debit: cash.name, debitAccountId: cash.id, credit: inventory.name, creditAccountId: inventory.id, cash: '300', ...movement }),
      entry({ id: `${kind}-credit-sale`, seq: 5, date: '2026-01-05', operationKind: 'sale', tx: saleTx, debit: customer.name, debitAccountId: customer.id, credit: inventory.name, creditAccountId: inventory.id, cash: '320', ...movement }),
    ];
    const stableAccessoryId = CURRENT_DATASET_INVENTORY_BINDINGS[29].inventoryAccountId;
    const timeline = rebuildRuntimeInventoryCostTimeline(rows, accounts, {
      gold21PriceByYearMinor: { '2026': 10000 },
      silverPriceByYearMinor: { '2026': 10000 },
      accessoryUnitCostByYearAndAccountMinor: { '2026': { [stableAccessoryId]: 10000 } },
    }, { historicalInventoryOverlayDirectives: [] });
    expect(timeline.valid, JSON.stringify(timeline.diagnostics)).toBe(true);
    expect(timeline.results.filter(result => result.classification === 'customer_purchase')).toHaveLength(2);
    expect(timeline.results.filter(result => result.classification === 'sale')).toHaveLength(2);
    expect(timeline.results.filter(result => result.classification === 'sale').every(result => result.totalCogsMinor > 0)).toBe(true);
    expect(timeline.finalStates[inventory.id!]).toBeDefined();
  });
});
