import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildHomeOperationalSnapshot } from '../homeSelector';

const cash: Account = { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'cash', canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'cash', type: 'cash', is_inventory: false, userId: 'u' };
const gold: Account = { id: 'gold', name: 'ذهب 21', mainType: 'asset', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', userId: 'u' };
const merchant: Account = { id: 'merchant', name: 'تاجر ذهب', mainType: 'liability', subType: 'merchant_gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', merchantDirection: 'payable', balanceNature: 'gold', type: 'merchant', metal: 'gold', is_inventory: false, userId: 'u' };
const capital: Account = { id: 'capital', name: 'رأس المال', mainType: 'equity', subType: 'capital', canonicalMainType: 'equity', canonicalSubType: 'capital', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u' };

const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', tx: 'عملية', operationKind: 'other', date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0', count: '0', arabicWeight: '0', notes: '', userId: 'u', ...patch,
});

describe('home operational snapshot', () => {
  it('preserves the lightweight treasury read model while gold uses the Financial Position projection', () => {
    const snapshot = buildHomeOperationalSnapshot({
      entries: [
        entry({ id: 'opening', operationKind: 'opening', debit: gold.name, debitAccountId: gold.id, credit: capital.name, creditAccountId: capital.id, weight: '10', arabicWeight: '10', karat: 21 }),
        entry({ id: 'merchant-receipt', operationKind: 'purchase', debit: gold.name, debitAccountId: gold.id, credit: merchant.name, creditAccountId: merchant.id, weight: '2', arabicWeight: '2', karat: 21, cash: '100' }),
        entry({ id: 'cash-sale', operationKind: 'sale', debit: cash.name, debitAccountId: cash.id, credit: gold.name, creditAccountId: gold.id, weight: '1', arabicWeight: '1', karat: 21, cash: '200' }),
      ],
      accounts: [cash, gold, merchant, capital], canonicalDefinitions: [], openingCostConfig: [],
    });

    expect(snapshot).toMatchObject({ treasuryCash: 200, goldOwnership: null });
  });
});
