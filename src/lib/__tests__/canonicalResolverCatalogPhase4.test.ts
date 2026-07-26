import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../../types';
import { buildAccountingEngineProjection, createCanonicalMappingResolver } from '../accountingEngine';
import {
  CANONICAL_RESOLVER_CATALOG_V1_VERSION,
  createVersionedCanonicalResolver,
  validateCanonicalResolverCatalog,
  type CanonicalResolverCatalog,
  type CanonicalResolverDefinition,
} from '../canonicalResolverCatalog';
import {
  canonicalResolverCatalogV1,
  canonicalResolverCatalogV1Resolver,
  canonicalResolverCatalogV1Runtime,
} from '../canonicalResolverCatalogV1';
import { summarizePostingBalances } from '../canonicalMappingDesign';

type CsvRow = Record<string, string>;

const parseCsv = (text: string): CsvRow[] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (character !== '\r') field += character;
  }
  if (field || record.length) records.push([...record, field]);
  const headers = (records.shift() ?? []).map(value => value.replace(/^\uFEFF/, ''));
  return records.filter(values => values.some(Boolean))
    .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
};

const fixtureRows = () => parseCsv(readFileSync(new URL('../../../approved_normalized_preview.csv', import.meta.url), 'utf8'));
const fixtures = (): Entry[] => fixtureRows().map(row => ({
  ...JSON.parse(row.proposed_import_document),
  id: row.document_id,
}) as Entry);

const cloneDefinition = (
  definition: CanonicalResolverDefinition,
  changes: Partial<CanonicalResolverDefinition>,
): CanonicalResolverDefinition => ({ ...definition, ...changes });

describe('Phase 4 versioned canonical resolver catalog', () => {
  it('has an explicit stable version and exactly 174 immutable definitions', () => {
    expect(CANONICAL_RESOLVER_CATALOG_V1_VERSION).toBe('phase2.1-approved-v1');
    expect(canonicalResolverCatalogV1.version).toBe(CANONICAL_RESOLVER_CATALOG_V1_VERSION);
    expect(canonicalResolverCatalogV1.definitions).toHaveLength(174);
    expect(Object.isFrozen(canonicalResolverCatalogV1)).toBe(true);
    expect(Object.isFrozen(canonicalResolverCatalogV1.definitions)).toBe(true);
  });

  it('represents every approved Phase 2.1 matrix row with a stable composite variant ID', () => {
    const matrix = parseCsv(readFileSync(new URL('../../../canonical_operation_mapping_matrix.csv', import.meta.url), 'utf8'));
    const expected = matrix.map(row => `${row.operationType}:${row.variant}`).sort();
    const actual = canonicalResolverCatalogV1.definitions.map(row => row.approvedVariantId).sort();
    expect(actual).toEqual(expected);
  });

  it('validates unique resolver and approved variant IDs', () => {
    expect(new Set(canonicalResolverCatalogV1.definitions.map(item => item.resolverId)).size).toBe(174);
    expect(new Set(canonicalResolverCatalogV1.definitions.map(item => item.approvedVariantId)).size).toBe(174);
    expect(canonicalResolverCatalogV1Runtime.validation).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('fails closed for a missing mapping', () => {
    const result = canonicalResolverCatalogV1Runtime.resolve({
      id: 'unknown', tx: 'unknown', debit: 'x', credit: 'y', date: '2026-01-01',
      cash: '1', weight: '0', arabicWeight: '0', count: '0', notes: '', userId: 'u',
    });
    expect(result).toEqual({ status: 'unresolved' });
  });

  it('detects overlapping conditions and blocks the entire invalid catalog', () => {
    const first = canonicalResolverCatalogV1.definitions[0];
    const overlap = cloneDefinition(first, {
      resolverId: 'overlap-id',
      approvedVariantId: 'overlap-variant',
    });
    const catalog = {
      version: CANONICAL_RESOLVER_CATALOG_V1_VERSION,
      definitions: [first, overlap],
    } as CanonicalResolverCatalog;
    const validation = validateCanonicalResolverCatalog(catalog);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join('|')).toContain('Overlapping match conditions');
    expect(createVersionedCanonicalResolver(catalog).resolve(fixtures()[0]).status).toBe('invalid');
  });

  it('blocks invalid definitions, including duplicate IDs and zero-leg canonical output', () => {
    const first = canonicalResolverCatalogV1.definitions[0];
    const invalid = cloneDefinition(first, {
      dimensions: { cash: false, gold: false, silver: false },
    });
    const catalog = {
      version: CANONICAL_RESOLVER_CATALOG_V1_VERSION,
      definitions: [invalid, invalid],
    } as CanonicalResolverCatalog;
    const errors = validateCanonicalResolverCatalog(catalog).errors.join('|');
    expect(errors).toContain('Duplicate resolver ID');
    expect(errors).toContain('zero required ledger dimensions');
  });

  it('keeps legacy_only non-executable with no canonical accounting legs', () => {
    const source = fixtures().find(entry => entry.id === 'csvref-entry-81dfb31da7851f610d67225ba19157a8')!;
    const resolution = canonicalResolverCatalogV1Runtime.resolve(source);
    expect(resolution.status).toBe('matched');
    if (resolution.status === 'matched') {
      expect(resolution.definition.status).toBe('legacy_only');
      expect(resolution.posting.cashLedgerLegs).toEqual([]);
    }
    const engine = buildAccountingEngineProjection([source], [], {
      mode: 'canonical_preview',
      canonicalResolver: canonicalResolverCatalogV1Resolver,
    });
    expect(engine.ready).toBe(false);
    expect(engine.canonicalLegs).toEqual([]);
    expect(engine.issues[0].code).toBe('posting_not_executable');
  });

  it('keeps design-only prerequisite rules fail-closed and emits no posting', () => {
    const designEntry = {
      id: 'return-1', tx: 'return', debit: 'x', credit: 'y', date: '2026-01-01',
      cash: '100', weight: '2', arabicWeight: '2', count: '1', notes: '', userId: 'u',
      canonicalOperationType: 'sale_return', canonicalVariant: 'gold',
    };
    const resolution = canonicalResolverCatalogV1Runtime.resolve(designEntry);
    expect(resolution.status).toBe('invalid');
    expect(resolution).not.toHaveProperty('posting');
  });

  it('does not let array order resolve ambiguity', () => {
    const source = fixtures()[0];
    const build = () => {
      const result = canonicalResolverCatalogV1Runtime.resolve(source);
      if (result.status !== 'matched') throw new Error('fixture must match');
      return result.posting;
    };
    for (const rules of [
      [{ id: 'one', matches: () => true, build }, { id: 'two', matches: () => true, build }],
      [{ id: 'two', matches: () => true, build }, { id: 'one', matches: () => true, build }],
    ]) {
      const resolution = createCanonicalMappingResolver(rules).resolve(source);
      expect(resolution.status).toBe('ambiguous');
    }
  });

  it('evaluates all 2,169 fixtures without modifying them and balances every executable record', () => {
    const entries = fixtures();
    const original = JSON.stringify(entries);
    const counts = { matched: 0, legacy_only: 0, unresolved: 0, invalid: 0, ambiguous: 0 };
    for (const entry of entries) {
      const result = canonicalResolverCatalogV1Runtime.resolve(entry);
      if (result.status === 'matched') {
        if (result.definition.status === 'legacy_only') {
          counts.legacy_only += 1;
          expect(result.posting.cashLedgerLegs).toEqual([]);
          expect(result.posting.goldLedgerLegs).toEqual([]);
          expect(result.posting.silverLedgerLegs).toEqual([]);
        } else {
          counts.matched += 1;
          expect(result.posting.ruleVersion).toBe(CANONICAL_RESOLVER_CATALOG_V1_VERSION);
          expect(summarizePostingBalances(result.posting).every(balance => balance.balanced)).toBe(true);
        }
      } else counts[result.status] += 1;
    }
    expect(counts).toEqual({ matched: 2168, legacy_only: 1, unresolved: 0, invalid: 0, ambiguous: 0 });
    expect(JSON.stringify(entries)).toBe(original);
  });

  it('keeps production default legacy and exposes catalog version only for explicit preview', () => {
    const source = fixtures()[0];
    const legacy = buildAccountingEngineProjection([source], []);
    expect(legacy.mode).toBe('legacy');
    expect(legacy.canonicalCatalogVersion).toBeNull();
    const preview = buildAccountingEngineProjection([source], [], {
      mode: 'canonical_preview',
      canonicalResolver: canonicalResolverCatalogV1Resolver,
    });
    expect(preview.mode).toBe('canonical_preview');
    expect(preview.canonicalCatalogVersion).toBe(CANONICAL_RESOLVER_CATALOG_V1_VERSION);
  });

  it('contains no persistence, migration, fallback, suspense, or balancing-plug behavior', () => {
    const sources = [
      readFileSync(new URL('../canonicalResolverCatalog.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../canonicalResolverCatalogV1.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../accountingEngine.ts', import.meta.url), 'utf8'),
    ].join('\n');
    expect(sources).not.toMatch(/\b(addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(/);
    expect(sources).not.toMatch(/\b(runMigration|migrateEntries|firebase\s+deploy)\s*\(/);
    expect(sources).not.toMatch(/\b(balancingPlug|suspenseAccount|fallbackToLegacy)\b/);
  });
});
