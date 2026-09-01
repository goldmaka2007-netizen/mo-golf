import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry, InventoryCheck } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import { buildCentralAccountingWritePreflight } from '../centralAccountingWritePreflight';
import { buildInventoryAdjustmentDraftEntry } from '../inventoryCheckSettlement';
import { createCentralAccountingEntry, sameCentralOperationPayload } from '../centralAccountingWriteService';

const readSource = (relativePath: string): string => (
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8')
);

const inventoryAccount: Account = {
  id: 'silver-stock',
  name: 'مخزون فضة 925',
  mainType: 'اصول',
  subType: 'مخزون فضة',
  canonicalMainType: 'assets',
  canonicalSubType: 'inventory_silver',
  balanceNature: 'جرام فضة',
  type: 'silver',
  metal: 'silver',
  userId: 'test',
  isActive: true,
};

const shortageAccount: Account = {
  id: 'silver-shortage',
  name: 'عجز-الفضة',
  mainType: 'مصروفات',
  subType: 'تسويات',
  canonicalMainType: 'expense',
  canonicalSubType: 'expense',
  balanceNature: 'جنية مصري',
  type: 'other',
  userId: 'test',
  isActive: true,
};

const surplusAccount: Account = {
  id: 'silver-surplus',
  name: 'زيادة-الفضة',
  mainType: 'ايرادات',
  subType: 'تسويات',
  canonicalMainType: 'revenue',
  canonicalSubType: 'revenue',
  balanceNature: 'جنية مصري',
  type: 'other',
  userId: 'test',
  isActive: true,
};

const check = (actualWeight: number): InventoryCheck => ({
  id: 'check-1',
  accountId: inventoryAccount.name,
  accountDbId: inventoryAccount.id,
  date: '2026-09-01',
  systemWeight: 100,
  actualWeight,
  systemCount: 0,
  actualCount: 0,
  notes: '',
  userId: 'test',
});

describe('Central Accounting Write Cutover Phase 5B', () => {
  it('generates explicit system shortage/surplus operations instead of generic legacy adjustment', () => {
    const accounts = [inventoryAccount, shortageAccount, surplusAccount];
    const shortage = buildInventoryAdjustmentDraftEntry({
      check: check(95), accountsDb: accounts, entries: [] as Entry[], userId: 'test', now: 1,
    });
    const surplus = buildInventoryAdjustmentDraftEntry({
      check: check(105), accountsDb: accounts, entries: [] as Entry[], userId: 'test', now: 2,
    });

    expect(shortage.ok).toBe(true);
    expect(shortage.ok && shortage.entry.tx).toBe('تسوية عجز');
    expect(surplus.ok).toBe(true);
    expect(surplus.ok && surplus.entry.tx).toBe('تسوية زيادة');
  });

  it('keeps all accounting Entry persistence behind the Central write service', () => {
    const entryForm = readSource('components/views/EntryForm.tsx');
    const app = readSource('App.tsx');
    const inventory = readSource('components/views/InventoryCheckView.tsx');
    const settings = readSource('components/views/SettingsView.tsx');
    const service = readSource('lib/centralAccountingWriteService.ts');

    expect(entryForm).toContain('createCentralAccountingEntry');
    expect(entryForm).not.toMatch(/addDoc\(collection\(db, ['"]entries['"]\)/);
    expect(app).toContain('updateCentralAccountingEntry');
    expect(app).not.toMatch(/deleteDoc\(doc\(db, ['"]entries['"]/);
    expect(app).not.toMatch(/updateDoc\(doc\(db, ['"]entries['"]/);
    expect(inventory).toContain('createCentralInventoryAdjustment');
    expect(inventory).not.toContain('transaction.set(entryRef');
    expect(settings).not.toMatch(/addDoc\(collection\(db, ['"]entries['"]\)/);
    expect(settings).not.toMatch(/batch\.(?:delete|update)\(doc\(db, ['"]entries['"]/);
    expect(service).toContain("doc(db, 'entries', args.entry.id)");
  });

  it('uses a stable draft Operation ID and sequence for idempotent create retries', () => {
    const entryForm = readSource('components/views/EntryForm.tsx');
    const service = readSource('lib/centralAccountingWriteService.ts');
    expect(entryForm).toContain('id: crypto.randomUUID()');
    expect(entryForm).toContain('id: formData.id');
    expect(entryForm).toContain('seq: formData.seq');
    expect(service).toContain('sameCentralOperationPayload');
    expect(service).toContain('Operation ID conflict');
  });

  it('accepts an exact same-ID business payload despite persistence metadata', () => {
    const base = {
      id: 'op-stable', seq: 1, tx: 'بيع ذهب', debit: 'الخزنة', credit: 'خاتم عربي',
      debitAccountId: 'cash-1', creditAccountId: 'gold-1', date: '2026-09-01', cash: '1000',
      weight: '1', count: '0', arabicWeight: '1', karat: 21, invoiceNumber: 'S1',
      operationKind: 'sale', canonicalOperationId: 'gold.sale', canonicalOperationVersion: 1,
      inventoryCheckId: 'check-1', userId: 'u',
    } as Entry;
    expect(sameCentralOperationPayload(base, { ...base })).toBe(true);
    expect(sameCentralOperationPayload(base, {
      ...base,
      createdAt: { toMillis: () => 1 } as unknown as Entry['createdAt'],
      userId: 'another-persistence-actor',
    })).toBe(true);
  });

  it.each([
    ['debitAccountId', 'cash-2'],
    ['creditAccountId', 'gold-2'],
    ['tx', 'شراء ذهب'],
    ['operationKind', 'purchase'],
    ['canonicalOperationId', 'gold.purchase'],
    ['canonicalOperationVersion', 2],
    ['cash', '1001'],
    ['weight', '2'],
    ['count', '1'],
    ['karat', 18],
    ['invoiceNumber', 'S2'],
    ['inventoryCheckId', 'check-2'],
  ] as const)('fails same-ID idempotency when authoritative %s changes', (field, value) => {
    const base = {
      id: 'op-stable', seq: 1, tx: 'بيع ذهب', debit: 'الخزنة', credit: 'خاتم عربي',
      debitAccountId: 'cash-1', creditAccountId: 'gold-1', date: '2026-09-01', cash: '1000',
      weight: '1', count: '0', arabicWeight: '1', karat: 21, invoiceNumber: 'S1',
      operationKind: 'sale', canonicalOperationId: 'gold.sale', canonicalOperationVersion: 1,
      inventoryCheckId: 'check-1', userId: 'u',
    } as Entry;
    expect(sameCentralOperationPayload(base, { ...base, [field]: value })).toBe(false);
  });

  it('normalizes a raw retry through Central preflight before accepting the persisted enriched payload', async () => {
    const retryCash: Account = {
      id: 'retry-cash', name: 'الخزنة', mainType: 'اصول', subType: '', balanceNature: 'جنية مصري',
      type: 'cash', userId: 'test', isActive: true,
    };
    const retryExpense: Account = {
      id: 'retry-expense', name: 'مصروف تشغيل', mainType: 'مصروفات', subType: 'م ت',
      canonicalMainType: 'expense', canonicalSubType: 'expense', balanceNature: 'جنية مصري',
      type: 'other', userId: 'test', isActive: true,
    };
    const alternateExpense: Account = {
      ...retryExpense,
      id: 'retry-expense-alternate',
      name: 'مصروف تشغيل بديل',
    };
    const retryAccounts = [retryCash, retryExpense, alternateExpense];
    const manualAccountDefinitions = buildAccountRegistry(retryAccounts, []).accounts.map(definition => ({
      ...definition,
      reviewStatus: 'reviewed' as const,
      approvalStatus: 'approved' as const,
    }));
    const rawDraft: Entry = {
      id: 'stable-retry-id', seq: 77, tx: 'م ت', debit: retryExpense.name, credit: retryCash.name,
      date: '2026-09-01', cash: '100', weight: '0', count: '0', arabicWeight: '0', notes: '',
      invoiceNumber: 'TX77', userId: 'test',
    };
    const initialPreflight = buildCentralAccountingWritePreflight({
      entry: rawDraft,
      entries: [],
      accounts: retryAccounts,
      openingCostConfig: [],
      manualAccountDefinitions,
      source: 'user',
    });
    expect(initialPreflight.ready).toBe(true);
    expect(initialPreflight.preparedEntry).toMatchObject({
      debitAccountId: retryExpense.id,
      creditAccountId: retryCash.id,
      canonicalOperationId: 'expense.operating',
    });

    const retry = await createCentralAccountingEntry({
      entry: rawDraft,
      context: {
        entries: [initialPreflight.preparedEntry!],
        accounts: retryAccounts,
        openingCostConfig: [],
        manualAccountDefinitions,
      },
      actor: { userId: 'test' },
    });
    expect(retry).toMatchObject({ ok: true, entryId: 'stable-retry-id' });

    const conflict = await createCentralAccountingEntry({
      entry: { ...rawDraft, debitAccountId: alternateExpense.id },
      context: {
        entries: [initialPreflight.preparedEntry!],
        accounts: retryAccounts,
        openingCostConfig: [],
        manualAccountDefinitions,
      },
      actor: { userId: 'test' },
    });
    expect(conflict).toMatchObject({ ok: false });
    expect(conflict.ok === false && conflict.message).toContain('Operation ID');
  });

  it('removes hard-delete controls from the saved Entry correction UI', () => {
    const modal = readSource('components/views/EditingEntryModal.tsx');
    expect(modal).not.toContain('handleDelete');
    expect(modal).not.toContain('تأكيد الحذف');
    expect(modal).toContain('سبب التعديل');
  });

  it('keeps the generic adjustment identity for history but makes it non-writable', () => {
    const catalog = readSource('lib/canonicalOperationCatalog.ts');
    const legacyBlock = catalog.match(/id: 'inventory\.adjustment\.legacy'[\s\S]*?decisionSource:/)?.[0] || '';
    expect(legacyBlock).toContain("availability: 'transition_only'");
    expect(legacyBlock).toContain('userSelectable: false');
    expect(catalog).toMatch(/id: 'inventory\.adjustment\.shortage'[\s\S]*?userSelectable: false, systemGenerated: true/);
    expect(catalog).toMatch(/id: 'inventory\.adjustment\.surplus'[\s\S]*?userSelectable: false, systemGenerated: true/);
  });

  it('requires an explicit correction reason and avoids full before/after audit snapshots', () => {
    const service = readSource('lib/centralAccountingWriteService.ts');
    expect(service).toContain('سبب التعديل مطلوب');
    expect(service).toContain('changedFields');
    expect(service).not.toContain('beforeSnapshot');
    expect(service).not.toContain('afterSnapshot');
    expect(service).not.toMatch(/action: 'delete'/);
  });
});
