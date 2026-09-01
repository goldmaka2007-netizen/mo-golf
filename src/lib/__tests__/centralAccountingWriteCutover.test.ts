import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry, InventoryCheck } from '../../types';
import { buildInventoryAdjustmentDraftEntry } from '../inventoryCheckSettlement';
import { sameCentralOperationPayload } from '../centralAccountingWriteService';

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

  it('fails same-ID idempotency comparison when either stable account ID changes', () => {
    const base = {
      id: 'op-stable', seq: 1, tx: 'بيع ذهب', debit: 'الخزنة', credit: 'خاتم عربي',
      debitAccountId: 'cash-1', creditAccountId: 'gold-1', date: '2026-09-01', cash: '1000',
      weight: '1', count: '0', arabicWeight: '1', invoiceNumber: 'S1', userId: 'u',
    } as Entry;
    expect(sameCentralOperationPayload(base, { ...base })).toBe(true);
    expect(sameCentralOperationPayload(base, { ...base, debitAccountId: 'cash-2' })).toBe(false);
    expect(sameCentralOperationPayload(base, { ...base, creditAccountId: 'gold-2' })).toBe(false);
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
