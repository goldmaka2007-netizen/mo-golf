import { useMemo } from 'react';
import { format } from 'date-fns';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store';
import {
  buildDashboardData,
  type BuildDashboardDataInput,
  type DashboardData,
} from '../lib/dashboardSelector';

const sameDashboardInput = (left: BuildDashboardDataInput, right: BuildDashboardDataInput): boolean =>
  left.entries === right.entries
  && left.accounts === right.accounts
  && left.canonicalDefinitions === right.canonicalDefinitions
  && left.timeline === right.timeline
  && left.goldPrice === right.goldPrice
  && left.silverPrice === right.silverPrice
  && left.today === right.today;

export const createDashboardDataCache = (
  build: (input: BuildDashboardDataInput) => DashboardData = buildDashboardData,
) => {
  let previousInput: BuildDashboardDataInput | null = null;
  let previousResult: DashboardData | null = null;
  return (input: BuildDashboardDataInput): DashboardData => {
    if (previousInput && previousResult && sameDashboardInput(previousInput, input)) return previousResult;
    previousInput = input;
    previousResult = build(input);
    return previousResult;
  };
};

const getCachedDashboardData = createDashboardDataCache();

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
  return useMemo(() => getCachedDashboardData({
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
