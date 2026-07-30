let fallbackCounter = 0;

const formatUuidV4 = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
};

const fallbackUuidV4 = (): string => {
  const bytes = new Uint8Array(16);
  const timestamp = Date.now();
  const highResolutionTime = typeof globalThis.performance?.now === 'function'
    ? Math.floor(globalThis.performance.now() * 1000)
    : 0;
  fallbackCounter = (fallbackCounter + 1) >>> 0;

  for (let index = 0; index < bytes.length; index += 1) {
    const timeByte = (timestamp / (2 ** ((index % 6) * 8))) & 0xff;
    const performanceByte = (highResolutionTime / (2 ** ((index % 4) * 8))) & 0xff;
    const counterByte = (fallbackCounter / (2 ** ((index % 4) * 8))) & 0xff;
    bytes[index] = Math.floor(Math.random() * 256) ^ timeByte ^ performanceByte ^ counterByte;
  }

  return formatUuidV4(bytes);
};

/**
 * Generates one project-wide document/entity ID.
 *
 * randomUUID is preferred when the browser exposes it. Older Safari versions
 * and insecure localhost origins still expose getRandomValues, which is used
 * to build an RFC 4122 UUID v4. The final fallback is collision-resistant for
 * document IDs in legacy/non-browser environments where Web Crypto is absent;
 * generated IDs must not be treated as secrets or authentication tokens.
 */
export const generateId = (prefix?: string): string => {
  const cryptoApi = globalThis.crypto;
  let uuid: string;

  if (typeof cryptoApi?.randomUUID === 'function') {
    uuid = cryptoApi.randomUUID.call(cryptoApi);
  } else if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    uuid = formatUuidV4(bytes);
  } else {
    uuid = fallbackUuidV4();
  }

  return prefix ? `${prefix}-${uuid}` : uuid;
};
