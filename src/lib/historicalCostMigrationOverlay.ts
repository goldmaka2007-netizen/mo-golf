import { createDeterministicAuditHash } from './historicalInventoryOverlay';

export interface HistoricalCostInterpretationOverlay {
  overlayId: string;
  targetOperationId: string;
  targetAccountId: string;
  reason: string;
  oldValue: unknown;
  newInterpretedValue: unknown;
  approver: string;
  source: string;
  createdTimestamp: string;
  auditHash: string;
}

const payload = (overlay: Omit<HistoricalCostInterpretationOverlay, 'auditHash'> | HistoricalCostInterpretationOverlay) => {
  const { auditHash: _ignored, ...stable } = overlay as HistoricalCostInterpretationOverlay;
  return stable;
};

export const createHistoricalCostInterpretationOverlay = (
  value: Omit<HistoricalCostInterpretationOverlay, 'auditHash'>,
): HistoricalCostInterpretationOverlay => {
  if (!value.overlayId || !value.targetOperationId || !value.targetAccountId || !value.reason
    || !value.approver || !value.source || !value.createdTimestamp) throw new Error('invalid_historical_cost_overlay');
  return { ...value, auditHash: createDeterministicAuditHash(value) };
};

export const validateHistoricalCostInterpretationOverlay = (overlay: HistoricalCostInterpretationOverlay): boolean =>
  overlay.auditHash === createDeterministicAuditHash(payload(overlay));