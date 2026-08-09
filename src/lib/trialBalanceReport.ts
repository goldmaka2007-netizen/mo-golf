import type { CanonicalAccountSubType } from '../types';
import { computePeriodAccountBalances, type AccountBalanceResult, type PeriodAccountBalancesResult } from './engine';
import { formatLedgerAmount, type LedgerDimension } from './ledgerReport';
import { splitBalanceByDirection } from './balanceDirection';

export type TrialBalanceGroupId = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses' | 'unclassified';
export interface TrialBalanceAmounts { openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number; closingDebit: number; closingCredit: number; }
export interface TrialBalanceRow extends TrialBalanceAmounts { entityId: string; accountName: string; description: string; group: TrialBalanceGroupId; order: number; }
export interface TrialBalanceGroup extends TrialBalanceAmounts { id: TrialBalanceGroupId; label: string; rows: TrialBalanceRow[]; }
export interface TrialBalanceReport extends TrialBalanceAmounts {
  balanceEngineVersion: string;
  dimension: LedgerDimension;
  source: 'balance_engine';
  groups: TrialBalanceGroup[];
  balanced: boolean;
  difference: number;
  differenceSide: 'debit' | 'credit' | null;
}

const labels: Record<TrialBalanceGroupId, string> = {
  assets: 'الأصول', liabilities: 'الخصوم', equity: 'حقوق الملكية', revenue: 'الإيرادات', expenses: 'المصروفات', unclassified: 'غير مصنف',
};
const descriptions: Partial<Record<CanonicalAccountSubType, string>> = {
  cash: 'خزنة', inventory_gold: 'مخزون ذهب', inventory_silver: 'مخزون فضة', inventory_accessory: 'ملحقات',
  merchant_gold: 'تاجر ذهب', merchant_silver: 'تاجر فضة', other_due: 'ذمم أخرى', customer: 'عميل',
  fixed_asset: 'أصل ثابت', capital: 'رأس المال', retained_earnings: 'أرباح محتجزة', withdrawals: 'مسحوبات', revenue: 'إيراد', expense: 'مصروف', unclassified: 'غير مصنف',
};
const tolerance = (dimension: LedgerDimension): number => dimension === 'cash' || dimension === 'book_value' ? 0.0001 : 0.000001;
const zero = (value: number, dimension: LedgerDimension): boolean => Math.abs(value) <= tolerance(dimension);
const empty = (): TrialBalanceAmounts => ({ openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 });
const amountKeys: Array<keyof TrialBalanceAmounts> = ['openingDebit', 'openingCredit', 'periodDebit', 'periodCredit', 'closingDebit', 'closingCredit'];
const add = (target: TrialBalanceAmounts, source: TrialBalanceAmounts): void => { amountKeys.forEach(key => { target[key] += source[key]; }); };
const split = (signedDebitBalance: number): [number, number] => {
  const resolved = splitBalanceByDirection({ signedBalance: signedDebitBalance, normalBalance: 'debit' });
  return [resolved.debit, resolved.credit];
};
const groupFor = (balance: AccountBalanceResult): TrialBalanceGroupId => balance.mainType === 'expense' ? 'expenses' : balance.mainType;
const entityIdFor = (balance: AccountBalanceResult): string => balance.isMerchant ? `merchant:${balance.accountId}` : balance.subType.startsWith('inventory_') ? `product:${balance.accountId}` : `account:${balance.accountId}`;
const rawBalanceFor = (balance: AccountBalanceResult, dimension: LedgerDimension): number => {
  const value = dimension === 'cash' ? balance.cashBalance
    : dimension === 'gold' ? balance.goldE21Balance
      : dimension === 'silver' ? balance.silverBalance
        : balance.quantityBalance;
  return ['liabilities', 'equity', 'revenue'].includes(balance.mainType)
    ? -value
    : value;
};

/** Pure report projection: Journal entries are accepted only by computePeriodAccountBalances(). */
export function buildTrialBalanceReport(computed: PeriodAccountBalancesResult, dimension: LedgerDimension): TrialBalanceReport;
/** @deprecated Compatibility adapter. New code must call computePeriodAccountBalances first. */
export function buildTrialBalanceReport(
  entries: Parameters<typeof computePeriodAccountBalances>[0],
  accounts: Parameters<typeof computePeriodAccountBalances>[1],
  dimension: LedgerDimension,
  startDate: string,
  endDate: string,
  ..._legacyOptions: unknown[]
): TrialBalanceReport;
export function buildTrialBalanceReport(
  input: PeriodAccountBalancesResult | Parameters<typeof computePeriodAccountBalances>[0],
  dimensionOrAccounts: LedgerDimension | Parameters<typeof computePeriodAccountBalances>[1],
  legacyDimension?: LedgerDimension,
  startDate?: string,
  endDate?: string,
  ..._legacyOptions: unknown[]
): TrialBalanceReport {
  const balancePeriod = Array.isArray(input)
    ? computePeriodAccountBalances(input, dimensionOrAccounts as Parameters<typeof computePeriodAccountBalances>[1], startDate ?? '', endDate ?? '')
    : input;
  const dimension = (Array.isArray(input) ? legacyDimension : dimensionOrAccounts) as LedgerDimension;
  const rowsByGroup = new Map<TrialBalanceGroupId, TrialBalanceRow[]>();
  [...balancePeriod.closing.balances.values()].forEach((closingBalance, order) => {
    const accountId = closingBalance.accountId;
    const openingMovement = balancePeriod.opening.movements.get(accountId);
    const periodMovement = balancePeriod.period.movements.get(accountId);
    const openingDebitMovement = openingMovement?.[dimension].debit ?? 0;
    const openingCreditMovement = openingMovement?.[dimension].credit ?? 0;
    const periodDebit = periodMovement?.[dimension].debit ?? 0;
    const periodCredit = periodMovement?.[dimension].credit ?? 0;
    const openingDebit = openingDebitMovement;
    const openingCredit = openingCreditMovement;
    const movementClosing = openingDebitMovement + periodDebit - openingCreditMovement - periodCredit;
    const rawClosing = rawBalanceFor(closingBalance, dimension);
    const exactnessTolerance = Number.EPSILON * Math.max(1, Math.abs(movementClosing), Math.abs(rawClosing)) * 16;
    const closing = Math.abs(movementClosing - rawClosing) <= exactnessTolerance
      ? rawClosing
      : movementClosing;
    const [closingDebit, closingCredit] = split(closing);
    const row: TrialBalanceRow = {
      entityId: entityIdFor(closingBalance), accountName: closingBalance.accountName,
      description: descriptions[closingBalance.subType] ?? closingBalance.subType,
      group: groupFor(closingBalance), order,
      openingDebit, openingCredit, periodDebit, periodCredit, closingDebit, closingCredit,
    };
    if (amountKeys.every(key => zero(row[key], dimension))) return;
    rowsByGroup.set(row.group, [...(rowsByGroup.get(row.group) ?? []), row]);
  });

  const totals = empty();
  const ordered: TrialBalanceGroupId[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses', 'unclassified'];
  const groups = ordered.flatMap(id => {
    const rows = rowsByGroup.get(id);
    if (!rows?.length) return [];
    rows.sort((a, b) => a.order - b.order || a.accountName.localeCompare(b.accountName, 'ar'));
    const group: TrialBalanceGroup = { id, label: labels[id], rows, ...empty() };
    rows.forEach(row => add(group, row)); add(totals, group); return [group];
  });
  const difference = Math.abs(totals.closingDebit - totals.closingCredit);
  return {
    balanceEngineVersion: balancePeriod.balanceEngineVersion, dimension, source: 'balance_engine', groups, ...totals,
    balanced: zero(difference, dimension), difference: zero(difference, dimension) ? 0 : difference,
    differenceSide: zero(difference, dimension) ? null : totals.closingDebit > totals.closingCredit ? 'debit' : 'credit',
  };
}

const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
const dimensionLabel = (dimension: LedgerDimension): string => dimension === 'cash' ? 'ميزان النقدية' : dimension === 'gold' ? 'ميزان الذهب' : dimension === 'silver' ? 'ميزان الفضة' : 'ميزان الكمية';
const csvValue = (amount: number, dimension: LedgerDimension): string => formatLedgerAmount(amount, dimension);

export const trialBalanceDimensionLabel = (dimension: LedgerDimension): string =>
  dimension === 'book_value' ? '\u0645\u064a\u0632\u0627\u0646 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u062f\u0641\u062a\u0631\u064a\u0629' : dimensionLabel(dimension);

export const buildTrialBalanceCsv = (reports: TrialBalanceReport[], startDate: string, endDate: string): string => {
  const version = reports[0]?.balanceEngineVersion ?? 'unknown';
  const lines: string[] = [`نسخة محرك الأرصدة,${version}`, `الفترة من ${startDate} إلى ${endDate}`];
  reports.forEach(report => {
    lines.push('', trialBalanceDimensionLabel(report.dimension));
    lines.push(['الحساب', 'الوصف', 'المجموعة', 'أول المدة مدين', 'أول المدة دائن', 'حركة الفترة مدين', 'حركة الفترة دائن', 'آخر المدة مدين', 'آخر المدة دائن'].map(csvEscape).join(','));
    report.groups.forEach(group => {
      group.rows.forEach(row => lines.push([row.accountName, row.description, group.label, row.openingDebit, row.openingCredit, row.periodDebit, row.periodCredit, row.closingDebit, row.closingCredit].map((value, index) => csvEscape(index < 3 ? String(value) : csvValue(Number(value), report.dimension))).join(',')));
    });
  });
  return `\uFEFF${lines.join('\r\n')}`;
};
