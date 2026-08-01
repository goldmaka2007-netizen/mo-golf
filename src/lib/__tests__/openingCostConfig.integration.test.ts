import { describe, expect, it } from 'vitest';
import type { Account, AnnualOpeningCostConfig, Entry } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import { executeCostCalculationRun, createCostInputRevision } from '../costRecalculation';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import { buildOpeningCostConfig, mergeAnnualOpeningCostRows } from '../openingCostConfig';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from '../inventoryCostCatalog';
import { resolveRuntimeCostAccountInputs } from '../runtimeCostAccountResolver';

const goldId = 'seed-account-ea099bf0071894125ad3';
const silverId = 'seed-account-feed1210d025ed84e443';
const tungstenId = 'seed-account-93c8c8cf9d87c00e1e88';
const medicalId = 'seed-account-8d4a16e5eb12e1278df0';
const siliconeId = 'seed-account-34b151012e0aaea0e188';

const accounts: Account[] = [
  { id: goldId, name: 'gold-21', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', userId: 'u', type: 'gold_product', is_inventory: true, metal: 'gold', karat: '21' },
  { id: silverId, name: 'silver-ring', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', userId: 'u', type: 'silver', is_inventory: true, metal: 'silver', karat: null },
  { id: tungstenId, name: 'دبلة تنجستين', mainType: 'asset', subType: 'accessories', balanceNature: 'piece', userId: 'u', type: 'accessory', is_inventory: true, metal: null, karat: null },
  { id: medicalId, name: 'حلق طبي', mainType: 'asset', subType: 'accessories', balanceNature: 'piece', userId: 'u', type: 'accessory', is_inventory: true, metal: null, karat: null },
  { id: siliconeId, name: 'سيليكون', mainType: 'asset', subType: 'accessories', balanceNature: 'piece', userId: 'u', type: 'accessory', is_inventory: true, metal: null, karat: null },
  { id: 'equity', name: 'equity', mainType: 'equity', subType: 'opening', balanceNature: 'cash', userId: 'u', type: 'other', is_inventory: false },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: 'op',
  seq: 1,
  tx: 'قيد افتتاحي',
  operationKind: 'opening',
  date: '2026-01-01',
  debit: '',
  credit: 'equity',
  creditAccountId: 'equity',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u',
  ...overrides,
});

const entries: Entry[] = [
  entry({ id: 'gold-opening', seq: 1, debit: 'gold-21', debitAccountId: goldId, weight: '1', arabicWeight: '1' }),
  entry({ id: 'silver-opening', seq: 2, debit: 'silver-ring', debitAccountId: silverId, weight: '2' }),
  entry({ id: 'tungsten-opening', seq: 3, debit: 'دبلة تنجستين', debitAccountId: tungstenId, count: '1' }),
  entry({ id: 'medical-opening', seq: 4, debit: 'حلق طبي', debitAccountId: medicalId, count: '2' }),
  entry({ id: 'silicone-opening', seq: 5, debit: 'سيليكون', debitAccountId: siliconeId, count: '3' }),
];

describe('opening cost settings integration', () => {
  it('saves, reloads, edits, preserves three accessory costs, and recalculates 2026', () => {
    const saved2026: AnnualOpeningCostConfig = {
      year: 2026,
      gold21PriceEgp: 6000,
      silverPriceEgp: 60,
      accessoryOpeningCosts: {
        [medicalId]: 100,
        [tungstenId]: 200,
        [siliconeId]: 50,
      },
    };

    const firestoreDocument = { openingCostConfig: [saved2026] };
    const reloaded = firestoreDocument.openingCostConfig[0];
    const edited = mergeAnnualOpeningCostRows(reloaded, { year: 2026, gold21PriceEgp: 6500 });

    expect(Object.keys(edited.accessoryOpeningCosts || {}).sort()).toEqual([medicalId, siliconeId, tungstenId].sort());
    expect(edited.accessoryOpeningCosts?.[medicalId]).toBe(100);
    expect(edited.accessoryOpeningCosts?.[tungstenId]).toBe(200);
    expect(edited.accessoryOpeningCosts?.[siliconeId]).toBe(50);

    const openingConfig = buildOpeningCostConfig([edited]);
    expect(openingConfig.gold21PriceByYearMinor?.['2026']).toBe(650000);
    expect(openingConfig.silverPriceByYearMinor?.['2026']).toBe(6000);
    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.[medicalId]).toBe(10000);
    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.[tungstenId]).toBe(20000);
    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.[siliconeId]).toBe(5000);

    const inputRevision = createCostInputRevision(entries, accounts, openingConfig);
    const result = executeCostCalculationRun({
      generationId: 1,
      inputRevision,
      entries,
      accounts,
      openingConfig,
    });

    if (result.status !== 'valid') console.log(result.error);
    expect(result.status).toBe('valid');
    expect(result.timeline?.finalStates[medicalId].remainingAccessoryCostMinor).toBe(20000);
    expect(result.timeline?.finalStates[tungstenId].remainingAccessoryCostMinor).toBe(20000);
    expect(result.timeline?.finalStates[siliconeId].remainingAccessoryCostMinor).toBe(15000);
  });

  it('reads the actual SettingsView accessoryOpeningCosts record even when legacy fields are empty', () => {
    const firestoreDocument = {
      openingCostConfig: [{
        year: 2026,
        gold21PriceEgp: 6000,
        silverPriceEgp: 60,
        accessoryUnitCostMinorByAccountId: {},
        accessoryOpeningCosts: {
          [medicalId]: 5,
          [tungstenId]: 70,
          [siliconeId]: 15,
        },
      }],
    };

    const openingConfig = buildOpeningCostConfig(firestoreDocument.openingCostConfig);

    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.[medicalId]).toBe(500);
    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.[tungstenId]).toBe(7000);
    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.[siliconeId]).toBe(1500);

    const inputRevision = createCostInputRevision(entries, accounts, openingConfig);
    const result = executeCostCalculationRun({
      generationId: 2,
      inputRevision,
      entries,
      accounts,
      openingConfig,
    });

    expect(result.status).toBe('valid');
    expect(result.timeline?.finalStates[medicalId].remainingAccessoryCostMinor).toBe(1000);
    expect(result.timeline?.finalStates[tungstenId].remainingAccessoryCostMinor).toBe(7000);
    expect(result.timeline?.finalStates[siliconeId].remainingAccessoryCostMinor).toBe(4500);
  });

  it('uses actual Firestore account document ids from accounts before recalculation', () => {
    const runtimeAccounts: Account[] = SEED_ACCOUNTS
      .filter(account => account.is_inventory)
      .map((account, index) => ({
        ...account,
        id: CURRENT_DATASET_INVENTORY_BINDINGS[index].inventoryAccountId,
        userId: 'u',
      } as Account))
      .map(account => {
        if (account.id === medicalId) return { ...account, id: 'htmUArWB0J6l9WiZRplj' };
        if (account.id === tungstenId) return { ...account, id: 'PpmQLB2mGjcuPGRiwHQN' };
        if (account.id === siliconeId) return { ...account, id: 'NJ5SdpStbaXLfGDdwQOO' };
        return account;
      });
    const firestoreDocument = {
      openingCostConfig: [{
        year: 2026,
        gold21PriceEgp: 5840,
        silverPriceEgp: 126,
        accessoryOpeningCosts: {
          htmUArWB0J6l9WiZRplj: 5,
          PpmQLB2mGjcuPGRiwHQN: 70,
          NJ5SdpStbaXLfGDdwQOO: 15,
        },
      }],
    };

    const openingConfig = buildOpeningCostConfig(firestoreDocument.openingCostConfig, runtimeAccounts);

    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.htmUArWB0J6l9WiZRplj).toBe(500);
    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.PpmQLB2mGjcuPGRiwHQN).toBe(7000);
    expect(openingConfig.accessoryUnitCostByYearAndAccountMinor?.['2026']?.NJ5SdpStbaXLfGDdwQOO).toBe(1500);

    const prepared = resolveRuntimeCostAccountInputs(entries, runtimeAccounts);
    expect(prepared.errors).toEqual([]);

    const timeline = rebuildInventoryCostTimeline(
      prepared.entries,
      prepared.accounts,
      openingConfig,
      { historicalInventoryOverlayDirectives: [] },
    );

    expect(timeline.valid).toBe(true);
    expect(timeline.finalStates.htmUArWB0J6l9WiZRplj.remainingAccessoryCostMinor).toBe(1000);
  });
});
