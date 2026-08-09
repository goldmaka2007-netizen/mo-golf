import type { Account, CanonicalAccountDefinition, Entry } from '../types';
import { BALANCE_ENGINE_VERSION } from './engine';
import { arabicAccountLabel } from './accountLabels';
import { buildLegacyLedgerLegs, type LegacyLedgerDimension, type LegacyLedgerLeg } from './legacyLedger';
import type { InventoryCostTimeline } from './inventoryCostTypes';
import { deriveUnitPrice } from './financialStatementsEgp';
import { buildMerchantMetalPositionTimeline } from './merchantGoldLiability';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';

export interface UnifiedTrialDimension {
  debit: number;
  credit: number;
  balance: number;
}
export interface UnifiedTrialBalanceRow {
  entityId: string;
  accountName: string;
  group: LegacyLedgerLeg['group'];
  groupLabel: string;
  normalBalance: 'debit' | 'credit';
  cash: UnifiedTrialDimension;
  goldBalance: number;
  silverBalance: number;
  quantityBalance: number;
  bookValue: UnifiedTrialDimension;
  effectiveGramPrice: number | null;
  classificationWarning?: string;
}
export interface UnifiedTrialBalanceReport {
  source: 'central_posting_projection';
  balanceEngineVersion: string;
  rows: UnifiedTrialBalanceRow[];
  financialDebit: number;
  financialCredit: number;
  financialDifference: number;
  financialBalanced: boolean;
  dimensionDifferences: Record<'gold' | 'silver' | 'quantity', number>;
}
export interface UnifiedTrialBalanceOptions {
  canonicalDefinitions?: CanonicalAccountDefinition[];
  timeline?: InventoryCostTimeline | null;
}

const zero = (): UnifiedTrialDimension => ({ debit: 0, credit: 0, balance: 0 });
const round = (value: number): number => Math.round((value + Number.EPSILON) * 1000000) / 1000000;
const signedBalance = (legs: LegacyLedgerLeg[], normal: 'debit' | 'credit'): number => round(legs.reduce((sum, leg) => sum + (leg.side === normal ? leg.amount : -leg.amount), 0));
const amounts = (legs: LegacyLedgerLeg[], normal: 'debit' | 'credit'): UnifiedTrialDimension => ({
  debit: round(legs.filter(leg => leg.side === 'debit').reduce((sum, leg) => sum + leg.amount, 0)),
  credit: round(legs.filter(leg => leg.side === 'credit').reduce((sum, leg) => sum + leg.amount, 0)),
  balance: signedBalance(legs, normal),
});

export const buildUnifiedTrialBalance = (
  entries: Entry[],
  accounts: Account[],
  startDate: string,
  endDate: string,
  options: UnifiedTrialBalanceOptions = {},
): UnifiedTrialBalanceReport => {
  const projected = buildLegacyLedgerLegs(entries.filter(entry => entry.date <= endDate), accounts, options.canonicalDefinitions, {
    enableFinancialProjection: true,
    costTimeline: options.timeline,
  });
  const included = projected.filter(leg => leg.date < startDate || leg.date <= endDate);
  const merchantTimeline = buildMerchantMetalPositionTimeline(
    entries.filter(entry => entry.date <= endDate),
    accounts.map(applyRuntimeAccountOverride),
    options.timeline,
  );
  const byEntity = new Map<string, LegacyLedgerLeg[]>();
  included.forEach(leg => byEntity.set(leg.entityId, [...(byEntity.get(leg.entityId) ?? []), leg]));
  const buildRow = (
    entityId: string,
    legs: LegacyLedgerLeg[],
    groupOverride?: LegacyLedgerLeg['group'],
    normalOverride?: 'debit' | 'credit',
    accountNameOverride?: string,
  ): UnifiedTrialBalanceRow => {
    const first = legs[0];
    const normal = normalOverride ?? first.account.normalBalance;
    const group = groupOverride ?? first.group;
    const dimension = (value: LegacyLedgerDimension) => legs.filter(leg => leg.dimension === value);
    const account = first.account.sourceAccount;
    const warning = !account && !entityId.startsWith('system:')
      ? 'تعذر التصنيف بمعرف ثابت؛ تمت القراءة بطبقة التوافق التاريخي.'
      : account?.canonicalSubType === 'unclassified' || account?.subType === 'unclassified'
        ? 'الحساب غير مصنف محاسبياً.'
        : undefined;
    const bookValue = amounts(dimension('book_value'), normal);
    const inventoryMetal = account?.is_inventory === true
      ? account.metal === 'silver' || account.type === 'silver' ? 'silver'
        : account.metal === 'gold' || ['gold_product', 'gold_raw', 'gold_direct'].includes(account.type ?? '') ? 'gold'
          : null
      : null;
    const inventoryWeight = inventoryMetal === 'gold'
      ? Math.abs(signedBalance(dimension('gold'), normal))
      : inventoryMetal === 'silver' ? Math.abs(signedBalance(dimension('silver'), normal)) : null;
    return {
      entityId,
      accountName: accountNameOverride ?? first.accountName,
      group,
      groupLabel: arabicAccountLabel(group),
      normalBalance: normal,
      cash: amounts(dimension('cash'), normal),
      goldBalance: signedBalance(dimension('gold'), normal),
      silverBalance: signedBalance(dimension('silver'), normal),
      quantityBalance: signedBalance(dimension('quantity'), normal),
      bookValue,
      effectiveGramPrice: inventoryMetal ? deriveUnitPrice(Math.abs(bookValue.balance), inventoryWeight) : null,
      classificationWarning: warning,
    };
  };
  const rows = [...byEntity.entries()].flatMap(([entityId, legs]): UnifiedTrialBalanceRow[] => {
    const account = legs[0].account.sourceAccount;
    const state = account?.id ? merchantTimeline.finalStates[account.id] : undefined;
    if (!state) return [buildRow(entityId, legs)];
    const metalLegs = legs.filter(leg => leg.dimension !== 'cash');
    const cashLegs = legs.filter(leg => leg.dimension === 'cash');
    const out: UnifiedTrialBalanceRow[] = [];
    if (metalLegs.length > 0) {
      const group = state.positionSide === 'receivable' ? 'assets' : state.positionSide === 'payable' ? 'liabilities' : legs[0].group;
      const normal = state.positionSide === 'receivable' ? 'debit' : state.positionSide === 'payable' ? 'credit' : legs[0].account.normalBalance;
      out.push(buildRow(`${entityId}:metal`, metalLegs, group, normal, `${legs[0].accountName} — ${state.metal === 'gold' ? 'ذهب' : 'فضة'}`));
    }
    if (cashLegs.length > 0) {
      const cashSigned = cashLegs.reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0);
      const group = cashSigned >= 0 ? 'assets' : 'liabilities';
      out.push(buildRow(`${entityId}:cash`, cashLegs, group, cashSigned >= 0 ? 'debit' : 'credit', `${legs[0].accountName} — نقدية`));
    }
    return out;
  }).filter(row => row.cash.debit || row.cash.credit || row.goldBalance || row.silverBalance || row.quantityBalance || row.bookValue.debit || row.bookValue.credit)
    .sort((a, b) => ['assets', 'liabilities', 'equity', 'revenue', 'expenses'].indexOf(a.group) - ['assets', 'liabilities', 'equity', 'revenue', 'expenses'].indexOf(b.group) || a.accountName.localeCompare(b.accountName, 'ar'));
  const financial = included.filter(leg => leg.dimension === 'cash' || leg.dimension === 'book_value');
  const financialDebit = round(financial.filter(leg => leg.side === 'debit').reduce((sum, leg) => sum + leg.amount, 0));
  const financialCredit = round(financial.filter(leg => leg.side === 'credit').reduce((sum, leg) => sum + leg.amount, 0));
  const difference = round(financialDebit - financialCredit);
  const differenceFor = (dimension: 'gold' | 'silver' | 'quantity') => round(included.filter(leg => leg.dimension === dimension).reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0));
  return {
    source: 'central_posting_projection',
    balanceEngineVersion: BALANCE_ENGINE_VERSION,
    rows,
    financialDebit,
    financialCredit,
    financialDifference: difference,
    financialBalanced: Math.abs(difference) <= 0.0001,
    dimensionDifferences: { gold: differenceFor('gold'), silver: differenceFor('silver'), quantity: differenceFor('quantity') },
  };
};

export const buildUnifiedTrialBalanceCsv = (report: UnifiedTrialBalanceReport): string => {
  const headers = ['الحساب', 'المجموعة', 'الطبيعة', 'مدين EGP', 'دائن EGP', 'رصيد EGP', 'ذهب مكافئ 21', 'فضة', 'كمية', 'مدين قيمة دفترية', 'دائن قيمة دفترية', 'رصيد قيمة دفترية', 'تحذير التصنيف'];
  headers.splice(headers.length - 1, 0, 'سعر الجرام');
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = report.rows.map(row => [row.accountName, row.groupLabel, row.normalBalance === 'debit' ? 'مدين' : 'دائن', row.cash.debit, row.cash.credit, row.cash.balance, row.goldBalance, row.silverBalance, row.quantityBalance, row.bookValue.debit, row.bookValue.credit, row.bookValue.balance, row.effectiveGramPrice ?? '', row.classificationWarning ?? ''].map(quote).join(','));
  return `\uFEFF${[headers.map(quote).join(','), ...lines].join('\r\n')}`;
};
