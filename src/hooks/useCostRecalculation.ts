import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store';
import { buildOpeningCostConfig } from '../lib/openingCostConfig';
import {
  createCostInputRevision,
  createCostSettingsHash,
  executeCostCalculationRun,
  findEarliestCostAffectedOperationId,
} from '../lib/costRecalculation';

export const useCostRecalculation = () => {
  const {
    user,
    entries,
    accountsDb,
    openingCostConfig,
    costRetryToken,
    beginCostCalculation,
    commitCostCalculation,
  } = useAppStore();
  const openingConfig = useMemo(
    () => buildOpeningCostConfig(openingCostConfig),
    [openingCostConfig],
  );
  const inputRevision = useMemo(
    () => createCostInputRevision(entries, accountsDb, openingConfig),
    [entries, accountsDb, openingConfig],
  );
  const settingsHash = useMemo(
    () => createCostSettingsHash(openingConfig),
    [openingConfig],
  );
  const previousEntriesRef = useRef(entries);

  useEffect(() => {
    if (!user || accountsDb.length === 0) return;
    const earliestAffectedOperationId = findEarliestCostAffectedOperationId(
      previousEntriesRef.current,
      entries,
    );
    previousEntriesRef.current = entries;
    const generationId = beginCostCalculation({
      inputRevision,
      settingsHash,
      earliestAffectedOperationId,
    });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const completed = executeCostCalculationRun({
        generationId,
        inputRevision,
        entries,
        accounts: accountsDb,
        openingConfig,
        earliestAffectedOperationId,
      });
      if (!cancelled) commitCostCalculation(completed);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    user,
    inputRevision,
    settingsHash,
    costRetryToken,
    beginCostCalculation,
    commitCostCalculation,
  ]);

  return { inputRevision, openingConfig };
};
