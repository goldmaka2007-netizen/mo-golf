import * as XLSX from 'xlsx';
import { BALANCE_ENGINE_VERSION } from '../lib/engine';

export const exportToExcel = (sheetsData: { name: string, data: any[] }[], fileName: string, balanceEngineVersion = BALANCE_ENGINE_VERSION) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ key: 'balanceEngineVersion', value: balanceEngineVersion }]), 'Metadata');
  
  sheetsData.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
