import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import {
  CANONICAL_OPERATION_CATALOG,
  type CanonicalOperationDefinition,
} from '../canonicalOperationCatalog';
import { buildCentralAccountingWritePreflight } from '../centralAccountingWritePreflight';

const account = (patch: Partial<Account>): Account => ({
  id: 'account',
  name: 'حساب',
  mainType: 'اصول',
  subType: '',
  balanceNature: 'جنية مصري',
  type: 'other',
  userId: 'test',
  isActive: true,
  ...patch,
});

const cash = account({ id: 'cash', name: 'الخزنة', type: 'cash' });
const expense = account({
  id: 'expense',
  name: 'مصروف تشغيل',
  mainType: 'مصروفات',
  subType: 'م ت',
  canonicalMainType: 'expense',
  canonicalSubType: 'expense',
});
const capital = account({
  id: 'capital',
  name: 'رأس المال',
  mainType: 'حقوق ملكية',
  subType: 'رأس مال',
  canonicalMainType: 'equity',
  canonicalSubType: 'capital',
});
const accounts = [cash, expense];

const entry = (patch: Partial<Entry> = {}): Entry => ({
  seq: 1,
  tx: 'م ت',
  debit: expense.name,
  credit: cash.name,
  date: '2026-09-01',
  cash: '100',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  invoiceNumber: 'TX1',
  userId: 'test',
  ...patch,
});

const approvedDefinitions = (sourceAccounts: Account[], rows: Entry[] = []) =>
  buildAccountRegistry(sourceAccounts, rows).accounts.map(definition => ({
    ...definition,
    reviewStatus: 'reviewed' as const,
    approvalStatus: 'approved' as const,
  }));

const cutoverCatalog: readonly CanonicalOperationDefinition[] = CANONICAL_OPERATION_CATALOG.map(operation =>
  operation.availability === 'transition_only'
    ? { ...operation, userSelectable: false }
    : operation,
);

describe('Central Accounting Write Preflight Phase 5A', () => {
  it('keeps the real default gate blocked while a transition-only writer is still selectable', () => {
    const candidate = entry();
    const before = JSON.stringify(candidate);
    const result = buildCentralAccountingWritePreflight({
      entry: candidate,
      entries: [],
      accounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(accounts),
      source: 'user',
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'registry_not_cutover_ready' }),
    ]));
    expect(result.coverage.transitionOperationsStillWritable).toContain('inventory.adjustment.legacy');
    expect(JSON.stringify(candidate)).toBe(before);
  });

  it('prepares a current user operation from Central operation/account identity when all cutover gates are satisfied', () => {
    const candidate = entry({ debitAccountId: undefined, creditAccountId: undefined, operationKind: undefined });
    const result = buildCentralAccountingWritePreflight({
      entry: candidate,
      entries: [],
      accounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(accounts),
      operationCatalog: cutoverCatalog,
      source: 'user',
    });

    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.operation).toMatchObject({ id: 'expense.operating', version: 1, operationKind: 'expense' });
    expect(result.preparedEntry).toMatchObject({
      tx: 'م ت',
      operationKind: 'expense',
      debit: expense.name,
      debitAccountId: expense.id,
      credit: cash.name,
      creditAccountId: cash.id,
    });
    expect(result.posting).toMatchObject({ valid: true, operationKind: 'expense' });
    expect(candidate.operationKind).toBeUndefined();
    expect(candidate.debitAccountId).toBeUndefined();
    expect(candidate.creditAccountId).toBeUndefined();
  });

  it('separates setup-only operations from normal user writes', () => {
    const setupAccounts = [cash, capital];
    const candidate = entry({
      tx: 'قيد افتتاحي',
      subTx: 'نقدي',
      debit: cash.name,
      credit: capital.name,
      cash: '1000',
      invoiceNumber: 'OPEN-1',
    });
    const definitions = approvedDefinitions(setupAccounts);

    const normalUser = buildCentralAccountingWritePreflight({
      entry: candidate,
      entries: [],
      accounts: setupAccounts,
      openingCostConfig: [],
      manualAccountDefinitions: definitions,
      operationCatalog: cutoverCatalog,
      source: 'user',
    });
    expect(normalUser.ready).toBe(false);
    expect(normalUser.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'operation_not_writable' }),
    ]));

    const setup = buildCentralAccountingWritePreflight({
      entry: candidate,
      entries: [],
      accounts: setupAccounts,
      openingCostConfig: [],
      manualAccountDefinitions: definitions,
      operationCatalog: cutoverCatalog,
      source: 'setup',
    });
    expect(setup.ready).toBe(true);
    expect(setup.operation).toMatchObject({ id: 'opening.entry', availability: 'setup_only' });
  });

  it('models update cost validation by replacing exactly one existing row instead of appending a duplicate', () => {
    const existing = entry({
      id: 'existing-entry',
      operationKind: 'expense',
      debitAccountId: expense.id,
      creditAccountId: cash.id,
    });
    const beforeRows = JSON.stringify([existing]);
    const candidate = { ...existing, cash: '125', notes: 'updated' };
    const result = buildCentralAccountingWritePreflight({
      entry: candidate,
      entries: [existing],
      accounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(accounts, [existing]),
      operationCatalog: cutoverCatalog,
      source: 'user',
      mode: 'update',
    });

    expect(result.ready).toBe(true);
    expect(result.preparedEntry).toMatchObject({ id: 'existing-entry', cash: '125', notes: 'updated' });
    expect(JSON.stringify([existing])).toBe(beforeRows);
  });

  it('keeps the stored account labels during unrelated updates while stable IDs remain authoritative', () => {
    const existing = entry({
      id: 'renamed-account-entry',
      operationKind: 'expense',
      debit: 'مصروف تشغيل — الاسم التاريخي',
      debitAccountId: expense.id,
      creditAccountId: cash.id,
    });
    const result = buildCentralAccountingWritePreflight({
      entry: { ...existing, notes: 'note only' },
      entries: [existing],
      accounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(accounts, [existing]),
      operationCatalog: cutoverCatalog,
      source: 'user',
      mode: 'update',
    });

    expect(result.ready).toBe(true);
    expect(result.preparedEntry).toMatchObject({
      debit: 'مصروف تشغيل — الاسم التاريخي',
      debitAccountId: expense.id,
      credit: cash.name,
      creditAccountId: cash.id,
    });
  });

  it('fails closed when an update target cannot be resolved exactly once', () => {
    const result = buildCentralAccountingWritePreflight({
      entry: entry({ id: 'missing-entry' }),
      entries: [],
      accounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(accounts),
      operationCatalog: cutoverCatalog,
      source: 'user',
      mode: 'update',
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'update_target_missing' }),
    ]));
  });

  it('fails closed for an unknown operation instead of consulting legacy operation rules', () => {
    const result = buildCentralAccountingWritePreflight({
      entry: entry({ tx: 'عملية غير معروفة' }),
      entries: [],
      accounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(accounts),
      operationCatalog: cutoverCatalog,
      source: 'user',
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'operation_unknown' }),
    ]));
    expect(result.preparedEntry).toBeUndefined();
  });

  it('fails closed when a supplied operationKind contradicts the Central operation definition', () => {
    const result = buildCentralAccountingWritePreflight({
      entry: entry({ operationKind: 'sale' }),
      entries: [],
      accounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(accounts),
      operationCatalog: cutoverCatalog,
      source: 'user',
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'operation_kind_conflict' }),
    ]));
    expect(result.preparedEntry?.operationKind).toBe('expense');
  });

  it('does not allow a system-generated operation to be submitted from the user path', () => {
    const gold = account({
      id: 'gold', name: 'ذهب 21', type: 'gold_product', metal: 'gold', karat: '21',
      is_inventory: true, balanceNature: 'جرام ذهب', canonicalSubType: 'inventory_gold',
    });
    const shortage = account({
      id: 'gold-shortage', name: 'عجز-الذهب', mainType: 'مصروفات', subType: 'عجز',
      metal: 'gold', balanceNature: 'جرام ذهب', canonicalSubType: 'expense',
    });
    const systemAccounts = [gold, shortage];
    const result = buildCentralAccountingWritePreflight({
      entry: entry({
        tx: 'تسوية عجز', debit: shortage.name, credit: gold.name, cash: '0', weight: '1', arabicWeight: '1', karat: 21,
      }),
      entries: [],
      accounts: systemAccounts,
      openingCostConfig: [],
      manualAccountDefinitions: approvedDefinitions(systemAccounts),
      operationCatalog: cutoverCatalog,
      source: 'user',
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'operation_not_writable' }),
    ]));
  });

  it('has no Firebase, React, store, or legacy operation-constant dependency', () => {
    const source = readFileSync(new URL('../centralAccountingWritePreflight.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"]firebase|addDoc\(|setDoc\(|updateDoc\(|deleteDoc\(|writeBatch\(|runTransaction\(/);
    expect(source).not.toMatch(/from ['"]react|from ['"]\.\.\/store|RAW_DATA|CATS|OPERATION_RULES/);
  });
});
