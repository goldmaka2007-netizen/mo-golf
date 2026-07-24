import type { Entry } from '../types';
import type { Phase5OpeningCostConfig } from './inventoryCostTypes';
import { CURRENT_DATASET_INVENTORY_BINDINGS } from './inventoryCostCatalog';

export const APPROVED_IMPORTED_COST_DATASET_VERSION =
  'csv-2026-07-23-v1' as const;
export const APPROVED_IMPORTED_COST_SOURCE_HASH =
  '0f80dc5a76d43e0c588f02ef4574543aecb6d8825419f31ded1af3de27a37892' as const;
export const APPROVED_IMPORTED_COST_RECORD_COUNT = 2169 as const;
export const APPROVED_IMPORTED_OPENING_COST_CONFIG_VERSION =
  'phase5-opening-cost-2026-v1' as const;

const accessoryOpeningCosts = Object.fromEntries(
  CURRENT_DATASET_INVENTORY_BINDINGS
    .filter(binding => binding.taxonomyKey.startsWith('accessory.'))
    .map(binding => [binding.inventoryAccountId, 10000]),
);

export const APPROVED_IMPORTED_OPENING_COST_CONFIG:
Phase5OpeningCostConfig = Object.freeze({
  gold21PriceByYearMinor: Object.freeze({ '2026': 600000 }),
  silverPriceByYearMinor: Object.freeze({ '2026': 6000 }),
  accessoryUnitCostByYearAndAccountMinor: Object.freeze({
    '2026': Object.freeze(accessoryOpeningCosts),
  }),
});

const hasAnyOpeningCost = (config: Phase5OpeningCostConfig): boolean =>
  Object.keys(config.gold21PriceByYearMinor ?? {}).length > 0
  || Object.keys(config.silverPriceByYearMinor ?? {}).length > 0
  || Object.keys(config.accessoryUnitCostByYearAndAccountMinor ?? {}).length > 0;

export interface ApprovedOpeningCostResolution {
  config: Phase5OpeningCostConfig;
  source: 'explicit_settings' | 'approved_imported_dataset';
  version: string;
}

/**
 * Uses the versioned opening-cost approval only for the exact imported
 * 2,169-record dataset. Any larger, newer, mixed, or partially identified
 * runtime dataset remains fail-closed and must provide explicit settings.
 */
export const resolveApprovedOpeningCostConfig = (
  entries: readonly Entry[],
  explicitConfig: Phase5OpeningCostConfig,
): ApprovedOpeningCostResolution => {
  if (hasAnyOpeningCost(explicitConfig)) {
    return {
      config: explicitConfig,
      source: 'explicit_settings',
      version: 'runtime-settings',
    };
  }
  const exactApprovedDataset = entries.length === APPROVED_IMPORTED_COST_RECORD_COUNT
    && entries.every(entry =>
      entry.imported === true
      && entry.importVersion === APPROVED_IMPORTED_COST_DATASET_VERSION
      && entry.legacySourceHash === APPROVED_IMPORTED_COST_SOURCE_HASH);
  if (!exactApprovedDataset) {
    return {
      config: explicitConfig,
      source: 'explicit_settings',
      version: 'runtime-settings-missing-or-incomplete',
    };
  }
  return {
    config: APPROVED_IMPORTED_OPENING_COST_CONFIG,
    source: 'approved_imported_dataset',
    version: APPROVED_IMPORTED_OPENING_COST_CONFIG_VERSION,
  };
};
