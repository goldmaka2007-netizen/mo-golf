import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface MetalPricesInput {
  goldPrice: number;
  silverPrice: number;
  goldSpread: number;
  silverSpread: number;
}

const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩';
const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

/** Normalize display text without coercing an empty draft or imposing a saved value. */
export const normalizeMetalPriceInput = (value: string): string => value
  .replace(/[٠-٩]/g, digit => String(arabicIndicDigits.indexOf(digit)))
  .replace(/[۰-۹]/g, digit => String(persianDigits.indexOf(digit)))
  .replace(/[٫,،]/g, '.');

export const parseMetalPrice = (value: string): number | null => {
  const normalized = normalizeMetalPriceInput(value).trim();
  if (normalized === '' || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const saveMetalPrices = async (userId: string, prices: MetalPricesInput): Promise<void> => {
  await setDoc(doc(db, 'settings', userId), {
    goldPrice: prices.goldPrice,
    goldBuyPrice: prices.goldPrice - prices.goldSpread,
    goldSpread: prices.goldSpread,
    silverPrice: prices.silverPrice,
    silverBuyPrice: prices.silverPrice - prices.silverSpread,
    silverSpread: prices.silverSpread,
  }, { merge: true });
};
