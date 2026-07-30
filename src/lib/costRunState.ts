import type { CostCalculationRun, InventoryCostDiagnostic } from './inventoryCostTypes';

export const commitCostCalculationRun = (
  activeGenerationId: number,
  completedRun: CostCalculationRun,
): { accepted: true; run: CostCalculationRun } | { accepted: false; diagnostic: InventoryCostDiagnostic } => {
  if (completedRun.generationId !== activeGenerationId) {
    return {
      accepted: false,
      diagnostic: {
        code: 'stale_generation',
        message: `Rejected stale cost generation ${completedRun.generationId}; active generation is ${activeGenerationId}`,
      },
    };
  }
  return { accepted: true, run: completedRun };
};

export const isCostReportAvailable = (
  run: CostCalculationRun,
  inputRevision: string,
): run is CostCalculationRun & { status: 'valid'; timeline: NonNullable<CostCalculationRun['timeline']> } =>
  run.status === 'valid'
  && run.inputRevision === inputRevision
  && !!run.timeline
  && run.timeline.valid
  && run.timeline.costDataComplete !== false;

export const areOperationWritesLocked = (run: CostCalculationRun | undefined): boolean =>
  run?.status === 'running' || run?.status === 'failed';
