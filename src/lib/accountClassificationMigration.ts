import type {
  Account,
  CanonicalAccountSubType,
  CanonicalMainType,
  ExplicitWeightedMetal,
  MerchantDirection,
} from '../types';

type ClassificationPatch = Pick<
  Account,
  'canonicalMainType' | 'canonicalSubType' | 'merchantDirection' | 'metal' | 'is_inventory'
>;

interface ConfirmedRule {
  name: string;
  reason: string;
  canonicalSubType: CanonicalAccountSubType;
  canonicalMainType?: CanonicalMainType;
  merchantDirection?: MerchantDirection;
  metal?: ExplicitWeightedMetal;
}

export interface AccountClassificationMigrationItem {
  accountId: string | null;
  name: string;
  before: Partial<ClassificationPatch>;
  after: Partial<ClassificationPatch>;
  reason: string;
  status: 'ready' | 'already_current' | 'skipped' | 'conflict' | 'written';
}

export interface AccountClassificationMigrationReport {
  dryRun: boolean;
  items: AccountClassificationMigrationItem[];
  ready: number;
  written: number;
  alreadyCurrent: number;
  skipped: number;
  conflicts: number;
  missingConfirmedNames: string[];
}

export interface AccountClassificationMigrationOptions {
  /** Writes are disabled unless this is exactly true. */
  executeWrites?: boolean;
  writer?: (accountId: string, patch: Partial<Account>) => Promise<void>;
  logger?: Pick<Console, 'info' | 'warn'>;
}

const RULES: readonly ConfirmedRule[] = [
  ...['\u062e\u0627\u0644\u062f \u062d\u0645\u064a\u062f\u0648', '\u0645\u062d\u0645\u062f \u0627\u0644\u0633\u064a\u062f', '\u0639\u0644\u0627\u0621 \u0635\u0627\u0644\u062d', '\u0627\u0644\u0635\u0627\u0641\u064a'].map(name => ({
    name,
    reason: 'Product-owner confirmed gold merchant payable',
    canonicalMainType: 'liabilities' as const,
    canonicalSubType: 'merchant_gold' as const,
    merchantDirection: 'payable' as const,
    metal: 'gold' as const,
  })),
  {
    name: '\u0633\u0645\u064a\u0631 \u0646\u0627\u0634\u062f',
    reason: 'Product-owner confirmed silver merchant payable',
    canonicalMainType: 'liabilities',
    canonicalSubType: 'merchant_silver',
    merchantDirection: 'payable',
    metal: 'silver',
  },
  {
    name: '\u0627\u0644\u0627\u0621 \u064a\u0627\u0633\u0631',
    reason: 'Product-owner confirmed other weighted due payable',
    canonicalMainType: 'liabilities',
    canonicalSubType: 'other_due',
    merchantDirection: 'payable',
    metal: 'gold',
  },
  ...['\u062f\u064a\u0646\u0627', '\u0639\u0644\u0627 \u062d\u0633\u0646', '\u0634\u0631\u0648\u0642 \u062d\u0628\u0634\u064a'].map(name => ({
    name,
    reason: 'Product-owner confirmed customer; preserve validated legacy direction',
    canonicalSubType: 'customer' as const,
  })),
  ...['\u0644\u0627\u0628\u062a\u0648\u0628', '\u062a\u0644\u064a\u0641\u0648\u0646 \u0627\u0631\u0636\u064a', '\u0645\u0643\u0646\u0629 \u0639\u062f \u0646\u0642\u062f\u064a\u0629'].map(name => ({
    name,
    reason: 'Product-owner confirmed fixed asset',
    canonicalMainType: 'assets' as const,
    canonicalSubType: 'fixed_asset' as const,
  })),
];

const LEGACY_MAIN_TYPES: Readonly<Record<string, CanonicalMainType>> = {
  assets: 'assets',
  liabilities: 'liabilities',
  equity: 'equity',
  revenue: 'revenue',
  expense: 'expense',
  expenses: 'expense',
  '\u0627\u0635\u0648\u0644': 'assets',
  '\u062e\u0635\u0648\u0645': 'liabilities',
  '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629': 'equity',
  '\u0627\u064a\u0631\u0627\u062f\u0627\u062a': 'revenue',
  '\u0645\u0635\u0631\u0648\u0641\u0627\u062a': 'expense',
};

export const normalizeCanonicalMainType = (value?: string | null): CanonicalMainType | null =>
  value ? LEGACY_MAIN_TYPES[value.trim().toLowerCase()] ?? null : null;

const snapshot = (account: Account): Partial<ClassificationPatch> => ({
  canonicalMainType: account.canonicalMainType,
  canonicalSubType: account.canonicalSubType,
  merchantDirection: account.merchantDirection,
  metal: account.metal,
  is_inventory: account.is_inventory,
});

const desiredPatch = (
  account: Account,
  rule: ConfirmedRule,
): { patch?: Partial<ClassificationPatch>; conflict?: string; skipped?: string } => {
  const legacyMainType = normalizeCanonicalMainType(account.mainType);
  const canonicalMainType = rule.canonicalMainType
    ?? account.canonicalMainType
    ?? legacyMainType
    ?? undefined;

  if (!canonicalMainType) {
    return { skipped: 'Customer direction is not structurally available' };
  }
  if (rule.canonicalSubType === 'customer'
    && canonicalMainType !== 'assets'
    && canonicalMainType !== 'liabilities') {
    return { conflict: 'Customer main type must preserve a validated asset or liability direction' };
  }
  if (rule.canonicalMainType && legacyMainType && legacyMainType !== rule.canonicalMainType) {
    return { conflict: 'Legacy mainType conflicts with the confirmed accounting direction' };
  }
  if (account.canonicalMainType && account.canonicalMainType !== canonicalMainType) {
    return { conflict: 'canonicalMainType conflicts with the confirmed classification' };
  }
  if (account.canonicalSubType && account.canonicalSubType !== rule.canonicalSubType) {
    return { conflict: 'canonicalSubType conflicts with the confirmed classification' };
  }
  if (rule.merchantDirection
    && account.merchantDirection
    && account.merchantDirection !== rule.merchantDirection) {
    return { conflict: 'merchantDirection conflicts with the confirmed accounting direction' };
  }
  if (rule.metal && account.metal && account.metal !== rule.metal) {
    return { conflict: 'metal conflicts with the confirmed weighted metal' };
  }
  if (account.is_inventory === true) {
    return { conflict: 'Confirmed due/customer/fixed-asset account cannot be inventory' };
  }

  return {
    patch: {
      canonicalMainType,
      canonicalSubType: rule.canonicalSubType,
      ...(rule.merchantDirection ? { merchantDirection: rule.merchantDirection } : {}),
      ...(rule.metal ? { metal: rule.metal } : {}),
      is_inventory: false,
    },
  };
};

const patchChangesAccount = (account: Account, patch: Partial<ClassificationPatch>): boolean =>
  Object.entries(patch).some(([key, value]) => account[key as keyof Account] !== value);

export const planAccountClassificationMigration = (
  accounts: readonly Account[],
): AccountClassificationMigrationReport => {
  const items: AccountClassificationMigrationItem[] = [];
  const foundNames = new Set<string>();

  for (const rule of RULES) {
    const matches = accounts.filter(account => account.name.trim() === rule.name);
    if (matches.length === 0) continue;
    foundNames.add(rule.name);

    if (matches.length > 1) {
      for (const account of matches) {
        items.push({
          accountId: account.id ?? null,
          name: account.name,
          before: snapshot(account),
          after: snapshot(account),
          reason: 'Duplicate confirmed name; no classification was applied',
          status: 'conflict',
        });
      }
      continue;
    }

    const account = matches[0];
    const result = desiredPatch(account, rule);
    if (!result.patch) {
      items.push({
        accountId: account.id ?? null,
        name: account.name,
        before: snapshot(account),
        after: snapshot(account),
        reason: result.conflict ?? result.skipped ?? 'Uncertain classification',
        status: result.conflict ? 'conflict' : 'skipped',
      });
      continue;
    }

    items.push({
      accountId: account.id ?? null,
      name: account.name,
      before: snapshot(account),
      after: result.patch,
      reason: rule.reason,
      status: patchChangesAccount(account, result.patch) ? 'ready' : 'already_current',
    });
  }

  return {
    dryRun: true,
    items,
    ready: items.filter(item => item.status === 'ready').length,
    written: 0,
    alreadyCurrent: items.filter(item => item.status === 'already_current').length,
    skipped: items.filter(item => item.status === 'skipped').length,
    conflicts: items.filter(item => item.status === 'conflict').length,
    missingConfirmedNames: RULES
      .filter(rule => !foundNames.has(rule.name))
      .map(rule => rule.name),
  };
};

const logItem = (
  logger: Pick<Console, 'info' | 'warn'>,
  item: AccountClassificationMigrationItem,
): void => {
  const payload = {
    accountId: item.accountId,
    name: item.name,
    before: item.before,
    after: item.after,
    reason: item.reason,
    status: item.status,
  };
  const message = `[account-classification] ${JSON.stringify(payload)}`;
  if (item.status === 'conflict' || item.status === 'skipped') logger.warn(message);
  else logger.info(message);
};

/**
 * Safe manual migration entry point. It is not imported by app startup.
 * Dry-run is the default; writes require executeWrites=true and an injected writer.
 */
export const runAccountClassificationMigration = async (
  accounts: readonly Account[],
  options: AccountClassificationMigrationOptions = {},
): Promise<AccountClassificationMigrationReport> => {
  const logger = options.logger ?? console;
  const report = planAccountClassificationMigration(accounts);

  for (const item of report.items) logItem(logger, item);
  for (const name of report.missingConfirmedNames) {
    logger.warn(`[account-classification] missing confirmed account: ${name}`);
  }

  if (options.executeWrites !== true) return report;
  if (!options.writer) {
    throw new Error('executeWrites=true requires an explicit account writer');
  }
  if (report.conflicts > 0 || report.skipped > 0 || report.missingConfirmedNames.length > 0) {
    throw new Error('Refusing writes while uncertain, conflicting, or missing confirmed accounts exist');
  }

  for (const item of report.items) {
    if (item.status !== 'ready') continue;
    if (!item.accountId) {
      throw new Error(`Refusing to write account without id: ${item.name}`);
    }
    await options.writer(item.accountId, item.after);
    item.status = 'written';
    report.written += 1;
    report.ready -= 1;
  }
  report.dryRun = false;
  return report;
};
