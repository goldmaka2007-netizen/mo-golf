export type MonthlyMetricStatus = 'available' | 'insufficient_data' | 'unsupported' | 'data_issue';
export type MonthlyMetricUnit = 'currency' | 'gram' | 'gold21' | 'count' | 'percent' | 'operations' | 'months';

export interface MonthlyMetric {
  value: number | null;
  status: MonthlyMetricStatus;
  reason?: string;
}

export interface MonthlyComparison {
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  comparable: boolean;
}

export interface MonthlyKpi {
  id: string;
  label: string;
  unit: MonthlyMetricUnit;
  current: MonthlyMetric;
  comparison: MonthlyComparison;
}

export interface MonthlyInventoryMovement {
  opening: number;
  inflows: number;
  outflows: number;
  adjustments: number;
  internalTransfers: number;
  closing: number;
  unit: 'gram' | 'gold21' | 'count';
}

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  sales: number;
  purchases: number;
  grossProfit: number | null;
  netOperatingProfit: number | null;
  closingCash: number;
  goldInventory21: number;
  merchantGoldLiabilities21: number;
  goldSalesWeight: number;
  operatingExpenses: number;
}

export interface MonthlyDecisionInsight {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  reason: string;
  supportingMetrics: Array<{ label: string; value: number; unit: MonthlyMetricUnit }>;
  suggestedAction: string;
}

export type MonthlyHealthStatus = 'ممتاز' | 'مستقر' | 'يحتاج انتباه' | 'خطر';

export interface MonthlyReportPeriod {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  ytdStartDate: string;
}

export interface MonthlySnapshot {
  month: string;
  hasActivity: boolean;
  sales: number;
  goldSales: number;
  silverSales: number;
  purchases: number;
  goldSalesWeight: number;
  goldSalesWeight21: number;
  silverSalesWeight: number;
  goldPurchaseWeight: number;
  silverPurchaseWeight: number;
  saleCount: number;
  purchaseCount: number;
  workmanshipRevenue: number;
  operatingExpenses: number;
  personalWithdrawals: number;
  cashIn: number;
  cashOut: number;
  openingCash: number;
  closingCash: number;
  cashLiabilities: number;
  cogs: MonthlyMetric;
  grossProfit: MonthlyMetric;
  netOperatingProfit: MonthlyMetric;
  grossMargin: MonthlyMetric;
  netMargin: MonthlyMetric;
  goldInventoryWeight: number;
  goldInventory21: number;
  silverInventoryWeight: number;
  merchantGoldLiabilities21: number;
  merchantSilverLiabilities: number | null;
  netOwnedGold21: number;
  netOwnedSilver: number | null;
  accessoryCount: number;
  accessoryCost: MonthlyMetric;
  goldProfitWeight: number;
  goldProfitWeight21: number;
  silverProfitWeight: number;
  inventory: {
    gold: MonthlyInventoryMovement;
    gold21: MonthlyInventoryMovement;
    silver: MonthlyInventoryMovement;
    accessories: MonthlyInventoryMovement;
    merchantGold: MonthlyInventoryMovement;
    merchantSilver: MonthlyInventoryMovement | null;
  };
}

export interface MonthlyAccountingSummary {
  trialBalance: { cashDifference: number; goldDifference: number; silverDifference: number };
  incomeStatement: { cashRevenue: number; cashExpenses: number; cashNet: number };
  financialPosition: { cashAssets: number; cashLiabilities: number; goldOwned21: number };
  equity: { cashChange: number; goldChange: number; silverChange: number };
}

export interface MonthlyMarketRevaluation {
  status: MonthlyMetricStatus;
  inventoryMarketValue: number | null;
  inventoryBookCost: number | null;
  revaluationDifference: number | null;
  price: number | null;
  source: string | null;
}

export interface MonthlyReportData {
  period: MonthlyReportPeriod;
  current: MonthlySnapshot;
  previous: MonthlySnapshot;
  rolling3: MonthlySnapshot[];
  ytd: MonthlySnapshot;
  trends: MonthlyTrendPoint[];
  kpis: MonthlyKpi[];
  insights: MonthlyDecisionInsight[];
  healthStatus: MonthlyHealthStatus;
  highlights: string[];
  accountingSummary: MonthlyAccountingSummary;
  marketRevaluation: MonthlyMarketRevaluation;
  warnings: string[];
}
