import { describe, expect, it } from 'vitest';
import { isDynamicImportFailure } from '../chunkLoadRecovery';

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
});
