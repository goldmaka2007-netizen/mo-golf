import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getNextInvoiceNumber, sanitizeFirestorePayload } from '../EntryForm';

describe('EntryForm completion actions', () => {
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
