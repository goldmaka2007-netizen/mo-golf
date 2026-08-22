import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const DEFAULT_STORY_GOLD_BUY_SPREAD_EGP = 20;

export const normalizeStoryGoldBuySpreadEgp = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_STORY_GOLD_BUY_SPREAD_EGP
);

export const parseStoryGoldBuySpreadInput = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const calculateStoryGoldBuyPrices = (p21Sell: number, storyGoldBuySpreadEgp: number) => {
  const p21Buy = Math.max(0, p21Sell - storyGoldBuySpreadEgp);
  return {
    p21Buy,
    p24Buy: Math.round((p21Buy / 21) * 24),
    p18Buy: Math.round((p21Buy / 21) * 18),
  };
};

export const saveStoryGoldBuySpreadEgp = async (userId: string, value: number): Promise<void> => {
  const normalized = normalizeStoryGoldBuySpreadEgp(value);
  if (normalized !== value) throw new Error('Invalid Story gold buy spread');
  await setDoc(doc(db, 'settings', userId), { storyGoldBuySpreadEgp: value }, { merge: true });
};
