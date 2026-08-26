import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import { buildHomeOperationalSnapshot } from '../lib/homeSelector';

export const useHomeMetrics = () => {
  const { entries, accounts, canonicalDefinitions, openingCostConfig, goldPrice, silverPrice } = useAppStore(useShallow(state => ({
    entries: state.entries,
    accounts: state.accountsDb,
    canonicalDefinitions: state.canonicalAccounts,
    openingCostConfig: state.openingCostConfig,
    goldPrice: state.goldPrice,
    silverPrice: state.silverPrice,
  })));

  const operational = useMemo(() => buildHomeOperationalSnapshot({ entries, accounts, canonicalDefinitions, openingCostConfig, goldPriceEgp: goldPrice, silverPriceEgp: silverPrice }), [entries, accounts, canonicalDefinitions, openingCostConfig, goldPrice, silverPrice]);
  return { operational };
};
