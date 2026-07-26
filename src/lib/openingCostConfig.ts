import type { Account, AnnualOpeningCostConfig } from '../types';
import type { OpeningCostConfig } from './weightedAverageCost';
import { normalizeNumerals } from './accounting';
import { buildRuntimeStableInventoryIdAliases } from './runtimeCostAccountResolver';

export const parseEgpToMinorUnits = (value: string): number => {
  const normalized = normalizeNumerals(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('invalid_money');
  }
  const [whole, fraction = ''] = normalized.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('money_too_large');
  }
  return Number(minor);
};

export const formatMinorUnitsToEgpInput = (value: number | string | undefined): string => {
  if (value === undefined || value === '') return '';
  const normalized = normalizeNumerals(String(value)).trim();
  if (!/^\d+$/.test(normalized)) return '';
  const minor = BigInt(normalized);
  const whole = minor / 100n;
  const fraction = minor % 100n;
  return fraction === 0n ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`;
};

const parseConfigEgpToMinorUnits = (value: number | string | undefined): number | string | undefined => {
  if (value === undefined || value === '') return undefined;
  return parseEgpToMinorUnits(String(value));
};

const normalizeAccessoryCostMap = (
  value: unknown,
): Record<string, number | string | undefined> => {
  if (!value) return {};
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter(item => item.accountId && (item.unitCostEgp ?? item.unitCost ?? item.value) !== undefined)
        .map(item => [item.accountId as string, parseConfigEgpToMinorUnits(item.unitCostEgp ?? item.unitCost ?? item.value)]),
    );
  }
  if (typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, number | string | undefined>)
      .filter(([, item]) => item !== undefined && item !== '')
      .map(([accountId, item]) => [accountId, parseConfigEgpToMinorUnits(item)]),
  );
};

export const getGoldOpeningPriceMinor = (config: AnnualOpeningCostConfig): number | string | undefined =>
  config.gold21PriceMinorPerGram ?? parseConfigEgpToMinorUnits(config.gold21PriceEgp);

export const getSilverOpeningPriceMinor = (config: AnnualOpeningCostConfig): number | string | undefined =>
  config.silverPriceMinorPerGram ?? parseConfigEgpToMinorUnits(config.silverPriceEgp);

export const getAccessoryOpeningCostsMinorByAccountId = (
  config: AnnualOpeningCostConfig,
): Record<string, number | string | undefined> => {
  return {
    ...(config.accessoryUnitCostMinorByAccountId || {}),
    ...normalizeAccessoryCostMap(config.openingCosts),
    ...normalizeAccessoryCostMap(config.accessoryCosts),
    ...normalizeAccessoryCostMap(config.unitCosts),
    ...normalizeAccessoryCostMap(config.accessoryOpeningCostsByAccountId),
    ...normalizeAccessoryCostMap(config.accessoryOpeningCosts),
  };
};

export const mergeAnnualOpeningCostRows = (
  previous: AnnualOpeningCostConfig | undefined,
  next: AnnualOpeningCostConfig,
): AnnualOpeningCostConfig => {
  const previousAccessoryCosts = previous?.accessoryOpeningCosts
    ?? Object.fromEntries(
      Object.entries(previous?.accessoryUnitCostMinorByAccountId || {})
        .map(([accountId, value]) => [accountId, formatMinorUnitsToEgpInput(value)]),
    );
  return {
    year: next.year,
    gold21PriceEgp: next.gold21PriceEgp ?? previous?.gold21PriceEgp ?? formatMinorUnitsToEgpInput(previous?.gold21PriceMinorPerGram),
    silverPriceEgp: next.silverPriceEgp ?? previous?.silverPriceEgp ?? formatMinorUnitsToEgpInput(previous?.silverPriceMinorPerGram),
    accessoryOpeningCosts: {
      ...previousAccessoryCosts,
      ...(next.accessoryOpeningCosts || {}),
    },
  };
};
export const normalizeOpeningCostConfigRows = (annualConfig: AnnualOpeningCostConfig[] = []): AnnualOpeningCostConfig[] => {
  const seen = new Set<number>();
  return annualConfig
    .map(config => ({ ...config, year: Number(config.year) }))
    .filter(config => Number.isInteger(config.year))
    .sort((a, b) => a.year - b.year)
    .map(config => {
      if (seen.has(config.year)) throw new Error(`Duplicate opening cost year: ${config.year}`);
      seen.add(config.year);
      return config;
    });
};

export const buildOpeningCostConfig = (
  annualConfig: AnnualOpeningCostConfig[] = [],
  accounts: readonly Account[] = [],
): OpeningCostConfig => {
  const gold21PriceByYearMinor: OpeningCostConfig['gold21PriceByYearMinor'] = {};
  const silverPriceByYearMinor: OpeningCostConfig['silverPriceByYearMinor'] = {};
  const accessoryUnitCostByYearAndAccountMinor: NonNullable<OpeningCostConfig['accessoryUnitCostByYearAndAccountMinor']> = {};
  const stableIdByRuntimeId = buildRuntimeStableInventoryIdAliases(accounts);

  normalizeOpeningCostConfigRows(annualConfig).forEach(config => {
    const year = String(config.year);
    const goldMinor = getGoldOpeningPriceMinor(config);
    const silverMinor = getSilverOpeningPriceMinor(config);
    const accessoryCosts = Object.fromEntries(
      Object.entries(getAccessoryOpeningCostsMinorByAccountId(config))
        .map(([accountId, value]) => [stableIdByRuntimeId.get(accountId) ?? accountId, value]),
    );
    if (/^\d{4}$/.test(year) && goldMinor !== undefined) {
      gold21PriceByYearMinor[year] = goldMinor;
    }
    if (/^\d{4}$/.test(year) && silverMinor !== undefined) {
      silverPriceByYearMinor[year] = silverMinor;
    }
    if (/^\d{4}$/.test(year) && Object.keys(accessoryCosts).length > 0) {
      accessoryUnitCostByYearAndAccountMinor[year] = accessoryCosts;
    }
  });

  return {
    gold21PriceByYearMinor,
    silverPriceByYearMinor,
    accessoryUnitCostByYearAndAccountMinor,
  };
};
