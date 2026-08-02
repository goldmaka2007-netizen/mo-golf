import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import { buildLegacyJournalProjection, buildLegacyLedgerLegs } from '../legacyLedger';
import { buildOperationalProjection, buildCanonicalRuleStatusReport, getPhysicalSilverInventory, isTx42 } from '../operationalProjection';
import { buildTrialBalanceReport } from '../trialBalanceReport';

type CsvRow = Record<string, string>;

const parseCsv = (text: string): CsvRow[] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field.length || record.length) records.push([...record, field]);
  const headers = records.shift() ?? [];
  return records.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const rows = parseCsv(readFileSync(new URL('../../../approved_normalized_preview.csv', import.meta.url), 'utf8'));
const entries = rows.map(row => ({ ...(JSON.parse(row.proposed_import_document) as Entry), id: row.document_id }));
const accounts: Account[] = SEED_ACCOUNTS.map((account, index) => ({ ...account, id: `phase1-account-${index + 1}`, userId: 'phase1-read-only', isActive: true } as Account));
const projection = buildLegacyJournalProjection(entries, accounts);
const operational = buildOperationalProjection(entries, accounts);
const reports = (['cash', 'gold', 'silver'] as const).map(dimension => buildTrialBalanceReport(entries, accounts, dimension, '0000-01-01', '9999-12-31'));

describe('Accounting Engine Repair — Phase 1', () => {
  it('keeps all 2,169 imported documents read-only and creates balanced raw legs', () => {
    expect(entries).toHaveLength(2169);
    expect(rows).toHaveLength(2169);
    expect(projection.source).toBe('legacy_raw_fields');
    expect(projection.trialBalanceTotals.cash).toMatchObject({ debit: 29292790, credit: 29292790, difference: 0 });
    expect(projection.trialBalanceTotals.gold.debit).toBeCloseTo(7479.90, 8);
    expect(projection.trialBalanceTotals.gold.credit).toBeCloseTo(7479.90, 8);
    expect(projection.trialBalanceTotals.silver.debit).toBeCloseTo(8509.39, 8);
    expect(projection.trialBalanceTotals.silver.credit).toBeCloseTo(8509.39, 8);
  });

  it('routes all historical Trial Balances through the central balance engine', () => {
    reports.forEach(report => {
      expect(report.source).toBe('balance_engine');
      expect(report.balanced).toBe(true);
      expect(report.difference).toBe(0);
    });
    expect(reports[0].openingDebit).toBe(1831490);
    expect(reports[0].openingCredit).toBe(1831490);
    expect(reports[0].periodDebit).toBe(27461300);
    expect(reports[0].periodCredit).toBe(27461300);
    expect(reports[1].openingDebit).toBeCloseTo(2260.11, 8);
    expect(reports[1].openingCredit).toBeCloseTo(2260.11, 8);
    expect(reports[1].periodDebit).toBeCloseTo(5219.79, 8);
    expect(reports[1].periodCredit).toBeCloseTo(5219.79, 8);
    expect(reports[2].openingDebit).toBeCloseTo(4837.60, 8);
    expect(reports[2].openingCredit).toBeCloseTo(4837.60, 8);
    expect(reports[2].periodDebit).toBeCloseTo(3671.79, 8);
    expect(reports[2].periodCredit).toBeCloseTo(3671.79, 8);
  });

  it('keeps operational movements out of Trial Balance by type and source', () => {
    expect(operational.source).toBe('canonical_operational_projection');
    expect('legs' in operational).toBe(false);
    expect(reports.every(report => report.source !== operational.source as string)).toBe(true);
  });

  it('uses one physical-silver selector for Home and inventory and separates merchant liability', () => {
    expect(getPhysicalSilverInventory(entries, accounts)).toBeCloseTo(5415.36, 8);
    expect(operational.physicalSilverInventoryMovement).toBeCloseTo(5415.36, 8);
    expect(operational.merchantWeightLiabilityMovement).toHaveProperty('silver');
    expect(operational).not.toHaveProperty('silverInventoryIncludingMerchant');
  });

  it('does not invert the seven merchant-silver inventory rows twice', () => {
    const seven = entries.filter(entry => entry.tx === 'حساب تاجر فضة' && entry.debit === 'سمير ناشد' && entry.credit === 'كسر فضة');
    expect(seven).toHaveLength(7);
    expect(seven.reduce((total, entry) => total + Number(entry.weight), 0)).toBeCloseTo(127.72, 8);
    const physicalContributions = seven.map(entry => {
      const single = buildOperationalProjection([entry], accounts);
      return single.physicalSilverInventoryMovement;
    });
    expect(physicalContributions.every(value => value < 0)).toBe(true);
    expect(physicalContributions.reduce((total, value) => total + value, 0)).toBeCloseTo(-127.72, 8);
  });

  it('keeps TX42 balanced in Legacy but unresolved in canonical operations', () => {
    const tx42 = entries.find(isTx42);
    expect(tx42).toBeDefined();
    expect(Number(tx42?.arabicWeight)).toBeCloseTo(16.20, 8);
    const legs = buildLegacyLedgerLegs([tx42!], accounts).filter(leg => leg.dimension === 'gold');
    expect(legs).toHaveLength(2);
    expect(legs.find(leg => leg.side === 'debit')?.amount).toBeCloseTo(16.20, 8);
    expect(legs.find(leg => leg.side === 'credit')?.amount).toBeCloseTo(16.20, 8);
    expect(operational.unresolvedCanonicalPostings).toHaveLength(1);
    expect(operational.unresolvedCanonicalPostings[0]).toMatchObject({ legacyOperationNo: 'TX42', storedGoldEquivalent21: 16.2 });
  });

  it('reports every operation type without inventing balanced sale or purchase mappings', () => {
    const statuses = buildCanonicalRuleStatusReport(entries);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.filter(row => row.operationKind === 'sale' || row.operationKind === 'purchase').every(row => row.status === 'operational_only')).toBe(true);
    expect(statuses.some(row => row.status === 'unresolved')).toBe(true);
    expect(statuses.every(row => row.status !== 'canonical_balanced')).toBe(true);
  });
});
