import { describe, expect, it } from 'vitest';
import { calculateArabicWeight, normalizeNumerals } from '../accounting';
import { calculateGoldEquivalent21, canCalculateGoldEquivalent21 } from '../goldEquivalent';

describe('fractional gold weight input', () => {
  it('accepts a quarter gram entered without a leading zero', () => {
    const normalized = normalizeNumerals('.25');
    expect(normalized).toBe('0.25');
    expect(canCalculateGoldEquivalent21(normalized, 24)).toBe(true);
    expect(calculateArabicWeight(normalized, 24 / 21, 24)).toBe('0.29');
  });

  it('accepts Arabic quarter-gram numerals and keeps centigram rounding auditable', () => {
    const normalized = normalizeNumerals('.\u0662\u0665');
    expect(normalized).toBe('0.25');
    expect(calculateGoldEquivalent21(normalized, 24).equivalent21).toBe('0.29');
  });
});
