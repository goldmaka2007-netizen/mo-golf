import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateStoryGoldBuyPrices,
  DEFAULT_STORY_GOLD_BUY_SPREAD_EGP,
  normalizeStoryGoldBuySpreadEgp,
  parseStoryGoldBuySpreadInput,
  saveStoryGoldBuySpreadEgp,
} from '../storyPricing';

const mocks = vi.hoisted(() => ({
  setDoc: vi.fn(),
  doc: vi.fn((...segments: unknown[]) => segments.join('/')),
}));

const syncSource = readFileSync(new URL('../../hooks/useDataSync.ts', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../../components/views/SettingsView.tsx', import.meta.url), 'utf8');

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: mocks.doc, setDoc: mocks.setDoc }));

describe('Story-only gold buy spread', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults missing and invalid persisted values to 20 while preserving zero', () => {
    expect(DEFAULT_STORY_GOLD_BUY_SPREAD_EGP).toBe(20);
    expect(normalizeStoryGoldBuySpreadEgp(undefined)).toBe(20);
    expect(normalizeStoryGoldBuySpreadEgp(null)).toBe(20);
    expect(normalizeStoryGoldBuySpreadEgp(-1)).toBe(20);
    expect(normalizeStoryGoldBuySpreadEgp(Number.NaN)).toBe(20);
    expect(normalizeStoryGoldBuySpreadEgp(Number.POSITIVE_INFINITY)).toBe(20);
    expect(normalizeStoryGoldBuySpreadEgp(0)).toBe(0);
    expect(normalizeStoryGoldBuySpreadEgp(30)).toBe(30);
  });

  it('accepts zero and finite non-negative inputs but rejects invalid inputs', () => {
    expect(parseStoryGoldBuySpreadInput('0')).toBe(0);
    expect(parseStoryGoldBuySpreadInput('30.5')).toBe(30.5);
    expect(parseStoryGoldBuySpreadInput('')).toBeNull();
    expect(parseStoryGoldBuySpreadInput('-1')).toBeNull();
    expect(parseStoryGoldBuySpreadInput('NaN')).toBeNull();
    expect(parseStoryGoldBuySpreadInput('Infinity')).toBeNull();
  });

  it('derives Story 24K and 18K buys from the Story 21K buy', () => {
    expect(calculateStoryGoldBuyPrices(6600, 30)).toEqual({ p21Buy: 6570, p24Buy: 7509, p18Buy: 5631 });
    expect(calculateStoryGoldBuyPrices(6600, 0).p21Buy).toBe(6600);
    expect(calculateStoryGoldBuyPrices(10, 50).p21Buy).toBe(0);
  });

  it('saves only the Story field with merge semantics after explicit Save', async () => {
    mocks.setDoc.mockResolvedValue(undefined);
    await saveStoryGoldBuySpreadEgp('user-1', 30);
    expect(mocks.doc).toHaveBeenCalledWith({}, 'settings', 'user-1');
    expect(mocks.setDoc).toHaveBeenCalledWith('[object Object]/settings/user-1', { storyGoldBuySpreadEgp: 30 }, { merge: true });
  });

  it('loads the Story setting through explicit normalization and exposes explicit Settings Save', () => {
    expect(syncSource).toContain('setStoryGoldBuySpreadEgp(normalizeStoryGoldBuySpreadEgp(data.storyGoldBuySpreadEgp))');
    expect(syncSource).toContain('setStoryGoldBuySpreadEgp(normalizeStoryGoldBuySpreadEgp(undefined))');
    expect(syncSource).not.toContain('if (data.storyGoldBuySpreadEgp)');
    expect(settingsSource).toContain('saveStoryGoldBuySpreadEgp');
    expect(settingsSource).toContain('storyGoldBuySpreadEgp');
    expect(settingsSource).toContain('حفظ فرق شراء الستوري');
    expect(settingsSource).toContain('فرق شراء الستوري');
  });
});
