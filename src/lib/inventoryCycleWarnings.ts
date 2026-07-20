import type { InventoryCycleTab, InventoryCycleWarning, WarningSeverity } from './inventoryCycleReport';

export type WarningStatus = 'active' | 'reviewed';

export interface InventoryWarningTypeConfig {
  typeCode: string;
  label: string;
  enabled: boolean;
  severity: WarningSeverity;
}

export interface InventoryWarningReviewRecord {
  warningId: string;
  status: 'reviewed';
  reviewedAt: string;
  acceptedAsIs: boolean;
  typeCode: string;
  typeLabel: string;
  severityAtReview: WarningSeverity;
  accountId?: string;
  accountName?: string;
  operationId?: string;
  operationNumber?: string;
  date?: string;
  description: string;
}

export interface InventoryWarningState {
  configs: Record<string, InventoryWarningTypeConfig>;
  reviews: Record<string, InventoryWarningReviewRecord>;
}

export const DEFAULT_WARNING_CONFIGS: Record<string, InventoryWarningTypeConfig> = {
  missing_opening_cost: { typeCode: 'missing_opening_cost', label: 'تكلفة الافتتاح غير متاحة', enabled: true, severity: 'medium' },
  missing_cost_basis: { typeCode: 'missing_cost_basis', label: 'تكلفة غير متاحة', enabled: true, severity: 'medium' },
  insufficient_inventory: { typeCode: 'insufficient_inventory', label: 'خروج أكبر من الرصيد', enabled: true, severity: 'critical' },
  invalid_operation: { typeCode: 'invalid_operation', label: 'بيانات عملية غير مكتملة', enabled: true, severity: 'critical' },
  quantity_mismatch: { typeCode: 'quantity_mismatch', label: 'عدم اتساق الكمية', enabled: true, severity: 'critical' },
  negative_balance: { typeCode: 'negative_balance', label: 'رصيد سالب', enabled: true, severity: 'critical' },
  unusual_average_cost_jump: { typeCode: 'unusual_average_cost_jump', label: 'قفزة غير معتادة في متوسط التكلفة', enabled: true, severity: 'info' },
  unusual_margin: { typeCode: 'unusual_margin', label: 'هامش ربح غير معتاد', enabled: true, severity: 'info' },
  large_revaluation: { typeCode: 'large_revaluation', label: 'فرق تقييم سوقي كبير', enabled: true, severity: 'info' },
};

const storageKey = (userKey: string) => `inventory-cycle-warning-state-${userKey || 'local'}`;

export const createDefaultWarningState = (): InventoryWarningState => ({
  configs: { ...DEFAULT_WARNING_CONFIGS },
  reviews: {},
});

export const normalizeWarningState = (state?: Partial<InventoryWarningState> | null): InventoryWarningState => ({
  configs: { ...DEFAULT_WARNING_CONFIGS, ...(state?.configs ?? {}) },
  reviews: state?.reviews ?? {},
});

export const loadInventoryWarningState = (userKey = 'local'): InventoryWarningState => {
  if (typeof localStorage === 'undefined') return createDefaultWarningState();
  try {
    return normalizeWarningState(JSON.parse(localStorage.getItem(storageKey(userKey)) || 'null'));
  } catch {
    return createDefaultWarningState();
  }
};

export const saveInventoryWarningState = (state: InventoryWarningState, userKey = 'local') => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(storageKey(userKey), JSON.stringify(normalizeWarningState(state)));
};

export const applyWarningState = (
  warnings: InventoryCycleWarning[],
  state: InventoryWarningState,
  tab: InventoryCycleTab,
): { active: InventoryCycleWarning[]; reviewed: InventoryWarningReviewRecord[] } => {
  if (tab === 'accessory') return { active: warnings, reviewed: [] };
  const normalized = normalizeWarningState(state);
  const active = warnings
    .map(warning => {
      const config = normalized.configs[warning.typeCode || warning.type] ?? DEFAULT_WARNING_CONFIGS[warning.typeCode || warning.type];
      if (!config?.enabled) return null;
      return { ...warning, type: config.label, severity: config.severity, status: 'active' as WarningStatus };
    })
    .filter((warning): warning is InventoryCycleWarning & { status: 'active' } => !!warning && !normalized.reviews[warning.id]);

  const activeIds = new Set(warnings.map(w => w.id));
  const reviewed = Object.values(normalized.reviews)
    .filter(review => activeIds.has(review.warningId) || review.status === 'reviewed')
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));

  return { active, reviewed };
};

export const markWarningReviewed = (
  state: InventoryWarningState,
  warning: InventoryCycleWarning,
  reviewedAt = new Date().toISOString(),
): InventoryWarningState => {
  const normalized = normalizeWarningState(state);
  const config = normalized.configs[warning.typeCode || warning.type] ?? DEFAULT_WARNING_CONFIGS[warning.typeCode || warning.type];
  return {
    configs: normalized.configs,
    reviews: {
      ...normalized.reviews,
      [warning.id]: {
        warningId: warning.id,
        status: 'reviewed',
        reviewedAt,
        acceptedAsIs: true,
        typeCode: warning.typeCode || warning.type,
        typeLabel: config?.label ?? warning.type,
        severityAtReview: config?.severity ?? warning.severity,
        accountId: warning.accountId,
        accountName: warning.accountName,
        operationId: warning.operationId,
        operationNumber: warning.operationNumber,
        date: warning.date,
        description: warning.description,
      },
    },
  };
};

export const updateWarningTypeConfig = (
  state: InventoryWarningState,
  typeCode: string,
  patch: Partial<Pick<InventoryWarningTypeConfig, 'enabled' | 'severity'>>,
): InventoryWarningState => {
  const normalized = normalizeWarningState(state);
  const current = normalized.configs[typeCode] ?? DEFAULT_WARNING_CONFIGS[typeCode] ?? { typeCode, label: typeCode, enabled: true, severity: 'info' as WarningSeverity };
  return { ...normalized, configs: { ...normalized.configs, [typeCode]: { ...current, ...patch } } };
};

