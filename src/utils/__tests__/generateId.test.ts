import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId } from '../generateId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('generateId', () => {
  it('prefers crypto.randomUUID when it is available', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000');
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: vi.fn() });

    expect(generateId('draft')).toBe('draft-123e4567-e89b-42d3-a456-426614174000');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('uses getRandomValues when Safari does not expose randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });

    expect(generateId()).toMatch(UUID_V4);
  });

  it('still creates distinct UUIDs when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const first = generateId();
    const second = generateId();

    expect(first).toMatch(UUID_V4);
    expect(second).toMatch(UUID_V4);
    expect(second).not.toBe(first);
  });
});
