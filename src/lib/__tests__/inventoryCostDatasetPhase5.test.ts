import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
} from '../inventoryCostCatalog';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';
import {
  APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
  approvedHistoricalInventoryOverlaysForAccounts,
} from '../historicalInventoryOverlay';

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
  return records
    .filter(row => row.some(Boolean))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const fixtureRows = parseCsv(
  readFileSync(new URL('../../../approved_normalized_preview.csv', import.meta.url), 'utf8'),
);

const inventorySeedAccounts = SEED_ACCOUNTS.filter(account => account.is_inventory);
const inventoryIdByName = new Map(
  inventorySeedAccounts.map((account, index) => [
    account.name,
    CURRENT_DATASET_INVENTORY_BINDINGS[index].inventoryAccountId,
  ]),
);

const accounts: Account[] = SEED_ACCOUNTS.map((account, index) => ({
  ...account,
  id: inventoryIdByName.get(account.name) ?? `phase5-non-inventory-${index + 1}`,
  userId: 'phase5-read-only',
})) as Account[];

const accountIdByName = new Map(accounts.map(account => [account.name, account.id as string]));
const entries: Entry[] = fixtureRows.map(row => {
  const entry = JSON.parse(row.proposed_import_document) as Entry;
  return {
    ...entry,
    id: row.document_id,
    debitAccountId: accountIdByName.get(entry.debit),
    creditAccountId: accountIdByName.get(entry.credit),
  };
});

const accessoryOpeningCosts = Object.fromEntries(
  CURRENT_DATASET_INVENTORY_BINDINGS
    .filter(binding => binding.taxonomyKey.startsWith('accessory.'))
    .map(binding => [binding.inventoryAccountId, 10000]),
);

describe('Phase 5 approved dataset regression', () => {
  it('applies legacy same-day batches and resolves the first genuine deficit through its approved overlay', () => {
    const before = JSON.stringify(entries);
    const timeline = rebuildInventoryCostTimeline(entries, accounts, {
      gold21PriceByYearMinor: { '2026': 600000 },
      silverPriceByYearMinor: { '2026': 6000 },
      accessoryUnitCostByYearAndAccountMinor: { '2026': accessoryOpeningCosts },
    }, {
      historicalInventoryOverlayDirectives:
        approvedHistoricalInventoryOverlaysForAccounts(accounts),
    });

    expect(entries).toHaveLength(2169);
    expect(JSON.stringify(entries)).toBe(before);
    // Overlay linkage fix — deficit resolved by approved historical overlay hiro-20260304-scrap-arabic-e21-002
    expect(timeline.valid).toBe(true);
    expect(timeline.diagnostics).toEqual([]);
    expect(timeline.resultsByOperationId['csvref-entry-8bac4f51c5f366affbcb8884610f549e'])
      .toMatchObject({ outgoingStandardizedQuantityUnits: 661 });
    expect(timeline.historicalInventoryOverlays).toContainEqual(expect.objectContaining({
      overlayId: 'hiro-20260304-scrap-arabic-e21-002',
      originalOperationId: 'csvref-entry-8bac4f51c5f366affbcb8884610f549e',
      quantityUnits: 2,
    }));
    expect(timeline.orderingDiagnostics).toHaveLength(133);
    expect(timeline.orderingDiagnostics.filter(item => item.changed)).toHaveLength(95);

    const scrapArabicId = 'seed-account-d1216eb4076ccdf40e20';
    const january12 = timeline.orderingDiagnostics.find(item =>
      item.date === '2026-01-12' && item.inventoryAccountId === scrapArabicId);
    expect(january12).toBeDefined();
    expect(january12?.changed).toBe(true);

    const dayEntries = entries.filter(entry => entry.date === '2026-01-12'
      && (entry.debitAccountId === scrapArabicId || entry.creditAccountId === scrapArabicId));
    const priorEntries = entries.filter(entry => entry.date < '2026-01-12'
      && (entry.debitAccountId === scrapArabicId || entry.creditAccountId === scrapArabicId));
    const movement = (entry: Entry) => Number(entry.arabicWeight || entry.weight || 0);
    const signed = (entry: Entry) =>
      (entry.debitAccountId === scrapArabicId ? 1 : -1) * movement(entry);
    const start = priorEntries.reduce((sum, entry) => sum + signed(entry), 0);
    const incoming = dayEntries
      .filter(entry => entry.debitAccountId === scrapArabicId)
      .reduce((sum, entry) => sum + movement(entry), 0);
    const outgoing = dayEntries
      .filter(entry => entry.creditAccountId === scrapArabicId)
      .reduce((sum, entry) => sum + movement(entry), 0);
    expect(start).toBeCloseTo(6.51, 8);
    expect(incoming).toBeCloseTo(9.71, 8);
    expect(outgoing).toBeCloseTo(8.94, 8);
    expect(start + incoming - outgoing).toBeCloseTo(7.28, 8);

    let running = start;
    for (const operationId of january12?.operationIdsAfter ?? []) {
      const entry = entries.find(item => item.id === operationId)!;
      running += signed(entry);
      expect(running).toBeGreaterThanOrEqual(0);
    }
    expect(running).toBeCloseTo(7.28, 8);

    for (const diagnostic of timeline.orderingDiagnostics.filter(item => item.changed)) {
      expect([...diagnostic.operationIdsAfter].sort())
        .toEqual([...diagnostic.operationIdsBefore].sort());
      const signedMovement = (operationId: string) => {
        const entry = entries.find(item => item.id === operationId)!;
        const amount = Number(entry.arabicWeight || entry.weight || entry.count || 0);
        return entry.debitAccountId === diagnostic.inventoryAccountId ? amount : -amount;
      };
      const beforeNet = diagnostic.operationIdsBefore
        .reduce((sum, operationId) => sum + signedMovement(operationId), 0);
      const afterNet = diagnostic.operationIdsAfter
        .reduce((sum, operationId) => sum + signedMovement(operationId), 0);
      expect(afterNet).toBeCloseTo(beforeNet, 8);
    }
  });
  it('selects all four approved overlays through historical account keys', () => {
    const selected = approvedHistoricalInventoryOverlaysForAccounts([
      { id: 'O5YOL6B9WF91qcskgfbr' },
      { id: 'oQlWP1di0KCBunB7TnWb' },
    ]);

    expect(selected).toHaveLength(4);
    expect(selected.map(item => item.overlayId).sort()).toEqual(
      APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES.map(item => item.overlayId).sort(),
    );
    expect(selected.every(item => item.historicalAccountKey === item.stableInventoryAccountId))
      .toBe(true);
  });

  it('applies every approved overlay exactly once without duplicates', () => {
    const timeline = rebuildInventoryCostTimeline(entries, accounts, {
      gold21PriceByYearMinor: { '2026': 600000 },
      silverPriceByYearMinor: { '2026': 6000 },
      accessoryUnitCostByYearAndAccountMinor: { '2026': accessoryOpeningCosts },
    }, {
      historicalInventoryOverlayDirectives:
        approvedHistoricalInventoryOverlaysForAccounts(accounts),
    });
    const appliedIds = timeline.historicalInventoryOverlays.map(item => item.overlayId);

    expect(timeline.valid).toBe(true);
    expect(appliedIds).toHaveLength(4);
    expect(new Set(appliedIds).size).toBe(4);
    expect(appliedIds.sort()).toEqual(
      APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES.map(item => item.overlayId).sort(),
    );
  });

  it('keeps the approved overlay correction total at exactly 0.85g E21', () => {
    const totalQuantityUnits = APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES
      .reduce((sum, item) => sum + item.quantityUnits, 0);

    expect(APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES).toHaveLength(4);
    expect(totalQuantityUnits).toBe(85);
    expect(totalQuantityUnits / 100).toBe(0.85);
  });

  it('keeps overlay results unchanged when future runtime IDs change but historical keys stay fixed', () => {
    const replacements = new Map([
      ['seed-account-d1216eb4076ccdf40e20', 'future-runtime-scrap-arabic'],
      ['seed-account-391695330f1733e03bb0', 'future-runtime-gouache-arabic'],
    ]);
    const futureAccounts = accounts.map(account => {
      const historicalAccountKey = account.id ?? '';
      const runtimeId = replacements.get(historicalAccountKey);
      return runtimeId ? { ...account, id: runtimeId, historicalAccountKey } : account;
    });
    const futureEntries = entries.map(entry => ({
      ...entry,
      debitAccountId: replacements.get(entry.debitAccountId ?? '') ?? entry.debitAccountId,
      creditAccountId: replacements.get(entry.creditAccountId ?? '') ?? entry.creditAccountId,
    }));
    const openingConfig = {
      gold21PriceByYearMinor: { '2026': 600000 },
      silverPriceByYearMinor: { '2026': 6000 },
      accessoryUnitCostByYearAndAccountMinor: { '2026': accessoryOpeningCosts },
    };
    const stableTimeline = rebuildInventoryCostTimeline(entries, accounts, openingConfig, {
      historicalInventoryOverlayDirectives:
        approvedHistoricalInventoryOverlaysForAccounts(accounts),
    });
    const futureTimeline = rebuildInventoryCostTimeline(futureEntries, futureAccounts, openingConfig, {
      historicalInventoryOverlayDirectives:
        approvedHistoricalInventoryOverlaysForAccounts(futureAccounts),
    });
    const withoutRuntimeId = ({ runtimeInventoryAccountId: _runtimeId, ...overlay }:
      (typeof stableTimeline.historicalInventoryOverlays)[number]) => overlay;

    expect(futureTimeline.valid).toBe(true);
    expect(futureTimeline.historicalInventoryOverlays.map(withoutRuntimeId))
      .toEqual(stableTimeline.historicalInventoryOverlays.map(withoutRuntimeId));
  });
  it('reconciles the M1390 deficit without mutating the 2,169 source records', () => {
    const before = JSON.stringify(entries);
    const timeline = rebuildInventoryCostTimeline(entries, accounts, {
      gold21PriceByYearMinor: { '2026': 600000 },
      silverPriceByYearMinor: { '2026': 6000 },
      accessoryUnitCostByYearAndAccountMinor: { '2026': accessoryOpeningCosts },
    }, {
      historicalInventoryOverlayDirectives: APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES,
      calculationGenerationId: 1,
    });
    expect(entries).toHaveLength(2169);
    expect(JSON.stringify(entries)).toBe(before);
    expect(timeline.valid).toBe(true);
    expect(timeline.costDataComplete).toBe(false);
    expect(timeline.diagnostics).toEqual([]);
    expect(timeline.historicalInventoryOverlays).toContainEqual(expect.objectContaining({
      overlayId: 'hiro-20260410-scrap-arabic-e21-005',
      sourceDeficitOperationId: 'csvref-entry-7decedc1a2d80d7620897618e62f5e96',
      quantityUnits: 5,
      totalCostMinor: 35_093,
    }));
  });
});
