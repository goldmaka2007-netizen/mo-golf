import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../../types';
import {
  TX42_CANONICAL_METADATA,
  createCustomerPurchaseDesignFixture,
  createCustomerSaleDesignFixture,
  createMerchantTransferDesignFixture,
  createTx42CanonicalPosting,
  summarizePostingBalances,
  validateCanonicalPostingSet,
} from '../canonicalMappingDesign';

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
  return records.filter(row => row.some(Boolean)).map(row =>
    Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ''), row[index] ?? ''])),
  );
};

const sourceText = readFileSync(new URL('../../../approved_normalized_preview.csv', import.meta.url), 'utf8');
const sourceRows = parseCsv(sourceText);
const entries = sourceRows.map(row => JSON.parse(row.proposed_import_document) as Entry);

describe('Accounting Engine Repair — Phase 2 canonical mapping design', () => {
  it('keeps the read-only legacy fixture at exactly 2,169 documents', () => {
    expect(entries).toHaveLength(2169);
  });

  it('resolves TX42 with the actual historical account IDs and preserves its stored names', () => {
    const source = entries.find(entry => entry.legacyOperationNo === 'TX42');
    const posting = createTx42CanonicalPosting();
    const gold = summarizePostingBalances(posting).find(item => item.dimension === 'gold');
    expect(source).toMatchObject({
      debit: TX42_CANONICAL_METADATA.capitalGoldHistoricalName,
      credit: TX42_CANONICAL_METADATA.retainedGoldHistoricalName,
      arabicWeight: '16.2',
    });
    expect(posting.goldLedgerLegs[0].accountId).toBe(TX42_CANONICAL_METADATA.capitalGoldAccountId);
    expect(posting.goldLedgerLegs[1].accountId).toBe(TX42_CANONICAL_METADATA.retainedGoldAccountId);
    expect(gold).toMatchObject({ debit: 16.2, credit: 16.2, difference: 0, balanced: true });
    expect(posting.postingStatus).toBe('canonical_balanced');
    expect(TX42_CANONICAL_METADATA.semanticSourceYear).toBe(2025);
    expect(posting.goldLedgerLegs[1].historicalName).toBe('الارباح و الخساير 2024');
    expect(posting.goldLedgerLegs[1].semanticLabel).toContain('2025');
    expect(validateCanonicalPostingSet(posting)).toEqual([]);
  });

  it('does not double-count customer-sale inventory and keeps count outside metal ledgers', () => {
    const sale = createCustomerSaleDesignFixture('gold');
    expect(sale.physicalInventoryMovements).toHaveLength(1);
    expect(sale.quantityMovements).toHaveLength(1);
    expect(sale.goldLedgerLegs).toHaveLength(2);
    expect(sale.goldLedgerLegs[0].accountId).toBe('canonical:metal-flow:gold:sold');
    expect(sale.quantityMovements[0].unit).toBe('quantity');
    expect(sale.postingStatus).toBe('canonical_balanced');
    expect(validateCanonicalPostingSet(sale)).toEqual([]);
  });

  it('does not create fake revenue for a customer purchase', () => {
    const purchase = createCustomerPurchaseDesignFixture('silver');
    expect(purchase.revenueEffects).toEqual([]);
    expect(purchase.physicalInventoryMovements[0]).toMatchObject({ direction: 'increase', unit: 'g_silver' });
  });

  it('keeps accessories out of gold and silver ledgers', () => {
    const sale = createCustomerSaleDesignFixture('accessory');
    const purchase = createCustomerPurchaseDesignFixture('accessory');
    expect([...sale.goldLedgerLegs, ...sale.silverLedgerLegs, ...purchase.goldLedgerLegs, ...purchase.silverLedgerLegs]).toEqual([]);
    expect(sale.quantityMovements[0].unit).toBe('quantity');
  });

  it('moves merchant liability without physical inventory or automatic cost', () => {
    const transfer = createMerchantTransferDesignFixture('silver');
    expect(transfer.physicalInventoryMovements).toEqual([]);
    expect(transfer.costMovements).toEqual([]);
    expect(transfer.merchantMetalLiabilityMovements).toHaveLength(2);
    expect(validateCanonicalPostingSet(transfer)).toEqual([]);
  });

  it('proves Phase 2.1 coverage, statuses, openings, controls and safety', () => {
    const simulation = JSON.parse(readFileSync(new URL('../../../canonical_mapping_simulation.json', import.meta.url), 'utf8'));
    const matrix = parseCsv(readFileSync(new URL('../../../canonical_operation_mapping_matrix.csv', import.meta.url), 'utf8'));
    const openings = parseCsv(readFileSync(new URL('../../../opening_balance_mapping_variants.csv', import.meta.url), 'utf8'));
    expect(simulation).toMatchObject({ legacyDocumentCount: 2169, historicalOperationTypeCount: 22, documentCountsByMappingStatus: { canonical_balanced: 2168, legacy_only: 1, unresolved: 0, invalid: 0 }, coverage: { coveredDocuments: 2169, uncoveredDocuments: 0, overlappingDocuments: 0 }, merchantSilverSign: { deliveredDocuments: 7, netPhysicalMovementOnceGrams: -127.72, passes: true }, safety: { firestoreWrites: 0, firestoreDeletes: 0, migrationRuns: 0, hostingDeploys: 0, productionEngineChanges: 0 } });
    expect(openings).toHaveLength(41);
    expect(new Set(openings.map(row => row.sourceOperationIds)).size).toBe(41);
    expect(matrix.filter(row => Number(row.documentCount) > 0).reduce((sum, row) => sum + Number(row.documentCount), 0)).toBe(2169);
    expect(simulation.legacyControlTotals.cash.debit).toBe(simulation.legacyControlTotals.cash.credit);
    expect(simulation.legacyControlTotals.gold.debit).toBeCloseTo(simulation.legacyControlTotals.gold.credit, 8);
    expect(simulation.legacyControlTotals.silver.debit).toBeCloseTo(simulation.legacyControlTotals.silver.credit, 8);
    const required = ['operationType','variant','triggerConditions','requiredFields','cashPosting','goldPosting','silverPosting','inventoryEffect','costEffect','profitEffect','fallbackPolicy','canonicalStatus','decisionId'];
    matrix.forEach(row => required.forEach(field => expect(row[field]).not.toBe('')));
    expect(new Set(matrix.map(row => row.triggerConditions)).size).toBe(matrix.length);
    const returns = matrix.filter(row => row.operationType === 'sale_return' || row.operationType === 'purchase_return');
    expect(returns).toHaveLength(4);
    expect(returns.every(row => row.requiredFields.includes('originalOperationId'))).toBe(true);
  });
  it('contains no Firestore write/delete or migration execution in the Phase 2 design module', () => {
    const designSource = readFileSync(new URL('../canonicalMappingDesign.ts', import.meta.url), 'utf8');
    expect(designSource).not.toMatch(/\b(addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\s*\(/);
    expect(designSource).not.toMatch(/\b(runMigration|migrateEntries|firebase\s+deploy)\s*\(/);
  });
});
