export interface FormatNumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  locale?: string;
}

export const EGP_CURRENCY_LABEL = '\u062c.\u0645' as const;

export const formatEgpNumber = (value: number, locale = 'en-US'): string =>
  (Number.isFinite(value) ? value : 0).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const formatEgpAmount = (value: number, maximumFractionDigits = 0): string =>
  `${(Number.isFinite(value) ? value : 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits })} ${EGP_CURRENCY_LABEL}`;

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