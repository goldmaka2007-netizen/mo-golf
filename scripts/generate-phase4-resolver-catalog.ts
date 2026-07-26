import fs from 'node:fs';
import path from 'node:path';

type CsvRow = Record<string, string>;

const root = process.cwd();

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
    .filter(values => values.some(Boolean))
    .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
};

const matrixPath = path.join(root, 'canonical_operation_mapping_matrix.csv');
const outputPath = path.join(root, 'src', 'lib', 'canonicalResolverCatalogV1.generated.ts');
const rows = parseCsv(fs.readFileSync(matrixPath, 'utf8'));
const legacyTrace = parseCsv(fs.readFileSync(path.join(root, 'legacy_ledger_projection_trace.csv'), 'utf8'));
const legacyDimensionsBySource = new Map<string, Set<string>>();
for (const row of legacyTrace) {
  const dimensions = legacyDimensionsBySource.get(row.source_entry_id) ?? new Set<string>();
  dimensions.add(row.dimension);
  legacyDimensionsBySource.set(row.source_entry_id, dimensions);
}

if (rows.length !== 174) throw new Error(`Expected 174 Phase 2.1 variants, received ${rows.length}`);

const definitions = rows.map((row, index) => {
  const sourceIds = row.sourceOperationIds.split('|').filter(Boolean);
  const exactSourceMatch = row.operationType === 'opening_balance'
    || row.operationType === 'retained_gold_results_opening'
    || row.canonicalStatus === 'legacy_only';
  const runtimeAccount = (dimension: string, side: string) =>
    `runtime-required:${row.operationType}:${row.variant}:${dimension}:${side} | Approved runtime account resolution required`;
  const accountValue = (value: string, dimension: string, side: string, used: boolean) =>
    value || (used ? runtimeAccount(dimension, side) : '');
  const dimensionUsed = (dimension: string, posting: string) => {
    if (posting === 'none') return false;
    if (Number(row.documentCount) === 0) return true;
    return sourceIds.some(sourceId => legacyDimensionsBySource.get(sourceId)?.has(dimension));
  };
  const cashUsed = dimensionUsed('cash', row.cashPosting);
  const goldUsed = dimensionUsed('gold', row.goldPosting);
  const silverUsed = dimensionUsed('silver', row.silverPosting);
  return {
    resolverId: `phase21-v1-${String(index + 1).padStart(3, '0')}`,
    approvedVariantId: `${row.operationType}:${row.variant}`,
    sourceVariantId: row.variant,
    name: `${row.arabicLabel} — ${row.variant}`,
    operationType: row.operationType,
    sourceClassification: Number(row.documentCount) > 0 ? 'historical' : 'design_only',
    match: exactSourceMatch
      ? {
          kind: 'source_operation' as const,
          sourceOperationIds: sourceIds,
          legacyOperationNo: row.operationType.includes('opening')
            ? row.triggerConditions.match(/legacyOperationNo == "([^"]*)"/)?.[1]
            : undefined,
        }
      : Number(row.documentCount) > 0
        ? {
            kind: 'legacy_fields' as const,
            tx: row.arabicLabel,
            debit: row.triggerConditions.match(/debit == "([^"]*)"/)?.[1] ?? '',
            credit: row.triggerConditions.match(/credit == "([^"]*)"/)?.[1] ?? '',
          }
        : {
            kind: 'design_variant' as const,
            operationType: row.operationType,
            variant: row.variant,
          },
    historicalDocumentCount: Number(row.documentCount),
    status: row.canonicalStatus,
    dimensions: {
      cash: cashUsed,
      gold: goldUsed,
      silver: silverUsed,
    },
    accounts: {
      cashDebit: accountValue(row.cashDebitAccount, 'cash', 'debit', cashUsed),
      cashCredit: accountValue(row.cashCreditAccount, 'cash', 'credit', cashUsed),
      goldDebit: accountValue(row.goldDebitAccount, 'gold', 'debit', goldUsed),
      goldCredit: accountValue(row.goldCreditAccount, 'gold', 'credit', goldUsed),
      silverDebit: accountValue(row.silverDebitAccount, 'silver', 'debit', silverUsed),
      silverCredit: accountValue(row.silverCreditAccount, 'silver', 'credit', silverUsed),
    },
    amountSources: {
      cash: row.cashPosting === 'none' ? 'none' : 'cash',
      gold: row.goldPosting === 'none' ? 'none' : 'arabicWeight',
      silver: row.silverPosting === 'none' ? 'none' : 'weight',
    },
    approvedPostings: {
      cash: row.cashPosting,
      gold: row.goldPosting,
      silver: row.silverPosting,
    },
    approvedEffects: {
      inventory: row.inventoryEffect,
      merchantLiability: row.merchantLiabilityEffect,
      workmanship: row.workmanshipEffect,
      cost: row.costEffect,
      profit: row.profitEffect,
      revenue: row.revenueEffect,
      expense: row.expenseEffect,
      equity: row.equityEffect,
    },
    signHandling: 'absolute_source_amount',
    metalHandling: row.goldPosting !== 'none' ? 'gold_e21' : row.silverPosting !== 'none' ? 'silver_grams' : 'none',
    karatHandling: row.goldPosting !== 'none' ? 'approved_e21_snapshot' : 'not_applicable',
    requiredFields: row.requiredFields,
    triggerConditions: row.triggerConditions,
    fallbackPolicy: row.fallbackPolicy,
    costStatus: row.costStatus,
    decisionReference: row.decisionId,
    ruleSource: row.sourceRule,
    notes: row.notes,
  };
});

const contents = `/* This file is deterministic and generated from the approved Phase 2.1
 * canonical_operation_mapping_matrix.csv, with historical dimension applicability
 * checked against legacy_ledger_projection_trace.csv to prevent cross-metal duplication.
 * Regenerate with: npx tsx scripts/generate-phase4-resolver-catalog.ts
 */
import type { CanonicalResolverDefinition } from './canonicalResolverCatalog';

export const CANONICAL_RESOLVER_CATALOG_V1_DEFINITIONS = ${JSON.stringify(definitions, null, 2)} as const satisfies readonly CanonicalResolverDefinition[];
`;

fs.writeFileSync(outputPath, contents, 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outputPath), definitions: definitions.length }, null, 2));
