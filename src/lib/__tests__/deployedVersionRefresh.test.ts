import { afterEach, describe, expect, it, vi } from 'vitest';
import { deployedAssetChanged, getDeployedMainAsset } from '../deployedVersionRefresh';

afterEach(() => vi.unstubAllGlobals());

describe('deployed version refresh', () => {
  it('extracts the hashed Vite entry bundle from deployed index HTML', () => {
    expect(getDeployedMainAsset(
      '<script type="module" crossorigin src="/assets/index-new123.js"></script>',
    )).toBe('/assets/index-new123.js');
  });

  it('requests a reload only when Hosting points to a different entry bundle', () => {
    vi.stubGlobal('window', { location: { origin: 'https://makka.example' } });
    const deployed = '<script type="module" src="/assets/index-new.js"></script>';
    expect(deployedAssetChanged('https://makka.example/assets/index-old.js', deployed))
      .toBe('/assets/index-new.js');
    expect(deployedAssetChanged('https://makka.example/assets/index-new.js', deployed))
      .toBeNull();
  });
});