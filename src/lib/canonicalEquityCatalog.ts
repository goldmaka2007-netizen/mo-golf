import type {
  Account,
  AccountTrackingDimension,
  CanonicalAccountDefinition,
  CanonicalAccountType,
} from '../types';

export const CANONICAL_EQUITY_ACCOUNT_IDS = {
  cashCapital: 'seed-account-5486ef1caa6f20ddfa37',
  goldCapital: 'seed-account-35d2d47536f02061f01a',
  silverCapital: 'seed-account-c06a92e1c390177ea90d',
  cashAndGoldRetainedResults: 'seed-account-b99a05ac4c9416a5c6f6',
  silverRetainedResults: 'seed-account-61d1858d6fa11a1b5e79',
} as const;

interface CanonicalEquityTaxonomy {
  entityType: Extract<CanonicalAccountType, 'capital' | 'retained_earnings'>;
  displayName: string;
  allowedDimensions: AccountTrackingDimension[];
  metal: CanonicalAccountDefinition['metal'];
  karat: CanonicalAccountDefinition['karat'];
  sourceMetadata?: Pick<Account, 'name' | 'mainType' | 'subType' | 'balanceNature' | 'type' | 'metal' | 'is_inventory'>;
}

/** Approved taxonomy keyed only by immutable source account IDs. */
export const CANONICAL_EQUITY_TAXONOMY_BY_SOURCE_ID: Readonly<Record<string, CanonicalEquityTaxonomy>> = Object.freeze({
  [CANONICAL_EQUITY_ACCOUNT_IDS.cashCapital]: {
    entityType: 'capital',
    displayName: 'رأس المال – نقد',
    allowedDimensions: ['cash'],
    metal: null,
    karat: null,
  },
  [CANONICAL_EQUITY_ACCOUNT_IDS.goldCapital]: {
    entityType: 'capital',
    displayName: 'رأس المال – ذهب',
    allowedDimensions: ['gold'],
    metal: 'gold',
    karat: 21,
  },
  [CANONICAL_EQUITY_ACCOUNT_IDS.silverCapital]: {
    entityType: 'capital',
    displayName: 'رأس المال – فضة',
    allowedDimensions: ['silver'],
    metal: 'silver',
    karat: null,
  },
  [CANONICAL_EQUITY_ACCOUNT_IDS.cashAndGoldRetainedResults]: {
    entityType: 'retained_earnings',
    displayName: 'الأرباح والخسائر المرحلة – نقد وذهب',
    allowedDimensions: ['cash', 'gold'],
    metal: 'gold',
    karat: 21,
    sourceMetadata: {
      name: 'الارباح و الخساير 2024',
      mainType: 'حقوق ملكية',
      subType: 'الارباح و الخساير',
      balanceNature: 'جنية مصري',
      type: 'other',
      metal: null,
      is_inventory: false,
    },
  },
  [CANONICAL_EQUITY_ACCOUNT_IDS.silverRetainedResults]: {
    entityType: 'retained_earnings',
    displayName: 'الأرباح والخسائر المرحلة – فضة',
    allowedDimensions: ['silver'],
    metal: 'silver',
    karat: null,
  },
});

const normalBalances = (
  dimensions: AccountTrackingDimension[],
): CanonicalAccountDefinition['normalBalanceByDimension'] => ({
  cash: dimensions.includes('cash') ? 'credit' : null,
  gold: dimensions.includes('gold') ? 'credit' : null,
  silver: dimensions.includes('silver') ? 'credit' : null,
  quantity: null,
});

const matchesMetadataFingerprint = (
  account: Account,
  expected: NonNullable<CanonicalEquityTaxonomy['sourceMetadata']>,
): boolean => Object.entries(expected).every(([field, value]) =>
  (account as unknown as Record<string, unknown>)[field] === value);

export const applyApprovedCanonicalEquityTaxonomy = (
  definition: CanonicalAccountDefinition,
  sourceAccount?: Account,
): CanonicalAccountDefinition => {
  const sourceAccountId = definition.sourceAccountId;
  const stableTaxonomy = sourceAccountId
    ? CANONICAL_EQUITY_TAXONOMY_BY_SOURCE_ID[sourceAccountId]
    : undefined;
  const metadataTaxonomyEntry = !stableTaxonomy && sourceAccount
    ? Object.entries(CANONICAL_EQUITY_TAXONOMY_BY_SOURCE_ID).find(([, candidate]) =>
      candidate.sourceMetadata
      && matchesMetadataFingerprint(sourceAccount, candidate.sourceMetadata))
    : undefined;
  const taxonomyId = stableTaxonomy ? sourceAccountId : metadataTaxonomyEntry?.[0];
  const taxonomy = stableTaxonomy ?? metadataTaxonomyEntry?.[1];
  if (!taxonomy || !taxonomyId) return definition;
  const dimensions = [...taxonomy.allowedDimensions];
  const tracksGold = dimensions.includes('gold');
  const tracksSilver = dimensions.includes('silver');
  const tracksCash = dimensions.includes('cash');
  const tracksWeight = tracksGold || tracksSilver;
  return {
    ...definition,
    displayName: taxonomy.displayName,
    entityType: taxonomy.entityType,
    mainGroup: 'equity',
    allowedDimensions: dimensions,
    normalBalanceByDimension: normalBalances(dimensions),
    metal: taxonomy.metal,
    karat: taxonomy.karat,
    trackingMode: tracksCash && tracksWeight ? 'value_and_weight' : tracksWeight ? 'weight' : 'value',
    tracksCash,
    tracksGold,
    tracksSilver,
    tracksQuantity: false,
    tracksWeight,
    tracksValue: tracksCash,
    tracksCost: false,
    isInventory: false,
    isMerchant: false,
    reportParticipation: ['equityStatement', 'financialPosition'],
    classificationSource: 'manual',
    classificationConfidence: 1,
    classificationEvidence: [
      ...definition.classificationEvidence,
      {
        source: 'manual',
        field: 'sourceAccountId',
        value: taxonomyId,
        rule: 'approved multi-dimensional equity taxonomy',
      },
    ],
    classificationConflicts: [],
    reviewStatus: 'reviewed',
    approvalStatus: 'approved',
    audit: {
      ...definition.audit,
      updatedBy: 'canonical-equity-taxonomy',
      lastReason: 'Approved capital/retained-results dimension classification',
    },
  };
};
