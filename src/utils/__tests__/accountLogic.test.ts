import { describe, expect, it, vi } from 'vitest';
import { AccountNature, type Account, type Entry } from '../../types';
import { belongsToMetric, clearLegacyNatureFallbackWarnings, getAccountTypeDetails, getDynamicAccountNature, getLegacyNatureFallbackWarnings, isCashOnlyMerchantSettlementEntry, isGoldEquivalentEntry } from '../accountLogic';

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

describe('structural account logic', () => {
  const account = (overrides: Partial<Account>): Account => ({
    id: 'account',
    name: 'account',
    mainType: 'legacy',
    subType: 'legacy',
    balanceNature: '',
    type: 'other',
    metal: null,
    is_inventory: false,
    userId: 'u',
    ...overrides,
  });

  const structuralAccounts: Account[] = [
    account({ id: 'gold-by-id', name: 'same-name', metal: 'gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', is_inventory: true }),
    account({ id: 'silver-by-id', name: 'same-name', metal: 'silver', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_silver', type: 'merchant' }),
    account({ id: 'gold-merchant', name: 'gold merchant', metal: 'gold', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_gold', merchantDirection: 'payable', type: 'merchant' }),
    account({ id: 'other-due', name: 'other due', metal: 'gold', canonicalMainType: 'liabilities', canonicalSubType: 'other_due', merchantDirection: 'payable' }),
    account({ id: 'retained-gold', name: 'retained gold', metal: 'gold', canonicalMainType: 'equity', canonicalSubType: 'retained_earnings' }),
    account({ id: 'silver-merchant', name: 'silver merchant', metal: 'silver', canonicalMainType: 'liabilities', canonicalSubType: 'merchant_silver', merchantDirection: 'payable', type: 'merchant' }),
    account({ id: 'accessory', name: 'accessory', canonicalMainType: 'assets', canonicalSubType: 'inventory_accessory', type: 'accessory', is_inventory: true }),
    account({ id: 'cash-only', name: 'cash only', canonicalMainType: 'assets', canonicalSubType: 'cash', type: 'cash' }),
  ];

  it('resolves by ID before a conflicting name and does not fall through an unknown ID', () => {
    expect(getDynamicAccountNature('same-name', structuralAccounts, 'silver-by-id')).toBe(AccountNature.SILVER);
    expect(getDynamicAccountNature('same-name', structuralAccounts, 'missing-id')).toBe(AccountNature.UNKNOWN);
    expect(belongsToMetric('same-name', 'silver', structuralAccounts, 'silver-by-id')).toBe(true);
    expect(belongsToMetric('same-name', 'gold', structuralAccounts, 'silver-by-id')).toBe(false);
  });

  it('keeps the legacy name-only API compatible when the name is unique', () => {
    expect(getDynamicAccountNature('gold merchant', structuralAccounts)).toBe(AccountNature.GOLD);
    expect(belongsToMetric('gold merchant', 'gold', structuralAccounts)).toBe(true);
    expect(getAccountTypeDetails('gold merchant', structuralAccounts)).toMatchObject({
      main: 'liabilities',
      sub: 'merchant_gold',
      nature: AccountNature.GOLD,
    });
  });

  it('includes weighted non-inventory parties and retained earnings in their metal metric only', () => {
    ['gold-merchant', 'other-due', 'retained-gold'].forEach(id => {
      const found = structuralAccounts.find(item => item.id === id)!;
      expect(found.is_inventory).toBe(false);
      expect(belongsToMetric(found.name, 'gold', structuralAccounts, id)).toBe(true);
      expect(belongsToMetric(found.name, 'silver', structuralAccounts, id)).toBe(false);
    });
    expect(belongsToMetric('silver merchant', 'silver', structuralAccounts, 'silver-merchant')).toBe(true);
    expect(belongsToMetric('silver merchant', 'gold', structuralAccounts, 'silver-merchant')).toBe(false);
  });

  it('routes accessory and cash to only their own metric', () => {
    expect(belongsToMetric('accessory', 'accs', structuralAccounts, 'accessory')).toBe(true);
    expect(belongsToMetric('accessory', 'cash', structuralAccounts, 'accessory')).toBe(false);
    expect(belongsToMetric('accessory', 'gold', structuralAccounts, 'accessory')).toBe(false);
    expect(belongsToMetric('cash only', 'cash', structuralAccounts, 'cash-only')).toBe(true);
    expect(belongsToMetric('cash only', 'gold', structuralAccounts, 'cash-only')).toBe(false);
    expect(belongsToMetric('cash only', 'accs', structuralAccounts, 'cash-only')).toBe(false);
  });

  it('uses and records one aggregated legacy-label fallback without duplicate warnings', () => {
    clearLegacyNatureFallbackWarnings();
    const legacy = account({
      id: 'legacy-gold',
      name: 'legacy gold',
      balanceNature: '\u062c\u0631\u0627\u0645 \u0630\u0647\u0628',
      type: 'other',
    });
    const secondLegacy = account({
      id: 'legacy-silver',
      name: 'legacy silver',
      balanceNature: '\u062c\u0631\u0627\u0645 \u0641\u0636\u0629',
      type: 'other',
    });
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(getDynamicAccountNature(legacy.name, [legacy])).toBe(AccountNature.GOLD);
    expect(getDynamicAccountNature(legacy.name, [legacy])).toBe(AccountNature.GOLD);
    expect(getDynamicAccountNature(secondLegacy.name, [secondLegacy])).toBe(AccountNature.SILVER);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toHaveLength(2);
    expect(getLegacyNatureFallbackWarnings()).toEqual([
      expect.objectContaining({
        accountId: 'legacy-gold',
        accountName: 'legacy gold',
        missingStructuralFields: expect.arrayContaining(['metal', 'canonicalSubType', 'type']),
        legacyLabel: expect.stringContaining('balanceNature'),
        nature: AccountNature.GOLD,
      }),
      expect.objectContaining({
        accountId: 'legacy-silver',
        nature: AccountNature.SILVER,
      }),
    ]);
    spy.mockRestore();
    clearLegacyNatureFallbackWarnings();
  });

  it('returns explicit unknown and unclassified results instead of a default bucket', () => {
    const unknown = account({ id: 'unknown', name: 'unknown', mainType: 'mystery', subType: 'mystery', balanceNature: '' });
    expect(getDynamicAccountNature('unknown', [unknown])).toBe(AccountNature.UNKNOWN);
    expect(belongsToMetric('unknown', 'cash', [unknown])).toBe(false);
    expect(getAccountTypeDetails('unknown', [unknown])).toEqual({
      main: 'others',
      sub: 'unclassified',
      nature: AccountNature.UNKNOWN,
    });
    expect(getAccountTypeDetails('missing', [])).toEqual({
      main: 'others',
      sub: 'unclassified',
      nature: AccountNature.UNKNOWN,
    });
  });

  it('exposes merchant-direction conflicts as unclassified', () => {
    const conflict = account({
      id: 'conflict',
      name: 'conflict',
      canonicalMainType: 'assets',
      canonicalSubType: 'merchant_gold',
      merchantDirection: 'payable',
      metal: 'gold',
    });
    expect(getAccountTypeDetails('wrong-name', [conflict], 'conflict')).toMatchObject({
      main: 'others',
      sub: 'unclassified',
      nature: AccountNature.GOLD,
    });
  });
});
