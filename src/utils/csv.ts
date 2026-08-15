export type CsvRow = Record<string, unknown>;

export const escapeCsv = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const rowsToCsv = (rows: CsvRow[], columns?: string[]): string => {
  const headers = columns ?? [...new Set(rows.flatMap(row => Object.keys(row)))];
  return `\uFEFF${[headers, ...rows.map(row => headers.map(header => row[header]))]
    .map(row => row.map(escapeCsv).join(','))
    .join('\r\n')}\r\n`;
};

export const downloadCsv = (rows: CsvRow[], fileName: string, columns?: string[]): void => {
  const blob = new Blob([rowsToCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};
