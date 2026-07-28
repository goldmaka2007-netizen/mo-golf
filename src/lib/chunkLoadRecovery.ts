const CHUNK_RELOAD_KEY = 'makka-chunk-reload-attempted';

const chunkLoadPatterns = [
  /Importing a module script failed/i,
  /Failed to fetch dynamically imported module/i,
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /error loading dynamically imported module/i,
];

const errorMessage = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value && typeof value === 'object') {
    const candidate = value as { message?: unknown; reason?: unknown; error?: unknown; payload?: unknown };
    return [
      typeof candidate.message === 'string' ? candidate.message : '',
      errorMessage(candidate.reason),
      errorMessage(candidate.error),
      errorMessage(candidate.payload),
    ].filter(Boolean).join(' ');
  }
  return '';
};

export const isDynamicImportFailure = (value: unknown): boolean => {
  const message = errorMessage(value);
  return chunkLoadPatterns.some(pattern => pattern.test(message));
};

export const reloadOnceForDynamicImportFailure = (value: unknown): boolean => {
  if (!isDynamicImportFailure(value) || typeof window === 'undefined') return false;
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
  return true;
};
