import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { CATS, OPERATION_RULES } from '../../constants';
import {
  CANONICAL_OPERATION_CATALOG,
  resolveCanonicalOperationLabel,
  validateCanonicalOperationCatalog,
} from '../canonicalOperationCatalog';
import { buildCentralAccountingRegistry } from '../centralAccountingRegistry';

const account = (patch: Partial<Account>): Account => ({
  id: 'account', name: 'حساب', mainType: 'اصول', subType: '', balanceNature: 'جنية مصري', type: 'other', userId: 'test', ...patch,
});
const entry = (patch: Partial<Entry>): Entry => ({
  id: 'entry', seq: 1, tx: 'بيع ذهب', operationKind: 'sale', debit: 'الخزنة', debitAccountId: 'cash', credit: 'خاتم', creditAccountId: 'gold',
  date: '2026-08-31', cash: '1000', weight: '1', count: '1', arabicWeight: '1', notes: '', userId: 'test', ...patch,
});

describe('canonical operation catalog', () => {
  it('is internally valid and versioned', () => {
    expect(validateCanonicalOperationCatalog()).toEqual([]);
    expect(CANONICAL_OPERATION_CATALOG.every(operation => operation.version >= 1)).toBe(true);
  });

  it('covers every current legacy operation label without making legacy constants a runtime dependency', () => {
    const labels = new Set<string>([
      ...CATS.flatMap(category => category.items),
      ...Object.keys(OPERATION_RULES),
    ]);
    labels.forEach(label => {
      expect(resolveCanonicalOperationLabel(label), `missing canonical operation mapping for ${label}`).toMatchObject({ status: 'resolved' });
    });
  });

  it('keeps returns historical-only after the owner removed them from the new operation model', () => {
    expect(resolveCanonicalOperationLabel('مرتجع ذهب')).toMatchObject({ status: 'resolved', operation: { availability: 'historical_only', userSelectable: false } });
    expect(resolveCanonicalOperationLabel('مرتجع فضة')).toMatchObject({ status: 'resolved', operation: { availability: 'historical_only', userSelectable: false } });
  });

  it('keeps sale contracts on WAC/COGS and fixed treasury without changing the posting engine', () => {
    expect(resolveCanonicalOperationLabel('بيع ذهب')).toMatchObject({
      status: 'resolved',
      operation: {
        operationKind: 'sale',
        contract: {
          requiresInventoryCostTimeline: true,
          treasuryPolicy: 'fixed_treasury',
          inventoryEffect: 'decrease',
          revenue: 'required',
          cogs: 'required',
          forbidsMarketPriceAsInventoryCost: true,
        },
      },
    });
  });
});

describe('Central Accounting Registry Phase 1', () => {
  const accounts: Account[] = [
    account({ id: 'cash', name: 'الخزنة', type: 'cash' }),
    account({ id: 'gold', name: 'خاتم', type: 'gold_product', metal: 'gold', karat: '21', is_inventory: true, balanceNature: 'جرام ذهب' }),
  ];

  it('builds a read-only registry and reports complete operation coverage for known rows', () => {
    const rows = [entry({})];
    const registry = buildCentralAccountingRegistry({ accounts, entries: rows });
    expect(registry.mode).toBe('read_only');
    expect(registry.resolveOperation('بيع ذهب')).toMatchObject({ status: 'resolved', operation: { id: 'sale.gold' } });
    expect(registry.coverage.unmappedOperations).toEqual([]);
    expect(registry.coverage.shadowReady).toBe(true);
    expect(rows[0]).toEqual(entry({}));
  });

  it('blocks shadow readiness for an unknown operation instead of falling back to legacy rules', () => {
    const registry = buildCentralAccountingRegistry({ accounts, entries: [entry({ tx: 'عملية غير معروفة', operationKind: 'other' })] });
    expect(registry.coverage.shadowReady).toBe(false);
    expect(registry.coverage.unmappedOperations).toEqual([{ label: 'عملية غير معروفة', count: 1 }]);
  });

  it('allows shadow analysis but blocks cutover while an unmatched historical account still needs mapping', () => {
    const rows = [entry({ credit: 'حساب تاريخي فقط', creditAccountId: undefined })];
    const registry = buildCentralAccountingRegistry({ accounts, entries: rows });
    expect(registry.coverage.shadowReady).toBe(true);
    expect(registry.coverage.cutoverReady).toBe(false);
    expect(registry.coverage.historicalAccountsNeedingMapping.map(item => item.accountName)).toContain('حساب تاريخي فقط');
  });

  it('has no Firebase/React/legacy constants dependency in the new runtime registry boundary', () => {
    const sources = ['../canonicalOperationCatalog.ts', '../centralAccountingRegistry.ts']
      .map(relative => readFileSync(new URL(relative, import.meta.url), 'utf8'))
      .join('\n');
    expect(sources).not.toMatch(/from ['"][^'"]*constants['"]|RAW_DATA|OPERATION_RULES|CATS/);
    expect(sources).not.toMatch(/from ['"]firebase|setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(|from ['"]react|from ['"]\.\.\/store/);
  });
});
