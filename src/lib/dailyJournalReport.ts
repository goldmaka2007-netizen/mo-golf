import { Account, Entry } from '../types';
import { AccountingLeg, buildCanonicalAccountRegistry, buildCanonicalAccountingLegs, diagnoseMetalPostings, isValidAccountingEntry } from './canonicalAccounting';
import { parseCash, resolveOperationKind } from './engine';
import { splitLegsByPeriod } from './periodLegs';

export type DailyJournalDimension = 'cash' | 'gold' | 'silver' | 'quantity';
export interface DailyJournalAmounts { openingDebit: number; openingCredit: number; periodDebit: number; periodCredit: number; closingDebit: number; closingCredit: number; }
export interface DailyJournalDimensionReport extends DailyJournalAmounts { dimension: DailyJournalDimension; periodLegs: AccountingLeg[]; }
export type DailyJournalDiagnosticReason = 'missing_debit_account' | 'missing_credit_account' | 'unresolved_debit_account_id' | 'unresolved_credit_account_id' | 'unsupported_operation_kind' | 'missing_canonical_amount' | 'cash_dimension_unavailable' | 'metal_dimension_unavailable' | 'missing_debit_metal_leg' | 'missing_credit_metal_leg';
export interface DailyJournalDiagnosticEntry { id: string; date: string; tx: string; debit: string; credit: string; operationKind: string; debitAccountId?: string; creditAccountId?: string; cash: string; weight: string; arabicWeight: string; karat?: number; reasons: DailyJournalDiagnosticReason[]; }
export interface DailyJournalDiagnosticGroup { reason: DailyJournalDiagnosticReason; entries: DailyJournalDiagnosticEntry[]; recommendation: string; }
export interface DailyJournalDiagnostics { entries: DailyJournalDiagnosticEntry[]; groups: DailyJournalDiagnosticGroup[]; }
export interface DailyJournalReport { date: string; dimensions: Record<DailyJournalDimension, DailyJournalDimensionReport>; diagnostics: DailyJournalDiagnostics; }

const empty = (): DailyJournalAmounts => ({ openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 });
const split = (balance: number): [number, number] => balance >= 0 ? [balance, 0] : [0, Math.abs(balance)];
const isOperationalLeg = (leg: AccountingLeg, dimension: DailyJournalDimension) => dimension === 'cash' ? leg.entity.entityType === 'cash' : dimension === 'quantity' ? leg.entity.isInventory && leg.entity.metal === 'accessory' : leg.entity.isInventory && leg.entity.metal === dimension;
const supportedKinds = new Set(['opening', 'purchase', 'sale', 'transfer', 'tifeet', 'adjustment', 'merchant_settlement', 'personal_withdrawal', 'expense', 'other']);
const recommendationFor: Record<DailyJournalDiagnosticReason, string> = {
  missing_debit_account: '\u0627\u0644\u0642\u064a\u062f \u0646\u0627\u0642\u0635: \u062d\u062f\u062f \u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u062f\u064a\u0646.',
  missing_credit_account: '\u0627\u0644\u0642\u064a\u062f \u0646\u0627\u0642\u0635: \u062d\u062f\u062f \u062d\u0633\u0627\u0628 \u0627\u0644\u062f\u0627\u0626\u0646.',
  unresolved_debit_account_id: '\u0627\u0631\u0627\u062c\u0639 \u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u062f\u064a\u0646; \u064a\u062d\u062a\u0627\u062c Backfill \u0623\u0648 \u062a\u0635\u062d\u064a\u062d \u0627\u0644\u062d\u0633\u0627\u0628.',
  unresolved_credit_account_id: '\u0627\u0631\u0627\u062c\u0639 \u0645\u0639\u0631\u0641 \u0627\u0644\u062f\u0627\u0626\u0646; \u064a\u062d\u062a\u0627\u062c Backfill \u0623\u0648 \u062a\u0635\u062d\u064a\u062d \u0627\u0644\u062d\u0633\u0627\u0628.',
  unsupported_operation_kind: '\u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629 \u062a\u062d\u062a\u0627\u062c Operation Rule \u0645\u0631\u0643\u0632\u064a\u0629 \u0623\u0648 \u062a\u0635\u062d\u064a\u062d operationKind.',
  missing_canonical_amount: '\u0627\u0644\u0642\u064a\u062f \u0646\u0627\u0642\u0635 \u0623\u0648 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d: \u0623\u062f\u062e\u0644 \u0646\u0642\u062f\u064b\u0627 \u0623\u0648 \u0648\u0632\u0646\u064b\u0627 \u0642\u0627\u0628\u0644\u064b\u0627 \u0644\u0644\u062a\u0631\u062d\u064a\u0644.',
  cash_dimension_unavailable: '\u0631\u0627\u062c\u0639 \u062a\u0635\u0646\u064a\u0641 \u0627\u0644\u062d\u0633\u0627\u0628 \u0623\u0648 \u0623\u0636\u0641 Alias \u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0646\u0642\u062f\u064a\u0629.',
  metal_dimension_unavailable: '\u0631\u0627\u062c\u0639 \u062a\u0635\u0646\u064a\u0641 \u0627\u0644\u0630\u0647\u0628/\u0627\u0644\u0641\u0636\u0629 \u0623\u0648 \u0623\u0636\u0641 Alias \u0645\u062b\u0628\u062a\u064b\u0627.',
  missing_debit_metal_leg: '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u062f\u064a\u0646 \u0644\u0627 \u064a\u0645\u062a\u0644\u0643 \u0628\u0639\u062f \u0627\u0644\u0645\u0639\u062f\u0646 \u0627\u0644\u0645\u0637\u0644\u0648\u0628; \u0631\u0627\u062c\u0639 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628.',
  missing_credit_metal_leg: '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u062f\u0627\u0626\u0646 \u0644\u0627 \u064a\u0645\u062a\u0644\u0643 \u0628\u0639\u062f \u0627\u0644\u0645\u0639\u062f\u0646 \u0627\u0644\u0645\u0637\u0644\u0648\u0628; \u0631\u0627\u062c\u0639 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628.',
};

const buildDiagnostics = (entries: Entry[], accounts: Account[], legs: AccountingLeg[], registry: ReturnType<typeof buildCanonicalAccountRegistry>): DailyJournalDiagnostics => {
  const accountsById = new Map(accounts.filter(account => account.id).map(account => [account.id as string, account]));
  const legged = new Set(legs.map(leg => leg.sourceEntryId));
  const metalIssues = new Map(diagnoseMetalPostings(entries, registry, legs).filter(issue => issue.amount > 0 && issue.droppedReasons.length > 0 && !['sale', 'purchase'].includes(issue.operationKind)).map(issue => [issue.sourceEntryId, issue]));
  const diagnostics: DailyJournalDiagnosticEntry[] = [];
  entries.filter(isValidAccountingEntry).forEach(entry => {
    const id = entry.id || String(entry.seq);
    const metalIssue = metalIssues.get(id);
    const hasMaterialValue = parseCash(entry) > 0 || Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0 || Number(entry.count) > 0;
    if ((!hasMaterialValue || legged.has(id)) && !metalIssue) return;
    const kind = resolveOperationKind(entry);
    const reasons: DailyJournalDiagnosticReason[] = [];
    if (!entry.debit) reasons.push('missing_debit_account');
    if (!entry.credit) reasons.push('missing_credit_account');
    if (entry.debitAccountId && !accountsById.has(entry.debitAccountId)) reasons.push('unresolved_debit_account_id');
    if (entry.creditAccountId && !accountsById.has(entry.creditAccountId)) reasons.push('unresolved_credit_account_id');
    if (!supportedKinds.has(kind)) reasons.push('unsupported_operation_kind');
    if (!legged.has(id)) {
      if (parseCash(entry) <= 0 && Number(entry.weight) <= 0 && Number(entry.arabicWeight) <= 0) reasons.push('missing_canonical_amount');
      const debitEntity = registry.entities.find(entity => entity.sourceAccount?.id === entry.debitAccountId) ?? registry.byLegacyName.get(entry.debit.trim());
      const creditEntity = registry.entities.find(entity => entity.sourceAccount?.id === entry.creditAccountId) ?? registry.byLegacyName.get(entry.credit.trim());
      if (parseCash(entry) > 0 && !debitEntity?.allowedDimensions.includes('cash') && !creditEntity?.allowedDimensions.includes('cash')) reasons.push('cash_dimension_unavailable');
      if ((Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0) && ![debitEntity?.metal, creditEntity?.metal].some(metal => metal === 'gold' || metal === 'silver')) reasons.push('metal_dimension_unavailable');
    }
    if (metalIssue?.droppedReasons.some(reason => reason.includes('missing debit'))) reasons.push('missing_debit_metal_leg');
    if (metalIssue?.droppedReasons.some(reason => reason.includes('missing credit'))) reasons.push('missing_credit_metal_leg');
    diagnostics.push({ id, date: entry.date, tx: entry.tx, debit: entry.debit, credit: entry.credit, operationKind: kind, debitAccountId: entry.debitAccountId, creditAccountId: entry.creditAccountId, cash: entry.cash, weight: entry.weight, arabicWeight: entry.arabicWeight, karat: entry.karat, reasons: reasons.length ? [...new Set(reasons)] : ['missing_canonical_amount'] });
  });
  const byReason = new Map<DailyJournalDiagnosticReason, DailyJournalDiagnosticEntry[]>();
  diagnostics.forEach(entry => entry.reasons.forEach(reason => byReason.set(reason, [...(byReason.get(reason) || []), entry])));
  return { entries: diagnostics, groups: [...byReason].map(([reason, entriesForReason]) => ({ reason, entries: entriesForReason, recommendation: recommendationFor[reason] })) };
};

/** Daily presentation over the same canonical legs consumed by ledger and trial balance. */
export const buildDailyJournalReport = (entries: Entry[], accounts: Account[], date: string): DailyJournalReport => {
  const registry = buildCanonicalAccountRegistry(accounts, entries);
  const legs = buildCanonicalAccountingLegs(entries, registry);
  const dimensions = {} as Record<DailyJournalDimension, DailyJournalDimensionReport>;
  (['cash', 'gold', 'silver', 'quantity'] as DailyJournalDimension[]).forEach(dimension => {
    const amounts = empty(); const dimensionLegs = legs.filter(leg => leg.dimension === dimension);
    const { periodLegs } = splitLegsByPeriod(dimensionLegs, date, date);
    const operationalLegs = dimensionLegs.filter(leg => isOperationalLeg(leg, dimension));
    const { openingLegs, periodLegs: operationalPeriodLegs } = splitLegsByPeriod(operationalLegs, date, date);
    openingLegs.forEach(leg => { if (leg.side === 'debit') amounts.openingDebit += leg.amount; else amounts.openingCredit += leg.amount; });
    operationalPeriodLegs.forEach(leg => { if (leg.side === 'debit') amounts.periodDebit += leg.amount; else amounts.periodCredit += leg.amount; });
    [amounts.closingDebit, amounts.closingCredit] = split((amounts.openingDebit + amounts.periodDebit) - (amounts.openingCredit + amounts.periodCredit));
    dimensions[dimension] = { dimension, ...amounts, periodLegs };
  });
  return { date, dimensions, diagnostics: buildDiagnostics(entries, accounts, legs, registry) };
};