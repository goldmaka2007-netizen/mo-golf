import type { Account, Entry } from '../types';
import { getMerchantMetadataMetal } from './engine';

export type MerchantReceiptMetal = 'gold' | 'silver';

const positiveNumber = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const accountForSide = (
  entry: Entry,
  side: 'debit' | 'credit',
  accounts: readonly Account[],
): Account | undefined => {
  const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
  const name = side === 'debit' ? entry.debit : entry.credit;
  return accounts.find(account => (id && account.id === id) || (!id && account.name === name));
};

export const isMerchantReceiptEntry = (entry: Pick<Entry, 'tx'>): boolean =>
  entry.tx === 'تاجر ذهب' || entry.tx === 'تاجر فضة';

export const resolveMerchantReceiptMetal = (
  entry: Entry,
  accounts: readonly Account[],
): MerchantReceiptMetal | undefined => {
  if (!isMerchantReceiptEntry(entry)) return undefined;
  const inventory = accountForSide(entry, 'debit', accounts);
  if (inventory?.is_inventory && (inventory.metal === 'gold' || inventory.metal === 'silver')) {
    return inventory.metal;
  }
  const merchantMetal = getMerchantMetadataMetal(accountForSide(entry, 'credit', accounts));
  if (merchantMetal) return merchantMetal;
  return entry.tx === 'تاجر فضة' ? 'silver' : entry.tx === 'تاجر ذهب' ? 'gold' : undefined;
};

/**
 * New receipts store the invoice's official base price explicitly:
 * gold is valued against Standard-21 (Arabic) weight and silver against actual weight.
 * Historical receipts only have marketPrice, which was already karat-adjusted by EntryForm,
 * so that legacy value is multiplied by actual physical weight.
 */
export const calculateMerchantInvoiceMetalValueMinor = (
  entry: Entry,
  accounts: readonly Account[] = [],
): number | null => {
  if (!isMerchantReceiptEntry(entry)) return null;
  const explicitInvoicePrice = positiveNumber(entry.invoiceOfficialPricePerGramEgp);
  const legacyAdjustedPrice = positiveNumber(entry.marketPrice);
  const price = explicitInvoicePrice ?? legacyAdjustedPrice;
  if (price === null) return null;

  const metal = resolveMerchantReceiptMetal(entry, accounts);
  const actualWeight = positiveNumber(entry.weight);
  if (actualWeight === null) return null;

  let valuationWeight = actualWeight;
  if (explicitInvoicePrice !== null && metal === 'gold') {
    valuationWeight = positiveNumber(entry.arabicWeight)
      ?? actualWeight * (positiveNumber(entry.multiplier) ?? 1);
  }
  const minor = Math.round(price * valuationWeight * 100);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
};