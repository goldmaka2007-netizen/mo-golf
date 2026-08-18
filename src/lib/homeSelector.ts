import type { Account, Entry } from '../types';
import { computeAccountBalances } from './engine';

export interface HomeOperationalSnapshot {
  treasuryCash: number;
  goldInventory21: number;
  merchantGoldLiabilities21: number;
  netOwnedGold21: number;
}

/** Lightweight operational read model; it intentionally does not build reports or projections. */
export const buildHomeOperationalSnapshot = (entries: Entry[], accounts: Account[]): HomeOperationalSnapshot => {
  const balances = computeAccountBalances(entries, accounts).balances.values();
  let treasuryCash = 0;
  let goldInventory21 = 0;
  let merchantGoldLiabilities21 = 0;

  for (const balance of balances) {
    if (balance.mainType === 'assets' && balance.subType === 'cash') treasuryCash += balance.cashBalance;
    if (balance.subType === 'inventory_gold') goldInventory21 += balance.goldE21Balance;
    if (balance.mainType === 'liabilities' && balance.metal === 'gold') {
      merchantGoldLiabilities21 += balance.goldE21Balance;
    }
  }

  return {
    treasuryCash,
    goldInventory21,
    merchantGoldLiabilities21,
    netOwnedGold21: goldInventory21 - merchantGoldLiabilities21,
  };
};
