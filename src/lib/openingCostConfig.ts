import type { AnnualOpeningCostConfig } from '../types';
import type { OpeningCostConfig } from './weightedAverageCost';
import { normalizeNumerals } from './accounting';

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

export const buildOpeningCostConfig = (annualConfig: AnnualOpeningCostConfig[] = []): OpeningCostConfig => {
  const gold21PriceByYearMinor: OpeningCostConfig['gold21PriceByYearMinor'] = {};
  const silverPriceByYearMinor: OpeningCostConfig['silverPriceByYearMinor'] = {};

  normalizeOpeningCostConfigRows(annualConfig).forEach(config => {
    const year = String(config.year);
    if (/^\d{4}$/.test(year) && config.gold21PriceMinorPerGram !== undefined) {
      gold21PriceByYearMinor[year] = config.gold21PriceMinorPerGram;
    }
    if (/^\d{4}$/.test(year) && config.silverPriceMinorPerGram !== undefined) {
      silverPriceByYearMinor[year] = config.silverPriceMinorPerGram;
    }
  });

  return { gold21PriceByYearMinor, silverPriceByYearMinor };
};
