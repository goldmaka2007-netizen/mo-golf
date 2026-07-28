export const MONTHLY_DECISION_THRESHOLDS = {
  criticalCashCoverageMonths: 0.5,
  warningCashCoverageMonths: 1,
  inventoryGrowthWarningPercent: 15,
  salesDeclineWarningPercent: -10,
  expenseGrowthWarningPercent: 15,
  marginDeclineWarningPoints: 3,
  merchantLiabilityGrowthWarningPercent: 15,
  strongNetMarginPercent: 8,
  strongCashCoverageMonths: 2,
} as const;
