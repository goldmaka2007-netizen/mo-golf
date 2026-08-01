import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { isCashOnlyMerchantSettlementEntry, isGoldEquivalentEntry } from '../accountLogic';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'assets', subType: 'cash', balanceNature: 'cash', type: 'cash', metal: null, userId: 'u' },
  { id: 'merchant', name: 'محمد السيد', mainType: 'liabilities', subType: 'merchant', balanceNature: 'gold', type: 'merchant', metal: 'gold', userId: 'u' },
  { id: 'gold', name: 'كسر افرنجي', mainType: 'assets', subType: 'inventory', balanceNature: 'gold', type: 'gold_raw', metal: 'gold', karat: '18', is_inventory: true, userId: 'u' },
];

const settlement = (credit: string, creditAccountId: string): Partial<Entry> => ({
  tx: 'حساب تاجر ذهب', operationKind: 'merchant_settlement', debit: 'محمد السيد', debitAccountId: 'merchant', credit, creditAccountId,
  cash: '10000', weight: '0', arabicWeight: '0', multiplier: 1,
});

describe('merchant cash settlement routing', () => {
  it('treats paying merchant workmanship from the till as cash-only', () => {
    const entry = settlement('الخزنة', 'cash');
    expect(isCashOnlyMerchantSettlementEntry(entry, accounts)).toBe(true);
    expect(isGoldEquivalentEntry(entry, accounts)).toBe(false);
  });
  it('keeps a merchant-to-gold-inventory settlement weight-based', () => {
    const entry = { ...settlement('كسر افرنجي', 'gold'), weight: '2', karat: 18 };
    expect(isCashOnlyMerchantSettlementEntry(entry, accounts)).toBe(false);
    expect(isGoldEquivalentEntry(entry, accounts)).toBe(true);
  });
});