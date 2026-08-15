export type CsvRecord = string[];

export interface ImportedEntryFields {
  date: string;
  tx: string;
  debit: string;
  credit: string;
  cash: string;
  weight: string;
  notes: string;
  karat: number | null;
  count: string;
  arabicWeight: string;
  multiplier: number | null;
}

const aliases: Record<keyof ImportedEntryFields, string[]> = {
  date: ['date', 'التاريخ'], tx: ['tx', 'operation', 'العملية'], debit: ['debit', 'مدين'], credit: ['credit', 'دائن'],
  cash: ['cash', 'نقدًا', 'نقدا'], weight: ['weight', 'الوزن'], notes: ['notes', 'ملاحظات'], karat: ['karat', 'العيار'],
  count: ['count', 'العدد'], arabicWeight: ['arabicweight', 'الوزن العربي'], multiplier: ['multiplier', 'المعامل'],
};

const normalizeHeader = (value: string): string => value.replace(/^\uFEFF/, '').trim().toLocaleLowerCase();
const arabicDigits = (value: string): string => value.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/٫/g, '.');
const numeric = (value: string, field: string): string => {
  const normalized = arabicDigits(value.trim());
  if (normalized === '') return '';
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) throw new Error(`Invalid numeric value in ${field}.`);
  return normalized;
};

export const parseCsvRecords = (input: string): CsvRecord[] => {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = (() => {
    let commas = 0; let semicolons = 0; let tabs = 0; let quoted = false;
    for (const char of text.split(/\r?\n/, 1)[0] ?? '') { if (char === '"') quoted = !quoted; else if (!quoted && char === ',') commas++; else if (!quoted && char === ';') semicolons++; else if (!quoted && char === '\t') tabs++; }
    return tabs > commas && tabs >= semicolons ? '\t' : semicolons > commas ? ';' : ',';
  })();
  const records: CsvRecord[] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (cell.trim() === '' || quoted) quoted = !quoted;
      else throw new Error('Malformed CSV: unexpected quote.');
    } else if (!quoted && char === delimiter) { row.push(cell); cell = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(value => value !== '')) records.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error('Malformed CSV: unterminated quoted field.');
  if (cell !== '' || row.length) { row.push(cell); if (row.some(value => value !== '')) records.push(row); }
  return records;
};

export const parseSettingsEntryCsv = (input: string): ImportedEntryFields[] => {
  const records = parseCsvRecords(input);
  if (!records.length) throw new Error('CSV file is empty.');
  const headers = records[0].map(normalizeHeader);
  const index = (field: keyof ImportedEntryFields): number => {
    const found = headers.findIndex(header => aliases[field].some(alias => normalizeHeader(alias) === header));
    if (found < 0 && ['date', 'tx', 'debit', 'credit'].includes(field)) throw new Error(`Missing required CSV header: ${field}.`);
    return found;
  };
  const indexes = Object.fromEntries((Object.keys(aliases) as (keyof ImportedEntryFields)[]).map(field => [field, index(field)])) as Record<keyof ImportedEntryFields, number>;
  return records.slice(1).map((row, rowIndex) => {
    const value = (field: keyof ImportedEntryFields): string => indexes[field] < 0 ? '' : row[indexes[field]] ?? '';
    const date = value('date').trim(); const tx = value('tx').trim(); const debit = value('debit').trim(); const credit = value('credit').trim();
    if (!date || !tx || !debit || !credit) throw new Error(`Invalid CSV row ${rowIndex + 2}: date, operation, debit, and credit are required.`);
    const karatValue = numeric(value('karat'), 'karat'); const multiplierValue = numeric(value('multiplier'), 'multiplier');
    return { date, tx, debit, credit, cash: value('cash') || '0', weight: value('weight') || '0', notes: value('notes'), karat: karatValue ? Number(karatValue) : null, count: value('count') || '0', arabicWeight: value('arabicWeight') || '0', multiplier: multiplierValue ? Number(multiplierValue) : null };
  });
};
