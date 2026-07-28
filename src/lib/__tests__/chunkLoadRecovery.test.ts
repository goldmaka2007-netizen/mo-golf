import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDynamicImportFailure, reloadOnceForDynamicImportFailure } from '../chunkLoadRecovery';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dynamic import recovery', () => {
  it.each([
    'Importing a module script failed',
    'Failed to fetch dynamically imported module',
    'ChunkLoadError: Loading chunk MonthlyReportView failed',
  ])('recognizes a stale chunk failure: %s', message => {
    expect(isDynamicImportFailure(new Error(message))).toBe(true);
  });

  it('does not reload for an unrelated application error', () => {
    expect(isDynamicImportFailure(new Error('Invalid accounting entry'))).toBe(false);
  });
  it('keeps the monthly report out of a second-level lazy chunk', () => {
    const reportsView = readFileSync(new URL('../../components/views/ReportsView.tsx', import.meta.url), 'utf8');
    expect(reportsView).toContain("import { MonthlyReportView } from './reports/MonthlyReportView'");
    expect(reportsView).not.toContain('const MonthlyReportView = lazy');
  });

  it('clears app caches and old service workers before reloading once', async () => {
    const reload = vi.fn();
    const deleteCache = vi.fn().mockResolvedValue(true);
    const unregister = vi.fn().mockResolvedValue(true);
    const storage = new Map<string, string>();

    vi.stubGlobal('window', { location: { reload } });
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['makka-shell', 'workbox-precache']),
      delete: deleteCache,
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
      },
    });

    expect(reloadOnceForDynamicImportFailure(new Error('Importing a module script failed'))).toBe(true);
    expect(reloadOnceForDynamicImportFailure(new Error('Importing a module script failed'))).toBe(false);

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});
