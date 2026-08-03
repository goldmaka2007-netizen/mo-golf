import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import { runPhase5GoldenDataset } from '../../test-fixtures/phase5GoldenDataset';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from '../inventoryCostCatalog';
import { CANONICAL_RESOLVER_CATALOG_V1_DEFINITIONS } from '../canonicalResolverCatalogV1.generated';
import type { InventoryCostTimeline } from '../inventoryCostTypes';
import { buildFinancialStatementsEgp } from '../financialStatementsEgp';
import { buildLegacyLedgerLegs } from '../legacyLedger';
import { buildUnifiedTrialBalance } from '../unifiedTrialBalance';

const accessory: Account = {
  id: 'accessory', name: 'Accessory inventory', mainType: 'asset', subType: 'inventory_accessories',
  balanceNature: 'piece', type: 'accessory', is_inventory: true, userId: 'u',
};
const equity: Account = {
  id: 'equity', name: 'Opening capital', mainType: 'equity', subType: 'capital',
  balanceNature: 'book_value', type: 'other', is_inventory: false, userId: 'u',
};
const opening: Entry = {
  id: 'accessory-opening', tx: 'opening', operationKind: 'opening', date: '2026-01-01',
  debit: accessory.name, debitAccountId: accessory.id, credit: equity.name, creditAccountId: equity.id,
  cash: '60', weight: '4', arabicWeight: '4', count: '0', notes: '', userId: 'u',
};
const openingTimeline = {
  valid: true,
  diagnostics: [],
  results: [{
    operationId: opening.id, classification: 'opening', entry: opening,
    inventoryAccountId: accessory.id, destinationInventoryAccountId: accessory.id,
    incomingTotalCostMinor: 6000, totalCogsMinor: 0, saleAmountMinor: 0,
    adjustmentLossMinor: 0, outgoingActualPhysicalWeightUnits: 0,
  }],
  finalStates: {
    [accessory.id]: {
      inventoryAccountId: accessory.id, displayName: accessory.name, kind: 'accessory',
      standardizedQuantityUnits: 0, accessoryQuantityUnits: 4000, remainingTotalCostMinor: 6000,
    },
  },
  historicalInventoryOverlays: [],
} as unknown as InventoryCostTimeline;

describe('accessories opening capital financial projection', () => {
  it('posts quantity and book value once without manufacturing cash', () => {
    const accounts = [accessory, equity];
    const legs = buildLegacyLedgerLegs([opening], accounts, [], {
      enableFinancialProjection: true,
      costTimeline: openingTimeline,
    });
    expect(legs.filter(leg => leg.dimension === 'quantity').map(leg => [
      leg.entityId, leg.side, leg.amount,
    ])).toEqual([['product:accessory', 'debit', 4]]);
    expect(legs.filter(leg => leg.dimension === 'book_value').map(leg => [
      leg.entityId, leg.side, leg.amount,
    ])).toEqual([
      ['product:accessory', 'debit', 60],
      ['account:equity', 'credit', 60],
    ]);
    expect(legs.filter(leg => leg.dimension === 'cash')).toHaveLength(0);
    const trial = buildUnifiedTrialBalance(
      [opening], accounts, '2026-01-01', '2026-12-31', { timeline: openingTimeline },
    );
    expect(trial.financialDifference).toBe(0);
  });

  it('keeps the approved local fixture balanced in the trial balance and financial position', () => {
    const golden = runPhase5GoldenDataset(901);
    expect(golden.timeline?.valid).toBe(true);
    expect(golden.timeline?.diagnostics).toHaveLength(0);
    const sourceIds = new Map<string, string>();
    CANONICAL_RESOLVER_CATALOG_V1_DEFINITIONS.forEach(definition =>
      Object.values(definition.accounts).forEach(reference => {
        const separator = reference.indexOf(' | ');
        if (separator > 0) {
          sourceIds.set(reference.slice(separator + 3), reference.slice(0, separator));
        }
      }));
    const inventoryIds = new Map(SEED_ACCOUNTS.filter(account => account.is_inventory)
      .map((account, index) => [
        account.name,
        CURRENT_DATASET_INVENTORY_BINDINGS[index].inventoryAccountId,
      ]));
    const accounts = SEED_ACCOUNTS.map((account, index) => ({
      ...account,
      id: inventoryIds.get(account.name) ?? sourceIds.get(account.name)
        ?? 'phase5-non-inventory-' + (index + 1),
      userId: 'phase5-local-balance-guard',
    })) as Account[];
    const accountsById = new Map(accounts.map(account => [account.id, account]));
    const syntheticAccounts = new Map(SEED_ACCOUNTS.map((account, index) => [
      'phase5-non-inventory-' + (index + 1), accounts[index],
    ]));
    const entries = golden.entries.map(entry => {
      const debit = accountsById.get(entry.debitAccountId || '') ?? syntheticAccounts.get(entry.debitAccountId || '');
      const credit = accountsById.get(entry.creditAccountId || '') ?? syntheticAccounts.get(entry.creditAccountId || '');
      return { ...entry, debit: debit?.name ?? entry.debit, debitAccountId: debit?.id, credit: credit?.name ?? entry.credit, creditAccountId: credit?.id };
    });
    const trial = buildUnifiedTrialBalance(
      entries, accounts, '2026-01-01', '2026-12-31', { timeline: golden.timeline },
    );
    const statements = buildFinancialStatementsEgp(entries, accounts, {
      timeline: golden.timeline, balanceEndDate: '2026-12-31',
    });
    expect(trial.financialDebit).toBe(63347893.81);
    expect(trial.financialCredit).toBe(63347893.81);
    expect(trial.financialDifference).toBe(0);
    expect(statements.balanceSheet.assets.total).toBeCloseTo(
      statements.balanceSheet.liabilities.total + statements.balanceSheet.equity.total, 2,
    );
    expect(Math.abs(statements.balanceSheet.balances.assetsLessLiabilitiesAndEquity)).toBe(0);
    expect(statements.balanceSheet.equity.currentProfit).toBe(statements.incomeStatement.netProfit);
  });
});
