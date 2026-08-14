import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accountSupportsCount, getNextInvoiceNumber, sanitizeFirestorePayload } from '../EntryForm';
import { buildAccountRegistry } from '../../../lib/accountRegistry';
import type { Account } from '../../../types';

describe('EntryForm completion actions', () => {
  it('uses canonical tracking metadata for conditional count presentation', () => {
    const weightOnly = { id: 'weight-only', name: 'Gold weight-only', mainType: 'asset', subType: 'inventory', balanceNature: 'weight', userId: 'fixture', metal: 'gold', is_inventory: true } as Account;
    const weightAndQuantity = { id: 'weight-and-quantity', name: 'Gold bar', mainType: 'asset', subType: 'inventory', balanceNature: 'weight', userId: 'fixture', metal: 'gold', is_inventory: true, quantityStep: 1 } as Account;
    const quantityOnly = { id: 'quantity-only', name: 'Accessory', mainType: 'asset', subType: 'inventory', balanceNature: 'quantity', userId: 'fixture', type: 'accessory', is_inventory: true } as Account;

    const registry = buildAccountRegistry([weightOnly, weightAndQuantity, quantityOnly]);
    const trackingModeFor = (name: string) => {
      const resolution = registry.resolve(undefined, name);
      if (resolution.status !== 'resolved') throw new Error(`Fixture account did not resolve: ${name}`);
      return resolution.account.trackingMode;
    };

    expect(trackingModeFor('Gold weight-only')).toBe('weight');
    expect(trackingModeFor('Gold bar')).toBe('weight_and_quantity');
    expect(trackingModeFor('Accessory')).toBe('quantity');
    expect(accountSupportsCount(registry, ['Gold weight-only'])).toBe(false);
    expect(accountSupportsCount(registry, ['Gold bar'])).toBe(true);
    expect(accountSupportsCount(registry, ['Accessory'])).toBe(true);
  });

  it('allocates a fresh invoice number even before the saved entry snapshot arrives', () => {
    expect(getNextInvoiceNumber('بيع ذهب', [{ invoiceNumber: 'S8' }], 'S9')).toBe('S10');
    expect(getNextInvoiceNumber('شراء ذهب', [{ invoiceNumber: 'P3' }], 'S9')).toBe('P4');
  });

  it('offers only new-operation actions after a successful save', () => {
    const source = readFileSync(new URL('../EntryForm.tsx', import.meta.url), 'utf8');

    expect(source).toContain('عملية جديدة من نفس النوع');
    expect(source).toContain('عملية جديدة');
    expect(source).not.toContain('إضافة صنف آخر (نفس الفاتورة)');
    expect(source).not.toContain('continueSameInvoice');
  });

  it('places invoice accounting fields on the entry before save-time policy validation', () => {
    const source = readFileSync(new URL('../EntryForm.tsx', import.meta.url), 'utf8');
    const entryFields = source.indexOf('marketPrice: formData.marketPrice');
    const policyValidation = source.indexOf('validateAccountingPolicy(entry, accountsDb)');

    expect(entryFields).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('karat: formData.karat ?? undefined')).toBeGreaterThanOrEqual(0);
    expect(entryFields).toBeLessThan(policyValidation);
    expect(source).not.toContain('if (formData.karat) entry.karat = formData.karat;');
    expect(source).not.toContain('if (formData.marketPrice !== undefined) entry.marketPrice = formData.marketPrice;');
  });

  it('omits undefined optional fields from the persisted payload without inventing tafyeet pricing', () => {
    const entry = {
      operationKind: 'tifeet',
      tx: 'تيفيت',
      debit: 'بريمة',
      credit: 'كسر افرنجي',
      weight: '0.43',
      karat: 18,
      marketPrice: undefined,
    };

    const persisted = sanitizeFirestorePayload(entry);

    expect(persisted).toMatchObject({ operationKind: 'tifeet', weight: '0.43', karat: 18 });
    expect(persisted).not.toHaveProperty('marketPrice');
    expect(entry.marketPrice).toBeUndefined();
  });
});
