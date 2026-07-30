import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';

export const useCostRecalculation = () => {
  const {
    user,
    entries,
    accountsDb,
    openingCostConfig,
    historicalCostReviewOverlays,
    costRetryToken,
    beginCostCalculation,
    commitCostCalculation,
  } = useAppStore();
  const previousEntriesRef = useRef(entries);

  useEffect(() => {
    if (!user || accountsDb.length === 0) return;

    let cancelled = false;
    let calculationTimer: number | undefined;

    void Promise.all([
      import('../lib/openingCostConfig'),
      import('../lib/costRecalculation'),
    ]).then(([openingCostModule, costModule]) => {
      if (cancelled) return;

      const openingConfig = openingCostModule.buildOpeningCostConfig(openingCostConfig, accountsDb);
      const inputRevision = costModule.createCostInputRevision(entries, accountsDb, openingConfig, historicalCostReviewOverlays);
      const settingsHash = costModule.createCostSettingsHash(openingConfig, historicalCostReviewOverlays);
      const earliestAffectedOperationId = costModule.findEarliestCostAffectedOperationId(
        previousEntriesRef.current,
        entries,
      );
      previousEntriesRef.current = entries;

      const generationId = beginCostCalculation({
        inputRevision,
        settingsHash,
        earliestAffectedOperationId,
      });

      calculationTimer = window.setTimeout(() => {
        const completed = costModule.executeCostCalculationRun({
          generationId,
          inputRevision,
          entries,
          accounts: accountsDb,
          openingConfig,
          historicalCostReviewOverlays,
          earliestAffectedOperationId,
        });
        if (!cancelled) commitCostCalculation(completed);
      }, 0);
    }).catch(error => {
      console.error('Cost calculation module load failed:', error);
    });

    return () => {
      cancelled = true;
      if (calculationTimer !== undefined) window.clearTimeout(calculationTimer);
    };
  }, [
    user,
    entries,
    accountsDb,
    openingCostConfig,
    historicalCostReviewOverlays,
    costRetryToken,
    beginCostCalculation,
    commitCostCalculation,
  ]);
};