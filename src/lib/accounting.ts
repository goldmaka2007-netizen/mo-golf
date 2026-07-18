/**
 * Accounting Utilities for Gold & Silver Shop
 */

export const MULTIPLIERS = {
  K18: 0.857142857,
  K21: 1,
  K24: 1.142857143,
  SILVER: 1
};

/**
 * Calculates Arabic Weight (Grade 21 equivalent)
 */
export function calculateArabicWeight(weight: string | number, multiplier: number | null | undefined): string {
  if (!weight) return "";
  const normalized = typeof weight === 'string' ? normalizeNumerals(weight) : weight;
  const n = typeof normalized === 'string' ? parseFloat(normalized) : normalized;
  const m = multiplier || 1;
  return isNaN(n) ? "" : (n * m).toFixed(2);
}

/**
 * Normalizes Eastern Arabic numerals and separators to Western Arabic numerals
 */
export function normalizeNumerals(val: string): string {
  if (!val) return "";
  // 1. Base digits
  let res = val.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  // 2. Arabic decimal separator
  res = res.replace(/٫/g, '.');
  // 3. Common comma used as decimal
  res = res.replace(/,/g, '.');
  // 4. Arabic comma
  res = res.replace(/،/g, '.');
  return res;
}

/**
 * Formats currency in EGP
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * Calculates price for a specific karat based on 21k market price
 */
export function calculateKaratPrice(base21Price: number, multiplier: number): number {
  return Math.round(base21Price * multiplier);
}

/**
 * Safely parses weight to float, handling Arabic numerals and separators
 */
export function parseWeight(w: string | number | undefined): number {
  if (w === undefined) return 0;
  if (typeof w === 'number') return w;
  const normalized = normalizeNumerals(w);
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}
