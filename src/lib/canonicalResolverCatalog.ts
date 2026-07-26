import type { Entry } from '../types';
import {
  type CanonicalAmountUnit,
  type CanonicalLedgerDimension,
  type CanonicalLedgerLeg,
  type CanonicalPostingSet,
  type CanonicalPostingStatus,
  validateCanonicalPostingSet,
} from './canonicalMappingDesign';

export const CANONICAL_RESOLVER_CATALOG_V1_VERSION = 'phase2.1-approved-v1' as const;
export type CanonicalResolverVersion = typeof CANONICAL_RESOLVER_CATALOG_V1_VERSION;
export type CanonicalCatalogSourceClassification = 'historical' | 'design_only';
export type CanonicalAmountSource = 'cash' | 'arabicWeight' | 'weight' | 'none';

export type CanonicalMatchCondition =
  | { kind: 'legacy_fields'; tx: string; debit: string; credit: string }
  | { kind: 'source_operation'; sourceOperationIds: readonly string[]; legacyOperationNo?: string }
  | { kind: 'design_variant'; operationType: string; variant: string };

export interface CanonicalResolverDefinition {
  readonly resolverId: string;
  readonly approvedVariantId: string;
  readonly sourceVariantId: string;
  readonly name: string;
  readonly operationType: string;
  readonly sourceClassification: CanonicalCatalogSourceClassification;
  readonly match: CanonicalMatchCondition;
  readonly historicalDocumentCount: number;
  readonly status: CanonicalPostingStatus;
  readonly dimensions: Readonly<Record<CanonicalLedgerDimension, boolean>>;
  readonly accounts: Readonly<{
    cashDebit: string;
    cashCredit: string;
    goldDebit: string;
    goldCredit: string;
    silverDebit: string;
    silverCredit: string;
  }>;
  readonly amountSources: Readonly<Record<CanonicalLedgerDimension, CanonicalAmountSource>>;
  readonly approvedPostings: Readonly<Record<CanonicalLedgerDimension, string>>;
  readonly approvedEffects: Readonly<{
    inventory: string;
    merchantLiability: string;
    workmanship: string;
    cost: string;
    profit: string;
    revenue: string;
    expense: string;
    equity: string;
  }>;
  readonly signHandling: 'absolute_source_amount';
  readonly metalHandling: 'gold_e21' | 'silver_grams' | 'none';
  readonly karatHandling: 'approved_e21_snapshot' | 'not_applicable';
  readonly requiredFields: string;
  readonly triggerConditions: string;
  readonly fallbackPolicy: string;
  readonly costStatus: 'confirmed' | 'unresolved' | 'not_applicable';
  readonly decisionReference: string;
  readonly ruleSource: string;
  readonly notes: string;
}

export interface CanonicalResolverCatalog {
  readonly version: CanonicalResolverVersion;
  readonly definitions: readonly CanonicalResolverDefinition[];
}

export interface CanonicalCatalogValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type CanonicalCatalogResolution =
  | { status: 'matched'; definition: CanonicalResolverDefinition; posting: CanonicalPostingSet }
  | { status: 'unresolved' }
  | { status: 'ambiguous'; definitions: CanonicalResolverDefinition[] }
  | { status: 'invalid'; definition?: CanonicalResolverDefinition; errors: string[] };

type CatalogEntry = Entry & {
  canonicalOperationType?: string;
  canonicalVariant?: string;
  confirmedPreSaleWac?: number;
  originalOperationId?: string;
};

const sourceOperationId = (entry: Entry): string =>
  entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq ?? '');

const matchesDefinition = (definition: CanonicalResolverDefinition, entry: CatalogEntry): boolean => {
  if (definition.match.kind === 'legacy_fields') {
    return entry.tx === definition.match.tx
      && entry.debit === definition.match.debit
      && entry.credit === definition.match.credit;
  }
  if (definition.match.kind === 'source_operation') {
    return definition.match.sourceOperationIds.includes(sourceOperationId(entry))
      && (!definition.match.legacyOperationNo || entry.legacyOperationNo === definition.match.legacyOperationNo);
  }
  return entry.canonicalOperationType === definition.match.operationType
    && entry.canonicalVariant === definition.match.variant;
};

const splitAccount = (value: string): { accountId: string; accountName: string } | null => {
  const separator = value.indexOf(' | ');
  if (separator <= 0 || separator >= value.length - 3) return null;
  return { accountId: value.slice(0, separator), accountName: value.slice(separator + 3) };
};

const numericSource = (entry: CatalogEntry, source: CanonicalAmountSource): number => {
  if (source === 'none') return 0;
  const value = Number(entry[source] ?? 0);
  return Number.isFinite(value) ? Math.abs(value) : Number.NaN;
};

const unitFor = (dimension: CanonicalLedgerDimension): CanonicalAmountUnit =>
  dimension === 'cash' ? 'EGP' : dimension === 'gold' ? 'g_E21' : 'g_silver';

const buildDimensionLegs = (
  definition: CanonicalResolverDefinition,
  entry: CatalogEntry,
  dimension: CanonicalLedgerDimension,
): CanonicalLedgerLeg[] => {
  if (!definition.dimensions[dimension]) return [];
  const amount = numericSource(entry, definition.amountSources[dimension]);
  if (!(amount > 0)) return [];
  const debit = splitAccount(definition.accounts[`${dimension}Debit`]);
  const credit = splitAccount(definition.accounts[`${dimension}Credit`]);
  if (!debit || !credit) return [];
  const unit = unitFor(dimension);
  return [
    { ...debit, side: 'debit', amount, unit },
    { ...credit, side: 'credit', amount, unit },
  ];
};

const fiscalYear = (entry: Entry): number => {
  const parsed = Number(entry.date.slice(0, 4));
  return Number.isInteger(parsed) ? parsed : 0;
};

export const buildCanonicalPostingFromDefinition = (
  definition: CanonicalResolverDefinition,
  entry: CatalogEntry,
  version: CanonicalResolverVersion,
): CanonicalPostingSet => {
  const executable = definition.status === 'canonical_balanced';
  const cashLedgerLegs = executable ? buildDimensionLegs(definition, entry, 'cash') : [];
  const goldLedgerLegs = executable ? buildDimensionLegs(definition, entry, 'gold') : [];
  const silverLedgerLegs = executable ? buildDimensionLegs(definition, entry, 'silver') : [];
  const requiredDimensions = executable
    ? (['cash', 'gold', 'silver'] as const).filter(dimension =>
        definition.dimensions[dimension] && numericSource(entry, definition.amountSources[dimension]) > 0)
    : [];
  const builtDimensions = ([
    ['cash', cashLedgerLegs],
    ['gold', goldLedgerLegs],
    ['silver', silverLedgerLegs],
  ] as const).filter(([, legs]) => legs.length > 0).map(([dimension]) => dimension);
  const validationErrors = definition.status === 'canonical_balanced'
    ? requiredDimensions.filter(dimension => !builtDimensions.includes(dimension))
      .map(dimension => `Unable to construct approved ${dimension} debit/credit legs`)
    : [];
  return {
    sourceOperationId: sourceOperationId(entry),
    operationType: definition.operationType,
    fiscalYear: fiscalYear(entry),
    cashLedgerLegs,
    goldLedgerLegs,
    silverLedgerLegs,
    physicalInventoryMovements: [],
    quantityMovements: [],
    merchantMetalLiabilityMovements: [],
    merchantWorkmanshipMovements: [],
    costMovements: [],
    revenueEffects: [],
    expenseEffects: [],
    equityEffects: [],
    validationWarnings: definition.costStatus === 'unresolved'
      ? ['Approved mapping has an unresolved cost-basis prerequisite; no cost amount was invented.']
      : [],
    validationErrors,
    postingStatus: definition.status,
    balancingStatus: definition.status === 'canonical_balanced' ? 'balanced' : 'not_applicable',
    ruleVersion: version,
    ruleSource: [definition.ruleSource, definition.decisionReference, 'canonical_operation_mapping_matrix.csv'],
  };
};

const accountFields = ['cashDebit', 'cashCredit', 'goldDebit', 'goldCredit', 'silverDebit', 'silverCredit'] as const;

export const validateCanonicalResolverCatalog = (
  catalog: CanonicalResolverCatalog,
): CanonicalCatalogValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (catalog.version !== CANONICAL_RESOLVER_CATALOG_V1_VERSION) errors.push(`Unsupported catalog version: ${catalog.version}`);
  const resolverIds = new Set<string>();
  const variantIds = new Set<string>();
  for (const definition of catalog.definitions) {
    if (!definition.resolverId || !definition.approvedVariantId || !definition.operationType || !definition.decisionReference) {
      errors.push(`Resolver ${definition.resolverId || '<missing>'} is missing required metadata`);
    }
    if (resolverIds.has(definition.resolverId)) errors.push(`Duplicate resolver ID: ${definition.resolverId}`);
    resolverIds.add(definition.resolverId);
    if (variantIds.has(definition.approvedVariantId)) errors.push(`Duplicate approved variant ID: ${definition.approvedVariantId}`);
    variantIds.add(definition.approvedVariantId);
    if (!['canonical_balanced', 'legacy_only', 'operational_only', 'inventory_only', 'non_journal', 'unresolved', 'invalid'].includes(definition.status)) {
      errors.push(`Invalid status for ${definition.resolverId}: ${definition.status}`);
    }
    for (const dimension of ['cash', 'gold', 'silver'] as const) {
      if (!definition.dimensions[dimension]) continue;
      const debit = definition.accounts[`${dimension}Debit`];
      const credit = definition.accounts[`${dimension}Credit`];
      if (!splitAccount(debit) || !splitAccount(credit)) errors.push(`Invalid ${dimension} account construction in ${definition.resolverId}`);
      if (definition.amountSources[dimension] === 'none') errors.push(`Missing ${dimension} amount source in ${definition.resolverId}`);
    }
    for (const field of accountFields) {
      if (definition.accounts[field] && !splitAccount(definition.accounts[field])) errors.push(`Unsupported account resolution in ${definition.resolverId}.${field}`);
    }
    if (definition.status === 'canonical_balanced' && !Object.values(definition.dimensions).some(Boolean)) {
      errors.push(`Canonical resolver ${definition.resolverId} has zero required ledger dimensions`);
    }
    if (definition.sourceClassification === 'historical' && definition.historicalDocumentCount <= 0) {
      errors.push(`Historical resolver ${definition.resolverId} is unreachable`);
    }
    if (definition.sourceClassification === 'design_only' && definition.historicalDocumentCount !== 0) {
      errors.push(`Design-only resolver ${definition.resolverId} has historical documents`);
    }
  }
  for (let left = 0; left < catalog.definitions.length; left += 1) {
    for (let right = left + 1; right < catalog.definitions.length; right += 1) {
      const a = catalog.definitions[left].match;
      const b = catalog.definitions[right].match;
      const overlap = a.kind === 'legacy_fields' && b.kind === 'legacy_fields'
        ? a.tx === b.tx && a.debit === b.debit && a.credit === b.credit
        : a.kind === 'source_operation' && b.kind === 'source_operation'
          ? a.sourceOperationIds.some(id => b.sourceOperationIds.includes(id))
          : a.kind === 'design_variant' && b.kind === 'design_variant'
            ? a.operationType === b.operationType && a.variant === b.variant
            : false;
      if (overlap) errors.push(`Overlapping match conditions: ${catalog.definitions[left].resolverId}, ${catalog.definitions[right].resolverId}`);
    }
  }
  if (catalog.definitions.length !== 174) errors.push(`Expected 174 definitions, received ${catalog.definitions.length}`);
  if (catalog.definitions.filter(definition => definition.sourceClassification === 'design_only').length !== 7) {
    warnings.push('Expected seven approved design-only variants');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings };
};

export const createVersionedCanonicalResolver = (catalog: CanonicalResolverCatalog) => {
  const validation = validateCanonicalResolverCatalog(catalog);
  return {
    version: catalog.version,
    validation,
    resolve(entry: CatalogEntry): CanonicalCatalogResolution {
      if (!validation.valid) return { status: 'invalid', errors: validation.errors };
      const matches = catalog.definitions.filter(definition => matchesDefinition(definition, entry));
      if (matches.length === 0) return { status: 'unresolved' };
      if (matches.length > 1) return { status: 'ambiguous', definitions: matches };
      const definition = matches[0];
      if (definition.sourceClassification === 'design_only') {
        return {
          status: 'invalid',
          definition,
          errors: [
            `Design-only resolver ${definition.resolverId} requires its approved linked-operation or business-account runtime adapter.`,
          ],
        };
      }
      const posting = buildCanonicalPostingFromDefinition(definition, entry, catalog.version);
      const errors = validateCanonicalPostingSet(posting);
      if (errors.length > 0) return { status: 'invalid', definition, errors };
      return { status: 'matched', definition, posting };
    },
  };
};
