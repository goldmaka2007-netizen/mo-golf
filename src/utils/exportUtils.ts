import * as XLSX from 'xlsx';

export const exportToExcel = (sheetsData: { name: string, data: any[] }[], fileName: string) => {
  const wb = XLSX.utils.book_new();
  
  sheetsData.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};
