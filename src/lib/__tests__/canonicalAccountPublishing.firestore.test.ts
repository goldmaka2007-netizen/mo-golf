import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Account, CanonicalAccountDefinition, Entry } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import { publishCanonicalAccount } from '../canonicalAccountPublishing';
import { resolveEntryIdentity } from '../entryIdentity';
import { buildOperationalAccountOptions } from '../operationalAccounts';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const emulatorDescribe = emulatorHost ? describe : describe.skip;
const [host, rawPort] = (emulatorHost ?? '127.0.0.1:8080').split(':');
const port = Number(rawPort);
const projectId = 'makka-canonical-publish-test';
let testEnv: RulesTestEnvironment;

const definition = (overrides: Partial<CanonicalAccountDefinition> = {}): CanonicalAccountDefinition => {
  const generated = buildAccountRegistry([{
    id: 'classification-template', name: 'قفل بار', userId: 'owner-a',
    mainType: 'اصول', subType: 'مخزون ملحقات اضافية', balanceNature: 'قطعة',
    type: 'accessory', is_inventory: true, quantityStep: 1,
  }]).accounts[0];
  const { sourceAccountId: _sourceAccountId, ...canonicalOnly } = generated;
  return {
    ...canonicalOnly,
    id: 'canonical-qafl-bar',
    entityId: 'canonical-qafl-bar',
    canonicalName: 'قفل بار',
    displayName: 'قفل بار',
    userId: 'owner-a',
    approvalStatus: 'draft',
    ...overrides,
  };
};

const cashAccount: Account = {
  id: 'cash', name: 'الخزنة', userId: 'owner-a', mainType: 'اصول',
  subType: 'النقدية بالخزنة', balanceNature: 'جنية مصري', type: 'cash',
};

emulatorDescribe('canonical account publishing transaction', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { host, port, rules: readFileSync('firestore.rules', 'utf8') },
    });
  });

  beforeEach(async () => testEnv.clearFirestore());
  afterAll(async () => testEnv?.cleanup());

  it('creates a legacy account and writes both links atomically', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore() as unknown as Firestore;
    const result = await publishCanonicalAccount({
      db, definition: definition(), userId: 'owner-a', reason: 'اختبار نشر', operationalAccounts: [],
      now: () => '2026-08-01T00:00:00.000Z',
    });
    const canonical = (await getDoc(doc(db, 'canonicalAccounts', result.canonicalAccountId))).data();
    const legacy = (await getDoc(doc(db, 'accounts', result.legacyAccountId))).data();
    expect(result.createdLegacyAccount).toBe(true);
    expect(canonical).toMatchObject({ approvalStatus: 'approved', legacyAccountId: result.legacyAccountId });
    expect(legacy).toMatchObject({ name: 'قفل بار', canonicalAccountId: result.canonicalAccountId });
  });

  it('is idempotent and does not create a duplicate account', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore() as unknown as Firestore;
    const draft = definition();
    const first = await publishCanonicalAccount({ db, definition: draft, userId: 'owner-a', reason: 'أول نشر', operationalAccounts: [] });
    const legacy = { id: first.legacyAccountId, ...(await getDoc(doc(db, 'accounts', first.legacyAccountId))).data() } as Account;
    const second = await publishCanonicalAccount({ db, definition: draft, userId: 'owner-a', reason: 'إعادة نشر', operationalAccounts: [legacy] });
    const accounts = await getDocs(query(collection(db, 'accounts'), where('userId', '==', 'owner-a')));
    expect(second).toMatchObject({ legacyAccountId: first.legacyAccountId, idempotent: true, createdLegacyAccount: false });
    expect(accounts.size).toBe(1);
  });

  it('rejects conflicting explicit IDs without changing a canonical account', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore() as unknown as Firestore;
    const conflicting: Account[] = [
      { ...cashAccount, id: 'one', canonicalAccountId: 'canonical-qafl-bar' },
      { ...cashAccount, id: 'two', canonicalAccountId: 'canonical-qafl-bar' },
    ];
    await expect(publishCanonicalAccount({
      db, definition: definition(), userId: 'owner-a', reason: 'conflict', operationalAccounts: conflicting,
    })).rejects.toThrow('تعارض IDs');
    expect((await getDoc(doc(db, 'canonicalAccounts', 'canonical-qafl-bar'))).exists()).toBe(false);
  });

  it('does not accept approved status alone or an incomplete classification', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore() as unknown as Firestore;
    await assertFails(setDoc(doc(db, 'canonicalAccounts', 'status-only'), {
      ...definition({ id: 'status-only', entityId: 'status-only', approvalStatus: 'approved' }),
    }));
    await expect(publishCanonicalAccount({
      db,
      definition: definition({ allowedDimensions: [], normalBalanceByDimension: { cash: null, gold: null, silver: null, quantity: null } }),
      userId: 'owner-a', reason: 'incomplete', operationalAccounts: [],
    })).rejects.toThrow('ناقص التصنيف');
  });

  it('shows the account only after publish and saves an accessory purchase with legacy accountId', async () => {
    const db = testEnv.authenticatedContext('owner-a').firestore() as unknown as Firestore;
    await assertSucceeds(setDoc(doc(db, 'canonicalAccounts', 'canonical-only'), definition({
      id: 'canonical-only', entityId: 'canonical-only', canonicalName: 'Canonical only', displayName: 'Canonical only',
    })));
    expect(buildOperationalAccountOptions([]).map(option => option.c)).not.toContain('Canonical only');

    const published = await publishCanonicalAccount({
      db, definition: definition(), userId: 'owner-a', reason: 'نشر قفل بار', operationalAccounts: [],
    });
    await assertSucceeds(setDoc(doc(db, 'accounts', cashAccount.id!), cashAccount));
    const legacy = { id: published.legacyAccountId, ...(await getDoc(doc(db, 'accounts', published.legacyAccountId))).data() } as Account;
    expect(buildOperationalAccountOptions([legacy])).toContainEqual({ id: published.legacyAccountId, c: 'قفل بار' });

    const purchase = {
      tx: 'شراء ملحقات', debit: legacy.name, debitAccountId: legacy.id,
      credit: cashAccount.name, creditAccountId: cashAccount.id,
      date: '2026-08-01', cash: '1000', weight: '0', arabicWeight: '0', count: '1',
      notes: '', userId: 'owner-a',
    } as Entry;
    const identity = resolveEntryIdentity(purchase, [legacy, cashAccount]);
    expect(identity).toMatchObject({ ok: true, value: { debitAccountId: published.legacyAccountId, creditAccountId: 'cash' } });
    if (identity.ok === false) throw new Error(identity.message);
    await assertSucceeds(setDoc(doc(db, 'entries', 'accessory-purchase'), { ...purchase, ...identity.value }));
    expect((await getDoc(doc(db, 'entries', 'accessory-purchase'))).data()?.debitAccountId).toBe(published.legacyAccountId);
  });
});