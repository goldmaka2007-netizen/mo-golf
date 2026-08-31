import type { AccountingOperationKind } from '../types';

export type CanonicalOperationAvailability =
  | 'current_runtime'
  | 'approved_target'
  | 'setup_only'
  | 'historical_only'
  | 'transition_only';

export type CanonicalOperationDomain =
  | 'gold'
  | 'silver'
  | 'accessories'
  | 'customer'
  | 'merchant'
  | 'expense'
  | 'income'
  | 'equity'
  | 'fixed_asset'
  | 'inventory'
  | 'opening';

export type OperationFieldRequirement = 'required' | 'optional' | 'forbidden' | 'account_defined' | 'system';
export type TreasuryPolicy = 'fixed_treasury' | 'none' | 'operation_specific';
export type InventoryEffect = 'increase' | 'decrease' | 'transfer' | 'preserve' | 'adjust' | 'none' | 'operation_specific';
export type FinancialEffectRequirement = 'required' | 'forbidden' | 'operation_specific';

export interface CanonicalOperationFieldPolicy {
  cash: OperationFieldRequirement;
  weight: OperationFieldRequirement;
  quantity: OperationFieldRequirement;
  customer: OperationFieldRequirement;
  merchant: OperationFieldRequirement;
}

export interface CanonicalOperationContract {
  requiresBalancedPosting: boolean;
  requiresInventoryCostTimeline: boolean;
  treasuryPolicy: TreasuryPolicy;
  inventoryEffect: InventoryEffect;
  revenue: FinancialEffectRequirement;
  cogs: FinancialEffectRequirement;
  forbidsMarketPriceAsInventoryCost: boolean;
  preservesHistoricalPostingVersion: boolean;
}

export interface CanonicalOperationDefinition {
  id: string;
  displayName: string;
  aliases: string[];
  version: number;
  operationKind: AccountingOperationKind;
  domain: CanonicalOperationDomain;
  availability: CanonicalOperationAvailability;
  userSelectable: boolean;
  systemGenerated: boolean;
  accountRoles: string[];
  fieldPolicy: CanonicalOperationFieldPolicy;
  contract: CanonicalOperationContract;
  decisionSource: string;
}

const fields = (
  cash: OperationFieldRequirement,
  weight: OperationFieldRequirement,
  quantity: OperationFieldRequirement,
  customer: OperationFieldRequirement = 'forbidden',
  merchant: OperationFieldRequirement = 'forbidden',
): CanonicalOperationFieldPolicy => ({ cash, weight, quantity, customer, merchant });

const contract = (
  treasuryPolicy: TreasuryPolicy,
  inventoryEffect: InventoryEffect,
  options: Partial<Pick<CanonicalOperationContract, 'requiresInventoryCostTimeline' | 'revenue' | 'cogs' | 'forbidsMarketPriceAsInventoryCost'>> = {},
): CanonicalOperationContract => ({
  requiresBalancedPosting: true,
  requiresInventoryCostTimeline: options.requiresInventoryCostTimeline ?? false,
  treasuryPolicy,
  inventoryEffect,
  revenue: options.revenue ?? 'forbidden',
  cogs: options.cogs ?? 'forbidden',
  forbidsMarketPriceAsInventoryCost: options.forbidsMarketPriceAsInventoryCost ?? inventoryEffect !== 'none',
  preservesHistoricalPostingVersion: true,
});

/**
 * Versioned, read-only operation catalog for the Central Accounting Registry.
 *
 * This catalog describes approved operation identity and invariants only. It is
 * intentionally NOT connected to EntryForm/save persistence in Phase 1 and it
 * does not replace Posting Matrix, WAC/COGS, Balance Engine, or historical data.
 */
export const CANONICAL_OPERATION_CATALOG: readonly CanonicalOperationDefinition[] = [
  {
    id: 'opening.entry', displayName: 'قيد افتتاحي',
    aliases: ['قيد افتتاحي', 'رصيد افتتاحي ذهب', 'رصيد افتتاحي فضة', 'رصيد افتتاحي ملحقات', 'رصيد افتتاحي نقدي', 'رصيد افتتاحي تاجر', 'رصيد افتتاحي عميل'],
    version: 1, operationKind: 'opening', domain: 'opening', availability: 'setup_only', userSelectable: true, systemGenerated: false,
    accountRoles: ['opening_target', 'opening_equity_counterpart'], fieldPolicy: fields('account_defined', 'account_defined', 'account_defined'),
    contract: contract('operation_specific', 'increase', { requiresInventoryCostTimeline: true }),
    decisionSource: 'D-005/D-012 + owner-approved Central Registry Grill 2026-08-31',
  },
  {
    id: 'sale.gold', displayName: 'بيع ذهب', aliases: ['بيع ذهب'], version: 1, operationKind: 'sale', domain: 'gold', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['treasury', 'gold_inventory_item', 'gold_sales_revenue', 'gold_cogs'], fieldPolicy: fields('required', 'required', 'account_defined'),
    contract: contract('fixed_treasury', 'decrease', { requiresInventoryCostTimeline: true, revenue: 'required', cogs: 'required', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-008/D-009 + owner-approved Central Registry Grill 2026-08-31',
  },
  {
    id: 'sale.silver', displayName: 'بيع فضة', aliases: ['بيع فضة'], version: 1, operationKind: 'sale', domain: 'silver', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['treasury', 'silver_inventory_item', 'silver_sales_revenue', 'silver_cogs'], fieldPolicy: fields('required', 'required', 'account_defined'),
    contract: contract('fixed_treasury', 'decrease', { requiresInventoryCostTimeline: true, revenue: 'required', cogs: 'required', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-008/D-009 + owner-approved Central Registry Grill 2026-08-31',
  },
  {
    id: 'sale.accessories', displayName: 'بيع ملحقات', aliases: ['بيع ملحقات'], version: 1, operationKind: 'sale', domain: 'accessories', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['treasury', 'accessory_inventory_item', 'accessory_sales_revenue', 'accessory_cogs'], fieldPolicy: fields('required', 'forbidden', 'required'),
    contract: contract('fixed_treasury', 'decrease', { requiresInventoryCostTimeline: true, revenue: 'required', cogs: 'required', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-008/D-009 + owner-approved Central Registry Grill 2026-08-31',
  },
  {
    id: 'purchase.gold', displayName: 'شراء ذهب', aliases: ['شراء ذهب'], version: 1, operationKind: 'purchase', domain: 'gold', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['gold_inventory_item', 'treasury'], fieldPolicy: fields('required', 'required', 'account_defined'),
    contract: contract('fixed_treasury', 'increase', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-008 + owner-approved Central Registry Grill 2026-08-31',
  },
  {
    id: 'purchase.silver', displayName: 'شراء فضة', aliases: ['شراء فضة'], version: 1, operationKind: 'purchase', domain: 'silver', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['silver_inventory_item', 'treasury'], fieldPolicy: fields('required', 'required', 'account_defined'),
    contract: contract('fixed_treasury', 'increase', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-008 + owner-approved Central Registry Grill 2026-08-31',
  },
  {
    id: 'purchase.accessories', displayName: 'شراء ملحقات', aliases: ['شراء ملحقات'], version: 1, operationKind: 'purchase', domain: 'accessories', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['accessory_inventory_item', 'treasury'], fieldPolicy: fields('required', 'forbidden', 'required'),
    contract: contract('fixed_treasury', 'increase', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-008 + owner-approved Central Registry Grill 2026-08-31',
  },
  {
    id: 'merchant.receipt.gold', displayName: 'تاجر ذهب', aliases: ['تاجر ذهب'], version: 1, operationKind: 'purchase', domain: 'merchant', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['gold_inventory_item', 'gold_merchant_account'], fieldPolicy: fields('optional', 'required', 'account_defined', 'forbidden', 'required'),
    contract: contract('operation_specific', 'increase', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-017 + owner-approved Merchant/Operations Grill 2026-08-31',
  },
  {
    id: 'merchant.settlement.gold', displayName: 'حساب تاجر ذهب', aliases: ['حساب تاجر ذهب'], version: 1, operationKind: 'merchant_settlement', domain: 'merchant', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['gold_merchant_account', 'approved_settlement_source'], fieldPolicy: fields('optional', 'optional', 'forbidden', 'forbidden', 'required'),
    contract: contract('operation_specific', 'operation_specific', { requiresInventoryCostTimeline: true, revenue: 'operation_specific', cogs: 'forbidden', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-017 + owner-approved Merchant/Operations Grill 2026-08-31',
  },
  {
    id: 'merchant.receipt.silver', displayName: 'تاجر فضة', aliases: ['تاجر فضة'], version: 1, operationKind: 'purchase', domain: 'merchant', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['silver_inventory_item', 'silver_merchant_account'], fieldPolicy: fields('optional', 'required', 'account_defined', 'forbidden', 'required'),
    contract: contract('operation_specific', 'increase', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-017 + owner-approved Merchant/Operations Grill 2026-08-31',
  },
  {
    id: 'merchant.settlement.silver', displayName: 'حساب تاجر فضة', aliases: ['حساب تاجر فضة'], version: 1, operationKind: 'merchant_settlement', domain: 'merchant', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['silver_merchant_account', 'approved_settlement_source'], fieldPolicy: fields('optional', 'optional', 'forbidden', 'forbidden', 'required'),
    contract: contract('operation_specific', 'operation_specific', { requiresInventoryCostTimeline: true, revenue: 'operation_specific', cogs: 'forbidden', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-017 + owner-approved Merchant/Operations Grill 2026-08-31',
  },
  {
    id: 'merchant.transfer', displayName: 'حوالة', aliases: ['حوالة'], version: 1, operationKind: 'transfer', domain: 'merchant', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['merchant_source', 'merchant_destination'], fieldPolicy: fields('forbidden', 'required', 'forbidden', 'forbidden', 'required'),
    contract: contract('none', 'preserve', { requiresInventoryCostTimeline: false, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'D-017 + owner-approved Merchant/Operations Grill 2026-08-31',
  },
  {
    id: 'customer.receipt', displayName: 'قبض من عميل', aliases: ['قبض من عميل'], version: 1, operationKind: 'other', domain: 'customer', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['treasury', 'customer_account'], fieldPolicy: fields('required', 'forbidden', 'forbidden', 'required'),
    contract: contract('fixed_treasury', 'none', { forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'Owner-approved Customer Grill 2026-08-31',
  },
  {
    id: 'customer.payment', displayName: 'دفع لعميل', aliases: ['دفع لعميل'], version: 1, operationKind: 'other', domain: 'customer', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['customer_account', 'treasury'], fieldPolicy: fields('required', 'forbidden', 'forbidden', 'required'),
    contract: contract('fixed_treasury', 'none', { forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'Owner-approved Customer Grill 2026-08-31',
  },
  {
    id: 'expense.operating', displayName: 'م ت', aliases: ['م ت'], version: 1, operationKind: 'expense', domain: 'expense', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['operating_expense_leaf', 'treasury'], fieldPolicy: fields('required', 'forbidden', 'forbidden'),
    contract: contract('fixed_treasury', 'none', { forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'Owner-approved Expense Grill 2026-08-31',
  },
  {
    id: 'expense.general_admin', displayName: 'م ا ع', aliases: ['م ا ع'], version: 1, operationKind: 'expense', domain: 'expense', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['general_admin_expense_leaf', 'treasury'], fieldPolicy: fields('required', 'forbidden', 'forbidden'),
    contract: contract('fixed_treasury', 'none', { forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'Owner-approved Expense Grill 2026-08-31',
  },
  {
    id: 'income.other', displayName: 'ايرادات اخري', aliases: ['ايرادات اخري'], version: 1, operationKind: 'other', domain: 'income', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['treasury', 'other_income_leaf'], fieldPolicy: fields('required', 'forbidden', 'forbidden'),
    contract: contract('fixed_treasury', 'none', { revenue: 'required', forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'Owner-approved Expense/Other Income Grill 2026-08-31',
  },
  {
    id: 'equity.withdrawal', displayName: 'مسحوبات', aliases: ['مسحوبات'], version: 1, operationKind: 'personal_withdrawal', domain: 'equity', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['withdrawals', 'treasury'], fieldPolicy: fields('required', 'forbidden', 'forbidden'),
    contract: contract('fixed_treasury', 'none', { forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'D-020 + owner-approved Equity Grill 2026-08-31',
  },
  {
    id: 'asset.purchase.fixed', displayName: 'شراء اصل', aliases: ['شراء اصل'], version: 1, operationKind: 'other', domain: 'fixed_asset', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['fixed_asset_leaf', 'treasury'], fieldPolicy: fields('required', 'forbidden', 'forbidden'),
    contract: contract('fixed_treasury', 'none', { forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'Owner-approved Fixed Asset Grill 2026-08-31',
  },
  {
    id: 'inventory.transfer', displayName: 'تحويل', aliases: ['تحويل'], version: 1, operationKind: 'transfer', domain: 'inventory', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['inventory_source_same_karat', 'inventory_destination_same_karat'], fieldPolicy: fields('forbidden', 'required', 'account_defined'),
    contract: contract('none', 'transfer', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'Owner-approved Inventory Transfer Grill 2026-08-31',
  },
  {
    id: 'inventory.tifeet', displayName: 'تيفيت', aliases: ['تيفيت'], version: 1, operationKind: 'tifeet', domain: 'inventory', availability: 'current_runtime', userSelectable: true, systemGenerated: false,
    accountRoles: ['gold_scrap_source_same_karat', 'gold_finished_destination_same_karat'], fieldPolicy: fields('forbidden', 'required', 'account_defined'),
    contract: contract('none', 'transfer', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'Owner-approved Tifeet Grill 2026-08-31',
  },
  {
    id: 'inventory.adjustment.legacy', displayName: 'تسوية', aliases: ['تسوية'], version: 1, operationKind: 'adjustment', domain: 'inventory', availability: 'transition_only', userSelectable: true, systemGenerated: false,
    accountRoles: ['inventory_item', 'inventory_adjustment_counterpart'], fieldPolicy: fields('optional', 'account_defined', 'account_defined'),
    contract: contract('operation_specific', 'adjust', { requiresInventoryCostTimeline: true, revenue: 'operation_specific', cogs: 'forbidden', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'Current Production compatibility + owner-approved split target 2026-08-31',
  },
  {
    id: 'inventory.adjustment.shortage', displayName: 'تسوية عجز', aliases: ['تسوية عجز'], version: 1, operationKind: 'adjustment', domain: 'inventory', availability: 'current_runtime', userSelectable: false, systemGenerated: true,
    accountRoles: ['inventory_shortage_loss', 'inventory_item'], fieldPolicy: fields('system', 'account_defined', 'account_defined'),
    contract: contract('none', 'decrease', { requiresInventoryCostTimeline: true, revenue: 'forbidden', cogs: 'forbidden', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'Owner-approved Inventory Adjustment Grill 2026-08-31',
  },
  {
    id: 'inventory.adjustment.surplus', displayName: 'تسوية زيادة', aliases: ['تسوية زيادة'], version: 1, operationKind: 'adjustment', domain: 'inventory', availability: 'current_runtime', userSelectable: false, systemGenerated: true,
    accountRoles: ['inventory_item', 'inventory_surplus_gain'], fieldPolicy: fields('system', 'account_defined', 'account_defined'),
    contract: contract('none', 'increase', { requiresInventoryCostTimeline: true, revenue: 'required', cogs: 'forbidden', forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'Owner-approved Inventory Adjustment Grill 2026-08-31',
  },
  {
    id: 'merchant.workmanship.payment.legacy', displayName: 'دفع مصنعية', aliases: ['دفع مصنعية'], version: 1, operationKind: 'other', domain: 'merchant', availability: 'historical_only', userSelectable: false, systemGenerated: false,
    accountRoles: ['merchant_workmanship_balance', 'treasury'], fieldPolicy: fields('required', 'forbidden', 'forbidden', 'forbidden', 'required'),
    contract: contract('fixed_treasury', 'none', { forbidsMarketPriceAsInventoryCost: false }),
    decisionSource: 'Legacy compatibility only; not promoted as a new approved visible operation',
  },
  {
    id: 'return.gold.legacy', displayName: 'مرتجع ذهب', aliases: ['مرتجع ذهب'], version: 1, operationKind: 'purchase', domain: 'gold', availability: 'historical_only', userSelectable: false, systemGenerated: false,
    accountRoles: ['gold_inventory_item', 'treasury'], fieldPolicy: fields('required', 'required', 'account_defined'),
    contract: contract('fixed_treasury', 'increase', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'Owner decision 2026-08-31: legacy-only, not part of current/new operation set',
  },
  {
    id: 'return.silver.legacy', displayName: 'مرتجع فضة', aliases: ['مرتجع فضة'], version: 1, operationKind: 'purchase', domain: 'silver', availability: 'historical_only', userSelectable: false, systemGenerated: false,
    accountRoles: ['silver_inventory_item', 'treasury'], fieldPolicy: fields('required', 'required', 'account_defined'),
    contract: contract('fixed_treasury', 'increase', { requiresInventoryCostTimeline: true, forbidsMarketPriceAsInventoryCost: true }),
    decisionSource: 'Owner decision 2026-08-31: legacy-only, not part of current/new operation set',
  },
] as const;

const normalizeOperationLabel = (value: string | undefined): string => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');

export type CanonicalOperationResolution =
  | { status: 'resolved'; operation: CanonicalOperationDefinition }
  | { status: 'unknown'; label: string }
  | { status: 'ambiguous'; label: string; operations: CanonicalOperationDefinition[] };

export const buildCanonicalOperationAliasIndex = (
  catalog: readonly CanonicalOperationDefinition[] = CANONICAL_OPERATION_CATALOG,
): Map<string, CanonicalOperationDefinition[]> => {
  const index = new Map<string, CanonicalOperationDefinition[]>();
  catalog.forEach(operation => {
    [...operation.aliases, operation.displayName].forEach(alias => {
      const key = normalizeOperationLabel(alias);
      if (!key) return;
      const bucket = index.get(key) ?? [];
      if (!bucket.some(item => item.id === operation.id)) bucket.push(operation);
      index.set(key, bucket);
    });
  });
  return index;
};

export const resolveCanonicalOperationLabel = (
  label: string | undefined,
  catalog: readonly CanonicalOperationDefinition[] = CANONICAL_OPERATION_CATALOG,
): CanonicalOperationResolution => {
  const normalized = normalizeOperationLabel(label);
  const matches = buildCanonicalOperationAliasIndex(catalog).get(normalized) ?? [];
  if (matches.length === 1) return { status: 'resolved', operation: matches[0] };
  if (matches.length > 1) return { status: 'ambiguous', label: normalized, operations: matches };
  return { status: 'unknown', label: normalized };
};

export const validateCanonicalOperationCatalog = (
  catalog: readonly CanonicalOperationDefinition[] = CANONICAL_OPERATION_CATALOG,
): string[] => {
  const issues: string[] = [];
  const ids = new Map<string, number>();
  catalog.forEach(operation => {
    ids.set(operation.id, (ids.get(operation.id) ?? 0) + 1);
    if (!operation.id.trim()) issues.push('operation id is required');
    if (!operation.displayName.trim()) issues.push(`${operation.id}: displayName is required`);
    if (!Number.isInteger(operation.version) || operation.version < 1) issues.push(`${operation.id}: version must be >= 1`);
    if (operation.aliases.length === 0) issues.push(`${operation.id}: at least one alias is required`);
    if (operation.availability === 'historical_only' && operation.userSelectable) issues.push(`${operation.id}: historical-only operation cannot be user-selectable`);
    if (operation.contract.treasuryPolicy === 'fixed_treasury' && operation.fieldPolicy.cash === 'forbidden') issues.push(`${operation.id}: fixed treasury operation cannot forbid cash`);
  });
  ids.forEach((count, id) => { if (count > 1) issues.push(`duplicate operation id: ${id}`); });
  buildCanonicalOperationAliasIndex(catalog).forEach((matches, alias) => {
    if (matches.length > 1) issues.push(`ambiguous operation alias: ${alias} -> ${matches.map(item => item.id).join(',')}`);
  });
  return issues;
};
