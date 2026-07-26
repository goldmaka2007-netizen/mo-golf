import { Account, CanonicalAccountDefinition, Entry } from '../types';
import { formatLedgerAmount, LedgerDimension } from './ledgerReport';
import { buildLegacyLedgerLegs, type LegacyLedgerBuildOptions } from './legacyLedger';
import { splitLegsByPeriod } from './periodLegs';

export type TrialBalanceGroupId = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';

export interface TrialBalanceAmounts {
  openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number; closingDebit: number; closingCredit: number;
}
export interface TrialBalanceRow extends TrialBalanceAmounts {
  entityId: string; accountName: string; description: string; group: TrialBalanceGroupId; order: number;
}
export interface TrialBalanceGroup extends TrialBalanceAmounts { id: TrialBalanceGroupId; label: string; rows: TrialBalanceRow[]; }
export interface TrialBalanceReport extends TrialBalanceAmounts {
  dimension: LedgerDimension; source: 'legacy_raw_fields'; groups: TrialBalanceGroup[]; balanced: boolean; difference: number; differenceSide: 'debit' | 'credit' | null;
}

const tolerance = (dimension: LedgerDimension) => dimension === 'cash' ? 0.0001 : 0.000001;
const zero = (value: number, dimension: LedgerDimension) => Math.abs(value) <= tolerance(dimension);
const empty = (): TrialBalanceAmounts => ({ openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 });
const amountKeys: (keyof TrialBalanceAmounts)[] = ['openingDebit', 'openingCredit', 'periodDebit', 'periodCredit', 'closingDebit', 'closingCredit'];
const add = (target: TrialBalanceAmounts, source: TrialBalanceAmounts) => {
  amountKeys.forEach(key => { target[key] += source[key]; });
};
const split = (balance: number) => balance >= 0 ? [balance, 0] : [0, Math.abs(balance)];

const arabic = {
  assets: '\u0627\u0644\u0623\u0635\u0648\u0644', liabilities: '\u0627\u0644\u062e\u0635\u0648\u0645', equity: '\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629', revenue: '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a', expenses: '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a',
  cash: '\u062e\u0632\u0646\u0629', merchant: '\u062a\u0627\u062c\u0631', goldMerchant: '\u062a\u0627\u062c\u0631 \u0630\u0647\u0628', silverMerchant: '\u062a\u0627\u062c\u0631 \u0641\u0636\u0629', accessory: '\u0645\u0644\u062d\u0642\u0627\u062a', goldProduct: '\u0635\u0646\u0641 \u0630\u0647\u0628', silverProduct: '\u0635\u0646\u0641 \u0641\u0636\u0629', goldInventory: '\u0645\u062e\u0632\u0648\u0646 \u0630\u0647\u0628', silverInventory: '\u0645\u062e\u0632\u0648\u0646 \u0641\u0636\u0629', asset: '\u062d\u0633\u0627\u0628 \u0623\u0635\u0644', liability: '\u062e\u0635\u0648\u0645',
};
const groupMeta = (mainType: string): { id: TrialBalanceGroupId; label: string } => {
  const value = mainType.toLowerCase();
  if (['liability', 'liabilities', '\u062e\u0635\u0648\u0645', '\u0627\u0644\u062e\u0635\u0648\u0645'].includes(value)) return { id: 'liabilities', label: arabic.liabilities };
  if (['equity', '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629', '\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629'].includes(value)) return { id: 'equity', label: arabic.equity };
  if (['revenue', 'revenues', '\u0625\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u0644\u0627\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a'].includes(value)) return { id: 'revenue', label: arabic.revenue };
  if (['expense', 'expenses', '\u0645\u0635\u0631\u0648\u0641\u0627\u062a', '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a'].includes(value)) return { id: 'expenses', label: arabic.expenses };
  return { id: 'assets', label: arabic.assets };
};

/** Metadata-only display description; never derived from the Arabic account name. */
export const getTrialBalanceDescription = (account: Account): string => {
  if (account.type === 'cash') return arabic.cash;
  if (account.type === 'merchant') return account.metal === 'silver' || account.balanceNature === 'silver' ? arabic.silverMerchant : account.metal === 'gold' || account.balanceNature === 'gold' ? arabic.goldMerchant : arabic.merchant;
  if (account.type === 'accessory') return arabic.accessory;
  if (account.metal === 'silver' || account.type === 'silver') return account.is_inventory ? arabic.silverInventory : arabic.silverProduct;
  if (account.metal === 'gold' || account.is_inventory || ['gold_product', 'gold_raw', 'gold_direct'].includes(account.type || '')) return account.is_inventory ? arabic.goldInventory : arabic.goldProduct;
  const group = groupMeta(account.mainType).id;
  return group === 'revenue' ? '\u0625\u064a\u0631\u0627\u062f' : group === 'expenses' ? '\u0645\u0635\u0631\u0648\u0641' : group === 'equity' ? arabic.equity : group === 'liabilities' ? arabic.liability : arabic.asset;
};
export const buildTrialBalanceReport = (entries: Entry[], accounts: Account[], dimension: LedgerDimension, startDate: string, endDate: string, canonicalDefinitions?: CanonicalAccountDefinition[], options: LegacyLedgerBuildOptions = {}): TrialBalanceReport => {
  const legs = buildLegacyLedgerLegs(entries, accounts, canonicalDefinitions, options).filter(leg => leg.dimension === dimension);
  const groupRows = new Map<TrialBalanceGroupId, TrialBalanceRow[]>();
  const entities = [...new Map(legs.map(leg => [leg.entityId, leg.account])).values()];
  entities.forEach((entity, order) => {
    const entityLegs = legs.filter(leg => leg.entityId === entity.entityId);
    let openingDebit = 0; let openingCredit = 0; let periodDebit = 0; let periodCredit = 0;
    const { openingLegs, periodLegs } = splitLegsByPeriod(entityLegs, startDate, endDate);
    openingLegs.forEach(leg => { if (leg.side === 'debit') openingDebit += leg.amount; else openingCredit += leg.amount; });
    periodLegs.forEach(leg => { if (leg.side === 'debit') periodDebit += leg.amount; else periodCredit += leg.amount; });
    const [closingDebit, closingCredit] = split((openingDebit + periodDebit) - (openingCredit + periodCredit));
    const row: TrialBalanceRow = { entityId: entity.entityId, accountName: entity.accountName, description: entity.description, group: entity.group, order, openingDebit, openingCredit, periodDebit, periodCredit, closingDebit, closingCredit };
    if (amountKeys.every(key => zero(row[key], dimension))) return; const rows = groupRows.get(row.group) || []; rows.push(row); groupRows.set(row.group, rows);
  });
  const totals = empty(); const ordered: TrialBalanceGroupId[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];
  const groups = ordered.flatMap(id => { const rows = groupRows.get(id); if (!rows?.length) return []; rows.sort((a, b) => a.order - b.order || a.accountName.localeCompare(b.accountName, 'ar')); const group: TrialBalanceGroup = { ...empty(), ...groupMeta(rows[0].group), rows }; rows.forEach(row => add(group, row)); add(totals, group); return [group]; });
  const difference = Math.abs(totals.closingDebit - totals.closingCredit);
  return { dimension, source: 'legacy_raw_fields', groups, ...totals, balanced: zero(difference, dimension), difference: zero(difference, dimension) ? 0 : difference, differenceSide: zero(difference, dimension) ? null : totals.closingDebit > totals.closingCredit ? 'debit' : 'credit' };
};
const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;
const dimensionLabel = (dimension: LedgerDimension) => dimension === 'cash' ? '\u0645\u064a\u0632\u0627\u0646 \u0627\u0644\u0646\u0642\u062f\u064a\u0629' : dimension === 'gold' ? '\u0645\u064a\u0632\u0627\u0646 \u0627\u0644\u0630\u0647\u0628' : '\u0645\u064a\u0632\u0627\u0646 \u0627\u0644\u0641\u0636\u0629';
const csvValue = (amount: number, dimension: LedgerDimension) => formatLedgerAmount(amount, dimension);

export const buildTrialBalanceCsv = (reports: TrialBalanceReport[], startDate: string, endDate: string): string => {
  const lines: string[] = [`\u0627\u0644\u0641\u062a\u0631\u0629 \u0645\u0646 ${startDate} \u0625\u0644\u0649 ${endDate}`];
  reports.forEach(report => {
    lines.push('', dimensionLabel(report.dimension));
    lines.push(['\u0627\u0644\u062d\u0633\u0627\u0628', '\u0627\u0644\u0648\u0635\u0641', '\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629', '\u0623\u0648\u0644 \u0627\u0644\u0645\u062f\u0629 \u0645\u062f\u064a\u0646', '\u0623\u0648\u0644 \u0627\u0644\u0645\u062f\u0629 \u062f\u0627\u0626\u0646', '\u062d\u0631\u0643\u0629 \u0627\u0644\u0641\u062a\u0631\u0629 \u0645\u062f\u064a\u0646', '\u062d\u0631\u0643\u0629 \u0627\u0644\u0641\u062a\u0631\u0629 \u062f\u0627\u0626\u0646', '\u0622\u062e\u0631 \u0627\u0644\u0645\u062f\u0629 \u0645\u062f\u064a\u0646', '\u0622\u062e\u0631 \u0627\u0644\u0645\u062f\u0629 \u062f\u0627\u0626\u0646'].map(csvEscape).join(','));
    report.groups.forEach(group => {
      group.rows.forEach(row => lines.push([row.accountName, row.description, group.label, row.openingDebit, row.openingCredit, row.periodDebit, row.periodCredit, row.closingDebit, row.closingCredit].map((value, index) => csvEscape(index < 3 ? String(value) : csvValue(Number(value), report.dimension))).join(',')));
      lines.push(['\u0625\u062c\u0645\u0627\u0644\u064a ' + group.label, '', group.label, group.openingDebit, group.openingCredit, group.periodDebit, group.periodCredit, group.closingDebit, group.closingCredit].map((value, index) => csvEscape(index < 3 ? String(value) : csvValue(Number(value), report.dimension))).join(','));
    });
    lines.push(['\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u064a\u0632\u0627\u0646', '', '', report.openingDebit, report.openingCredit, report.periodDebit, report.periodCredit, report.closingDebit, report.closingCredit].map((value, index) => csvEscape(index < 3 ? String(value) : csvValue(Number(value), report.dimension))).join(','));
    lines.push(`\u062d\u0627\u0644\u0629 \u0627\u0644\u0627\u062a\u0632\u0627\u0646: ${report.balanced ? '\u0627\u0644\u0645\u064a\u0632\u0627\u0646 \u0645\u062a\u0632\u0646' : `\u0627\u0644\u0645\u064a\u0632\u0627\u0646 \u063a\u064a\u0631 \u0645\u062a\u0632\u0646 — \u0641\u0631\u0642 ${csvValue(report.difference, report.dimension)} ${report.differenceSide === 'debit' ? '\u0645\u062f\u064a\u0646' : '\u062f\u0627\u0626\u0646'}`}`);
  });
  return `\uFEFF${lines.join('\r\n')}`;
};
