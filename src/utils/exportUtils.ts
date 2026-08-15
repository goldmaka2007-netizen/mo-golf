import { BALANCE_ENGINE_VERSION } from '../lib/engine';
import { downloadCsv } from './csv';

export const exportToCsv = (sheetsData: { name: string, data: Record<string, unknown>[] }[], fileName: string, balanceEngineVersion = BALANCE_ENGINE_VERSION) => {
  const rows: Record<string, unknown>[] = sheetsData.flatMap(({ name, data }) => data.map(row => ({ التقرير: name, ...row })));
  rows.push({ التقرير: 'Metadata', key: 'balanceEngineVersion', value: balanceEngineVersion });
  downloadCsv(rows, fileName);
};
