export const GOLD_EQUIVALENT_21_CALCULATION_VERSION = 'gold-equivalent-21-centigram-v1';
export const GOLD_EQUIVALENT_21_ROUNDING_SCALE = '0.01g';

export type SupportedGoldKarat = 18 | 21 | 24;

export interface GoldEquivalent21Snapshot {
  physicalWeight: string;
  physicalWeightUnits: number;
  karat: SupportedGoldKarat;
  equivalent21: string;
  equivalent21Units: number;
  roundingScale: typeof GOLD_EQUIVALENT_21_ROUNDING_SCALE;
  calculationVersion: typeof GOLD_EQUIVALENT_21_CALCULATION_VERSION;
}

export interface GoldEquivalent21LegacyComparison {
  legacyValue: string | null;
  legacyValueUnits: number | null;
  calculatedValue: string;
  calculatedValueUnits: number;
  difference: string;
  differenceUnits: number;
  mismatch: boolean;
}

export interface GoldEquivalent21Audit {
  snapshot: GoldEquivalent21Snapshot;
  legacyComparison: GoldEquivalent21LegacyComparison | null;
}

const SUPPORTED_KARATS = new Set<SupportedGoldKarat>([18, 21, 24]);
const KARAT_FROM_MULTIPLIER: Array<[SupportedGoldKarat, number]> = [
  [18, 18 / 21],
  [21, 1],
  [24, 24 / 21],
];

const normalizeWeightNumerals = (val: string): string => {
  let res = val.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  res = res.replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  res = res.replace(/\u066b/g, '.');
  res = res.replace(/,/g, '.');
  res = res.replace(/\u060c/g, '.');
  return res;
};

export const isSupportedGoldKarat = (karat: unknown): karat is SupportedGoldKarat => {
  const numeric = typeof karat === 'string' ? Number(karat.replace('.0', '')) : Number(karat);
  return Number.isInteger(numeric) && SUPPORTED_KARATS.has(numeric as SupportedGoldKarat);
};

const assertSupportedKarat = (karat: unknown): SupportedGoldKarat => {
  const numeric = typeof karat === 'string' ? Number(karat.replace('.0', '')) : Number(karat);
  if (!Number.isInteger(numeric) || !SUPPORTED_KARATS.has(numeric as SupportedGoldKarat)) {
    throw new Error(`Unsupported gold karat: ${String(karat)}`);
  }
  return numeric as SupportedGoldKarat;
};

const decimalStringToCentigrams = (value: string, label: string, allowZero = false): number => {
  const normalized = normalizeWeightNumerals(value.trim());
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${label} must be a finite positive decimal with at most two decimal places`);
  }

  const [whole, fraction = ''] = normalized.split('.');
  const units = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));

  if (units < 0n || (!allowZero && units === 0n)) {
    throw new Error(`${label} must be at least 0.01g`);
  }
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large to store safely`);
  }

  return Number(units);
};

export const gramsToCentigramUnits = (value: string | number, label = 'weight', allowZero = false): number => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return decimalStringToCentigrams(String(value), label, allowZero);
  }
  return decimalStringToCentigrams(value, label, allowZero);
};

export const formatCentigramUnits = (units: number): string => {
  if (!Number.isSafeInteger(units)) throw new Error('centigram units must be a safe integer');
  const sign = units < 0 ? '-' : '';
  const absolute = Math.abs(units);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
};

const roundDivide = (numerator: bigint, denominator: bigint): bigint =>
  (numerator + denominator / 2n) / denominator;

export const calculateGoldEquivalent21 = (
  physicalWeight: string | number,
  karat: string | number,
): GoldEquivalent21Snapshot => {
  const physicalWeightUnits = gramsToCentigramUnits(physicalWeight, 'physicalWeight');
  const supportedKarat = assertSupportedKarat(karat);
  const equivalent21Units = Number(roundDivide(BigInt(physicalWeightUnits) * BigInt(supportedKarat), 21n));

  return {
    physicalWeight: formatCentigramUnits(physicalWeightUnits),
    physicalWeightUnits,
    karat: supportedKarat,
    equivalent21: formatCentigramUnits(equivalent21Units),
    equivalent21Units,
    roundingScale: GOLD_EQUIVALENT_21_ROUNDING_SCALE,
    calculationVersion: GOLD_EQUIVALENT_21_CALCULATION_VERSION,
  };
};

export const inferGoldKaratFromMultiplier = (multiplier: number | null | undefined): SupportedGoldKarat | null => {
  if (multiplier === null || multiplier === undefined || !Number.isFinite(multiplier)) return null;
  const match = KARAT_FROM_MULTIPLIER.find(([, value]) => Math.abs(value - multiplier) < 0.000001);
  return match?.[0] ?? null;
};

export const canCalculateGoldEquivalent21 = (physicalWeight: string | number, karat: string | number | null | undefined): boolean => {
  if (karat === null || karat === undefined || karat === '') return false;
  try {
    gramsToCentigramUnits(physicalWeight, 'physicalWeight');
    assertSupportedKarat(karat);
    return true;
  } catch {
    return false;
  }
};

export const compareLegacyGoldEquivalent21 = (
  legacyValue: string | number | null | undefined,
  calculated: GoldEquivalent21Snapshot,
): GoldEquivalent21LegacyComparison => {
  if (legacyValue === null || legacyValue === undefined || legacyValue === '') {
    return {
      legacyValue: null,
      legacyValueUnits: null,
      calculatedValue: calculated.equivalent21,
      calculatedValueUnits: calculated.equivalent21Units,
      difference: calculated.equivalent21,
      differenceUnits: calculated.equivalent21Units,
      mismatch: calculated.equivalent21Units !== 0,
    };
  }

  const legacyValueUnits = gramsToCentigramUnits(legacyValue, 'legacyValue', true);
  const differenceUnits = calculated.equivalent21Units - legacyValueUnits;

  return {
    legacyValue: formatCentigramUnits(legacyValueUnits),
    legacyValueUnits,
    calculatedValue: calculated.equivalent21,
    calculatedValueUnits: calculated.equivalent21Units,
    difference: formatCentigramUnits(differenceUnits),
    differenceUnits,
    mismatch: differenceUnits !== 0,
  };
};

export const buildGoldEquivalent21Audit = (
  physicalWeight: string | number,
  karat: string | number | null | undefined,
  legacyValue?: string | number | null,
): GoldEquivalent21Audit | null => {
  if (karat === null || karat === undefined || karat === '') return null;
  const snapshot = calculateGoldEquivalent21(physicalWeight, karat);
  const hasLegacyValue = legacyValue !== undefined && legacyValue !== null && legacyValue !== '';
  return {
    snapshot,
    legacyComparison: hasLegacyValue ? compareLegacyGoldEquivalent21(legacyValue, snapshot) : null,
  };
};