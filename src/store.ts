import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Entry, FirebaseUser, AccountCategories, Account, TransactionRule, CustomRule, InventoryCheck } from './types';
import { ACCOUNT_CATEGORIES } from './constants';

interface AppState {
  user: FirebaseUser | null;
  setUser: (user: FirebaseUser | null) => void;
  
  isAuthReady: boolean;
  setIsAuthReady: (ready: boolean) => void;

  entries: Entry[];
  setEntries: (entries: Entry[]) => void;

  inventoryChecks: InventoryCheck[];
  setInventoryChecks: (checks: InventoryCheck[]) => void;

  customRules: CustomRule[];
  setCustomRules: (rules: CustomRule[]) => void;

  accountsDb: Account[];
  setAccountsDb: (accounts: Account[]) => void;

  transactionRules: TransactionRule[];
  setTransactionRules: (rules: TransactionRule[]) => void;

  goldPrice: number;
  setGoldPrice: (price: number) => void;

  goldBuyPrice: number;
  setGoldBuyPrice: (price: number) => void;

  goldSpread: number;
  setGoldSpread: (spread: number) => void;

  silverPrice: number;
  setSilverPrice: (price: number) => void;

  silverBuyPrice: number;
  setSilverBuyPrice: (price: number) => void;

  silverSpread: number;
  setSilverSpread: (spread: number) => void;

  goldKarat: 18 | 21;
  setGoldKarat: (karat: 18 | 21) => void;

  view: 'home' | 'entry' | 'database' | 'reports' | 'settings' | 'journal' | 'guide' | 'inventory' | 'story' | 'profit-analysis' | 'advanced-analytics' | 'more';
  setView: (view: 'home' | 'entry' | 'database' | 'reports' | 'settings' | 'journal' | 'guide' | 'inventory' | 'story' | 'profit-analysis' | 'advanced-analytics' | 'more') => void;

  printEntry: Entry | null;
  setPrintEntry: (entry: Entry | null) => void;

  reportsTab: 'ledger' | 'trial' | 'income' | 'equity' | 'balance' | 'inventory' | 'final' | 'scrap' | 'monthly' | 'lifecycle' | 'profit-analysis' | 'advanced-analytics';
  setReportsTab: (tab: 'ledger' | 'trial' | 'income' | 'equity' | 'balance' | 'inventory' | 'final' | 'scrap' | 'monthly' | 'lifecycle' | 'profit-analysis' | 'advanced-analytics') => void;

  globalError: string | null;
  setGlobalError: (error: string | null) => void;

  isUpdatingPrice: boolean;
  setIsUpdatingPrice: (isUpdating: boolean) => void;

  editingEntry: Partial<Entry> | null;
  setEditingEntry: (entry: Partial<Entry> | null) => void;

  bullionCharges: Record<number, number>;
  setBullionCharges: (charges: Record<number, number>) => void;

  coinCharges: Record<number, number>;
  setCoinCharges: (charges: Record<number, number>) => void;

  accountCategories: AccountCategories;
  setAccountCategories: (categories: AccountCategories) => void;

  accounts: {
    assets: string[];
    liabilities: string[];
    equity: string[];
    revenue: string[];
    expenses: string[];
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),

  isAuthReady: false,
  setIsAuthReady: (isAuthReady) => set({ isAuthReady }),

  entries: [],
  setEntries: (entries) => set({ entries }),

  inventoryChecks: [],
  setInventoryChecks: (inventoryChecks) => set({ inventoryChecks }),

  customRules: [],
  setCustomRules: (customRules) => set({ customRules }),

  accountsDb: [],
  setAccountsDb: (accountsDb) => {
    // Derive accountCategories from accounts database
    const categories: AccountCategories = {
      assets: {}, liabilities: {}, equity: {}, revenue: {}, expenses: {}
    };

    const typeMap: Record<string, keyof AccountCategories> = {
      'اصول': 'assets',
      'خصوم': 'liabilities',
      'حقوق ملكية': 'equity',
      'ايرادات': 'revenue',
      'مصروفات': 'expenses'
    };

    accountsDb.forEach(acc => {
      const typeKey = typeMap[acc.mainType];
      if (typeKey && categories[typeKey]) {
        if (!categories[typeKey][acc.subType]) {
          categories[typeKey][acc.subType] = [];
        }
        categories[typeKey][acc.subType].push(acc.name);
      }
    });

    const isDbEmpty = accountsDb.length === 0;

    set({ 
      accountsDb,
      accountCategories: isDbEmpty ? ACCOUNT_CATEGORIES : categories,
      accounts: {
        assets: isDbEmpty ? Object.values(ACCOUNT_CATEGORIES.assets).flat() : accountsDb.filter(a => a.mainType === 'اصول').map(a => a.name),
        liabilities: isDbEmpty ? Object.values(ACCOUNT_CATEGORIES.liabilities).flat() : accountsDb.filter(a => a.mainType === 'خصوم').map(a => a.name),
        equity: isDbEmpty ? Object.values(ACCOUNT_CATEGORIES.equity).flat() : accountsDb.filter(a => a.mainType === 'حقوق ملكية').map(a => a.name),
        revenue: isDbEmpty ? Object.values(ACCOUNT_CATEGORIES.revenue).flat() : accountsDb.filter(a => a.mainType === 'ايرادات').map(a => a.name),
        expenses: isDbEmpty ? Object.values(ACCOUNT_CATEGORIES.expenses).flat() : accountsDb.filter(a => a.mainType === 'مصروفات').map(a => a.name),
      }
    });
  },

  transactionRules: [],
  setTransactionRules: (transactionRules) => set({ transactionRules }),

  goldPrice: 3750,
  setGoldPrice: (goldPrice) => set({ goldPrice }),

  goldBuyPrice: 3730,
  setGoldBuyPrice: (goldBuyPrice) => set({ goldBuyPrice }),

  goldSpread: 20,
  setGoldSpread: (goldSpread) => set({ goldSpread }),

  silverPrice: 50,
  setSilverPrice: (silverPrice) => set({ silverPrice }),

  silverBuyPrice: 45,
  setSilverBuyPrice: (silverBuyPrice) => set({ silverBuyPrice }),

  silverSpread: 5,
  setSilverSpread: (silverSpread) => set({ silverSpread }),

  goldKarat: 21,
  setGoldKarat: (goldKarat) => set({ goldKarat }),

  view: 'home',
  setView: (view) => set({ view }),

  printEntry: null,
  setPrintEntry: (printEntry) => set({ printEntry }),

  reportsTab: 'profit-analysis',
  setReportsTab: (reportsTab) => set({ reportsTab }),

  globalError: null,
  setGlobalError: (globalError) => set({ globalError }),

  isUpdatingPrice: false,
  setIsUpdatingPrice: (isUpdatingPrice) => set({ isUpdatingPrice }),

  editingEntry: null,
  setEditingEntry: (editingEntry) => set({ editingEntry }),

  bullionCharges: {
    0.25: 200,
    0.5: 180,
    1: 150,
    2.5: 140,
    5: 130,
    10: 120,
    20: 110,
    31.1: 105,
    50: 100,
    100: 95
  },
  setBullionCharges: (bullionCharges) => set({ bullionCharges }),

  coinCharges: {
    8: 120,
    4: 130,
    2: 140
  },
  setCoinCharges: (coinCharges) => set({ coinCharges }),

  accountCategories: ACCOUNT_CATEGORIES,
  setAccountCategories: (accountCategories) => set({ 
    accountCategories,
    accounts: {
      assets: Object.values(accountCategories?.assets || {}).flat(),
      liabilities: Object.values(accountCategories?.liabilities || {}).flat(),
      equity: Object.values(accountCategories?.equity || {}).flat(),
      revenue: Object.values(accountCategories?.revenue || {}).flat(),
      expenses: Object.values(accountCategories?.expenses || {}).flat()
    }
  }),

  accounts: {
    assets: Object.values(ACCOUNT_CATEGORIES.assets).flat(),
    liabilities: Object.values(ACCOUNT_CATEGORIES.liabilities).flat(),
    equity: Object.values(ACCOUNT_CATEGORIES.equity).flat(),
    revenue: Object.values(ACCOUNT_CATEGORIES.revenue).flat(),
    expenses: Object.values(ACCOUNT_CATEGORIES.expenses).flat()
  },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({ 
        view: state.view,
        reportsTab: state.reportsTab,
        bullionCharges: state.bullionCharges,
        coinCharges: state.coinCharges,
        goldPrice: state.goldPrice,
        goldBuyPrice: state.goldBuyPrice,
        goldSpread: state.goldSpread,
        silverPrice: state.silverPrice,
        silverBuyPrice: state.silverBuyPrice,
        silverSpread: state.silverSpread
      }),
    }
  )
);

