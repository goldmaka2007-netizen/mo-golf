import { describe, expect, it } from 'vitest';
import { parseCsvRecords, parseSettingsEntryCsv } from '../csvImport';

const headers = 'date,tx,debit,credit,cash,weight,notes,karat,count,arabicWeight,multiplier';

describe('Settings CSV import', () => {
  it('imports the old XLSX business fields from a normal CSV', () => {
    expect(parseSettingsEntryCsv(`${headers}\n2026-08-15,بيع,الخزنة,المبيعات,2500.75,12.5,عربي,21,2,12.5,1.5`)[0]).toEqual({ date: '2026-08-15', tx: 'بيع', debit: 'الخزنة', credit: 'المبيعات', cash: '2500.75', weight: '12.5', notes: 'عربي', karat: 21, count: '2', arabicWeight: '12.5', multiplier: 1.5 });
  });
  it('supports BOM, reordered headers, extra columns, and Arabic numerals', () => {
    const csv = '\uFEFFcredit,notes,extra,date,tx,debit,multiplier,karat,cash,weight,count,arabicWeight\nالمبيعات,"قال ""نعم""",ignored,2026-08-15,بيع,الخزنة,١٫٥,٢١,2500.75,12.5,,,\n';
    expect(parseSettingsEntryCsv(csv)[0]).toMatchObject({ credit: 'المبيعات', notes: 'قال "نعم"', date: '2026-08-15', karat: 21 });
  });
  it('preserves commas, embedded newlines, empty and trailing cells', () => {
    const records = parseCsvRecords(`${headers}\n2026-08-15,بيع,الخزنة,المبيعات,2500.75,,"line one\nline two",21,,,\n`);
    expect(records[1]).toHaveLength(11);
    expect(records[1][6]).toBe('line one\nline two');
    expect(parseSettingsEntryCsv(`${headers}\n2026-08-15,بيع,الخزنة,المبيعات,,,,,,,`)[0].cash).toBe('0');
  });
  it('rejects missing headers, malformed quoting, missing required values, and invalid numeric values', () => {
    expect(() => parseSettingsEntryCsv('date,tx,debit\n2026-08-15,بيع,الخزنة')).toThrow('Missing required CSV header');
    expect(() => parseSettingsEntryCsv(`${headers}\n2026-08-15,بيع,الخزنة,المبيعات,"unterminated`)).toThrow('Malformed CSV');
    expect(() => parseSettingsEntryCsv(`${headers}\n2026-08-15,,الخزنة,المبيعات`)).toThrow('required');
    expect(() => parseSettingsEntryCsv(`${headers}\n2026-08-15,بيع,الخزنة,المبيعات,,,,not-a-number`)).toThrow('Invalid numeric');
  });
});
