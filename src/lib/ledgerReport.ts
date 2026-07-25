import { Account, AccountNature, CanonicalAccountDefinition, Entry } from '../types';
import { getEntryArabicWeight, getMerchantMetals, resolveOperationKind } from './engine';
import { getDynamicAccountNature, getMetricActualValue, getMetricValue } from '../utils/accountLogic';
import { buildLegacyLedgerLegs, legacyLedgerEntityId, type LegacyLedgerBuildOptions } from './legacyLedger';
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

const accountMatches = (entry: Entry, side: 'debit' | 'credit', account: Account): boolean => {
  const entryId = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const entryName = side === 'debit' ? entry.debit : entry.credit;
  return entryId ? entryId === account.id : entryName === account.name;
};

/** Account metadata defines which dimensions an account may own. An entry's
 * cash/weight payload never grants a dimension to the other side. */
const supportsDimension = (account: Account, dimension: LedgerDimension, _accounts: Account[], entries: Entry[] = []): boolean => {
  if (account.type === 'accessory') return dimension === 'quantity';
  // The inventory engine owns merchant metal classification, including legacy
  // merchants whose metal field was never migrated.
  if (account.type === 'merchant') {
    if (dimension === 'cash') return true;
    if (dimension === 'quantity') return false;
    return getMerchantMetals(account, entries, _accounts).includes(dimension);
  }
  if (account.is_inventory || ['gold_product', 'gold_raw', 'gold_direct'].includes(account.type || '')) return dimension === 'gold';
  if (account.type === 'silver' || account.metal === 'silver') return dimension === 'silver';
  if (account.metal === 'gold') return dimension === 'gold';
  const nature = getDynamicAccountNature(account.name, _accounts);
  if (nature === AccountNature.MIXED_GOLD) return dimension === 'cash' || dimension === 'gold';
  if (nature === AccountNature.MIXED_SILVER) return dimension === 'cash' || dimension === 'silver';
  return dimension === 'cash';
};

const entryWithMasterNames = (entry: Entry, accounts: Account[]): Entry => {
  const debit = entry.debitAccountId ? accounts.find(account => account.id === entry.debitAccountId)?.name ?? entry.debit : entry.debit;
  const credit = entry.creditAccountId ? accounts.find(account => account.id === entry.creditAccountId)?.name ?? entry.credit : entry.credit;
  return debit === entry.debit && credit === entry.credit ? entry : { ...entry, debit, credit };
};

const valueFor = (entry: Entry, account: Account, dimension: LedgerDimension, accounts: Account[]): number => {
  if (!supportsDimension(account, dimension, accounts, [entry])) return 0;
  const resolved = entryWithMasterNames(entry, accounts);
  // Match the exact merchant-weight calculation used by processInventory. It
  // intentionally does not require the opposite side to be a metal account.
  if (account.type === 'merchant' && (dimension === 'gold' || dimension === 'silver')) {
    return getEntryArabicWeight(resolved, { ...account, metal: dimension });
  }
  if (dimension === 'quantity') return getMetricValue(resolved, 'accs', accounts);
  return dimension === 'cash' ? getMetricValue(resolved, 'cash', accounts) : getMetricValue(resolved, dimension, accounts);
};

const originalWeightFor = (entry: Entry, dimension: LedgerDimension, accounts: Account[]): number | undefined => {
  if (dimension !== 'gold') return undefined;
  const value = getMetricActualValue(entry, 'gold', accounts);
  return value > 0 && typeof entry.karat === 'number' ? value : undefined;
};

const compareEntries = (a: Entry, b: Entry): number => (a.date || '').localeCompare(b.date || '');

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
  const legs = buildLegacyLedgerLegs(entries, accounts, canonicalDefinitions, options)
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

export const getAccountGroup = (account: Account): string => {
  if (account.type === 'cash') return '\u0627\u0644\u062e\u0632\u0646\u0629';
  if (account.type === 'merchant') return '\u0627\u0644\u062a\u062c\u0627\u0631';
  if (account.type === 'accessory') return '\u0627\u0644\u0623\u0635\u0646\u0627\u0641 - \u0645\u0644\u062d\u0642\u0627\u062a';
  if (account.metal === 'gold') return '\u0627\u0644\u0623\u0635\u0646\u0627\u0641 - \u0630\u0647\u0628';
  if (account.metal === 'silver') return '\u0627\u0644\u0623\u0635\u0646\u0627\u0641 - \u0641\u0636\u0629';
  if (['revenue', 'revenues', '\u0625\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u0644\u0627\u064a\u0631\u0627\u062f\u0627\u062a'].includes(account.mainType)) return '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a';
  if (['expense', 'expenses', '\u0645\u0635\u0631\u0648\u0641\u0627\u062a', '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a'].includes(account.mainType)) return '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a';
  if (['equity', '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629', '\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629'].includes(account.mainType)) return '\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629';
  return '\u0627\u0644\u0623\u0635\u0646\u0627\u0641';
};export const getAccountNature = (account: Account, accounts: Account[]): AccountNature => {
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
  return [...grouped].map(([label, groupAccounts]) => ({ id: label, label, accounts: groupAccounts }));
};

