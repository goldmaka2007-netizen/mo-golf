import { describe, expect, it } from 'vitest';
import { Account, Entry } from '../../types';
import { buildInventoryCycleReport, getDefaultInventoryCycleFilters } from '../inventoryCycleReport';
import { createDefaultWarningState, markWarningReviewed, updateWarningTypeConfig } from '../inventoryCycleWarnings';
import { createInventoryCycleFingerprint, findEarliestAffectedOperationId, makeCurrentCacheRecord, makeFailedCacheRecord, resolveCacheStatus } from '../inventoryCycleCache';
import { buildOpeningCostConfig } from '../openingCostConfig';
import { buildInventoryCycleExcelSheets, canExportInventoryCycleReport } from '../inventoryCycleExcel';
import { isQuantityAlignedToStep, parseAccessoryQuantityUnits, rebuildCostTimeline } from '../weightedAverageCost';

const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', is_inventory: false, userId: 'u1' },
  { id: 'gold', name: 'gold', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', is_inventory: true, karat: '21', metal: 'gold', userId: 'u1' },
  { id: 'silver', name: 'silver', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', is_inventory: true, metal: 'silver', userId: 'u1' },
  { id: 'acc', name: 'acc', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, quantityStep: 0.2, userId: 'u1' },
  { id: 'equity', name: 'equity', mainType: 'equity', subType: 'capital', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u1' },
  { id: 'adjustment', name: 'adjustment', mainType: 'expense', subType: 'adjustment', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u1' },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: overrides.id ?? String(overrides.seq ?? 1),
  seq: 1,
  tx: 'test',
  date: '2026-01-01',
  debit: '',
  credit: '',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u1',
  ...overrides,
});

describe('inventory cycle report selector', () => {
  it('calculates gold opening, period sale COGS, and market revaluation separately', () => {
    const entries = [
      entry({ id: 'o1', operationKind: 'opening', debit: 'gold', debitAccountId: 'gold', credit: 'equity', creditAccountId: 'equity', weight: '10.00', date: '2026-01-01', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', weight: '2.00', cash: '15000', date: '2026-07-10', seq: 2 }),
    ];
    const report = buildInventoryCycleReport({
      entries,
      accountsDb: accounts,
      tab: 'gold',
      filters: { ...getDefaultInventoryCycleFilters('gold'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' },
      goldPrice: 8000,
      silverPrice: 60,
      openingConfig: buildOpeningCostConfig([{ year: 2026, gold21PriceMinorPerGram: 600000 }]),
    });

    expect(report.summary.opening).toBe(10);
    expect(report.summary.closing).toBe(8);
    expect(report.summary.cogs).toBe(12000);
    expect(report.summary.grossProfit).toBe(3000);
    expect(report.summary.marketValue).toBe(64000);
    expect(report.summary.revaluation).toBe(16000);
  });

  it('movement filter does not change true opening and closing balances', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '10.00', cash: '500', date: '2026-07-01', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'silver', creditAccountId: 'silver', weight: '2.00', cash: '200', date: '2026-07-02', seq: 2 }),
    ];
    const baseFilters = { ...getDefaultInventoryCycleFilters('silver'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all' };
    const all = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'silver', filters: { ...baseFilters, movementKind: 'all' }, goldPrice: 1, silverPrice: 60 });
    const salesOnly = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'silver', filters: { ...baseFilters, movementKind: 'sale' }, goldPrice: 1, silverPrice: 60 });

    expect(all.summary.closing).toBe(8);
    expect(salesOnly.summary.closing).toBe(8);
    expect(salesOnly.summary.operationsCount).toBe(1);
  });

  it('supports decimal accessory quantities and quantityStep warnings', () => {
    expect(parseAccessoryQuantityUnits('0.20')).toBe(200);
    expect(isQuantityAlignedToStep('0.40', 0.2)).toBe(true);
    expect(isQuantityAlignedToStep('0.10', 0.2)).toBe(false);

    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'acc', debitAccountId: 'acc', credit: 'cash', creditAccountId: 'cash', count: '1.00', cash: '100', date: '2026-07-01', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'acc', creditAccountId: 'acc', count: '0.40', cash: '60', date: '2026-07-02', seq: 2 }),
      entry({ id: 'legacy', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'acc', creditAccountId: 'acc', count: '0.10', cash: '20', date: '2026-07-03', seq: 3 }),
    ];
    const timeline = rebuildCostTimeline(entries.slice(0, 2), accounts);
    expect(timeline.resultsByOperationId.s1.cogsMinor).toBe(4000);

    const report = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'accessory', filters: { ...getDefaultInventoryCycleFilters('accessory'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' }, goldPrice: 1, silverPrice: 1 });
    expect(report.summary.activeItemCount).toBe(1);
    expect(report.warnings.some(w => w.type.includes('quantityStep'))).toBe(true);
  });

  it('keeps missing cost basis unavailable instead of zero profit', () => {
    const entries = [entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', weight: '1.00', cash: '7000', date: '2026-07-01' })];
    const report = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters: { ...getDefaultInventoryCycleFilters('gold'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' }, goldPrice: 8000, silverPrice: 1 });

    expect(report.summary.cogs).toBeNull();
    expect(report.summary.grossProfit).toBeNull();
    expect(report.warnings.some(w => w.typeCode === 'missing_cost_basis')).toBe(true);
  });
  it('applies persistent warning review state and keeps reviewed severity historical', () => {
    const entries = [entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', weight: '1.00', cash: '7000', date: '2026-07-01' })];
    const baseReport = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters: { ...getDefaultInventoryCycleFilters('gold'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' }, goldPrice: 8000, silverPrice: 1 });
    const warning = baseReport.warnings[0];
    const reviewed = markWarningReviewed(createDefaultWarningState(), warning, '2026-07-20T10:00:00.000Z');
    const changed = updateWarningTypeConfig(reviewed, warning.typeCode, { severity: 'critical' });
    const report = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters: { ...getDefaultInventoryCycleFilters('gold'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' }, goldPrice: 8000, silverPrice: 1, warningState: changed });

    expect(report.warnings.some(w => w.id === warning.id)).toBe(false);
    expect(report.reviewedWarnings[0]).toMatchObject({ warningId: warning.id, status: 'reviewed', acceptedAsIs: true, severityAtReview: warning.severity });
  });

  it('warning type settings immediately change active severity and enabled state', () => {
    const entries = [entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', weight: '1.00', cash: '7000', date: '2026-07-01' })];
    const filters = { ...getDefaultInventoryCycleFilters('gold'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' as const };
    const changed = updateWarningTypeConfig(createDefaultWarningState(), 'missing_cost_basis', { severity: 'critical' });
    const critical = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters, goldPrice: 8000, silverPrice: 1, warningState: changed });
    expect(critical.warnings[0].severity).toBe('critical');

    const disabled = updateWarningTypeConfig(changed, 'missing_cost_basis', { enabled: false });
    const hidden = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters, goldPrice: 8000, silverPrice: 1, warningState: disabled });
    expect(hidden.warnings.some(w => w.typeCode === 'missing_cost_basis')).toBe(false);
  });

  it('cache helpers distinguish current, stale, rebuilding, failed, and retry success', () => {
    const entries = [entry({ id: 'p1', operationKind: 'purchase', debit: 'silver', debitAccountId: 'silver', credit: 'cash', creditAccountId: 'cash', weight: '1.00', cash: '50' })];
    const filters = { ...getDefaultInventoryCycleFilters('silver'), startDate: '2026-01-01', endDate: '2026-12-31', accountId: 'all', movementKind: 'all' as const };
    const openingConfig = buildOpeningCostConfig([]);
    const report = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'silver', filters, goldPrice: 1, silverPrice: 60 });
    const fp = createInventoryCycleFingerprint({ entries, accountsDb: accounts, filters, tab: 'silver', goldPrice: 1, silverPrice: 60, openingConfig, warningState: createDefaultWarningState() });
    const current = makeCurrentCacheRecord(report, fp, entries);

    expect(resolveCacheStatus(null, fp)).toBe('stale');
    expect(resolveCacheStatus(current, fp)).toBe('current');
    expect(resolveCacheStatus({ ...current, meta: { ...current.meta, status: 'rebuilding' } }, fp)).toBe('rebuilding');
    const failed = makeFailedCacheRecord(current, new Error('boom'));
    expect(resolveCacheStatus(failed, fp)).toBe('failed');
    const retry = makeCurrentCacheRecord(report, fp, entries);
    expect(resolveCacheStatus(retry, fp)).toBe('current');
  });

  it('detects earliest affected operation for old edit and delete', () => {
    const base = [entry({ id: 'p1', seq: 1, cash: '50' }), entry({ id: 'p2', seq: 2, cash: '100' })];
    expect(findEarliestAffectedOperationId(base, [{ ...base[0], cash: '60' }, base[1]])).toBe('p1');
    expect(findEarliestAffectedOperationId(base, [base[0]])).toBe('p2');
  });

  it('builds accessory chart series with book value, sales, COGS, and gross profit grouping', () => {
    const entries = [
      entry({ id: 'p1', operationKind: 'purchase', debit: 'acc', debitAccountId: 'acc', credit: 'cash', creditAccountId: 'cash', count: '1.00', cash: '100', date: '2026-07-01', seq: 1 }),
      entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'acc', creditAccountId: 'acc', count: '0.20', cash: '40', date: '2026-07-02', seq: 2 }),
    ];
    const report = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'accessory', filters: { ...getDefaultInventoryCycleFilters('accessory'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all', chartGrouping: 'monthly' }, goldPrice: 1, silverPrice: 1 });
    const july = report.chart.find(point => point.date === '2026-07');
    expect(july?.bookValue).toBe(80);
    expect(july?.sales).toBe(40);
    expect(july?.cogs).toBe(20);
    expect(july?.grossProfit).toBe(20);
  });
  it('builds Excel sheets for each tab with Arabic names and current-tab scope', () => {
    const filters = { ...getDefaultInventoryCycleFilters('gold'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' as const };
    const report = buildInventoryCycleReport({ entries: [], accountsDb: accounts, tab: 'gold', filters, goldPrice: 8000, silverPrice: 60 });
    expect(buildInventoryCycleExcelSheets(report, 'gold').map(sheet => sheet.name)).toEqual([
      'الملخص العام',
      'الأصناف',
      'الحركات',
      'الربحية',
      'التقييم السوقي',
      'التحذيرات النشطة',
      'سجل المراجعة',
      'المراجعة والمعادلات',
    ]);

    const silverReport = buildInventoryCycleReport({ entries: [], accountsDb: accounts, tab: 'silver', filters: { ...filters, periodPreset: 'custom' }, goldPrice: 8000, silverPrice: 60 });
    expect(buildInventoryCycleExcelSheets(silverReport, 'silver').map(sheet => sheet.name)).toContain('التقييم السوقي');

    const accessoryReport = buildInventoryCycleReport({ entries: [], accountsDb: accounts, tab: 'accessory', filters: { ...getDefaultInventoryCycleFilters('accessory'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' }, goldPrice: 1, silverPrice: 1 });
    expect(buildInventoryCycleExcelSheets(accessoryReport, 'accessory').map(sheet => sheet.name)).toEqual(['الملخص', 'الأصناف', 'الحركات', 'الربحية', 'التحذيرات']);
  });

  it('exports missing cost as unavailable and includes real review log rows', () => {
    const entries = [entry({ id: 's1', operationKind: 'sale', debit: 'cash', debitAccountId: 'cash', credit: 'gold', creditAccountId: 'gold', weight: '1.00', cash: '7000', date: '2026-07-01' })];
    const filters = { ...getDefaultInventoryCycleFilters('gold'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' as const };
    const baseReport = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters, goldPrice: 8000, silverPrice: 1 });
    const warningState = markWarningReviewed(createDefaultWarningState(), baseReport.warnings[0], '2026-07-20T10:00:00.000Z');
    const reviewedReport = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'gold', filters, goldPrice: 8000, silverPrice: 1, warningState });
    const sheets = buildInventoryCycleExcelSheets(reviewedReport, 'gold');
    const summary = sheets.find(sheet => sheet.name === 'الملخص العام')?.data[0];
    const review = sheets.find(sheet => sheet.name === 'سجل المراجعة')?.data[0];

    expect(summary.cogs).toBe('غير متاح');
    expect(summary.grossProfit).toBe('غير متاح');
    expect(review['التحذير']).toBe(baseReport.warnings[0].type);
    expect(review['المستوى وقت المراجعة']).toBe(baseReport.warnings[0].severity);
  });

  it('allows Excel export only for current report cache', () => {
    const report = buildInventoryCycleReport({ entries: [], accountsDb: accounts, tab: 'silver', filters: { ...getDefaultInventoryCycleFilters('silver'), startDate: '2026-07-01', endDate: '2026-07-31', accountId: 'all', movementKind: 'all' }, goldPrice: 1, silverPrice: 60, cacheMeta: { status: 'current' } });
    expect(canExportInventoryCycleReport(report)).toBe(true);
    expect(canExportInventoryCycleReport({ ...report, cache: { ...report.cache, status: 'stale' } })).toBe(false);
    expect(canExportInventoryCycleReport({ ...report, cache: { ...report.cache, status: 'rebuilding' } })).toBe(false);
  });
  it('uses local month boundaries for default filters and reset', () => {
    const filters = getDefaultInventoryCycleFilters('gold', new Date(2026, 6, 20));
    expect(filters.startDate).toBe('2026-07-01');
    expect(filters.endDate).toBe('2026-07-31');
  });
});

