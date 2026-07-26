/**
 * Canonical posting contract approved in Phase 2.1.
 *
 * Phase 3 imports this contract through the pure accounting-engine boundary.
 * It still contains no persistence, migration, or automatic production
 * activation.
 */

export type CanonicalPostingStatus =
  | 'legacy_only'
  | 'operational_only'
  | 'inventory_only'
  | 'non_journal'
  | 'canonical_balanced'
  | 'unresolved'
  | 'invalid';

export type CanonicalBalancingStatus =
  | 'balanced'
  | 'not_applicable'
  | 'unbalanced'
  | 'blocked';

export type CanonicalLedgerDimension = 'cash' | 'gold' | 'silver';
export type CanonicalLedgerSide = 'debit' | 'credit';
export type CanonicalAmountUnit = 'EGP' | 'g_E21' | 'g_silver' | 'quantity' | 'EGP_cost';

export interface CanonicalLedgerLeg {
  accountId: string;
  accountName: string;
  side: CanonicalLedgerSide;
  amount: number;
  unit: CanonicalAmountUnit;
  historicalName?: string;
  semanticLabel?: string;
}

export interface CanonicalMovement {
  accountId?: string;
  productId?: string;
  merchantAccountId?: string;
  direction: 'increase' | 'decrease' | 'transfer_in' | 'transfer_out' | 'none';
  amount: number;
  unit: CanonicalAmountUnit;
  ownershipEffect?: 'increase' | 'decrease' | 'unchanged' | 'not_determined';
  note?: string;
}

export interface CanonicalFinancialEffect {
  accountId?: string;
  direction: 'increase' | 'decrease' | 'none';
  amount: number;
  unit: 'EGP' | 'EGP_cost';
  note?: string;
}

export interface CanonicalPostingSet {
  sourceOperationId: string;
  operationType: string;
  fiscalYear: number;
  cashLedgerLegs: CanonicalLedgerLeg[];
  goldLedgerLegs: CanonicalLedgerLeg[];
  silverLedgerLegs: CanonicalLedgerLeg[];
  physicalInventoryMovements: CanonicalMovement[];
  quantityMovements: CanonicalMovement[];
  merchantMetalLiabilityMovements: CanonicalMovement[];
  merchantWorkmanshipMovements: CanonicalMovement[];
  costMovements: CanonicalMovement[];
  revenueEffects: CanonicalFinancialEffect[];
  expenseEffects: CanonicalFinancialEffect[];
  equityEffects: CanonicalFinancialEffect[];
  validationWarnings: string[];
  validationErrors: string[];
  postingStatus: CanonicalPostingStatus;
  balancingStatus: CanonicalBalancingStatus;
  ruleVersion: string;
  ruleSource: string[];
}

export interface DimensionBalance {
  dimension: CanonicalLedgerDimension;
  debit: number;
  credit: number;
  difference: number;
  used: boolean;
  balanced: boolean;
}

const round = (value: number): number => Math.round((value + Number.EPSILON) * 1e9) / 1e9;

export const summarizeDimensionBalance = (
  dimension: CanonicalLedgerDimension,
  legs: CanonicalLedgerLeg[],
): DimensionBalance => {
  const debit = round(legs.filter(leg => leg.side === 'debit').reduce((sum, leg) => sum + leg.amount, 0));
  const credit = round(legs.filter(leg => leg.side === 'credit').reduce((sum, leg) => sum + leg.amount, 0));
  return {
    dimension,
    debit,
    credit,
    difference: round(debit - credit),
    used: legs.length > 0,
    balanced: legs.length === 0 || Math.abs(debit - credit) < 1e-9,
  };
};

export const summarizePostingBalances = (posting: CanonicalPostingSet): DimensionBalance[] => [
  summarizeDimensionBalance('cash', posting.cashLedgerLegs),
  summarizeDimensionBalance('gold', posting.goldLedgerLegs),
  summarizeDimensionBalance('silver', posting.silverLedgerLegs),
];

export const validateCanonicalPostingSet = (posting: CanonicalPostingSet): string[] => {
  const errors = [...posting.validationErrors];
  const balances = summarizePostingBalances(posting);
  if (posting.postingStatus === 'canonical_balanced') {
    balances.filter(balance => balance.used && !balance.balanced).forEach(balance => {
      errors.push(`${balance.dimension} ledger is not balanced`);
    });
    if (!balances.some(balance => balance.used)) errors.push('canonical_balanced posting has no journal dimension');
    if (posting.balancingStatus !== 'balanced') errors.push('canonical_balanced posting must have balancingStatus=balanced');
  }
  return [...new Set(errors)];
};

export const TX42_CANONICAL_METADATA = {
  sourceDocumentId: 'csvref-entry-3e1f9b1fe78247341d78529914239bba',
  legacyOperationId: 'dykcltueh9B3mWMkDUGK',
  legacyOperationNo: 'TX42',
  operationDate: '2026-01-01',
  fiscalYear: 2026,
  goldEquivalent21: 16.2,
  capitalGoldAccountId: 'seed-account-35d2d47536f02061f01a',
  capitalGoldHistoricalName: 'راس المال ذهب',
  retainedGoldAccountId: 'seed-account-b99a05ac4c9416a5c6f6',
  retainedGoldHistoricalName: 'الارباح و الخساير 2024',
  retainedGoldApprovedMeaning: 'الأرباح والخسائر المرحلة من سنة 2025 — ذهب',
  retainedGoldModernDisplayLabel: 'الارباح و الخساير 2024 (نتيجة 2025 المرحلة)',
  semanticSourceYear: 2025,
} as const;

/** Phase 2.1 approved design identifiers. These are stable mapping IDs only;
 * creating account documents in Production is explicitly outside this phase. */
export const PHASE21_CANONICAL_ACCOUNT_IDS = {
  retainedCashResults: 'canonical:equity:retained-results:cash',
  retainedGoldResults: 'canonical:equity:retained-results:gold',
  retainedSilverResults: 'canonical:equity:retained-results:silver',
  goldInventoryCarryingCost: 'canonical:asset:inventory-carrying-cost:gold',
  silverInventoryCarryingCost: 'canonical:asset:inventory-carrying-cost:silver',
  accessoriesInventoryCarryingCost: 'canonical:asset:inventory-carrying-cost:accessories',
  goldCogs: 'canonical:expense:cogs:gold',
  silverCogs: 'canonical:expense:cogs:silver',
  accessoriesCogs: 'canonical:expense:cogs:accessories',
  goldSalesRevenue: 'canonical:revenue:sales:gold',
  silverSalesRevenue: 'canonical:revenue:sales:silver',
  accessoriesSalesRevenue: 'canonical:revenue:sales:accessories',
  goldWeightAcquired: 'canonical:metal-flow:gold:acquired',
  goldWeightSold: 'canonical:metal-flow:gold:sold',
  silverWeightAcquired: 'canonical:metal-flow:silver:acquired',
  silverWeightSold: 'canonical:metal-flow:silver:sold',
} as const;

export type Phase21MerchantOperationType =
  | 'merchant_weight_received'
  | 'merchant_weight_delivered'
  | 'merchant_workmanship_paid'
  | 'merchant_workmanship_received'
  | 'merchant_cash_paid'
  | 'merchant_cash_received';

export type Phase21CostStatus = 'confirmed' | 'unresolved' | 'not_applicable';
export const createTx42CanonicalPosting = (): CanonicalPostingSet => ({
  sourceOperationId: TX42_CANONICAL_METADATA.sourceDocumentId,
  operationType: 'opening.retained_gold_result',
  fiscalYear: TX42_CANONICAL_METADATA.fiscalYear,
  cashLedgerLegs: [],
  goldLedgerLegs: [
    {
      accountId: TX42_CANONICAL_METADATA.capitalGoldAccountId,
      accountName: TX42_CANONICAL_METADATA.capitalGoldHistoricalName,
      historicalName: TX42_CANONICAL_METADATA.capitalGoldHistoricalName,
      semanticLabel: 'رأس المال ذهب',
      side: 'debit',
      amount: TX42_CANONICAL_METADATA.goldEquivalent21,
      unit: 'g_E21',
    },
    {
      accountId: TX42_CANONICAL_METADATA.retainedGoldAccountId,
      accountName: TX42_CANONICAL_METADATA.retainedGoldHistoricalName,
      historicalName: TX42_CANONICAL_METADATA.retainedGoldHistoricalName,
      semanticLabel: TX42_CANONICAL_METADATA.retainedGoldApprovedMeaning,
      side: 'credit',
      amount: TX42_CANONICAL_METADATA.goldEquivalent21,
      unit: 'g_E21',
    },
  ],
  silverLedgerLegs: [],
  physicalInventoryMovements: [],
  quantityMovements: [],
  merchantMetalLiabilityMovements: [],
  merchantWorkmanshipMovements: [],
  costMovements: [],
  revenueEffects: [],
  expenseEffects: [],
  equityEffects: [],
  validationWarnings: [
    'The stored historical account name is intentionally preserved; semantic year 2025 is metadata only.',
  ],
  validationErrors: [],
  postingStatus: 'canonical_balanced',
  balancingStatus: 'balanced',
  ruleVersion: 'phase2-design-v1',
  ruleSource: ['Owner-approved TX42 decision — 2026-07-24', 'LegacyLedgerProjection TX42 legs'],
});

export const createCustomerSaleDesignFixture = (
  metal: 'gold' | 'silver' | 'accessory',
): CanonicalPostingSet => {
  const isAccessory = metal === 'accessory';
  const unit: CanonicalAmountUnit = metal === 'gold' ? 'g_E21' : metal === 'silver' ? 'g_silver' : 'quantity';
  const carryingCostId = PHASE21_CANONICAL_ACCOUNT_IDS[`${metal}InventoryCarryingCost`];
  const cogsId = PHASE21_CANONICAL_ACCOUNT_IDS[`${metal}Cogs`];
  const revenueId = PHASE21_CANONICAL_ACCOUNT_IDS[`${metal}SalesRevenue`];
  const metalLegs: CanonicalLedgerLeg[] = isAccessory ? [] : [
    { accountId: PHASE21_CANONICAL_ACCOUNT_IDS[metal === 'gold' ? 'goldWeightSold' : 'silverWeightSold'], accountName: `${metal} weight sold`, side: 'debit', amount: 2, unit },
    { accountId: `fixture-${metal}-product`, accountName: `${metal} physical inventory`, side: 'credit', amount: 2, unit },
  ];
  return {
    sourceOperationId: `fixture-customer-${metal}-sale`, operationType: `customer_${metal}_sale`, fiscalYear: 2026,
    cashLedgerLegs: [
      { accountId: 'seed-account-43aee8a824522365db1a', accountName: 'الخزنة', side: 'debit', amount: 1000, unit: 'EGP' },
      { accountId: revenueId, accountName: `${metal} sales revenue`, side: 'credit', amount: 1000, unit: 'EGP' },
      { accountId: cogsId, accountName: `${metal} COGS`, side: 'debit', amount: 600, unit: 'EGP' },
      { accountId: carryingCostId, accountName: `${metal} inventory carrying cost`, side: 'credit', amount: 600, unit: 'EGP' },
    ],
    goldLedgerLegs: metal === 'gold' ? metalLegs : [], silverLedgerLegs: metal === 'silver' ? metalLegs : [],
    physicalInventoryMovements: isAccessory ? [] : [{ productId: `fixture-${metal}-product`, direction: 'decrease', amount: 2, unit, ownershipEffect: 'decrease', note: 'Exactly one physical movement; ledger legs do not generate inventory movement.' }],
    quantityMovements: [{ productId: `fixture-${metal}-product`, direction: 'decrease', amount: isAccessory ? 2 : 1, unit: 'quantity', note: 'Quantity never enters a metal ledger.' }],
    merchantMetalLiabilityMovements: [], merchantWorkmanshipMovements: [],
    costMovements: [{ productId: `fixture-${metal}-product`, direction: 'decrease', amount: 600, unit: 'EGP_cost', note: 'Confirmed WAC immediately before sale.' }],
    revenueEffects: [{ accountId: revenueId, direction: 'increase', amount: 1000, unit: 'EGP' }],
    expenseEffects: [{ accountId: cogsId, direction: 'increase', amount: 600, unit: 'EGP_cost' }], equityEffects: [],
    validationWarnings: [], validationErrors: [], postingStatus: 'canonical_balanced', balancingStatus: 'balanced',
    ruleVersion: 'phase2.1-design-v1', ruleSource: ['Owner-approved Phase 2.1 purchase cost and acquisition account decisions'],
  };
};

export const createCustomerPurchaseDesignFixture = (
  metal: 'gold' | 'silver' | 'accessory',
): CanonicalPostingSet => {
  const isAccessory = metal === 'accessory';
  const unit: CanonicalAmountUnit = metal === 'gold' ? 'g_E21' : metal === 'silver' ? 'g_silver' : 'quantity';
  const carryingCostId = PHASE21_CANONICAL_ACCOUNT_IDS[`${metal}InventoryCarryingCost`];
  const metalLegs: CanonicalLedgerLeg[] = isAccessory ? [] : [
    { accountId: `fixture-${metal}-product`, accountName: `${metal} physical inventory`, side: 'debit', amount: 2, unit },
    { accountId: PHASE21_CANONICAL_ACCOUNT_IDS[metal === 'gold' ? 'goldWeightAcquired' : 'silverWeightAcquired'], accountName: `${metal} weight acquired`, side: 'credit', amount: 2, unit },
  ];
  return {
    sourceOperationId: `fixture-customer-${metal}-purchase`, operationType: `customer_${metal}_purchase`, fiscalYear: 2026,
    cashLedgerLegs: [
      { accountId: carryingCostId, accountName: `${metal} inventory carrying cost`, side: 'debit', amount: 1000, unit: 'EGP' },
      { accountId: 'seed-account-43aee8a824522365db1a', accountName: 'الخزنة', side: 'credit', amount: 1000, unit: 'EGP' },
    ],
    goldLedgerLegs: metal === 'gold' ? metalLegs : [], silverLedgerLegs: metal === 'silver' ? metalLegs : [],
    physicalInventoryMovements: isAccessory ? [] : [{ productId: `fixture-${metal}-product`, direction: 'increase', amount: 2, unit, ownershipEffect: 'increase' }],
    quantityMovements: [{ productId: `fixture-${metal}-product`, direction: 'increase', amount: isAccessory ? 2 : 1, unit: 'quantity', note: 'Quantity never enters a metal ledger.' }],
    merchantMetalLiabilityMovements: [], merchantWorkmanshipMovements: [],
    costMovements: [{ productId: `fixture-${metal}-product`, direction: 'increase', amount: 1000, unit: 'EGP_cost', note: 'Acquisition cost, never Market Price.' }],
    revenueEffects: [], expenseEffects: [], equityEffects: [], validationWarnings: [], validationErrors: [],
    postingStatus: 'canonical_balanced', balancingStatus: 'balanced', ruleVersion: 'phase2.1-design-v1',
    ruleSource: ['Owner-approved Phase 2.1 purchase cost and acquisition account decisions'],
  };
};
export const createMerchantTransferDesignFixture = (
  metal: 'gold' | 'silver',
): CanonicalPostingSet => {
  const unit: CanonicalAmountUnit = metal === 'gold' ? 'g_E21' : 'g_silver';
  const legs: CanonicalLedgerLeg[] = [
    { accountId: 'fixture-merchant-source', accountName: 'التاجر المحول منه', side: 'debit', amount: 10, unit },
    { accountId: 'fixture-merchant-destination', accountName: 'التاجر المحول إليه', side: 'credit', amount: 10, unit },
  ];
  return {
    sourceOperationId: `fixture-merchant-${metal}-transfer`,
    operationType: 'merchant_to_merchant_transfer',
    fiscalYear: 2026,
    cashLedgerLegs: [],
    goldLedgerLegs: metal === 'gold' ? legs : [],
    silverLedgerLegs: metal === 'silver' ? legs : [],
    physicalInventoryMovements: [],
    quantityMovements: [],
    merchantMetalLiabilityMovements: [
      { merchantAccountId: 'fixture-merchant-source', direction: 'decrease', amount: 10, unit, ownershipEffect: 'increase' },
      { merchantAccountId: 'fixture-merchant-destination', direction: 'increase', amount: 10, unit, ownershipEffect: 'decrease' },
    ],
    merchantWorkmanshipMovements: [],
    costMovements: [],
    revenueEffects: [],
    expenseEffects: [],
    equityEffects: [],
    validationWarnings: [],
    validationErrors: [],
    postingStatus: 'canonical_balanced',
    balancingStatus: 'balanced',
    ruleVersion: 'phase2-design-v1',
    ruleSource: ['Notion Business, Accounting & Inventory Rules §8', 'Owner-approved merchant rules'],
  };
};
