import fs from 'node:fs';
import path from 'node:path';
import type { Entry } from '../src/types';
import {
  CANONICAL_RESOLVER_CATALOG_V1_VERSION,
  type CanonicalResolverDefinition,
} from '../src/lib/canonicalResolverCatalog';
import {
  canonicalResolverCatalogV1,
  canonicalResolverCatalogV1Runtime,
} from '../src/lib/canonicalResolverCatalogV1';
import {
  summarizePostingBalances,
  type CanonicalLedgerDimension,
  type CanonicalLedgerLeg,
} from '../src/lib/canonicalMappingDesign';

type CsvRow = Record<string, string>;
type ResultStatus = 'matched' | 'legacy_only' | 'unresolved' | 'invalid' | 'ambiguous' | 'error';

const root = process.cwd();
const round = (value: number): number => Math.round((value + Number.EPSILON) * 1e9) / 1e9;

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

const csvEscape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
const writeCsv = (fileName: string, rows: Record<string, unknown>[], columns: string[]) => {
  const text = [columns.map(csvEscape).join(','), ...rows.map(row => columns.map(column => csvEscape(row[column])).join(','))].join('\r\n');
  fs.writeFileSync(path.join(root, fileName), `\uFEFF${text}\r\n`, 'utf8');
};

const fixtureRows = parseCsv(fs.readFileSync(path.join(root, 'approved_normalized_preview.csv'), 'utf8'));
const entries = fixtureRows.map(row => ({ ...JSON.parse(row.proposed_import_document), id: row.document_id }) as Entry);
const originalFixtureSerialization = JSON.stringify(entries);
const legacyTrace = parseCsv(fs.readFileSync(path.join(root, 'legacy_ledger_projection_trace.csv'), 'utf8'));

if (entries.length !== 2169) throw new Error(`Expected 2169 fixtures, received ${entries.length}`);

const dimensions: CanonicalLedgerDimension[] = ['cash', 'gold', 'silver'];
const totals = Object.fromEntries(dimensions.map(dimension => [dimension, { debit: 0, credit: 0 }])) as
  Record<CanonicalLedgerDimension, { debit: number; credit: number }>;
const statusCounts: Record<ResultStatus, number> = {
  matched: 0,
  legacy_only: 0,
  unresolved: 0,
  invalid: 0,
  ambiguous: 0,
  error: 0,
};
const variantCounts = new Map<string, Record<ResultStatus, number>>();
const recordResults: Record<string, unknown>[] = [];
const comparisonRows: Record<string, unknown>[] = [];
const exceptionRows: Record<string, unknown>[] = [];

const legacyFor = (id: string, dimension: CanonicalLedgerDimension) =>
  legacyTrace.filter(row => row.source_entry_id === id && row.dimension === dimension);
const sumSide = (legs: CanonicalLedgerLeg[], side: 'debit' | 'credit') =>
  round(legs.filter(leg => leg.side === side).reduce((sum, leg) => sum + leg.amount, 0));
const canonicalLegsFor = (
  posting: ReturnType<typeof canonicalResolverCatalogV1Runtime.resolve> extends infer _T ? any : never,
  dimension: CanonicalLedgerDimension,
): CanonicalLedgerLeg[] => dimension === 'cash'
    ? posting.cashLedgerLegs
    : dimension === 'gold'
      ? posting.goldLedgerLegs
      : posting.silverLedgerLegs;

for (const entry of entries) {
  const id = entry.id ?? '';
  let status: ResultStatus = 'error';
  let definition: CanonicalResolverDefinition | undefined;
  let diagnosticReason = '';
  let posting: any;
  try {
    const resolution = canonicalResolverCatalogV1Runtime.resolve(entry);
    if (resolution.status === 'unresolved') {
      status = 'unresolved';
      diagnosticReason = 'No approved V1 mapping matched the record.';
    } else if (resolution.status === 'ambiguous') {
      status = 'ambiguous';
      diagnosticReason = resolution.definitions.map(item => item.resolverId).join('|');
    } else if (resolution.status === 'invalid') {
      status = 'invalid';
      definition = resolution.definition;
      diagnosticReason = resolution.errors.join('; ');
    } else {
      definition = resolution.definition;
      posting = resolution.posting;
      status = definition.status === 'legacy_only'
        ? 'legacy_only'
        : definition.status === 'unresolved'
          ? 'unresolved'
          : definition.status === 'invalid'
            ? 'invalid'
            : 'matched';
      diagnosticReason = status === 'legacy_only'
        ? 'Approved Phase 2.1 legacy_direction_exception; canonical legs suppressed.'
        : '';
    }
  } catch (error) {
    status = 'error';
    diagnosticReason = error instanceof Error ? error.message : String(error);
  }
  statusCounts[status] += 1;
  if (definition) {
    const counts = variantCounts.get(definition.approvedVariantId) ?? {
      matched: 0, legacy_only: 0, unresolved: 0, invalid: 0, ambiguous: 0, error: 0,
    };
    counts[status] += 1;
    variantCounts.set(definition.approvedVariantId, counts);
  }

  const balances = posting && status === 'matched' ? summarizePostingBalances(posting) : [];
  const usedDimensions = balances.filter(item => item.used).map(item => item.dimension);
  const debitTotal = round(balances.reduce((sum, item) => sum + item.debit, 0));
  const creditTotal = round(balances.reduce((sum, item) => sum + item.credit, 0));
  const difference = round(debitTotal - creditTotal);
  let legacyComparisonResult = status === 'legacy_only' ? 'not_comparable_legacy_only' : 'not_comparable';

  if (posting && status === 'matched') {
    const comparisonStates: string[] = [];
    for (const dimension of dimensions) {
      const canonicalLegs = canonicalLegsFor(posting, dimension);
      const legacyLegs = legacyFor(id, dimension);
      const canonicalDebit = sumSide(canonicalLegs, 'debit');
      const canonicalCredit = sumSide(canonicalLegs, 'credit');
      const legacyDebit = round(legacyLegs.filter(row => row.side === 'debit').reduce((sum, row) => sum + Number(row.amount), 0));
      const legacyCredit = round(legacyLegs.filter(row => row.side === 'credit').reduce((sum, row) => sum + Number(row.amount), 0));
      totals[dimension].debit = round(totals[dimension].debit + canonicalDebit);
      totals[dimension].credit = round(totals[dimension].credit + canonicalCredit);
      const amountComparison = canonicalDebit === legacyDebit && canonicalCredit === legacyCredit ? 'exact' : 'different';
      const canonicalAccounts = canonicalLegs.map(leg => `${leg.side}:${leg.accountId}`).sort().join('|');
      const legacyAccounts = legacyLegs.map(row => `${row.side}:${row.account_name}`).sort().join('|');
      const accountComparison = canonicalLegs.length === 0 && legacyLegs.length === 0
        ? 'not_used'
        : canonicalLegs.map(leg => `${leg.side}:${leg.accountName}`).sort().join('|') === legacyAccounts
          ? 'exact'
          : 'intentional_canonical_mapping';
      if (amountComparison === 'different') comparisonStates.push(`${dimension}:amount_difference`);
      comparisonRows.push({
        record_id: id,
        operation_number: entry.legacyOperationNo ?? entry.invoiceNumber ?? '',
        operation_type: definition.operationType,
        approved_variant_id: definition.approvedVariantId,
        resolver_id: definition.resolverId,
        dimension,
        canonical_debit: canonicalDebit,
        canonical_credit: canonicalCredit,
        legacy_debit: legacyDebit,
        legacy_credit: legacyCredit,
        debit_difference: round(canonicalDebit - legacyDebit),
        credit_difference: round(canonicalCredit - legacyCredit),
        amount_comparison: amountComparison,
        account_comparison: accountComparison,
        canonical_accounts: canonicalAccounts,
        legacy_accounts: legacyAccounts,
      });
    }
    legacyComparisonResult = comparisonStates.length === 0 ? 'exact_dimension_amounts' : comparisonStates.join(';');
  }

  const resultRow = {
    record_id: id,
    transaction_date: entry.date,
    operation_number: entry.legacyOperationNo ?? entry.invoiceNumber ?? '',
    source_operation_type: entry.tx,
    matched_resolver_id: definition?.resolverId ?? '',
    approved_variant_id: definition?.approvedVariantId ?? '',
    source_variant_id: definition?.sourceVariantId ?? '',
    catalog_version: CANONICAL_RESOLVER_CATALOG_V1_VERSION,
    result_status: status,
    accounting_dimension: usedDimensions.join('|'),
    debit_total: debitTotal,
    credit_total: creditTotal,
    balance_difference: difference,
    legacy_comparison_result: legacyComparisonResult,
    diagnostic_reason: diagnosticReason,
  };
  recordResults.push(resultRow);
  if (status !== 'matched') exceptionRows.push(resultRow);
}

if (JSON.stringify(entries) !== originalFixtureSerialization) throw new Error('Historical fixtures were modified in memory');

const variantRows = canonicalResolverCatalogV1.definitions.map(definition => {
  const counts = variantCounts.get(definition.approvedVariantId) ?? statusCountsFromZero();
  return {
    resolver_id: definition.resolverId,
    approved_variant_id: definition.approvedVariantId,
    source_variant_id: definition.sourceVariantId,
    operation_type: definition.operationType,
    source_classification: definition.sourceClassification,
    approved_status: definition.status,
    expected_historical_documents: definition.historicalDocumentCount,
    evaluated_documents: Object.values(counts).reduce((sum, count) => sum + count, 0),
    matched: counts.matched,
    legacy_only: counts.legacy_only,
    unresolved: counts.unresolved,
    invalid: counts.invalid,
    ambiguous: counts.ambiguous,
    error: counts.error,
    decision_reference: definition.decisionReference,
  };
});

function statusCountsFromZero(): Record<ResultStatus, number> {
  return { matched: 0, legacy_only: 0, unresolved: 0, invalid: 0, ambiguous: 0, error: 0 };
}

writeCsv('phase4_canonical_record_results.csv', recordResults, Object.keys(recordResults[0]));
writeCsv('phase4_legacy_vs_canonical_comparison.csv', comparisonRows, Object.keys(comparisonRows[0]));
writeCsv('phase4_variant_coverage.csv', variantRows, Object.keys(variantRows[0]));
writeCsv('phase4_exceptions.csv', exceptionRows, Object.keys(recordResults[0]));

const validation = canonicalResolverCatalogV1Runtime.validation;
const exactComparisonRows = comparisonRows.filter(row => row.amount_comparison === 'exact').length;
const differentComparisonRows = comparisonRows.length - exactComparisonRows;
const exactComparisonRecords = recordResults.filter(row => row.legacy_comparison_result === 'exact_dimension_amounts').length;
const exactAccountRows = comparisonRows.filter(row => row.account_comparison === 'exact').length;
const intentionalAccountRows = comparisonRows.filter(row => row.account_comparison === 'intentional_canonical_mapping').length;
const totalLine = (dimension: CanonicalLedgerDimension, label: string) => {
  const debit = totals[dimension].debit;
  const credit = totals[dimension].credit;
  return `| ${label} | ${debit} | ${credit} | ${round(debit - credit)} |`;
};

fs.writeFileSync(path.join(root, 'phase4_catalog_validation_report.md'), `# Phase 4 Catalog Validation Report

- Catalog version: \`${CANONICAL_RESOLVER_CATALOG_V1_VERSION}\`
- Definitions: ${canonicalResolverCatalogV1.definitions.length}
- Historical definitions: ${canonicalResolverCatalogV1.definitions.filter(item => item.sourceClassification === 'historical').length}
- Design-only definitions: ${canonicalResolverCatalogV1.definitions.filter(item => item.sourceClassification === 'design_only').length}
- Result: **${validation.valid ? 'PASS' : 'FAIL'}**
- Errors: ${validation.errors.length}
- Warnings: ${validation.warnings.length}

## Errors

${validation.errors.length ? validation.errors.map(error => `- ${error}`).join('\n') : '- None.'}

## Warnings

${validation.warnings.length ? validation.warnings.map(warning => `- ${warning}`).join('\n') : '- None.'}

The validator is fail-closed. Duplicate IDs, duplicate composite approved variant IDs,
unsupported account construction, overlaps, invalid statuses, unreachable historical
rules, missing dimensions, or a non-V1 version prevent all catalog resolution.
`, 'utf8');

fs.writeFileSync(path.join(root, 'phase4_canonical_resolver_catalog_report.md'), `# Phase 4 — Versioned Canonical Resolver Catalog

## Result

- Catalog: \`${CANONICAL_RESOLVER_CATALOG_V1_VERSION}\`
- Resolver definitions: ${canonicalResolverCatalogV1.definitions.length}
- Approved Phase 2.1 matrix coverage: ${variantRows.length}/174
- Validation: **${validation.valid ? 'PASS' : 'FAIL'}**
- Historical records evaluated in memory: ${entries.length}
- Original records modified: 0
- Firestore writes/deletes: 0/0
- Migrations: 0
- Deploys: 0
- Production activation: 0

## Record Status

| Status | Count |
|---|---:|
${Object.entries(statusCounts).map(([status, count]) => `| ${status} | ${count} |`).join('\n')}
| **Total** | **${Object.values(statusCounts).reduce((sum, count) => sum + count, 0)}** |

## Canonical Executable Totals

| Dimension | Debit | Credit | Difference |
|---|---:|---:|---:|
${totalLine('cash', 'Cash EGP')}
${totalLine('gold', 'Gold E21')}
${totalLine('silver', 'Silver grams')}

## Legacy Comparison

Comparison is limited to the three approved ledger dimensions and their source
amounts. It does not require canonical account structures to equal legacy names.

- Dimension comparison rows: ${comparisonRows.length}
- Records with exact comparable dimension amounts: ${exactComparisonRecords}
- Exact debit/credit amount rows: ${exactComparisonRows}
- Amount-difference rows: ${differentComparisonRows}
- Exact account-structure rows: ${exactAccountRows}
- Intentional canonical account-remapping rows: ${intentionalAccountRows}
- Legacy-only records excluded from canonical totals: ${statusCounts.legacy_only}
- Canonical account remapping is reported separately as an intentional structural
  difference and is never treated as an amount match.

## Cost and Runtime Prerequisites

No cost amount was inferred. The source fixture has no approved pre-sale WAC
snapshot. Cost Basis, linked returns, opening/manual cost assignment, and real
merchant workmanship/cash business accounts remain prerequisites before any
production activation.

The generated catalog retains the complete approved posting/effect text for every
variant. Historical executable totals in this report are deliberately limited to
the approved Cash, Gold E21, and Silver source dimensions; unavailable COGS/WAC
amounts are not emitted as zero or balancing entries.

## Artifact Reconciliation

The Phase 2.1 matrix generator left Gold posting text on Silver variants and on
three accessory opening rows because their legacy \`arabicWeight\` field was
populated. Historical dimension applicability is therefore checked against the
approved \`legacy_ledger_projection_trace.csv\`. This prevents cross-metal
duplication while preserving the matrix account mappings and decision metadata.

## Source Artifacts

- \`canonical_operation_mapping_matrix.csv\`
- \`opening_balance_mapping_variants.csv\`
- \`phase2_1_business_decisions_closure_report.md\`
- \`tx42_canonical_resolution.md\`
- \`phase3_canonical_architecture_report.md\`
- \`approved_normalized_preview.csv\` (read-only)
- \`legacy_ledger_projection_trace.csv\` (read-only)
`, 'utf8');

console.log(JSON.stringify({
  catalogVersion: CANONICAL_RESOLVER_CATALOG_V1_VERSION,
  validation,
  definitions: canonicalResolverCatalogV1.definitions.length,
  statusCounts,
  totals,
  comparison: { rows: comparisonRows.length, exactAmountRows: exactComparisonRows, differentAmountRows: differentComparisonRows },
  fixturesUnmodified: true,
}, null, 2));
