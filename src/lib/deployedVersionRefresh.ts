const MAIN_ASSET_PATTERN = /<script[^>]+type=["']module["'][^>]+src=["'](\/assets\/index-[^"']+\.js)["']/i;
const RELOAD_ATTEMPT_KEY = 'makka-deployed-version-reload-target';

export const getDeployedMainAsset = (html: string): string | null =>
  html.match(MAIN_ASSET_PATTERN)?.[1] ?? null;

export const deployedAssetChanged = (
  currentAssetUrl: string,
  deployedIndexHtml: string,
): string | null => {
  const deployedAsset = getDeployedMainAsset(deployedIndexHtml);
  if (!deployedAsset) return null;
  const currentPath = new URL(currentAssetUrl, window.location.origin).pathname;
  return currentPath === deployedAsset ? null : deployedAsset;
};

let refreshCheckRunning = false;

export const checkForDeployedVersion = async (): Promise<boolean> => {
  if (refreshCheckRunning || typeof document === 'undefined') return false;
  const currentScript = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
  if (!currentScript?.src) return false;
  refreshCheckRunning = true;
  try {
    const response = await fetch(`/index.html?version-check=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return false;
    const deployedAsset = deployedAssetChanged(currentScript.src, await response.text());
    if (!deployedAsset) {
      sessionStorage.removeItem(RELOAD_ATTEMPT_KEY);
      return false;
    }
    if (sessionStorage.getItem(RELOAD_ATTEMPT_KEY) === deployedAsset) return false;
    sessionStorage.setItem(RELOAD_ATTEMPT_KEY, deployedAsset);
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }
    window.location.reload();
    return true;
  } catch (error) {
    console.warn('Deployed version check failed:', error);
    return false;
  } finally {
    refreshCheckRunning = false;
  }
};

export const installDeployedVersionRefresh = (): (() => void) => {
  if (import.meta.env.DEV || typeof window === 'undefined') return () => undefined;
  const check = () => { void checkForDeployedVersion(); };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check();
  };
  const initialTimer = window.setTimeout(check, 1_500);
  const interval = window.setInterval(check, 60_000);
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.clearTimeout(initialTimer);
    window.clearInterval(interval);
    window.removeEventListener('focus', check);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};