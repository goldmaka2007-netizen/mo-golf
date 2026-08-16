import { describe, expect, it } from 'vitest';
import { Account, CanonicalAccountDefinition, Entry } from '../../types';
import { buildAccountRegistry, canApproveRegistry, discoverAccounts, normalizeAccountName, validateCanonicalAccount } from '../accountRegistry';
import { buildMigrationPatch, planAccountIdMigration } from '../accountMigration';
import { buildCanonicalPosting } from '../postingMatrix';
import { buildParityReport } from '../shadowAccounting';
import { SEED_ACCOUNTS } from '../../migrationData';

const account = (patch: Partial<Account>): Account => ({ id: 'a', name: 'حساب', mainType: 'اصول', subType: '', balanceNature: 'جنية مصري', type: 'other', userId: 'u', ...patch });
const entry = (patch: Partial<Entry>): Entry => ({ id: 'e', seq: 1, tx: 'عملية', operationKind: 'other', debit: 'الخزنة', credit: 'مصروفات', date: '2026-01-01', cash: '100', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u', ...patch });

describe('central account registry', () => {
  it('derives coin and bar quantity tracking from runtime taxonomy when metadata is missing', () => {
    const seeded = (name: string, id: string): Account => ({
      ...(SEED_ACCOUNTS.find(item => item.name === name)! as Account),
      id,
      userId: 'u',
    });
    const registry = buildAccountRegistry([
      seeded('كسر افرنجي', 'scrap-foreign'),
      seeded('كسر عربي', 'scrap-arabic'),
      seeded('جنية', 'coin'),
      seeded('سبيكة', 'bar'),
      { ...seeded('جنية', 'unrelated-direct'), name: 'ذهب مباشر إضافي', cloneSourceAccountId: undefined, type: 'gold_direct', quantityStep: undefined },
    ]);

    expect(registry.bySourceAccountId.get('scrap-foreign')).toMatchObject({ trackingMode: 'weight', tracksQuantity: false });
    expect(registry.bySourceAccountId.get('scrap-arabic')).toMatchObject({ trackingMode: 'weight', tracksQuantity: false });
    expect(registry.bySourceAccountId.get('coin')).toMatchObject({ trackingMode: 'weight_and_quantity', tracksQuantity: true });
    expect(registry.bySourceAccountId.get('bar')).toMatchObject({ trackingMode: 'weight_and_quantity', tracksQuantity: true });
    expect(registry.bySourceAccountId.get('unrelated-direct')).toMatchObject({ trackingMode: 'weight', tracksQuantity: false });
  });

  it('extracts inventory and merchant dimensions from legacy metadata without treating merchant weight as inventory', () => {
    const registry = buildAccountRegistry([
      account({ id: 'gold', name: 'خاتم', type: 'gold_product', metal: 'gold', is_inventory: true, karat: '21', balanceNature: 'جرام ذهب' }),
      account({ id: 'merchant', name: 'تاجر', mainType: 'خصوم', type: 'merchant', metal: 'gold', balanceNature: 'جرام ذهب' }),
    ]);
    expect(registry.bySourceAccountId.get('gold')).toMatchObject({ entityType: 'gold_inventory', allowedDimensions: ['gold'], isInventory: true, karat: 21 });
    expect(registry.bySourceAccountId.get('merchant')).toMatchObject({ entityType: 'merchant', allowedDimensions: ['cash', 'gold'], isInventory: false, isMerchant: true });
  });

  it('normalizes harmless Arabic/hyphen variants but refuses ambiguous aliases', () => {
    const first = account({ id: 'one', name: 'زيادة-الذهب', mainType: 'ايرادات', balanceNature: 'جرام ذهب', metal: 'gold' });
    const second = account({ id: 'two', name: 'إيراد آخر', mainType: 'ايرادات' });
    const manual = buildAccountRegistry([first, second]).accounts.map(item => item.id === 'account:two' ? { ...item, aliases: [...item.aliases, 'زيادة الذهب'] } : item);
    const registry = buildAccountRegistry([first, second], [], manual);
    expect(normalizeAccountName('زيادة-الذهب')).toBe(normalizeAccountName('زيادة الذهب'));
    expect(registry.resolve(undefined, 'زيادة الذهب').status).toBe('ambiguous');
  });

  it('lets a reviewed manual classification override the legacy proposal', () => {
    const source = account({ id: 'x', name: 'طرف', type: 'other' });
    const generated = buildAccountRegistry([source]).accounts[0];
    const manual: CanonicalAccountDefinition = { ...generated, entityType: 'creditor', mainGroup: 'liabilities', classificationSource: 'manual', approvalStatus: 'approved', reviewStatus: 'reviewed' };
    expect(buildAccountRegistry([source], [], [manual]).accounts[0]).toMatchObject({ entityType: 'creditor', mainGroup: 'liabilities', classificationSource: 'manual', classificationConfidence: 1 });
  });

  it('discovers names used only by historical debit/credit and returns evidence statistics', () => {
    const rows = [entry({ id: '1', debit: 'عميل قديم', credit: 'الخزنة', creditAccountId: 'cash' }), entry({ id: '2', debit: 'الخزنة', debitAccountId: 'cash', credit: 'عميل قديم', cash: '50' })];
    const found = discoverAccounts([account({ id: 'cash', name: 'الخزنة', type: 'cash' })], rows);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: 'عميل قديم', debitCount: 1, creditCount: 1, cashTotal: 150, firstDate: '2026-01-01' });
    expect(found[0].samples).toHaveLength(2);
  });

  it('requires per-dimension balance nature and keeps quantity outside financial dimensions', () => {
    const definition = buildAccountRegistry([account({ id: 'acc', name: 'ملحق', type: 'accessory', is_inventory: true, quantityStep: 1 })]).accounts[0];
    expect(definition.allowedDimensions).toEqual(['quantity']);
    expect(validateCanonicalAccount({ ...definition, normalBalanceByDimension: { ...definition.normalBalanceByDimension, quantity: null } })).toContain('طبيعة الرصيد مطلوبة لبُعد quantity');
  });
});
describe('safe ID migration and shadow posting', () => {
  const accounts = [
    account({ id: 'cash', name: 'الخزنة', type: 'cash' }),
    account({ id: 'expense', name: 'كهرباء', mainType: 'مصروفات', type: 'other' }),
  ];
  it('plans only unique matches and produces an idempotent patch preserving historical labels', () => {
    const row = entry({ debit: 'كهرباء', credit: 'الخزنة' });
    const report = planAccountIdMigration([row], buildAccountRegistry(accounts, [row]));
    expect(report).toMatchObject({ ready: 1, blocked: 0 });
    const patch = buildMigrationPatch(report.plans[0], '2026-01-02T00:00:00.000Z');
    expect(patch).toMatchObject({ debitAccountId: 'expense', creditAccountId: 'cash', debitLegacySnapshot: 'كهرباء', creditLegacySnapshot: 'الخزنة', accountMigrationVersion: 1 });
    const rerun = planAccountIdMigration([{ ...row, ...patch }], buildAccountRegistry(accounts, [{ ...row, ...patch }]));
    expect(rerun).toMatchObject({ ready: 0, alreadyMigrated: 1 });
  });

  it('blocks migration for an unknown account instead of fuzzy matching it', () => {
    const report = planAccountIdMigration([entry({ debit: 'كهرباااء', credit: 'الخزنة' })], buildAccountRegistry(accounts));
    expect(report).toMatchObject({ blocked: 1, unknownSides: 1 });
  });

  it('validates the central posting matrix before a shadow result is accepted', () => {
    const row = entry({ operationKind: 'expense', debit: 'كهرباء', debitAccountId: 'expense', credit: 'الخزنة', creditAccountId: 'cash', weight: '1' });
    const posting = buildCanonicalPosting(row, buildAccountRegistry(accounts, [row]));
    expect(posting.valid).toBe(false);
    expect(posting.issues.map(issue => issue.code)).toContain('dimension_forbidden');
  });

  it('generates parity without writing duplicate ledger records', () => {
    const row = entry({ debit: 'كهرباء', debitAccountId: 'expense', credit: 'الخزنة', creditAccountId: 'cash', operationKind: 'expense' });
    const report = buildParityReport([row], accounts, buildAccountRegistry(accounts, [row]));
    expect(report.total).toBe(1);
    expect(report.rows[0].canonicalResult.operationId).toBe('e');
    expect(row).not.toHaveProperty('shadowLegs');
  });

  it('prevents registry approval while IDs, reviews, or parity prerequisites are unresolved', () => {
    const registry = buildAccountRegistry(accounts, [entry({ debit: 'مجهول', credit: 'الخزنة' })]);
    const result = canApproveRegistry(registry, [entry({ debit: 'مجهول', credit: 'الخزنة' })]);
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
