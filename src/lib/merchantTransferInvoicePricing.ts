import type { Account } from '../types';
import { AL_SAFI_TRANSFER_HUB_ACCOUNT_ID } from './merchantGoldLiability';

export interface EntryPricingContext {
  tx?: string;
  debit?: string;
  credit?: string;
  debitAccountId?: string;
  creditAccountId?: string;
}

const resolveSelectedAccount = (
  context: EntryPricingContext,
  accounts: Account[],
  side: 'debit' | 'credit',
): Account | undefined => {
  const id = side === 'debit' ? context.debitAccountId : context.creditAccountId;
  const name = side === 'debit' ? context.debit : context.credit;
  return accounts.find(account => account.id === id)
    ?? accounts.find(account => account.name === name);
};

/**
 * UI-only recognition for Makka V1's approved merchant transfer invoice.
 * Accounting validation remains authoritative; this helper only makes sure
 * EntryForm captures the price snapshot that the existing save guard requires.
 */
export const isAlSafiGoldMerchantTransfer = (
  context: EntryPricingContext,
  accounts: Account[],
): boolean => {
  if (context.tx !== 'حوالة') return false;

  const debit = resolveSelectedAccount(context, accounts, 'debit');
  const credit = resolveSelectedAccount(context, accounts, 'credit');
  if (!debit || !credit) return false;

  const bothGoldMerchants = [debit, credit].every(account =>
    account.type === 'merchant'
    && account.metal === 'gold'
    && account.is_inventory !== true,
  );

  return bothGoldMerchants
    && [debit.id, credit.id].includes(AL_SAFI_TRANSFER_HUB_ACCOUNT_ID);
};

export const shouldCaptureGoldMarketPrice = (
  context: EntryPricingContext,
  accounts: Account[],
): boolean => (
  (context.tx || '').includes('ذهب')
  || (context.debit || '').includes('ذهب')
  || (context.credit || '').includes('ذهب')
  || isAlSafiGoldMerchantTransfer(context, accounts)
);
