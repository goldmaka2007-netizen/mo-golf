import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { SEED_ACCOUNTS } from '../../migrationData';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
} from '../inventoryCostCatalog';
import { rebuildInventoryCostTimeline } from '../inventoryCostEngine';

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
  it('keeps all 2,169 records immutable and fails closed on the first historical inventory deficit', () => {
    const before = JSON.stringify(entries);
    const timeline = rebuildInventoryCostTimeline(entries, accounts, {
      gold21PriceByYearMinor: { '2026': 600000 },
      silverPriceByYearMinor: { '2026': 6000 },
      accessoryUnitCostByYearAndAccountMinor: { '2026': accessoryOpeningCosts },
    });

    expect(entries).toHaveLength(2169);
    expect(JSON.stringify(entries)).toBe(before);
    expect(timeline.valid).toBe(false);
    expect(timeline.results).toEqual([]);
    expect(timeline.finalStates).toEqual({});
    expect(timeline.diagnostics).toEqual([{
      code: 'insufficient_inventory',
      message: 'Metal movement exceeds costed inventory',
      operationId: 'csvref-entry-89c515f70df8e79793ebc8d1482440f9',
      inventoryAccountId: 'seed-account-d1216eb4076ccdf40e20',
    }]);
  });
});
