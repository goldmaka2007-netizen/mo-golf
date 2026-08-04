import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetalPriceEditor, applySavedMetalPrices } from '../MetalPriceEditor';
import { parseMetalPrice, saveMetalPrices } from '../../../lib/metalPrices';
import { createDashboardDataCache } from '../../../hooks/useDashboardMetrics';

const mocks = vi.hoisted(() => ({
  store: {} as any,
  setDoc: vi.fn(),
  doc: vi.fn((...segments: string[]) => segments.join('/')),
}));

vi.mock('../../../store', () => ({
  useAppStore: (selector?: (state: any) => unknown) => selector ? selector(mocks.store) : mocks.store,
}));

vi.mock('../../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  setDoc: mocks.setDoc,
}));

describe('Dashboard metal prices and return cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store = {
      user: { uid: 'user-1' },
      goldPrice: 7350,
      silverPrice: 115,
      goldSpread: 20,
      silverSpread: 5,
      setGoldPrice: vi.fn(),
      setGoldBuyPrice: vi.fn(),
      setSilverPrice: vi.fn(),
      setSilverBuyPrice: vi.fn(),
    };
  });

  it('renders the gold and silver editor with current prices', () => {
    const html = renderToStaticMarkup(<MetalPriceEditor />);
    expect(html).toContain('أسعار المعادن الحالية');
    expect(html).toContain('سعر جرام الذهب عيار 21');
    expect(html).toContain('value="7350"');
    expect(html).toContain('سعر جرام الفضة');
    expect(html).toContain('value="115"');
  });

  it('rejects empty, zero, negative, and non-numeric prices', () => {
    expect(parseMetalPrice('')).toBeNull();
    expect(parseMetalPrice('0')).toBeNull();
    expect(parseMetalPrice('-1')).toBeNull();
    expect(parseMetalPrice('abc')).toBeNull();
  });

  it('accepts a positive decimal price', () => {
    expect(parseMetalPrice('7350.50')).toBe(7350.5);
  });

  it('saves into the existing user settings document with merge semantics', async () => {
    mocks.setDoc.mockResolvedValue(undefined);
    await saveMetalPrices('user-1', { goldPrice: 7400, silverPrice: 120, goldSpread: 20, silverSpread: 5 });
    expect(mocks.doc).toHaveBeenCalledWith({}, 'settings', 'user-1');
    expect(mocks.setDoc).toHaveBeenCalledWith('[object Object]/settings/user-1', {
      goldPrice: 7400,
      goldBuyPrice: 7380,
      goldSpread: 20,
      silverPrice: 120,
      silverBuyPrice: 115,
      silverSpread: 5,
    }, { merge: true });
  });

  it('updates displayed store prices immediately after a successful save', () => {
    const setters = {
      setGoldPrice: vi.fn(),
      setGoldBuyPrice: vi.fn(),
      setSilverPrice: vi.fn(),
      setSilverBuyPrice: vi.fn(),
    };
    applySavedMetalPrices(7400, 120, 20, 5, setters);
    expect(setters.setGoldPrice).toHaveBeenCalledWith(7400);
    expect(setters.setGoldBuyPrice).toHaveBeenCalledWith(7380);
    expect(setters.setSilverPrice).toHaveBeenCalledWith(120);
    expect(setters.setSilverBuyPrice).toHaveBeenCalledWith(115);
  });

  it('reuses Dashboard data on route return and refreshes only after an input changes', () => {
    const build = vi.fn(() => ({ snapshot: {} }) as any);
    const cached = createDashboardDataCache(build);
    const base = {
      entries: [],
      accounts: [],
      canonicalDefinitions: [],
      timeline: null,
      goldPrice: 7350,
      silverPrice: 115,
      today: '2026-08-04',
    };
    const first = cached(base);
    const returned = cached({ ...base });
    expect(returned).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);

    cached({ ...base, goldPrice: 7400 });
    expect(build).toHaveBeenCalledTimes(2);
  });
});