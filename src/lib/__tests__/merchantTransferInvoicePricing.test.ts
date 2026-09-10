import { describe, expect, it } from 'vitest';
import type { Account } from '../../types';
import {
  isAlSafiGoldMerchantTransfer,
  shouldCaptureGoldMarketPrice,
} from '../merchantTransferInvoicePricing';

const accounts: Account[] = [
  {
    id: 'alaa',
    name: 'علاء صالح',
    mainType: 'الالتزامات',
    subType: 'تاجر ذهب',
    balanceNature: 'جرام ذهب',
    type: 'merchant',
    metal: 'gold',
    is_inventory: false,
    userId: 'u',
  },
  {
    id: '3zGclNk6qdAuNxM6y5iP',
    name: 'الصافي',
    mainType: 'الالتزامات',
    subType: 'تاجر ذهب',
    balanceNature: 'جرام ذهب',
    type: 'merchant',
    metal: 'gold',
    is_inventory: false,
    userId: 'u',
  },
  {
    id: 'merchant-21',
    name: 'تاجر آخر',
    mainType: 'الالتزامات',
    subType: 'تاجر ذهب',
    balanceNature: 'جرام ذهب',
    type: 'merchant',
    metal: 'gold',
    is_inventory: false,
    userId: 'u',
  },
];

describe('merchant transfer invoice pricing', () => {
  it('recognizes Alaa Saleh -> Al-Safi as a gold transfer even though labels do not contain ذهب', () => {
    const context = {
      tx: 'حوالة',
      debit: 'علاء صالح',
      credit: 'الصافي',
    };

    expect(isAlSafiGoldMerchantTransfer(context, accounts)).toBe(true);
    expect(shouldCaptureGoldMarketPrice(context, accounts)).toBe(true);
  });

  it('recognizes the approved transfer by stable Al-Safi account ID when IDs are available', () => {
    expect(isAlSafiGoldMerchantTransfer({
      tx: 'حوالة',
      debit: 'اسم قديم',
      credit: 'اسم قديم للصافي',
      debitAccountId: 'alaa',
      creditAccountId: '3zGclNk6qdAuNxM6y5iP',
    }, accounts)).toBe(true);
  });

  it('does not broaden price capture to an ordinary merchant-to-merchant transfer', () => {
    const context = {
      tx: 'حوالة',
      debitAccountId: 'alaa',
      creditAccountId: 'merchant-21',
    };

    expect(isAlSafiGoldMerchantTransfer(context, accounts)).toBe(false);
    expect(shouldCaptureGoldMarketPrice(context, accounts)).toBe(false);
  });

  it('preserves the existing label-based gold price detection', () => {
    expect(shouldCaptureGoldMarketPrice({ tx: 'بيع ذهب' }, accounts)).toBe(true);
  });
});
