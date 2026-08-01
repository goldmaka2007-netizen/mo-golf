import type { Entry } from '../types';

export const INVENTORY_COST_CALCULATION_VERSION = 'phase5-wac-v1' as const;

export type InventoryCostTaxonomyKey = string;
export type LegacyInventoryCostTaxonomyKey =
  | 'gold.product.ring_women'
  | 'gold.product.ring_children'
  | 'gold.product.earring_women'
  | 'gold.product.earring_children'
  | 'gold.product.earring_macaroni'
  | 'gold.product.tons'
  | 'gold.product.band'
  | 'gold.product.mehbes'
  | 'gold.product.bracelet'
  | 'gold.product.chain_pendant'
  | 'gold.product.gouache_kimk'
  | 'gold.product.borema'
  | 'gold.product.ring_arabic'
  | 'gold.product.earring_arabic'
  | 'gold.product.gouache_arabic'
  | 'gold.product.chain_arabic'
  | 'gold.raw.scrap_foreign'
  | 'gold.raw.scrap_arabic'
  | 'gold.direct.coin'
  | 'gold.direct.bar'
  | 'silver.product.ring'
  | 'silver.product.ring_women'
  | 'silver.product.band'
  | 'silver.product.chain_men'
  | 'silver.product.chain_women'
  | 'silver.product.medal'
  | 'silver.product.clasp'
  | 'silver.raw.scrap'
  | 'silver.direct.bar'
  | 'accessory.tungsten_band'
  | 'accessory.medical_earring'
  | 'accessory.silicone';

export type InventoryCostKind = 'gold' | 'silver' | 'accessory';
export type InventoryCostUnitBasis =
  | 'gold_equivalent21_centigram'
  | 'silver_centigram'
  | 'accessory_milli_piece';

export interface InventoryTaxonomyDefinition {
  taxonomyKey: InventoryCostTaxonomyKey;
  kind: InventoryCostKind;
  unitBasis: InventoryCostUnitBasis;
  karat: 18 | 21 | 24 | null;
}

export interface InventoryRuntimeBinding {
  inventoryAccountId: string;
  taxonomyKey: InventoryCostTaxonomyKey;
}

export interface ResolvedInventoryAccount extends InventoryTaxonomyDefinition {
  inventoryAccountId: string;
  displayName: string;
  dimension: 'weight' | 'quantity';
  costingMethod: 'wac' | 'fixed-opening-cost';
}

export type InventoryAccountResolution =
  | { status: 'eligible'; accountId: string; dimension: 'weight' | 'quantity'; costingMethod: 'wac' | 'fixed-opening-cost'; account: ResolvedInventoryAccount }
  | { status: 'not-inventory' }
  | { status: 'invalid'; reason: 'missing_inventory_type' | 'unsupported_dimension' | 'unsupported_costing_method' | 'missing_cost_basis' };

export type InventoryValuationStatus = 'empty-uninitialized' | 'ready' | 'missing-cost-basis' | 'invalid-configuration';

export interface InventoryCostState {
  inventoryAccountId: string;
  taxonomyKey: InventoryCostTaxonomyKey;
  displayName: string;
  kind: InventoryCostKind;
  unitBasis: InventoryCostUnitBasis;
  dimension: 'weight' | 'quantity';
  costingMethod: 'wac' | 'fixed-opening-cost';
  valuationStatus: InventoryValuationStatus;
  standardizedQuantityUnits: number;
  actualPhysicalWeightUnits: number;
  accessoryQuantityUnits: number;
  pendingStandardizedQuantityUnits: number;
  pendingActualPhysicalWeightUnits: number;
  pendingAccessoryQuantityUnits: number;
  remainingMetalCostMinor: number;
  remainingWorkmanshipCostMinor: number;
  remainingAccessoryCostMinor: number;
  remainingTotalCostMinor: number;
  metalWacMinorPerStandardUnit: number | null;
  workmanshipWacMinorPerPhysicalUnit: number | null;
  totalWacMinorPerDisplayUnit: number | null;
  lastKnownMetalCostMinor: number;
  lastKnownStandardizedQuantityUnits: number;
  lastKnownWorkmanshipCostMinor: number;
  lastKnownPhysicalQuantityUnits: number;
  lastKnownAccessoryCostMinor: number;
  lastKnownAccessoryQuantityUnits: number;
  hasReliableCostBasis: boolean;
  lastProcessedOperationId?: string;
  calculationVersion: typeof INVENTORY_COST_CALCULATION_VERSION;
}


export type InventoryCostDiagnosticCode =
  | 'duplicate_operation'
  | 'invalid_historical_overlay'
  | 'insufficient_inventory'
  | 'invalid_amount'
  | 'invalid_opening_cost'
  | 'invalid_ordering'
  | 'invalid_quantity'
  | 'merchant_workmanship_without_weight'
  | 'missing_inventory_account_id'
  | 'missing_karat_conversion'
  | 'missing_opening_cost'
  | 'missing_wac'
  | 'missing_cost_basis'
  | 'inventory_cost_basis_required'
  | 'missing_inventory_type'
  | 'unsupported_dimension'
  | 'unsupported_costing_method'
  | 'stale_generation'
  | 'tafyeet_quantity_mismatch'
  | 'transfer_quantity_mismatch'
  | 'unknown_inventory_account'
  | 'unknown_inventory_operation'
  | 'unsupported_inventory_account_type'
  | 'cost_invariant_failed'
  | 'missing_original_operation'
  | 'over_return'
  | 'unresolved_merchant_cost'
  | 'pending_surplus_cost'
  | 'invalid_manufacturing'
  | 'invalid_snapshot'
  | 'duplicate_opening';

export interface InventoryCostDiagnostic {
  code: InventoryCostDiagnosticCode;
  message: string;
  operationId?: string;
  inventoryAccountId?: string;
}

export interface LegacySameDayOrderingDiagnostic {
  code: 'legacy_same_day_batch_ordering_applied';
  date: string;
  inventoryAccountId: string;
  displayName: string;
  changed: boolean;
  openingOperationIds: string[];
  incomingOperationIds: string[];
  outgoingOperationIds: string[];
  operationIdsBefore: string[];
  operationIdsAfter: string[];
  message: string;
}

export type InventoryCostOperationClassification =
  | 'opening'
  | 'customer_purchase'
  | 'merchant_receipt'
  | 'merchant_delivery'
  | 'merchant_cash_settlement'
  | 'merchant_liability_opening'
  | 'merchant_liability_transfer'
  | 'sale'
  | 'tafyeet'
  | 'transfer'
  | 'shortage'
  | 'surplus'
  | 'two_sided_adjustment'
  | 'quantity_only'
  | 'customer_return'
  | 'supplier_return'
  | 'manufacturing'
  | 'pending_surplus'
  | 'approved_surplus'
  | 'snapshot_opening'
  | 'non_cost';

export interface InventoryCostUnresolvedItem {
  code: 'unresolved_merchant_cost' | 'pending_surplus_cost' | 'unresolved_return_cost';
  operationId: string;
  inventoryAccountId?: string;
  message: string;
  requiredCorrection: string;
}

export interface MerchantGoldLiabilityState {
  merchantAccountId: string;
  standardizedWeightUnits: number;
  physicalWeightUnits: number;
  bookValueMinor: number;
  unresolvedWeightUnits: number;
}

export type HistoricalOverlayOwnerApprovalStatus =
  | 'pending_final_approval'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'superseded';

export interface HistoricalInventoryOverlayDirective {
  overlayId: string;
  stableInventoryAccountId: string;
  effectiveDate: string;
  quantityUnits: number;
  unitBasis: InventoryCostUnitBasis;
  reasonCode: 'historical_inventory_reconciliation';
  sourceDeficitOperationId: string;
  ownerApprovalStatus: HistoricalOverlayOwnerApprovalStatus;
  approvedAt: string | null;
  supersedesOverlayId: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface AppliedHistoricalInventoryOverlay extends HistoricalInventoryOverlayDirective {
  metalCostMinor: number;
  workmanshipCostMinor: number;
  totalCostMinor: number;
  calculationGenerationId: number;
  auditHash: string;
  metalWacBefore: number;
  metalWacAfter: number;
  workmanshipWacBefore: number;
  workmanshipWacAfter: number;
}
export interface OperationCostResultV2 {
  operationId: string;
  classification: InventoryCostOperationClassification;
  inventoryAccountId?: string;
  sourceInventoryAccountId?: string;
  destinationInventoryAccountId?: string;
  incomingStandardizedQuantityUnits: number;
  outgoingStandardizedQuantityUnits: number;
  incomingActualPhysicalWeightUnits: number;
  outgoingActualPhysicalWeightUnits: number;
  incomingAccessoryQuantityUnits: number;
  outgoingAccessoryQuantityUnits: number;
  incomingMetalCostMinor: number;
  incomingWorkmanshipCostMinor: number;
  outgoingMetalCostMinor: number;
  outgoingWorkmanshipCostMinor: number;
  incomingTotalCostMinor: number;
  outgoingTotalCostMinor: number;
  metalCogsMinor: number;
  workmanshipCogsMinor: number;
  totalCogsMinor: number;
  saleAmountMinor: number;
  profitMinor: number | null;
  adjustmentGainMinor: number;
  adjustmentLossMinor: number;
  /** Populated for surplus operations valued from the affected account WAC. */
  wacBeforeMinorPerDisplayUnit?: number | null;
  wacAfterMinorPerDisplayUnit?: number | null;
  revenueReversalMinor: number;
  reversedCogsMinor: number;
  purchaseCostReversalMinor: number;
  merchantLiabilityIncreaseMinor: number;
  merchantLiabilityDecreaseMinor: number;
  merchantSettlementGainMinor: number;
  merchantSettlementLossMinor: number;
  manufacturingConversionCostMinor: number;
  manufacturingAbnormalLossMinor: number;
  originalOperationId?: string;
  costPostingMovements?: Array<{ accountId: string; side: 'debit' | 'credit'; amountMinor: number; role: string }>;
  calculationVersion: typeof INVENTORY_COST_CALCULATION_VERSION;
  entry: Entry;
}

export interface InventoryCostTimeline {
  calculationVersion: typeof INVENTORY_COST_CALCULATION_VERSION;
  orderedOperationIds: string[];
  results: OperationCostResultV2[];
  resultsByOperationId: Record<string, OperationCostResultV2>;
  finalStates: Record<string, InventoryCostState>;
  diagnostics: InventoryCostDiagnostic[];
  orderingDiagnostics: LegacySameDayOrderingDiagnostic[];
  historicalInventoryOverlays: AppliedHistoricalInventoryOverlay[];
  valid: boolean;
  merchantGoldLiabilities: Record<string, MerchantGoldLiabilityState>;
  unresolvedCostData: InventoryCostUnresolvedItem[];
  costDataComplete: boolean;
  completeness?: 'complete' | 'partial';
  excludedAccounts?: Array<{ accountId: string; reason: 'missing_inventory_type' | 'unsupported_dimension' | 'unsupported_costing_method' | 'missing_cost_basis' }>;
  accountValuations?: Record<string, { accountId: string; quantity: number; bookValue: number; averageCost: number | null; valuationStatus: InventoryValuationStatus }>;
  excludedHistoricalOperationIds?: string[];
}

export interface AccessoryOpeningUnitCostConfig {
  [inventoryAccountId: string]: number | string | undefined;
}

export interface Phase5OpeningCostConfig {
  gold21PriceByYearMinor?: Record<string, number | string>;
  silverPriceByYearMinor?: Record<string, number | string>;
  accessoryUnitCostByYearAndAccountMinor?: Record<string, AccessoryOpeningUnitCostConfig>;
}

export type CostRunStatus = 'idle' | 'running' | 'valid' | 'failed';

export interface CostCalculationRun {
  generationId: number;
  inputRevision: string;
  catalogVersion: string;
  startedAt?: string;
  completedAt?: string;
  status: CostRunStatus;
  earliestAffectedOperationId?: string;
  settingsHash?: string;
  error?: InventoryCostDiagnostic;
  timeline?: InventoryCostTimeline;
}
