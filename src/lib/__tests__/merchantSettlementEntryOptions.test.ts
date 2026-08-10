import { describe, expect, it } from 'vitest';
import type { Account, Entry, TransactionType } from '../../types';
import { resolveMerchantMetalOperationSemantic } from '../engine';
import {
  buildGoldMerchantSettlementEntryRules,
  mergeGoldMerchantSettlementEntryRules,
} from '../merchantSettlementEntryOptions';

const account = (overrides: Partial<Account>): Account => ({
  id: overrides.name,
  name: 'حساب',
  mainType: 'assets',
  subType: 'inventory',
  balanceNature: 'gold',
  userId: 'test-user',
  isActive: true,
  ...overrides,
});

const merchant = account({
  name: 'تاجر جديد',
  mainType: 'liabilities',
  subType: 'merchant_gold',
  canonicalSubType: 'merchant_gold',
  type: 'merchant',
  metal: 'gold',
  is_inventory: false,
});

const arabicScrap = account({
  name: 'كسر عربي',
  type: 'gold_raw',
  metal: 'gold',
  karat: '21',
  is_inventory: true,
});

describe('gold merchant settlement Entry Form options', () => {
  it('adds an allowed inventory source for a new gold merchant without a historical rule', () => {
    const rules = buildGoldMerchantSettlementEntryRules([merchant, arabicScrap]);

    expect(rules).toContainEqual({
      t: 'تاجر ذهب',
      d: 'تاجر جديد',
      c: 'كسر عربي',
      k: 21,
      m: 1,
    });
  });

  it('excludes gold inventory classifications that are not approved settlement sources', () => {
    const finishedGold = account({
      name: 'مشغولات ذهب',
      type: 'gold_product',
      metal: 'gold',
      karat: '21',
      is_inventory: true,
    });

    const rules = buildGoldMerchantSettlementEntryRules([merchant, arabicScrap, finishedGold]);

    expect(rules.some(rule => rule.c === 'مشغولات ذهب')).toBe(false);
    expect(rules.some(rule => rule.c === 'كسر عربي')).toBe(true);
  });

  it('adds exactly the approved active gold settlement source classifications and excludes gold_product', () => {
    const approvedSources = [
      account({ name: 'كسر عربي', type: 'gold_raw', metal: 'gold', karat: '21', is_inventory: true }),
      account({ name: 'كسر افرنجي', type: 'gold_raw', metal: 'gold', karat: '18', is_inventory: true }),
      account({ name: 'جنية', type: 'gold_direct', metal: 'gold', karat: '21', is_inventory: true }),
      account({ name: 'سبيكة', type: 'gold_direct', metal: 'gold', karat: '24', is_inventory: true }),
    ];
    const finishedGold = account({
      name: 'مشغولات ذهب',
      type: 'gold_product',
      metal: 'gold',
      karat: '21',
      is_inventory: true,
    });

    const settlementCredits = buildGoldMerchantSettlementEntryRules([
      merchant,
      ...approvedSources,
      finishedGold,
    ])
      .filter(rule => rule.t === 'تاجر ذهب' && rule.d === merchant.name)
      .map(rule => rule.c)
      .sort();

    expect(settlementCredits).toEqual(['جنية', 'سبيكة', 'كسر افرنجي', 'كسر عربي'].sort());
    expect(settlementCredits).not.toContain('مشغولات ذهب');
  });

  it('keeps a generated merchant-debit and inventory-credit operation as weight_settlement', () => {
    const [rule] = buildGoldMerchantSettlementEntryRules([merchant, arabicScrap]);
    const entry: Entry = {
      tx: rule.t,
      debit: rule.d,
      credit: rule.c,
      date: '2026-08-11',
      cash: '0',
      weight: '1',
      count: '0',
      arabicWeight: '1',
      karat: rule.k ?? undefined,
      multiplier: rule.m,
      notes: '',
      userId: 'test-user',
    };

    expect(resolveMerchantMetalOperationSemantic(entry, merchant, arabicScrap)).toEqual({
      kind: 'weight_settlement',
      metal: 'gold',
    });
  });

  it('preserves legacy rules and their precedence when adding dynamic options', () => {
    const legacyRule: TransactionType = {
      t: 'تاجر ذهب',
      d: 'كسر عربي',
      c: 'تاجر قديم',
      k: 21,
      m: 1,
    };
    const existingSettlement: TransactionType = {
      t: 'تاجر ذهب',
      d: 'تاجر جديد',
      c: 'كسر عربي',
      k: 21,
      m: 0.99,
    };

    const merged = mergeGoldMerchantSettlementEntryRules(
      [legacyRule, existingSettlement],
      [merchant, arabicScrap],
    );

    expect(merged.slice(0, 2)).toEqual([legacyRule, existingSettlement]);
    expect(merged.filter(rule =>
      rule.t === existingSettlement.t
      && rule.d === existingSettlement.d
      && rule.c === existingSettlement.c
    )).toHaveLength(1);
  });
});
