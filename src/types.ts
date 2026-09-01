import { User as FirebaseUser } from 'firebase/auth';
import type { GoldEquivalent21LegacyComparison, GoldEquivalent21Snapshot } from './lib/goldEquivalent';

export type { FirebaseUser };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export enum AccountNature {
  UNKNOWN = 0,
  CASH = 1,
  GOLD = 2,
  SILVER = 3,
  MIXED_GOLD = 4,
  MIXED_SILVER = 5,
  ACC = 6
}

export interface Entry {
  id?: string;
  /**
   * Application sequence for newly-created entries.
   * Legacy imported entries intentionally keep this null/absent and retain
   * their original identifiers in the legacy migration fields below.
   */
  seq?: number | null;
  legacyOperationId?: string;
  legacyOperationNo?: string;
  sourceRow?: number;
  sourceFile?: string;
  imported?: boolean;
  importVersion?: string;
  importedAt?: any;
  legacySourceHash?: string;
  tx: string;
  operationKind?: AccountingOperationKind;
  /** Stable Central operation contract identity for new/modified Entries after Cutover. */
  canonicalOperationId?: string;
  canonicalOperationVersion?: number;
  /** Latest explicit correction metadata. Full correction history lives in audit_logs. */
  modifiedAt?: any;
  modifiedBy?: string;
  modificationReason?: string;
  subTx?: string;
  debit: string;
  credit: string;
  debitAccountId?: string;
  creditAccountId?: string;
  /** Immutable legacy labels retained after the ID migration. */
  debitLegacySnapshot?: string;
  creditLegacySnapshot?: string;
  accountMigrationVersion?: number;
  accountMigratedAt?: string;
  date: string;
  cash: string;
  weight: string;
  count: string;
  arabicWeight: string;
  karat?: number;
  multiplier?: number;
  notes: string;
  invoiceNumber?: string;
  operationNo?: string;
  journalNo?: string;
  clientName?: string;
  clientPhone?: string;
  marketPrice?: number;
  /**
   * Immutable official metal price per gram in EGP. For gold this is always
   * the Gold-21 basis applied to E21; for silver it is the Silver-999 basis
   * applied to physical grams. Historical backfill writes only this field.
   */
  invoiceOfficialPricePerGramEgp?: number;
  goldEquivalent21Snapshot?: GoldEquivalent21Snapshot;
  goldEquivalent21LegacyComparison?: GoldEquivalent21LegacyComparison;
  userId: string;
  createdAt?: any;
  isSettled?: boolean;
  inventoryCheckId?: string;
}

export type AccountingOperationKind =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'transfer'
  | 'tifeet'
  | 'adjustment'
  | 'merchant_settlement'
  | 'personal_withdrawal'
  | 'expense'
  | 'other';

export interface CustomRule {
  id?: string;
  t: string;
  d: string;
  c: string;
  k?: number;
  m: number;
  userId: string;
}

export interface TransactionType {
  t: string;
  d: string;
  c: string;
  k: number | null;
  m: number;
}

export interface AccountCategories {
  assets: Record<string, string[]>;
  liabilities: Record<string, string[]>;
  equity: Record<string, string[]>;
  revenue: Record<string, string[]>;
  expenses: Record<string, string[]>;
}

export type AccountType =
  | 'gold_raw'
  | 'gold_product'
  | 'gold_direct'
  | 'silver'
  | 'accessory'
  | 'cash'
  | 'merchant'
  | 'other';

export type CanonicalMainType =
  | 'assets'
  | 'liabilities'
  | 'equity'
  | 'revenue'
  | 'expense';

export type CanonicalAccountSubType =
  | 'inventory_gold'
  | 'inventory_silver'
  | 'inventory_accessory'
  | 'cash'
  | 'fixed_asset'
  | 'customer'
  | 'merchant_gold'
  | 'merchant_silver'
  | 'other_due'
  | 'capital'
  | 'withdrawals'
  | 'retained_earnings'
  | 'revenue'
  | 'expense'
  | 'unclassified';

export type MerchantDirection = 'payable' | 'receivable';
export type ExplicitWeightedMetal = 'gold' | 'silver';

export interface OperationRule {
  affectsInventory: boolean;
  isPurchase: boolean;
  isSale?: boolean;
  hasCash: boolean;
  cashAlwaysZero: boolean;
  isOpening?: boolean;
}

export interface Account {
  id?: string;
  canonicalAccountId?: string;
  name: string;
  mainType: string;
  subType: string;
  /** Normalized classification; legacy Arabic mainType/subType remain readable. */
  canonicalMainType?: CanonicalMainType;
  canonicalSubType?: CanonicalAccountSubType;
  merchantDirection?: MerchantDirection;
  balanceNature: string;
  userId: string;
  type?: AccountType;
  karat?: '18' | '21' | '24' | 'silver' | null;
  metal?: ExplicitWeightedMetal | null;
  is_inventory?: boolean;
  measurementDimension?: 'weight' | 'quantity';
  quantityStep?: number | string;
  isActive?: boolean;
  /** Posting configuration only. Balances are always rebuilt from entries. */
  dimensions?: Array<'cash' | 'gold' | 'silver' | 'quantity' | 'book_value'>;
  accountRole?: 'standard' | 'inventory' | 'sales' | 'cost_of_sales' | 'system' | 'revaluation';
  cloneSourceAccountId?: string;
  linkedInventoryAccountId?: string;
  salesAccountId?: string;
  costOfSalesAccountId?: string;
}

export type AccountingDimension = 'cash' | 'gold' | 'silver';
export type AccountTrackingDimension = AccountingDimension | 'quantity';
export type CanonicalMainGroup = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
export type CanonicalAccountType =
  | 'cash' | 'gold_inventory' | 'silver_inventory' | 'accessory_inventory'
  | 'merchant' | 'customer' | 'debtor' | 'creditor' | 'capital'
  | 'retained_earnings' | 'withdrawals' | 'revenue' | 'expense'
  | 'gold_surplus' | 'gold_shortage' | 'silver_surplus' | 'silver_shortage'
  | 'fixed_asset' | 'adjustment' | 'historical' | 'other';
export type ClassificationSource = 'legacy_code' | 'manual';
export type ReviewStatus = 'discovered' | 'needs_review' | 'reviewed';
export type ApprovalStatus = 'draft' | 'approved' | 'rejected';
export type ReportParticipation = 'incomeStatement' | 'financialPosition' | 'equityStatement' | 'inventoryReports';

export interface ClassificationEvidence {
  source: 'account_document' | 'entry_id' | 'entry_name' | 'migration_data' | 'legacy_rule' | 'manual';
  field?: string;
  value?: string;
  file?: string;
  rule?: string;
}

/** Central account definition used only by the new shadow accounting path. */
export interface CanonicalAccountDefinition {
  id: string;
  entityId: string;
  sourceAccountId?: string;
  userId?: string;
  canonicalName: string;
  displayName: string;
  legacyNames: string[];
  aliases: string[];
  code?: string;
  description?: string;
  entityType: CanonicalAccountType;
  mainGroup: CanonicalMainGroup;
  allowedDimensions: AccountTrackingDimension[];
  normalBalanceByDimension: Record<AccountTrackingDimension, 'debit' | 'credit' | null>;
  metal: 'gold' | 'silver' | 'accessory' | null;
  karat: 18 | 21 | 24 | null;
  trackingMode: 'value' | 'weight' | 'quantity' | 'weight_and_quantity' | 'value_and_weight';
  tracksCash: boolean;
  tracksGold: boolean;
  tracksSilver: boolean;
  tracksQuantity: boolean;
  tracksWeight: boolean;
  tracksValue: boolean;
  tracksCost: boolean;
  isInventory: boolean;
  isMerchant: boolean;
  isHistoricalOnly: boolean;
  isActive: boolean;
  reportParticipation: ReportParticipation[];
  allowedOperationKinds: AccountingOperationKind[];
  classificationSource: ClassificationSource;
  classificationConfidence: number;
  classificationEvidence: ClassificationEvidence[];
  classificationConflicts: string[];
  reviewStatus: ReviewStatus;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  version: number;
  audit: { createdBy: string; updatedBy: string; lastReason?: string };
}

export interface TransactionRule {
  id?: string;
  tx: string;
  debit: string;
  credit: string;
  debitAccountId?: string;
  creditAccountId?: string;
  karat?: number | null;
  multiplier?: number;
  category: string;
  userId: string;
}

export interface InventoryCheck {
  id?: string;
  accountId: string;
  accountDbId?: string;
  date: string;
  systemWeight: number;
  actualWeight: number;
  systemCount: number;
  actualCount: number;
  weightDiff?: number;
  countDiff?: number;
  status?: 'draft' | 'matched' | 'posted' | 'cancelled';
  notes: string;
  userId: string;
  createdAt?: any;
  updatedAt?: any;
  isResolved?: boolean;
  postedEntryId?: string;
  postedAt?: any;
  postedBy?: string;
}

export interface AnnualOpeningCostConfig {
  year: number;
  /** Canonical persisted shape: user-facing EGP values. */
  gold21PriceEgp?: number | string;
  silverPriceEgp?: number | string;
  accessoryOpeningCosts?: Record<string, number | string | undefined>;
  /** Legacy persisted shape: integer minor units. Kept readable for older settings docs. */
  gold21PriceMinorPerGram?: number | string;
  silverPriceMinorPerGram?: number | string;
  accessoryUnitCostMinorByAccountId?: Record<string, number | string | undefined>;
  accessoryOpeningCostsByAccountId?: Record<string, number | string | undefined>;
  accessoryCosts?: Record<string, number | string | undefined>;
  openingCosts?: Record<string, number | string | undefined>;
  unitCosts?: Record<string, number | string | undefined>;
}

export interface Category {
  cat: string;
  items: string[];
}
