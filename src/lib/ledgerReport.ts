import { Account, AccountNature, CanonicalAccountDefinition, Entry } from '../types';
import { getMerchantMetals } from './engine';
import { getDynamicAccountNature, getMetricActualValue } from '../utils/accountLogic';
import { buildLegacyLedgerLegs, legacyLedgerEntityId, type LegacyLedgerBuildOptions } from './legacyLedger';
import { buildFinancialPostingProjection } from './postingProjection';
import { splitLegsByPeriod } from './periodLegs';

export type LedgerDimension = 'cash' | 'gold' | 'silver' | 'quantity';
export type GoldDisplayMode = 'equivalent21' | 'original';

export interface LedgerRow {
  entry: Entry;
  date: string;
  operationNumber: string;
  operationType: string;
  oppositeAccount: string;
  debit: number;
  credit: number;
  balance: number;
  originalWeight?: number;
  karat?: number;
}

export interface LedgerReport {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  rows: LedgerRow[];
}

const creditMainTypes = new Set(['liability', 'liabilities', 'equity', 'revenue', 'revenues', 'خصوم', 'الخصوم', 'حقوق ملكية', 'حقوق الملكية', 'إيرادات', 'الإيرادات', 'ايرادات', 'الايرادات']);

export const getAccountKey = (account: Account): string => account.id || account.name;
export const isCreditNatureAccount = (account: Account | undefined): boolean => !!account && creditMainTypes.has(account.mainType);

const originalWeightFor = (entry: Entry, dimension: LedgerDimension, accounts: Account[]): number | undefined => {
  if (dimension !== 'gold') return undefined;
  const value = getMetricActualValue(entry, 'gold', accounts);
  return value > 0 && typeof entry.karat === 'number' ? value : undefined;
};


/** The only user-facing operation identifier in the persisted model is invoiceNumber. */
export const getVisibleOperationNumber = (entry: Entry): string => entry.invoiceNumber || String(entry.seq || '');

export const getAvailableDimensions = (account: Account, entries: Entry[], accounts: Account[]): LedgerDimension[] => {
  const historical = new Set(buildLegacyLedgerLegs(entries, accounts).filter(leg => leg.entityId === legacyLedgerEntityId(account)).map(leg => leg.dimension));
  const configured: LedgerDimension[] = [];
  if (account.type === 'merchant') configured.push('cash', ...getMerchantMetals(account, entries, accounts));
  else if (account.type === 'cash') configured.push('cash');
  else if (account.metal === 'gold' || ['gold_product', 'gold_raw', 'gold_direct'].includes(account.type ?? '')) configured.push('gold');
  else if (account.metal === 'silver' || account.type === 'silver') configured.push('silver');
  else if (account.type === 'accessory') configured.push('quantity');
  else {
    const nature = getDynamicAccountNature(account.name, accounts);
    if (nature === AccountNature.MIXED_GOLD) configured.push('cash', 'gold');
    if (nature === AccountNature.MIXED_SILVER) configured.push('cash', 'silver');
  }
  configured.forEach(dimension => historical.add(dimension));
  return (['cash', 'gold', 'silver', 'quantity'] as const).filter(dimension => historical.has(dimension));
};

export const buildLedgerReport = (
  entries: Entry[],
  accounts: Account[],
  account: Account,
  dimension: LedgerDimension,
  startDate: string,
  endDate: string,
  canonicalDefinitions?: CanonicalAccountDefinition[],
  options: LegacyLedgerBuildOptions = {},
): LedgerReport => {
  const entityId = legacyLedgerEntityId(account);
  const isOperationalMerchantStatement =
    account.type === 'merchant' && options.merchantStatementMode === 'operational';
  const sourceLegs = options.enableFinancialProjection && !isOperationalMerchantStatement
    ? buildFinancialPostingProjection(entries, accounts, canonicalDefinitions, options.costTimeline).legs
    : buildLegacyLedgerLegs(entries, accounts, canonicalDefinitions,
      isOperationalMerchantStatement ? { ...options, enableFinancialProjection: false } : options);
  const legs = sourceLegs
    .filter(leg => leg.entityId === entityId && leg.dimension === dimension)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (legs.length) {
    const normalBalance = legs[0].account.normalBalance;
    const { openingLegs, periodLegs } = splitLegsByPeriod(legs, startDate, endDate);
    let openingBalance = 0; let runningBalance = 0; const rows: LedgerRow[] = [];
    openingLegs.forEach(leg => {
      const change = normalBalance === 'credit' ? (leg.side === 'credit' ? leg.amount : -leg.amount) : (leg.side === 'debit' ? leg.amount : -leg.amount);
      openingBalance += change;
    });
    periodLegs.forEach(leg => {
      const change = normalBalance === 'credit' ? (leg.side === 'credit' ? leg.amount : -leg.amount) : (leg.side === 'debit' ? leg.amount : -leg.amount);
      runningBalance += change;
      rows.push({ entry: leg.entry, date: leg.date, operationNumber: getVisibleOperationNumber(leg.entry), operationType: leg.entry.tx || leg.operationKind || 'عملية', oppositeAccount: leg.oppositeAccount, debit: leg.side === 'debit' ? leg.amount : 0, credit: leg.side === 'credit' ? leg.amount : 0, balance: openingBalance + runningBalance, originalWeight: originalWeightFor(leg.entry, dimension, accounts), karat: leg.entry.karat });
    });
    return { openingBalance, totalDebit: rows.reduce((total, row) => total + row.debit, 0), totalCredit: rows.reduce((total, row) => total + row.credit, 0), closingBalance: openingBalance + runningBalance, rows };
  }
  return { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, rows: [] };
};

export const filterLedgerRows = (rows: LedgerRow[], operationType: string, oppositeAccount: string): LedgerRow[] =>
  rows.filter(row =>
    (!operationType || row.operationType === operationType) &&
    (!oppositeAccount || row.oppositeAccount === oppositeAccount),
  );

export const getFilteredTotals = (rows: LedgerRow[]): Pick<LedgerReport, 'totalDebit' | 'totalCredit'> => ({
  totalDebit: rows.reduce((total, row) => total + row.debit, 0),
  totalCredit: rows.reduce((total, row) => total + row.credit, 0),
});

export const formatCash = (amount: number): string => `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} \u062c\u0646\u064a\u0647`;
export const formatWeight = (amount: number): string => `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u062c\u0645`;
export const formatQuantity = (amount: number): string => `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} \u0642\u0637\u0639\u0629`;
export const formatLedgerAmount = (amount: number, dimension: LedgerDimension): string => dimension === 'cash' ? formatCash(amount) : dimension === 'quantity' ? formatQuantity(amount) : formatWeight(amount);

export const formatBalance = (balance: number, dimension: LedgerDimension): string => {
  const nature = balance < 0 ? '\u062f\u0627\u0626\u0646' : '\u0645\u062f\u064a\u0646';
  const magnitude = balance < 0 ? -balance : balance;
  return `${formatLedgerAmount(magnitude, dimension)} ${nature}`;
};

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export const buildLedgerCsv = (args: {
  accountName: string; dimension: LedgerDimension; startDate: string; endDate: string;
  report: LedgerReport; rows: LedgerRow[]; goldDisplayMode: GoldDisplayMode;
}): string => {
  const { accountName, dimension, startDate, endDate, report, rows, goldDisplayMode } = args;
  const amount = (row: LedgerRow, value: number): string =>
    goldDisplayMode === 'original' && dimension === 'gold' && row.originalWeight !== undefined && row.karat
      ? `${formatLedgerAmount(row.originalWeight, 'gold')} - \u0639\u064a\u0627\u0631 ${row.karat}`
      : formatLedgerAmount(value, dimension);
  const labels = {
    accountName: '\u0627\u0633\u0645 \u0627\u0644\u062d\u0633\u0627\u0628',
    dimension: '\u0627\u0644\u0628\u0639\u062f',
    cash: '\u0646\u0642\u062f\u064a\u0629',
    gold: '\u0630\u0647\u0628',
    silver: '\u0641\u0636\u0629',
    quantity: '\u0639\u062f\u062f',
    fromDate: '\u0645\u0646 \u062a\u0627\u0631\u064a\u062e',
    toDate: '\u0625\u0644\u0649 \u062a\u0627\u0631\u064a\u062e',
    openingBalance: '\u0631\u0635\u064a\u062f \u0623\u0648\u0644 \u0627\u0644\u0645\u062f\u0629',
    totalDebit: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062f\u064a\u0646',
    totalCredit: '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062f\u0627\u0626\u0646',
    closingBalance: '\u0631\u0635\u064a\u062f \u0622\u062e\u0631 \u0627\u0644\u0645\u062f\u0629',
    date: '\u0627\u0644\u062a\u0627\u0631\u064a\u062e',
    operationNumber: '\u0631\u0642\u0645 \u0627\u0644\u0639\u0645\u0644\u064a\u0629',
    description: '\u0627\u0644\u0628\u064a\u0627\u0646',
    debit: '\u0645\u062f\u064a\u0646',
    credit: '\u062f\u0627\u0626\u0646',
    balance: '\u0627\u0644\u0631\u0635\u064a\u062f',
  } as const;
  const dimensionLabel = dimension === 'cash' ? labels.cash : dimension === 'gold' ? labels.gold : dimension === 'silver' ? labels.silver : labels.quantity;
  const metadata = [
    [labels.accountName, accountName], [labels.dimension, dimensionLabel],
    [labels.fromDate, startDate], [labels.toDate, endDate], [labels.openingBalance, formatBalance(report.openingBalance, dimension)],
    [labels.totalDebit, formatLedgerAmount(report.totalDebit, dimension)], [labels.totalCredit, formatLedgerAmount(report.totalCredit, dimension)],
    [labels.closingBalance, formatBalance(report.closingBalance, dimension)], [],
  ];
  const lines = metadata.map(row => row.map(cell => escapeCsv(cell)).join(','));
  lines.push([labels.date, labels.operationNumber, labels.description, labels.debit, labels.credit, labels.balance].map(escapeCsv).join(','));
  lines.push(['', '', labels.openingBalance, '', '', formatBalance(report.openingBalance, dimension)].map(escapeCsv).join(','));
  rows.forEach(row => lines.push([
    row.date, row.operationNumber, `${row.operationType} - ${row.oppositeAccount}`,
    amount(row, row.debit), amount(row, row.credit), formatBalance(row.balance, dimension),
  ].map(escapeCsv).join(',')));
  return `\uFEFF${lines.join('\r\n')}`;
};

export const LEDGER_ACCOUNT_GROUPS = {
  cash: '\u0627\u0644\u062e\u0632\u0646\u0629 / \u0627\u0644\u0646\u0642\u062f\u064a\u0629',
  inventory_gold: '\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0630\u0647\u0628',
  inventory_silver: '\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0641\u0636\u0629',
  inventory_accessory: '\u0627\u0644\u0645\u0644\u062d\u0642\u0627\u062a',
  merchant_gold: '\u062a\u062c\u0627\u0631 \u0627\u0644\u0630\u0647\u0628',
  merchant_silver: '\u062a\u062c\u0627\u0631 \u0627\u0644\u0641\u0636\u0629',
  customer: '\u0627\u0644\u0639\u0645\u0644\u0627\u0621',
  fixed_asset: '\u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u062b\u0627\u0628\u062a\u0629',
  other_due: '\u0630\u0645\u0645 \u0623\u062e\u0631\u0649',
  expense: '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a',
  revenue: '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a',
  equity: '\u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644 \u0648\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629',
  unclassified: '\u063a\u064a\u0631 \u0645\u0635\u0646\u0641',
} as const;

export type LedgerAccountGroupId = keyof typeof LEDGER_ACCOUNT_GROUPS;

const canonicalSubTypeFor = (account: Account): string => {
  if (account.canonicalSubType) return account.canonicalSubType;
  const legacySubTypes: Record<string, string> = {
    '\u0627\u0644\u0646\u0642\u062f\u064a\u0629 \u0628\u0627\u0644\u062e\u0632\u0646\u0629': 'cash',
    '\u0645\u062e\u0632\u0648\u0646 \u0630\u0647\u0628': 'inventory_gold',
    '\u0645\u062e\u0632\u0648\u0646 \u0641\u0636\u0629': 'inventory_silver',
    '\u0645\u062e\u0632\u0648\u0646 \u0645\u0644\u062d\u0642\u0627\u062a \u0627\u0636\u0627\u0641\u064a\u0629': 'inventory_accessory',
    '\u0627\u0635\u0648\u0644 \u062b\u0627\u0628\u062a\u0629': 'fixed_asset',
    '\u0630\u0645\u0645 \u0645\u062f\u064a\u0646\u0629': 'customer',
    '\u062a\u062c\u0627\u0631 \u0630\u0647\u0628': 'merchant_gold',
    '\u062a\u062c\u0627\u0631 \u0641\u0636\u0629': 'merchant_silver',
    '\u0631\u0627\u0633 \u0627\u0644\u0645\u0627\u0644': 'capital',
  };
  return legacySubTypes[account.subType] ?? account.subType;
};

export const getLedgerAccountGroupId = (account: Account): LedgerAccountGroupId => {
  const subType = canonicalSubTypeFor(account);
  if (subType === 'cash') return 'cash';
  if (subType === 'inventory_gold' && account.is_inventory === true) return 'inventory_gold';
  if (subType === 'inventory_silver' && account.is_inventory === true) return 'inventory_silver';
  if (subType === 'inventory_accessory' && account.is_inventory === true) return 'inventory_accessory';
  if (subType === 'merchant_gold') return 'merchant_gold';
  if (subType === 'merchant_silver') return 'merchant_silver';
  if (subType === 'customer') return 'customer';
  if (subType === 'fixed_asset') return 'fixed_asset';
  if (subType === 'other_due') return 'other_due';
  if (['capital', 'withdrawals', 'retained_earnings'].includes(subType)) return 'equity';
  if (subType === 'revenue') return 'revenue';
  if (subType === 'expense') return 'expense';
  if (subType === 'unclassified') return 'unclassified';

  if (account.type === 'cash') return 'cash';
  if (account.type === 'merchant' && account.metal === 'gold') return 'merchant_gold';
  if (account.type === 'merchant' && account.metal === 'silver') return 'merchant_silver';
  if (account.is_inventory === true && account.type === 'accessory') return 'inventory_accessory';
  if (account.is_inventory === true && account.metal === 'gold') return 'inventory_gold';
  if (account.is_inventory === true && account.metal === 'silver') return 'inventory_silver';
  const mainType = account.canonicalMainType ?? account.mainType;
  if (['revenue', 'revenues', '\u0625\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u064a\u0631\u0627\u062f\u0627\u062a'].includes(mainType)) return 'revenue';
  if (['expense', 'expenses', '\u0645\u0635\u0631\u0648\u0641\u0627\u062a'].includes(mainType)) return 'expense';
  if (['equity', '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629'].includes(mainType)) return 'equity';
  return 'unclassified';
};

export const getAccountGroup = (account: Account): string =>
  LEDGER_ACCOUNT_GROUPS[getLedgerAccountGroupId(account)];

export interface LedgerUnclassifiedAccount {
  accountId: string;
  accountName: string;
  mainType: string;
  subType: string;
  reason: string;
}

export const getUnclassifiedLedgerAccounts = (accounts: Account[]): LedgerUnclassifiedAccount[] =>
  accounts
    .filter(account => account.isActive !== false && getLedgerAccountGroupId(account) === 'unclassified')
    .map(account => ({
      accountId: account.id ?? '',
      accountName: account.name,
      mainType: account.canonicalMainType ?? account.mainType,
      subType: account.canonicalSubType ?? account.subType,
      reason: canonicalSubTypeFor(account).startsWith('inventory_') && account.is_inventory !== true
        ? 'Inventory subtype requires is_inventory === true'
        : 'No supported structural subtype or main/type/metal classification',
    }));

let lastUnclassifiedLedgerWarning = '';
export const warnUnclassifiedLedgerAccounts = (warnings: LedgerUnclassifiedAccount[]): void => {
  const fingerprint = JSON.stringify(warnings);
  if (!warnings.length) {
    lastUnclassifiedLedgerWarning = '';
    return;
  }
  if (fingerprint === lastUnclassifiedLedgerWarning) return;
  lastUnclassifiedLedgerWarning = fingerprint;
  console.warn('Unclassified historical ledger accounts', warnings);
};

export const getAccountNature = (account: Account, accounts: Account[]): AccountNature => {
  const found = accounts.find(item => getAccountKey(item) === getAccountKey(account));
  return found?.metal === 'gold' ? AccountNature.GOLD : found?.metal === 'silver' ? AccountNature.SILVER : AccountNature.CASH;
};

export interface LedgerSelectableEntity {
  ledgerEntityId: string;
  sourceEntityId: string;
  entityType: 'account' | 'product' | 'merchant' | 'accessory';
  displayName: string;
  primaryGroup: string;
  account: Account;
}
export interface LedgerAccountGroup { id: string; label: string; accounts: LedgerSelectableEntity[]; }

type AccountWithSource = Account & Record<string, unknown>;
const normalizedId = (value: unknown): string => String(value ?? '').trim();
const entityTypeFor = (account: Account): LedgerSelectableEntity['entityType'] => account.type === 'merchant' ? 'merchant' : account.type === 'accessory' ? 'accessory' : account.is_inventory || ['gold_product', 'gold_raw', 'gold_direct', 'silver'].includes(account.type || '') ? 'product' : 'account';
const sourceEntityIdFor = (account: AccountWithSource): string => normalizedId(account.ledgerEntityId ?? account.sourceEntityId ?? account.accountId ?? account.productId ?? account.merchantId ?? account.partyId ?? account.id);

/** Converts all master/adaptor shapes into exactly one ledger entity. */
export const buildLedgerAccountSelection = (accounts: Account[], search = ''): LedgerAccountGroup[] => {
  const query = search.trim();
  const selected = new Map<string, LedgerSelectableEntity>();
  const directDocumentByName = new Map<string, LedgerSelectableEntity>();
  accounts.filter(account => account.isActive !== false).forEach((raw, index) => {
    const account = raw as AccountWithSource;
    const sourceEntityId = sourceEntityIdFor(account);
    const legacyName = normalizedId(account.name);
    const entityType = entityTypeFor(account);
    const ledgerEntityId = sourceEntityId ? `${entityType}:${sourceEntityId}` : `${entityType}:legacy:${legacyName}`;
    // Direct Firestore account documents have only their document ID. Their
    // canonical business identity is type + normalized name; adapters carry an
    // explicit entity ID and keep that stronger identity.
    const adapterEntityId = normalizedId(account.ledgerEntityId ?? account.sourceEntityId ?? account.accountId ?? account.productId ?? account.merchantId ?? account.partyId);
    const identityKey = `${entityType}:entity:${adapterEntityId || sourceEntityId || legacyName}`;
    const nameKey = `${entityType}:name:${legacyName}`;
    if (query && !account.name.includes(query)) return;
    const candidate: LedgerSelectableEntity = { ledgerEntityId, sourceEntityId: sourceEntityId || legacyName, entityType, displayName: account.name, primaryGroup: getAccountGroup(account), account };
    const existing = selected.get(identityKey) ?? (!adapterEntityId ? directDocumentByName.get(nameKey) : undefined);
    if (existing && import.meta.env.DEV) {
      console.warn('Duplicate final ledger selection entity', [existing, candidate].map((item, pairIndex) => ({
        displayName: item.displayName,
        ledgerEntityId: item.ledgerEntityId,
        sourceEntityId: item.sourceEntityId,
        firestoreDocumentId: item.account.id,
        entityType: item.entityType,
        primaryGroup: item.primaryGroup,
        reactKey: item.ledgerEntityId,
        originalSourceObject: item.account,
        index: pairIndex === 0 ? accounts.indexOf(item.account) : index,
      })));
    }
    // Explicit adapter identity wins; otherwise preserve the first Firestore
    // document and discard its duplicate-name fallback row.
    if (!existing || (!!adapterEntityId && !normalizedId((existing.account as AccountWithSource).ledgerEntityId ?? (existing.account as AccountWithSource).sourceEntityId ?? (existing.account as AccountWithSource).accountId ?? (existing.account as AccountWithSource).productId ?? (existing.account as AccountWithSource).merchantId ?? (existing.account as AccountWithSource).partyId))) {
      selected.set(identityKey, candidate);
      if (!adapterEntityId) directDocumentByName.set(nameKey, candidate);
    }
  });
  const grouped = new Map<string, LedgerSelectableEntity[]>();
  selected.forEach(entity => grouped.set(entity.primaryGroup, [...(grouped.get(entity.primaryGroup) || []), entity]));
  return (Object.entries(LEDGER_ACCOUNT_GROUPS) as Array<[LedgerAccountGroupId, string]>)
    .map(([id, label]) => ({ id, label, accounts: grouped.get(label) ?? [] }))
    .filter(group => group.accounts.length > 0);
};

