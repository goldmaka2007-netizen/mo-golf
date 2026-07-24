import { Account, AccountNature, CanonicalAccountDefinition, Entry } from '../types';
import { getEntryArabicWeight, getMerchantMetals, resolveOperationKind } from './engine';
import { getDynamicAccountNature, getMetricActualValue, getMetricValue } from '../utils/accountLogic';
import { buildLegacyLedgerLegs, legacyLedgerEntityId } from './legacyLedger';
import { splitLegsByPeriod } from './periodLegs';

export type LedgerDimension = 'cash' | 'gold' | 'silver';
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
  if (account.type === 'accessory') return dimension === 'cash';
  // The inventory engine owns merchant metal classification, including legacy
  // merchants whose metal field was never migrated.
  if (account.type === 'merchant') {
    if (dimension === 'cash') return true;
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
  if (account.type === 'merchant' && dimension !== 'cash') {
    return getEntryArabicWeight(resolved, { ...account, metal: dimension });
  }
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
  else if (account.type !== 'accessory') {
    const nature = getDynamicAccountNature(account.name, accounts);
    if (nature === AccountNature.MIXED_GOLD) configured.push('cash', 'gold');
    if (nature === AccountNature.MIXED_SILVER) configured.push('cash', 'silver');
  }
  configured.forEach(dimension => historical.add(dimension));
  return (['cash', 'gold', 'silver'] as const).filter(dimension => historical.has(dimension));
};

export const buildLedgerReport = (
  entries: Entry[],
  accounts: Account[],
  account: Account,
  dimension: LedgerDimension,
  startDate: string,
  endDate: string,
  canonicalDefinitions?: CanonicalAccountDefinition[],
): LedgerReport => {
  const entityId = legacyLedgerEntityId(account);
  const legs = buildLegacyLedgerLegs(entries, accounts, canonicalDefinitions)
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

export const formatCash = (amount: number): string => `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} جنيه`;
export const formatWeight = (amount: number): string => `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} جم`;
export const formatLedgerAmount = (amount: number, dimension: LedgerDimension): string => dimension === 'cash' ? formatCash(amount) : formatWeight(amount);

export const formatBalance = (balance: number, dimension: LedgerDimension): string => {
  const nature = balance < 0 ? 'دائن' : 'مدين';
  return `${formatLedgerAmount(Math.abs(balance), dimension)} ${nature}`;
};

const escapeCsv = (value: string): string => `"${value.replace(/"/g, '""')}"`;

export const buildLedgerCsv = (args: {
  accountName: string; dimension: LedgerDimension; startDate: string; endDate: string;
  report: LedgerReport; rows: LedgerRow[]; goldDisplayMode: GoldDisplayMode;
}): string => {
  const { accountName, dimension, startDate, endDate, report, rows, goldDisplayMode } = args;
  const amount = (row: LedgerRow, value: number): string =>
    goldDisplayMode === 'original' && dimension === 'gold' && row.originalWeight !== undefined && row.karat
      ? `${formatLedgerAmount(row.originalWeight, 'gold')} — عيار ${row.karat}`
      : formatLedgerAmount(value, dimension);
  const metadata = [
    ['اسم الحساب', accountName], ['البعد', dimension === 'cash' ? 'نقدية' : dimension === 'gold' ? 'ذهب' : 'فضة'],
    ['من تاريخ', startDate], ['إلى تاريخ', endDate], ['رصيد أول المدة', formatBalance(report.openingBalance, dimension)],
    ['إجمالي المدين', formatLedgerAmount(report.totalDebit, dimension)], ['إجمالي الدائن', formatLedgerAmount(report.totalCredit, dimension)],
    ['رصيد آخر المدة', formatBalance(report.closingBalance, dimension)], [],
  ];
  const lines = metadata.map(row => row.map(cell => escapeCsv(cell)).join(','));
  lines.push(['التاريخ', 'رقم العملية', 'البيان', 'مدين', 'دائن', 'الرصيد'].map(escapeCsv).join(','));
  lines.push(['', '', 'رصيد أول المدة', '', '', formatBalance(report.openingBalance, dimension)].map(escapeCsv).join(','));
  rows.forEach(row => lines.push([
    row.date, row.operationNumber, `${row.operationType} — ${row.oppositeAccount}`,
    amount(row, row.debit), amount(row, row.credit), formatBalance(row.balance, dimension),
  ].map(escapeCsv).join(',')));
  return `\uFEFF${lines.join('\r\n')}`;
};

export const getAccountGroup = (account: Account): string => {
  if (account.type === 'cash') return 'الخزنة';
  if (account.type === 'merchant') return 'التجار';
  if (account.type === 'accessory') return 'الأصناف — ملحقات';
  if (account.metal === 'gold') return 'الأصناف — ذهب';
  if (account.metal === 'silver') return 'الأصناف — فضة';
  if (['revenue', 'revenues', 'إيرادات', 'الإيرادات', 'ايرادات', 'الايرادات'].includes(account.mainType)) return 'الإيرادات';
  if (['expense', 'expenses', 'مصروفات', 'المصروفات'].includes(account.mainType)) return 'المصروفات';
  if (['equity', 'حقوق ملكية', 'حقوق الملكية'].includes(account.mainType)) return 'حقوق الملكية';
  return 'الأصناف';
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
  return [...grouped].map(([label, groupAccounts]) => ({ id: label, label, accounts: groupAccounts }));
};
