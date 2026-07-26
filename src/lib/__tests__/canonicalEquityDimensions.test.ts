import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildAccountRegistry } from '../accountRegistry';
import {
  buildCanonicalAccountingLegs,
  buildCanonicalAccountRegistry,
  diagnoseMetalPostings,
  findUnbalancedMetalPostings,
} from '../canonicalAccounting';
import { CANONICAL_EQUITY_ACCOUNT_IDS } from '../canonicalEquityCatalog';
import { buildDailyJournalReport } from '../dailyJournalReport';

const account = (partial: Partial<Account>): Account => ({
  id: 'account', name: 'حساب', mainType: 'أصول', subType: '', balanceNature: '',
  userId: 'u', type: 'other', ...partial,
});
const entry = (partial: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, tx: 'قيد افتتاحي', operationKind: 'opening',
  date: '2026-01-01', debit: '', credit: '', cash: '0', weight: '0',
  arabicWeight: '0', count: '0', notes: '', userId: 'u', ...partial,
});

const goldCapital = account({
  id: CANONICAL_EQUITY_ACCOUNT_IDS.goldCapital,
  name: 'راس المال ذهب', mainType: 'حقوق ملكية', subType: 'راس المال',
  balanceNature: 'جرام ذهب',
});
const retainedCashAndGold = account({
  id: CANONICAL_EQUITY_ACCOUNT_IDS.cashAndGoldRetainedResults,
  name: 'الارباح و الخساير 2024', mainType: 'حقوق ملكية',
  subType: 'الارباح و الخساير', balanceNature: 'جنية مصري',
});
const silverCapital = account({
  id: CANONICAL_EQUITY_ACCOUNT_IDS.silverCapital,
  name: 'راس المال فضة', mainType: 'حقوق ملكية', subType: 'راس المال',
  balanceNature: 'جرام فضة', metal: 'silver',
});
const silverRetained = account({
  id: CANONICAL_EQUITY_ACCOUNT_IDS.silverRetainedResults,
  name: 'الارباح و الخساير 2024 فضة', mainType: 'حقوق ملكية',
  subType: 'الارباح و الخساير', balanceNature: 'جرام فضة', metal: 'silver',
});

describe('canonical equity dimensions', () => {
  it('balances historical TX42 as two gold equity legs at 16.20 g E21', () => {
    const tx42 = entry({
      id: 'csvref-entry-3e1f9b1fe78247341d78529914239bba',
      invoiceNumber: 'TX42',
      debit: goldCapital.name, debitAccountId: goldCapital.id,
      credit: retainedCashAndGold.name, creditAccountId: retainedCashAndGold.id,
      weight: '16.20', arabicWeight: '16.20',
      legacyOperationId: 'dykcltueh9B3mWMkDUGK', legacyOperationNo: 'TX42',
      imported: true, importVersion: 'makkah-gold-csv-2026-07-23-v1', sourceRow: 2155,
    });
    const accounts = [goldCapital, retainedCashAndGold];
    const registry = buildCanonicalAccountRegistry(accounts, [tx42]);
    const legs = buildCanonicalAccountingLegs([tx42], registry);

    expect(legs.map(leg => ({
      side: leg.side, dimension: leg.dimension, amount: leg.amount, group: leg.group,
      accountId: leg.entity.sourceAccount?.id,
    }))).toEqual([
      { side: 'debit', dimension: 'gold', amount: 16.2, group: 'equity', accountId: goldCapital.id },
      { side: 'credit', dimension: 'gold', amount: 16.2, group: 'equity', accountId: retainedCashAndGold.id },
    ]);
    expect(diagnoseMetalPostings([tx42], registry, legs)[0].droppedReasons).toEqual([]);
    expect(findUnbalancedMetalPostings([tx42], legs)).toEqual([]);
    expect(buildDailyJournalReport([tx42], accounts, tx42.date).diagnostics.entries).toEqual([]);
  });

  it('classifies approved gold retained results as equity with gold E21 support', () => {
    const result = buildAccountRegistry([retainedCashAndGold]).resolve(
      retainedCashAndGold.id, retainedCashAndGold.name,
    );
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.via).toBe('id');
    expect(result.account).toMatchObject({
      mainGroup: 'equity', entityType: 'retained_earnings',
      allowedDimensions: ['cash', 'gold'], metal: 'gold', karat: 21,
      tracksGold: true, trackingMode: 'value_and_weight', approvalStatus: 'approved',
    });
    expect(result.account.legacyNames).toContain('الارباح و الخساير 2024');
  });

  it('keeps cash retained earnings out of gold', () => {
    const cashRetained = account({
      id: 'cash-retained', name: 'نتيجة سنوات سابقة نقد', mainType: 'حقوق ملكية',
      subType: 'retained earnings', balanceNature: 'EGP',
    });
    const result = buildAccountRegistry([cashRetained]).resolve(cashRetained.id);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.account).toMatchObject({
      mainGroup: 'equity', entityType: 'retained_earnings',
      allowedDimensions: ['cash'], metal: null, tracksGold: false,
    });
  });

  it('accepts silver retained results only for silver legs', () => {
    const silverEntry = entry({
      id: 'silver-retained-opening',
      debit: silverRetained.name, debitAccountId: silverRetained.id,
      credit: silverCapital.name, creditAccountId: silverCapital.id,
      weight: '60.94', arabicWeight: '60.94',
    });
    const registry = buildCanonicalAccountRegistry(
      [silverRetained, silverCapital], [silverEntry],
    );
    const legs = buildCanonicalAccountingLegs([silverEntry], registry);
    expect(legs).toHaveLength(2);
    expect(legs.every(leg => leg.dimension === 'silver')).toBe(true);
    expect(findUnbalancedMetalPostings([silverEntry], legs)).toEqual([]);

    const goldEntry = entry({
      id: 'wrong-gold-on-silver-equity',
      debit: goldCapital.name, debitAccountId: goldCapital.id,
      credit: silverRetained.name, creditAccountId: silverRetained.id,
      weight: '1', arabicWeight: '1',
    });
    const mixed = buildCanonicalAccountRegistry([goldCapital, silverRetained], [goldEntry]);
    expect(buildCanonicalAccountingLegs([goldEntry], mixed)).toEqual([]);
  });

  it('does not infer retained equity or a dimension from a similar name alone', () => {
    const unclassified = account({
      id: 'unclassified-similar-name', name: 'أرباح وخسائر مشروع تجريبي',
      mainType: 'حقوق ملكية', subType: '', balanceNature: '',
    });
    const result = buildAccountRegistry([unclassified]).resolve(unclassified.id);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.account.entityType).toBe('capital');
    expect(result.account.allowedDimensions).toEqual([]);
    expect(result.account.metal).toBeNull();
  });

  it('keeps operational loss accounts classified as expenses', () => {
    const operationalLoss = account({
      id: 'operational-loss', name: 'خسائر تشغيلية', mainType: 'مصروفات',
      subType: 'مصاريف تشغيلية', balanceNature: 'جنية مصري',
    });
    const result = buildAccountRegistry([operationalLoss]).resolve(operationalLoss.id);
    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.account).toMatchObject({
      mainGroup: 'expenses', entityType: 'expense', allowedDimensions: ['cash'],
    });
  });

  it('keeps opening equity without a dimension fail-closed with a diagnostic', () => {
    const unspecified = account({
      id: 'unspecified-equity', name: 'حقوق ملكية غير محددة',
      mainType: 'حقوق ملكية', subType: 'راس المال', balanceNature: '',
    });
    const opening = entry({
      id: 'unspecified-equity-opening',
      debit: goldCapital.name, debitAccountId: goldCapital.id,
      credit: unspecified.name, creditAccountId: unspecified.id,
      weight: '2', arabicWeight: '2',
    });
    const accounts = [goldCapital, unspecified];
    const registry = buildCanonicalAccountRegistry(accounts, [opening]);
    const legs = buildCanonicalAccountingLegs([opening], registry);
    expect(legs).toHaveLength(1);
    expect(diagnoseMetalPostings([opening], registry, legs)[0].droppedReasons)
      .toContain('missing credit metal leg');
    expect(buildDailyJournalReport([opening], accounts, opening.date)
      .diagnostics.entries[0].reasons).toContain('missing_credit_metal_leg');
  });
  it('turns conflicting manual metadata into a fail-closed classification diagnostic', () => {
    const approved = buildAccountRegistry([retainedCashAndGold]).accounts[0];
    const conflicting = {
      ...approved,
      allowedDimensions: ['silver' as const],
      metal: 'silver' as const,
      normalBalanceByDimension: {
        cash: null, gold: null, silver: 'credit' as const, quantity: null,
      },
    };
    const result = buildAccountRegistry(
      [retainedCashAndGold],
      [],
      [conflicting],
    ).accounts[0];
    expect(result.allowedDimensions).toEqual([]);
    expect(result.reviewStatus).toBe('needs_review');
    expect(result.approvalStatus).toBe('draft');
    expect(result.classificationConflicts).toContain(
      `approved_equity_taxonomy_conflict:${retainedCashAndGold.id}`,
    );
  });
  it('rejects duplicate approved metadata aliases instead of choosing by array order', () => {
    const duplicateRetained = { ...retainedCashAndGold, id: 'duplicate-runtime-retained' };
    const opening = entry({
      id: 'duplicate-retained-opening',
      debit: goldCapital.name,
      credit: retainedCashAndGold.name,
      weight: '3',
      arabicWeight: '3',
    });
    const accounts = [goldCapital, retainedCashAndGold, duplicateRetained];
    const registry = buildCanonicalAccountRegistry(accounts, [opening]);
    expect(registry.ambiguousAliases?.size).toBe(1);
    const legs = buildCanonicalAccountingLegs([opening], registry);
    expect(legs).toHaveLength(1);
    expect(buildDailyJournalReport([opening], accounts, opening.date)
      .diagnostics.entries[0].reasons).toContain('missing_credit_metal_leg');
  });
});
