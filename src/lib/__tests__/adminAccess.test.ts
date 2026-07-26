import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdminEmail } from '../adminAccess';

describe('admin email access', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('matches a configured admin email after normalization', () => {
    vi.stubEnv('VITE_ADMIN_EMAIL', '  ADMIN@example.com  ');
    expect(isAdminEmail('admin@example.com')).toBe(true);
    expect(isAdminEmail('other@example.com')).toBe(false);
  });

  it.each([undefined, ''])('fails closed when VITE_ADMIN_EMAIL is %s', value => {
    vi.stubEnv('VITE_ADMIN_EMAIL', value);
    expect(isAdminEmail('admin@example.com')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});
