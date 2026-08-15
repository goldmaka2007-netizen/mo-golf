import { describe, expect, it } from 'vitest';
import { escapeCsv, rowsToCsv } from '../../utils/csv';

describe('CSV export safety', () => {
  it('escapes commas, quotes, newlines, Arabic, and preserves numbers', () => {
    const csv = rowsToCsv([{ name: 'عربي،اختبار', note: 'قال "نعم"\nسطر', amount: 2500.75 }], ['name', 'note', 'amount']);
    expect(csv).toContain('عربي،اختبار');
    expect(csv).toContain('"قال ""نعم""\nسطر"');
    expect(csv).toContain('2500.75');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
  it('escapes a plain value without changing it', () => { expect(escapeCsv(42)).toBe('42'); });
});
