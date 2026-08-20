/** Presentation-only zero hiding. Monetary accounting is never recalculated here. */
export const isFinancialPositionRowVisible = (egp: number, meaningfulMetalWeight = 0): boolean =>
  egp !== 0 || meaningfulMetalWeight !== 0;
