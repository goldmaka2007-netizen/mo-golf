import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import { buildHomeOperationalSnapshot } from '../lib/homeSelector';

export const useHomeMetrics = () => {
  const { entries, accounts } = useAppStore(useShallow(state => ({
    entries: state.entries,
    accounts: state.accountsDb,
  })));

  const operational = useMemo(() => buildHomeOperationalSnapshot(entries, accounts), [entries, accounts]);
  return { operational };
};
