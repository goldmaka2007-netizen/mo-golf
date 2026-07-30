/**
 * Accounting Utilities for Gold & Silver Shop
 */

import { calculateGoldEquivalent21, inferGoldKaratFromMultiplier } from './goldEquivalent';

export const MULTIPLIERS = {
  K18: 0.857142857,
  K21: 1,
  K24: 1.142857143,
  SILVER: 1
};

/**
 * Calculates Arabic Weight (Grade 21 equivalent) through the centigram-safe engine.
 */
export function calculateArabicWeight(weight: string | number, multiplier: number | null | undefined, karat?: string | number | null): string {
  if (!weight) return "";
  const inferredKarat = karat ?? inferGoldKaratFromMultiplier(multiplier) ?? 21;
  try {
    return calculateGoldEquivalent21(weight, inferredKarat).equivalent21;
  } catch {
    return "";
  }
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
  // Accept common fractional input such as `.25` as `0.25`.
  res = res.replace(/^([+-]?)\./, '$10.');
  return res;
}

/**
 * Formats currency in EGP
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Formats a displayed cash value without piasters.
 *
 * This is intentionally a presentation-only rule. Stored and calculated
 * accounting values keep their original precision.
 */
export function formatCashAmount(amount: number, locale: string = 'ar-EG'): string {
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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
