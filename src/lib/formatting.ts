export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  locale?: string;
}

export const formatDecimal = (value: number, digits = 2, locale = 'en-US'): string =>
  (Number.isFinite(value) ? value : 0).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });

export const formatWeight = (value: number, digits = 2, includeUnit = false): string => {
  const formatted = formatDecimal(value, digits);
  return includeUnit ? `${formatted} جم` : formatted;
};

export const formatQuantity = (value: number, digits = 3): string => formatDecimal(value, digits);
export const formatPercent = (value: number, digits = 1): string => `${formatDecimal(value, digits)}%`;
export const roundToInteger = (value: number): number => Math.round(value);
export const formatInteger = (value: number, locale = 'en-US'): string => (Number.isFinite(value) ? value : 0).toLocaleString(locale, { maximumFractionDigits: 0 });
export const toMinorUnits = (value: number): number => Number((value * 100).toFixed(0));