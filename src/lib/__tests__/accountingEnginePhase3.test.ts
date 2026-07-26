import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildAccountingEngineProjection, createCanonicalMappingResolver } from '../accountingEngine';
import { createCustomerPurchaseDesignFixture, createTx42CanonicalPosting } from '../canonicalMappingDesign';

const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'u' },
  { id: 'gold', name: 'gold', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', metal: 'gold', userId: 'u' },
];
const entry = (partial: Partial<Entry> = {}): Entry => ({
  id: 'entry-1', seq: 1, tx: 'purchase', operationKind: 'purchase', date: '2026-01-01',
  debit: 'gold', credit: 'cash', cash: '1000', weight: '2', arabicWeight: '2', count: '1', notes: '', userId: 'u', ...partial,
});

describe('Phase 3 canonical accounting integration boundary', () => {
  it('keeps legacy execution as the default production behavior', () => {
    const source = entry();
    const implicit = buildAccountingEngineProjection([source], accounts);
    const explicit = buildAccountingEngineProjection([source], accounts, { mode: 'legacy' });
    expect(implicit).toEqual(explicit);
    expect(implicit).toMatchObject({ mode: 'legacy', source: 'legacy_raw_fields', ready: true });
    expect(implicit.legacyProjection.legs).toHaveLength(4);
  });

  it('executes an approved canonical posting entirely in memory', () => {
    const source = entry();
    const resolver = createCanonicalMappingResolver([{
      id: 'approved-gold-purchase', matches: candidate => candidate.id === source.id,
      build: candidate => ({ ...createCustomerPurchaseDesignFixture('gold'), sourceOperationId: candidate.id! }),
    }]);
    const result = buildAccountingEngineProjection([source], accounts, { mode: 'canonical_preview', canonicalResolver: resolver });
    expect(result).toMatchObject({ mode: 'canonical_preview', source: 'canonical_mapping', ready: true, legacyProjection: null, issues: [] });
    expect(result.canonicalPostings).toHaveLength(1);
    expect(result.canonicalLegs.filter(leg => leg.dimension === 'cash')).toHaveLength(2);
    expect(result.canonicalLegs.filter(leg => leg.dimension === 'gold')).toHaveLength(2);
  });

  it('fails closed for missing, overlapping, or non-executable mappings', () => {
    const source = entry();
    const overlap = createCanonicalMappingResolver([
      { id: 'one', matches: () => true, build: () => createCustomerPurchaseDesignFixture('gold') },
      { id: 'two', matches: () => true, build: () => createCustomerPurchaseDesignFixture('gold') },
    ]);
    const ambiguous = buildAccountingEngineProjection([source], accounts, { mode: 'canonical_preview', canonicalResolver: overlap });
    expect(ambiguous.ready).toBe(false);
    expect(ambiguous.canonicalLegs).toEqual([]);
    expect(ambiguous.issues[0]).toMatchObject({ code: 'mapping_ambiguous', ruleIds: ['one', 'two'] });
    const missing = buildAccountingEngineProjection([source], accounts, { mode: 'canonical_preview' });
    expect(missing.ready).toBe(false);
    expect(missing.canonicalLegs).toEqual([]);
    const legacyOnly = createCanonicalMappingResolver([{
      id: 'legacy-exception', matches: () => true,
      build: () => ({ ...createTx42CanonicalPosting(), postingStatus: 'legacy_only', balancingStatus: 'not_applicable' }),
    }]);
    const blocked = buildAccountingEngineProjection([source], accounts, { mode: 'canonical_preview', canonicalResolver: legacyOnly });
    expect(blocked.ready).toBe(false);
    expect(blocked.canonicalLegs).toEqual([]);
    expect(blocked.issues[0].code).toBe('posting_not_executable');
  });

  it('contains no persistence, migration, or deployment calls', () => {
    const source = readFileSync(new URL('../accountingEngine.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\b(addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(/);
    expect(source).not.toMatch(/\b(runMigration|migrateEntries|firebase\s+deploy)\s*\(/);
  });
});