import type { Account, Entry } from '../types';
import { resolveOperationKind } from './engine';

export interface AccountingPolicyIssue {
  code: 'finished_gold_direct_purchase' | 'trader_invoice_price_missing' | 'invalid_account_dimension';
  message: string;
}

const bySide = (entry: Partial<Entry>, accounts: Account[], side: 'debit' | 'credit'): Account | undefined => {
  const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const name = side === 'debit' ? entry.debit : entry.credit;
  return accounts.find(account => account.id === id) ?? accounts.find(account => account.name === name);
};

const inferredDimensions = (account: Account): Set<string> => {
  if (account.dimensions?.length) return new Set(account.dimensions);
  if (account.type === 'cash' || account.canonicalSubType === 'customer') return new Set(['cash']);
  if (account.type === 'accessory') return new Set(['quantity', 'book_value']);
  if (account.is_inventory) return new Set([account.metal === 'silver' || account.type === 'silver' ? 'silver' : 'gold', 'book_value']);
  if (account.type === 'merchant') return new Set([account.metal === 'silver' ? 'silver' : 'gold', 'cash', 'book_value']);
  if (account.metal === 'silver') return new Set(['silver']);
  if (account.metal === 'gold') return new Set(['gold']);
  return new Set(['cash']);
};

/** Save-time policy for new invoices. Historical imports remain readable. */
export const validateAccountingPolicy = (entry: Partial<Entry>, accounts: Account[]): AccountingPolicyIssue[] => {
  const debit = bySide(entry, accounts, 'debit');
  const credit = bySide(entry, accounts, 'credit');
  if (!debit || !credit) return [];
  const kind = resolveOperationKind(entry as Entry);
  const issues: AccountingPolicyIssue[] = [];

  const incomingGold = debit.is_inventory && debit.metal === 'gold';
  if (kind === 'purchase' && incomingGold && debit.type === 'gold_product') {
    issues.push({
      code: 'finished_gold_direct_purchase',
      message: 'لا يجوز شراء المشغولات الذهبية مباشرة. الإدخال مسموح من تاجر أو تفييت أو تحويل أو زيادة مخزون فقط.',
    });
  }

  const traderReceipt = debit.is_inventory && credit.type === 'merchant';
  if (traderReceipt && (!(Number(entry.marketPrice) > 0) || !Number.isFinite(Number(entry.marketPrice)))) {
    issues.push({ code: 'trader_invoice_price_missing', message: 'فاتورة التاجر تحتاج سعر الذهب المثبت في الفاتورة.' });
  }

  const dimensions: Array<'cash' | 'gold' | 'silver' | 'quantity'> = [];
  if (Math.abs(Number(entry.cash) || 0) > 0) dimensions.push('cash');
  const hasWeight = Math.abs(Number(entry.weight) || 0) > 0 || Math.abs(Number(entry.arabicWeight) || 0) > 0;
  if (hasWeight) {
    if ([debit, credit].some(account => account.metal === 'silver' || account.type === 'silver')) dimensions.push('silver');
    else dimensions.push('gold');
  }
  if (Math.abs(Number(entry.count) || 0) > 0) dimensions.push('quantity');
  const allowed = [inferredDimensions(debit), inferredDimensions(credit)];
  dimensions.forEach(dimension => {
    if (!allowed.some(set => set.has(dimension))) {
      issues.push({ code: 'invalid_account_dimension', message: `البُعد ${dimension} غير مسموح للحسابين المختارين.` });
    }
  });
  return issues;
};
