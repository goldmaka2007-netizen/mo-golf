import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface MetalPricesInput {
  goldPrice: number;
  silverPrice: number;
  goldSpread: number;
  silverSpread: number;
}

export const parseMetalPrice = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
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