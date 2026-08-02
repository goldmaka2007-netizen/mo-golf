import { describe, expect, it, vi } from 'vitest';
import { SEED_ACCOUNTS } from '../../migrationData';
import type { Account } from '../../types';
import {
  planAccountClassificationMigration,
  runAccountClassificationMigration,
} from '../accountClassificationMigration';

const baseAccount = (overrides: Partial<Account>): Account => ({
  id: 'account-1',
  name: 'legacy',
  mainType: 'assets',
  subType: 'legacy',
  balanceNature: 'weight',
  userId: 'test-user',
  ...overrides,
});

describe('account classification migration', () => {
  it('keeps every confirmed seed classification idempotent', () => {
    const accounts: Account[] = SEED_ACCOUNTS.map((account, index) => ({
      ...account,
      id: `seed-${index}`,
      userId: 'test-user',
    }));

    const report = planAccountClassificationMigration(accounts);

    expect(report.missingConfirmedNames).toEqual([]);
    expect(report.conflicts).toBe(0);
    expect(report.skipped).toBe(0);
    expect(report.ready).toBe(0);
    expect(report.alreadyCurrent).toBe(16);

    const classified = new Map(accounts.map(account => [account.name, account]));
    expect(classified.get('\u0627\u0644\u0645\u0633\u062d\u0648\u0628\u0627\u062a')).toMatchObject({
      canonicalMainType: 'equity',
      canonicalSubType: 'withdrawals',
      metal: null,
      is_inventory: false,
    });
    expect(classified.get('\u0627\u0644\u0627\u0631\u0628\u0627\u062d \u0648 \u0627\u0644\u062e\u0633\u0627\u064a\u0631 2024')).toMatchObject({
      canonicalMainType: 'equity',
      canonicalSubType: 'retained_earnings',
      metal: null,
      is_inventory: false,
    });
    expect(classified.get('\u0627\u0644\u0627\u0631\u0628\u0627\u062d \u0648 \u0627\u0644\u062e\u0633\u0627\u064a\u0631 2024 \u0630\u0647\u0628')).toMatchObject({
      canonicalMainType: 'equity',
      canonicalSubType: 'retained_earnings',
      metal: 'gold',
      is_inventory: false,
    });
    expect(classified.get('\u0627\u0644\u0627\u0631\u0628\u0627\u062d \u0648 \u0627\u0644\u062e\u0633\u0627\u064a\u0631 2024 \u0641\u0636\u0629')).toMatchObject({
      canonicalMainType: 'equity',
      canonicalSubType: 'retained_earnings',
      metal: 'silver',
      is_inventory: false,
    });
  });

  it('plans an explicit before and after for legacy retained earnings gold', () => {
    const account = baseAccount({
      name: '\u0627\u0644\u0627\u0631\u0628\u0627\u062d \u0648 \u0627\u0644\u062e\u0633\u0627\u064a\u0631 2024 \u0630\u0647\u0628',
      mainType: '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629',
      subType: '\u0627\u0644\u0627\u0631\u0628\u0627\u062d \u0648 \u0627\u0644\u062e\u0633\u0627\u064a\u0631',
      metal: null,
      is_inventory: false,
    });

    const report = planAccountClassificationMigration([account]);

    expect(report.items[0]).toMatchObject({
      before: {
        canonicalMainType: undefined,
        canonicalSubType: undefined,
        metal: null,
        is_inventory: false,
      },
      after: {
        canonicalMainType: 'equity',
        canonicalSubType: 'retained_earnings',
        metal: 'gold',
        is_inventory: false,
      },
      status: 'ready',
    });
  });

  it('is dry-run by default and records before, after, id, name, and reason', async () => {
    const logger = { info: vi.fn(), warn: vi.fn() };
    const writer = vi.fn();
    const account = baseAccount({
      name: '\u062e\u0627\u0644\u062f \u062d\u0645\u064a\u062f\u0648',
      mainType: '\u062e\u0635\u0648\u0645',
      subType: '\u062a\u062c\u0627\u0631 \u0630\u0647\u0628',
      type: 'merchant',
      metal: 'gold',
      is_inventory: false,
    });

    const report = await runAccountClassificationMigration([account], { logger, writer });

    expect(report.dryRun).toBe(true);
    expect(report.items[0]).toMatchObject({
      accountId: 'account-1',
      name: account.name,
      before: { canonicalMainType: undefined },
      after: {
        canonicalMainType: 'liabilities',
        canonicalSubType: 'merchant_gold',
        merchantDirection: 'payable',
        metal: 'gold',
        is_inventory: false,
      },
      status: 'ready',
    });
    expect(report.items[0].reason).toContain('Product-owner');
    expect(logger.info).toHaveBeenCalled();
    expect(writer).not.toHaveBeenCalled();
  });

  it('refuses a payable direction conflict instead of guessing', () => {
    const account = baseAccount({
      name: '\u0645\u062d\u0645\u062f \u0627\u0644\u0633\u064a\u062f',
      mainType: '\u062e\u0635\u0648\u0645',
      subType: '\u062a\u062c\u0627\u0631 \u0630\u0647\u0628',
      canonicalMainType: 'assets',
      canonicalSubType: 'merchant_gold',
      merchantDirection: 'receivable',
      metal: 'gold',
      is_inventory: false,
    });

    const report = planAccountClassificationMigration([account]);

    expect(report.conflicts).toBe(1);
    expect(report.items[0].status).toBe('conflict');
    expect(report.items[0].after).toEqual(report.items[0].before);
  });

  it('requires both the explicit write flag and a writer', async () => {
    const account = baseAccount({
      name: '\u0644\u0627\u0628\u062a\u0648\u0628',
      mainType: '\u0627\u0635\u0648\u0644',
      subType: '\u0627\u0635\u0648\u0644 \u062b\u0627\u0628\u062a\u0629',
      is_inventory: false,
    });
    const logger = { info: vi.fn(), warn: vi.fn() };

    await expect(runAccountClassificationMigration(
      [account],
      { executeWrites: true, logger },
    )).rejects.toThrow('requires an explicit account writer');
  });
});
