import type { Entry } from '../types';

export const INVENTORY_COST_CALCULATION_VERSION = 'phase5-wac-v1' as const;

export type InventoryCostTaxonomyKey =
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
}

export interface InventoryCostState {
  inventoryAccountId: string;
  taxonomyKey: InventoryCostTaxonomyKey;
  displayName: string;
  kind: InventoryCostKind;
  unitBasis: InventoryCostUnitBasis;
  standardizedQuantityUnits: number;
  actualPhysicalWeightUnits: number;
  accessoryQuantityUnits: number;
  remainingMetalCostMinor: number;
  remainingWorkmanshipCostMinor: number;
  remainingAccessoryCostMinor: number;
  remainingTotalCostMinor: number;
  metalWacMinorPerStandardUnit: number | null;
  workmanshipWacMinorPerPhysicalUnit: number | null;
  totalWacMinorPerDisplayUnit: number | null;
  hasReliableCostBasis: boolean;
  lastProcessedOperationId?: string;
  calculationVersion: typeof INVENTORY_COST_CALCULATION_VERSION;
}

export type InventoryCostDiagnosticCode =
  | 'duplicate_operation'
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
  | 'stale_generation'
  | 'tafyeet_quantity_mismatch'
  | 'transfer_quantity_mismatch'
  | 'unknown_inventory_account'
  | 'unknown_inventory_operation'
  | 'unsupported_inventory_account_type';

export interface InventoryCostDiagnostic {
  code: InventoryCostDiagnosticCode;
  message: string;
  operationId?: string;
  inventoryAccountId?: string;
}

export type InventoryCostOperationClassification =
  | 'opening'
  | 'customer_purchase'
  | 'merchant_receipt'
  | 'merchant_delivery'
  | 'sale'
  | 'tafyeet'
  | 'transfer'
  | 'shortage'
  | 'surplus'
  | 'two_sided_adjustment'
  | 'quantity_only'
  | 'non_cost';

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
  valid: boolean;
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
