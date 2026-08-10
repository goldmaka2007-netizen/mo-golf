import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, TransactionRule } from '../../types';

const fake = vi.hoisted(() => {
  const collections = new Map<string, Map<string, Record<string, unknown>>>();
  let queue = Promise.resolve<void>(undefined);
  let failNextCommit = false;
  const bucket = (name: string) => {
    const value = collections.get(name) ?? new Map<string, Record<string, unknown>>();
    collections.set(name, value);
    return value;
  };
  return { collections, bucket, get queue() { return queue; }, set queue(value) { queue = value; }, get failNextCommit() { return failNextCommit; }, set failNextCommit(value) { failNextCommit = value; } };
});

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  where: () => ({}),
  query: (ref: { collection: string }) => ref,
  doc: (_db: unknown, collectionName: string, id: string) => ({ collection: collectionName, id }),
  serverTimestamp: () => ({ __serverTimestamp: true }),
  getDocs: async (ref: { collection: string }) => ({
    docs: [...fake.bucket(ref.collection)].map(([id, data]) => ({ id, data: () => data })),
  }),
  runTransaction: async (_db: unknown, handler: (transaction: {
    get: (ref: { collection: string; id: string }) => Promise<{ id: string; exists: () => boolean; data: () => Record<string, unknown> }>;
    set: (ref: { collection: string; id: string }, data: Record<string, unknown>) => void;
  }) => Promise<unknown>) => {
    const execute = async () => {
      const staged: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];
      const result = await handler({
        get: async ref => {
          const data = fake.bucket(ref.collection).get(ref.id);
          return { id: ref.id, exists: () => !!data, data: () => data ?? {} };
        },
        set: (ref, data) => staged.push({ ...ref, data }),
      });
      if (fake.failNextCommit) {
        fake.failNextCommit = false;
        throw new Error('simulated commit failure');
      }
      staged.forEach(write => fake.bucket(write.collection).set(write.id, write.data));
      return result;
    };
    const result = fake.queue.then(execute, execute);
    fake.queue = result.then(() => undefined, () => undefined);
    return result;
  },
}));

import { createAccountClone } from '../accountCloneService';

const source: Account = {
  id: 'customer',
  name: 'عميل قائم',
  mainType: 'اصول',
  subType: 'ذمم مدينة',
  canonicalMainType: 'assets',
  canonicalSubType: 'customer',
  balanceNature: 'جنيه مصري',
  userId: 'user',
  type: 'other',
  metal: null,
  is_inventory: false,
  isActive: true,
};

const treasury: Account = {
  id: 'cash', name: 'الخزنة', mainType: 'اصول', subType: 'النقدية بالخزنة',
  canonicalMainType: 'assets', canonicalSubType: 'cash', balanceNature: 'جنيه مصري',
  userId: 'user', type: 'cash', metal: null, is_inventory: false, isActive: true,
};

const rules: TransactionRule[] = [{
  id: 'customer-rule', tx: 'تحصيل عميل', debit: treasury.name, credit: source.name,
  debitAccountId: treasury.id, creditAccountId: source.id, category: 'العملاء', userId: 'user', multiplier: 1,
}];

beforeEach(() => {
  fake.collections.clear();
  fake.queue = Promise.resolve();
  fake.failNextCommit = false;
  fake.bucket('accounts').set(source.id!, source as unknown as Record<string, unknown>);
  fake.bucket('accounts').set(treasury.id!, treasury as unknown as Record<string, unknown>);
});

describe('atomic Firestore account clone service', () => {
  it('allows exactly one concurrent creator for the same normalized name', async () => {
    const create = () => createAccountClone({
      firestore: {} as never,
      userId: 'user',
      sourceAccountId: source.id!,
      newName: 'أحمد',
      operationalRules: rules,
    });
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(fake.bucket('accounts')).toHaveLength(3);
    expect(fake.bucket('transactionRules')).toHaveLength(1);
    expect(fake.bucket('audit_logs')).toHaveLength(1);
  });

  it('leaves no partial state on failure and a retry succeeds once', async () => {
    fake.failNextCommit = true;
    const args = {
      firestore: {} as never,
      userId: 'user',
      sourceAccountId: source.id!,
      newName: 'عميل جديد',
      operationalRules: rules,
    };
    await expect(createAccountClone(args)).rejects.toThrow('simulated commit failure');
    expect(fake.bucket('accounts')).toHaveLength(2);
    expect(fake.bucket('transactionRules')).toHaveLength(0);
    expect(fake.bucket('audit_logs')).toHaveLength(0);

    await expect(createAccountClone(args)).resolves.toMatchObject({ ruleCount: 1 });
    expect(fake.bucket('accounts')).toHaveLength(3);
    expect(fake.bucket('transactionRules')).toHaveLength(1);
    expect(fake.bucket('audit_logs')).toHaveLength(1);
  });
});
