import type {
  AppliedHistoricalInventoryOverlay,
  HistoricalInventoryOverlayDirective,
} from './inventoryCostTypes';

export const HISTORICAL_INVENTORY_OVERLAY_VERSION =
  'historical-inventory-reconciliation-v2' as const;

export const HISTORICAL_MERCHANT_LIABILITY_OPENING_VERSION =
  'historical-merchant-liability-opening-v1' as const;

export interface HistoricalMerchantLiabilityOpeningDirective {
  overlayId: string;
  merchantAccountId: string;
  merchantAccountIdAliases?: readonly string[];
  metal: 'gold' | 'silver';
  effectiveDate: string;
  standardizedWeightUnits: number;
  physicalWeightUnits: number;
  bookValueMinor: number;
  sourceReference: string;
  ownerApprovalStatus: 'approved';
  approvedAt: string;
}

export const APPROVED_HISTORICAL_MERCHANT_LIABILITY_OPENINGS:
readonly HistoricalMerchantLiabilityOpeningDirective[] = [
  {
    overlayId: 'hmlo-20260101-elsafy-gold-e21-077',
    merchantAccountId: '3zGclNk6qdAuNxM6y5iP',
    merchantAccountIdAliases: ['phase5-non-inventory-40'],
    metal: 'gold',
    effectiveDate: '2026-01-01',
    standardizedWeightUnits: 77,
    physicalWeightUnits: 77,
    bookValueMinor: 449_680,
    sourceReference: 'Opening liability reconciliation: recorded 3.16g; required 3.93g; approved opening gold price 5,840 EGP/g.',
    ownerApprovalStatus: 'approved',
    approvedAt: '2026-07-29T16:10:00+03:00',
  },
  {
    overlayId: 'hmlo-20260101-samir-silver-048',
    merchantAccountId: '00kIdH1ctqdEsOisnG80',
    merchantAccountIdAliases: ['phase5-non-inventory-43'],
    metal: 'silver',
    effectiveDate: '2026-01-01',
    standardizedWeightUnits: 48,
    physicalWeightUnits: 48,
    bookValueMinor: 6_048,
    sourceReference: 'Opening liability reconciliation: recorded 0.11g; required 0.59g; approved opening silver price 126 EGP/g.',
    ownerApprovalStatus: 'approved',
    approvedAt: '2026-07-29T16:10:00+03:00',
  },
] as const;
export const APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES:
readonly HistoricalInventoryOverlayDirective[] = [
  {
    overlayId: 'hiro-20260304-scrap-arabic-e21-002',
    historicalAccountKey: 'seed-account-d1216eb4076ccdf40e20',
    originalOperationId: 'csvref-entry-8bac4f51c5f366affbcb8884610f549e',
    stableInventoryAccountId: 'seed-account-d1216eb4076ccdf40e20',
    effectiveDate: '2026-03-04',
    quantityUnits: 2,
    unitBasis: 'gold_equivalent21_centigram',
    reasonCode: 'historical_inventory_reconciliation',
    sourceDeficitOperationId: 'csvref-entry-8bac4f51c5f366affbcb8884610f549e',
    ownerApprovalStatus: 'approved',
    approvedAt: '2026-07-24T15:59:38.400+03:00',
    supersedesOverlayId: null,
    revokedAt: null,
    revocationReason: null,
  },
  {
    overlayId: 'hiro-20260320-scrap-arabic-e21-076',
    historicalAccountKey: 'seed-account-d1216eb4076ccdf40e20',
    originalOperationId: 'csvref-entry-0d4c9ee1f0f2eae2af57a503a0c3dce8',
    stableInventoryAccountId: 'seed-account-d1216eb4076ccdf40e20',
    effectiveDate: '2026-03-20',
    quantityUnits: 76,
    unitBasis: 'gold_equivalent21_centigram',
    reasonCode: 'historical_inventory_reconciliation',
    sourceDeficitOperationId: 'csvref-entry-0d4c9ee1f0f2eae2af57a503a0c3dce8',
    ownerApprovalStatus: 'approved',
    approvedAt: '2026-07-24T15:59:38.400+03:00',
    supersedesOverlayId: null,
    revokedAt: null,
    revocationReason: null,
  },
  {
    overlayId: 'hiro-20260406-gouache-arabic-e21-002',
    historicalAccountKey: 'seed-account-391695330f1733e03bb0',
    originalOperationId: 'csvref-entry-1a614dcb5f2ffe9369daa03453366393',
    stableInventoryAccountId: 'seed-account-391695330f1733e03bb0',
    effectiveDate: '2026-04-06',
    quantityUnits: 2,
    unitBasis: 'gold_equivalent21_centigram',
    reasonCode: 'historical_inventory_reconciliation',
    sourceDeficitOperationId: 'csvref-entry-1a614dcb5f2ffe9369daa03453366393',
    ownerApprovalStatus: 'approved',
    approvedAt: '2026-07-24T15:59:38.400+03:00',
    supersedesOverlayId: null,
    revokedAt: null,
    revocationReason: null,
  },
  {
    overlayId: 'hiro-20260410-scrap-arabic-e21-005',
    historicalAccountKey: 'seed-account-d1216eb4076ccdf40e20',
    originalOperationId: 'csvref-entry-7decedc1a2d80d7620897618e62f5e96',
    stableInventoryAccountId: 'seed-account-d1216eb4076ccdf40e20',
    effectiveDate: '2026-04-10',
    quantityUnits: 5,
    unitBasis: 'gold_equivalent21_centigram',
    reasonCode: 'historical_inventory_reconciliation',
    sourceDeficitOperationId: 'csvref-entry-7decedc1a2d80d7620897618e62f5e96',
    ownerApprovalStatus: 'approved',
    approvedAt: '2026-07-29T15:35:00+03:00',
    supersedesOverlayId: null,
    revokedAt: null,
    revocationReason: null,
  },
] as const;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

const rotateRight = (value: number, amount: number): number =>
  (value >>> amount) | (value << (32 - amount));

export const createDeterministicAuditHash = (value: unknown): string => {
  const bytes = new TextEncoder().encode(
    HISTORICAL_INVENTORY_OVERLAY_VERSION + ':' + stableStringify(value),
  );
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);
  const constants = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ]);
  const hash = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choose + constants[index] + words[index]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0;
    }
    hash[0]=(hash[0]+a)>>>0; hash[1]=(hash[1]+b)>>>0; hash[2]=(hash[2]+c)>>>0; hash[3]=(hash[3]+d)>>>0;
    hash[4]=(hash[4]+e)>>>0; hash[5]=(hash[5]+f)>>>0; hash[6]=(hash[6]+g)>>>0; hash[7]=(hash[7]+h)>>>0;
  }
  return [...hash].map(item => item.toString(16).padStart(8, '0')).join('');
};

export const sealAppliedHistoricalInventoryOverlay = (
  value: Omit<AppliedHistoricalInventoryOverlay, 'auditHash'>,
): AppliedHistoricalInventoryOverlay => {
  const {
    calculationGenerationId: _runtimeGeneration,
    runtimeInventoryAccountId: _runtimeAccountId,
    ...stableApprovedOverlay
  } = value;
  return {
    ...value,
    // Runtime generations change on recalculation; approved economics do not.
    auditHash: createDeterministicAuditHash(stableApprovedOverlay),
  };
};

export const isHistoricalOverlayActive = (
  directive: HistoricalInventoryOverlayDirective,
  allowPendingFinalApproval: boolean,
): boolean => {
  if (directive.revokedAt || directive.ownerApprovalStatus === 'revoked'
    || directive.ownerApprovalStatus === 'superseded') return false;
  return directive.ownerApprovalStatus === 'approved'
    || (allowPendingFinalApproval && directive.ownerApprovalStatus === 'pending_final_approval');
};

const LEGACY_HISTORICAL_ACCOUNT_KEY_BY_RUNTIME_ACCOUNT_ID = new Map<string, string>([
  ['O5YOL6B9WF91qcskgfbr', 'seed-account-d1216eb4076ccdf40e20'],
  ['oQlWP1di0KCBunB7TnWb', 'seed-account-391695330f1733e03bb0'],
  ['seed-account-d1216eb4076ccdf40e20', 'seed-account-d1216eb4076ccdf40e20'],
  ['seed-account-391695330f1733e03bb0', 'seed-account-391695330f1733e03bb0'],
]);

const resolveHistoricalAccountKeyForOverlayLookup = (
  account: { id?: string; historicalAccountKey?: string },
): string | undefined => account.historicalAccountKey
  ?? (account.id
    ? LEGACY_HISTORICAL_ACCOUNT_KEY_BY_RUNTIME_ACCOUNT_ID.get(account.id)
    : undefined);

export const approvedHistoricalInventoryOverlaysForAccounts = (
  accounts: readonly { id?: string; historicalAccountKey?: string }[],
): readonly HistoricalInventoryOverlayDirective[] => {
  const selectedByOverlayId = new Map<string, HistoricalInventoryOverlayDirective>();
  for (const account of accounts) {
    if (!account.id) continue;
    const historicalAccountKey = resolveHistoricalAccountKeyForOverlayLookup(account);
    if (!historicalAccountKey) continue;
    for (const directive of APPROVED_HISTORICAL_INVENTORY_OVERLAY_DIRECTIVES) {
      if (directive.historicalAccountKey !== historicalAccountKey
        || selectedByOverlayId.has(directive.overlayId)) continue;
      selectedByOverlayId.set(directive.overlayId, {
        ...directive,
        runtimeInventoryAccountId: account.id,
      });
    }
  }
  return [...selectedByOverlayId.values()];
};

export const approvedHistoricalMerchantLiabilityOpeningsForAccounts = (
  accounts: readonly { id?: string }[],
): readonly HistoricalMerchantLiabilityOpeningDirective[] => {
  const accountIds = new Set(accounts.map(account => account.id).filter(Boolean));
  return APPROVED_HISTORICAL_MERCHANT_LIABILITY_OPENINGS.flatMap(directive => {
    const resolvedMerchantAccountId = [
      directive.merchantAccountId,
      ...(directive.merchantAccountIdAliases ?? []),
    ].find(accountId => accountIds.has(accountId));
    return resolvedMerchantAccountId
      ? [{ ...directive, merchantAccountId: resolvedMerchantAccountId }]
      : [];
  });
};