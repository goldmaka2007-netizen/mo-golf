import { useMemo } from 'react';
import { format } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import { buildDashboardData } from '../lib/dashboardSelector';

export const useDashboardMetrics = () => {
  const {
    entries,
    accounts,
    canonicalDefinitions,
    costCalculationRun,
    goldPrice,
    silverPrice,
  } = useAppStore(useShallow(state => ({
    entries: state.entries,
    accounts: state.accountsDb,
    canonicalDefinitions: state.canonicalAccounts,
    costCalculationRun: state.costCalculationRun,
    goldPrice: state.goldPrice,
    silverPrice: state.silverPrice,
  })));

  const today = format(new Date(), 'yyyy-MM-dd');
  return useMemo(() => buildDashboardData({
    entries,
    accounts,
    canonicalDefinitions,
    timeline: costCalculationRun.status === 'valid' ? costCalculationRun.timeline : null,
    goldPrice,
    silverPrice,
    today,
  }), [
    entries,
    accounts,
    canonicalDefinitions,
    costCalculationRun.status,
    costCalculationRun.timeline,
    goldPrice,
    silverPrice,
    today,
  ]);
};
