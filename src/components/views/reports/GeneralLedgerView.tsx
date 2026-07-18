import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Search, Calendar, Landmark, Download, X } from 'lucide-react';
import { Entry, AccountNature } from '../../../types';
import { cn } from '../../../lib/utils';
import { useAppStore } from '../../../store';
import { getDynamicAccountNature, getMetricValue, getMetricActualValue } from '../../../utils/accountLogic';
import { parseWeight } from '../../../lib/accounting';
import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';

export const GeneralLedgerView = React.memo(({ entries, startDate, endDate }: { entries: Entry[], startDate?: string, endDate?: string }) => {
  const { accountsDb } = useAppStore();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [metric, setMetric] = useState<'cash' | 'gold' | 'silver' | 'accs'>('cash');
  const [selectedKaratFilter, setSelectedKaratFilter] = useState<string | null>(null);

  // Unified Account List
  const accounts = useMemo(() => {
    const set = new Set<string>();
    const safeEntries = Array.isArray(entries) ? entries : [];
    safeEntries.forEach(e => {
        if (e.debit) set.add(e.debit);
        if (e.credit) set.add(e.credit);
    });
    return Array.from(set).sort((a, b) => (a || '').localeCompare(b || '', 'ar'));
  }, [entries]);

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    return accounts.filter(acc => acc.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [accounts, searchTerm]);

  const normalizeTo21 = (weight: number, karat: any) => {
    return weight;
  };

    const { ledgerEntries, openingBalance } = useMemo(() => {
    if (!selectedAccount) return { ledgerEntries: [], openingBalance: 0 };

    let runningBalance = 0;
    let periodOpeningBalance = 0;
    const result: any[] = [];
    const nature = getDynamicAccountNature(selectedAccount, accountsDb || []);
    
    const accountInfo = (accountsDb || []).find(a => a.name === selectedAccount);
    const isNaturallyCredit = accountInfo?.mainType === 'خصوم' || 
                             accountInfo?.mainType === 'الخصوم' ||
                             accountInfo?.mainType === 'حقوق ملكية' || 
                             accountInfo?.mainType === 'حقوق الملكية' ||
                             accountInfo?.mainType === 'ايرادات' || 
                             accountInfo?.mainType === 'الايرادات';

    const safeEntries = Array.isArray(entries) ? entries : [];
    
    // Always sort chronological for calculations
    const sortedEntries = [...safeEntries].sort((a, b) => {
      const dateComp = (a.date || '').localeCompare(b.date || '');
      if (dateComp !== 0) return dateComp;
      const invComp = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
      if (invComp !== 0) return invComp;
      return (a.seq || 0) - (b.seq || 0);
    });

    sortedEntries.forEach(e => {
        const isDebit = e.debit === selectedAccount;
        const isCredit = e.credit === selectedAccount;
        if (!isDebit && !isCredit) return;

        let val = 0;
        if (metric === 'gold') {
          val = getMetricActualValue(e, 'gold', accountsDb);
        } else if (metric === 'silver') {
          val = getMetricActualValue(e, 'silver', accountsDb);
        } else if (metric === 'accs') {
          val = getMetricActualValue(e, 'accs', accountsDb);
        } else {
          val = getMetricValue(e, 'cash', accountsDb);
        }

        const dVal = isDebit ? val : 0;
        const cVal = isCredit ? val : 0;
        const balanceChange = isNaturallyCredit ? (cVal - dVal) : (dVal - cVal);
        
        // Karat Filter: If active, we only calculate balance for THIS karat
        if (metric === 'gold' && selectedKaratFilter) {
          const entryKarat = (e.karat || 'أخرى').toString();
          if (entryKarat !== selectedKaratFilter) {
             return; // Skip entry AND balance calculation for other karats when filtered
          }
        }

        if (startDate && e.date < startDate) {
          runningBalance += balanceChange;
          periodOpeningBalance = runningBalance;
          return;
        }

        if (endDate && e.date > endDate) return;

        runningBalance += balanceChange;

        if (dVal === 0 && cVal === 0) return;

        result.push({
            date: e.date || '',
            tx: e.tx || '',
            karat: e.karat || '-',
            debit: dVal,
            credit: cVal,
            balance: runningBalance,
            counterPart: isDebit ? e.credit : e.debit
        });
    });

    // Return descending for UI
    return { ledgerEntries: result.reverse(), openingBalance: periodOpeningBalance };
  }, [entries, selectedAccount, metric, startDate, endDate, accountsDb, selectedKaratFilter]);
  const handleExport = () => {
    try {
      if (!selectedAccount) return;

      const accountInfo = accountsDb.find(a => a.name === selectedAccount);
      if (!accountInfo) return;

      const nature = getDynamicAccountNature(selectedAccount, accountsDb);
      const isCr = accountInfo?.mainType === 'خصوم' || 
                   accountInfo?.mainType === 'الخصوم' ||
                   accountInfo?.mainType === 'حقوق ملكية' || 
                   accountInfo?.mainType === 'حقوق الملكية' ||
                   accountInfo?.mainType === 'ايرادات' || 
                   accountInfo?.mainType === 'الايرادات';

      let runningCash = 0;
      let runningGold = 0;
      let runningSilver = 0;

      let opCash = 0;
      let opGold = 0;
      let opSilver = 0;

      // Ensure at least Cash is exported even if nature is unknown
      const hasCash = true; 
      const hasGold = [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(nature);
      const hasSilver = [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(nature);

      const exportDataCash: any[] = [];
      const exportDataGold: any[] = [];
      const exportDataSilver: any[] = [];

      // Sort chronological for balance calculation
      const chronologicallySorted = [...entries].sort((a, b) => {
        const dateComp = (a.date || '').localeCompare(b.date || '');
        if (dateComp !== 0) return dateComp;
        const invComp = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '');
        if (invComp !== 0) return invComp;
        return (a.seq || 0) - (b.seq || 0);
      });

      chronologicallySorted.forEach(e => {
        const isDebit = e.debit === selectedAccount;
        const isCredit = e.credit === selectedAccount;
        if (!isDebit && !isCredit) return;

        const valC = getMetricValue(e, 'cash', accountsDb);
        const valG = getMetricActualValue(e, 'gold', accountsDb);
        const valS = getMetricActualValue(e, 'silver', accountsDb);

        const dCash = isDebit ? valC : 0;
        const cCash = isCredit ? valC : 0;
        const dGold = isDebit ? valG : 0;
        const cGold = isCredit ? valG : 0;
        const dSilver = isDebit ? valS : 0;
        const cSilver = isCredit ? valS : 0;

        const changeCash = isCr ? (cCash - dCash) : (dCash - cCash);
        const changeGold = isCr ? (cGold - dGold) : (dGold - cGold);
        const changeSilver = isCr ? (cSilver - dSilver) : (dSilver - cSilver);

        if (startDate && e.date < startDate) {
          runningCash += changeCash;
          runningGold += changeGold;
          runningSilver += changeSilver;
          opCash = runningCash;
          opGold = runningGold;
          opSilver = runningSilver;
          return;
        }

        if (endDate && e.date > endDate) return;

        // Apply Karat filter: Only track balance for THIS karat if filtered
        if (selectedKaratFilter && hasGold) {
          const entryKarat = e.karat?.toString() || 'أخرى';
          if (entryKarat !== selectedKaratFilter) {
            return; // Skip completely for balance calculation when filtered
          }
        }

        runningCash += changeCash;
        runningGold += changeGold;
        runningSilver += changeSilver;

        if (valC === 0 && valG === 0 && valS === 0) return;

        const baseRow = {
          'التاريخ': e.date,
          'البيان': e.tx,
          'الطرف المقابل': isDebit ? e.credit : e.debit,
        };

        if (hasCash && valC !== 0) {
          exportDataCash.push({
            ...baseRow,
            'مدين': dCash,
            'دائن': cCash,
            'الرصيد': runningCash,
          });
        }
        if (hasGold && valG !== 0) {
          exportDataGold.push({
            ...baseRow,
            'مدين (جم)': dGold,
            'دائن (جم)': cGold,
            'الرصيد (جم)': runningGold,
          });
        }
        if (hasSilver && valS !== 0) {
          exportDataSilver.push({
            ...baseRow,
            'مدين (فضة)': dSilver,
            'دائن (فضة)': cSilver,
            'الرصيد (فضة)': runningSilver,
          });
        }
      });

      const wb = XLSX.utils.book_new();

      const addSheet = (data: any[], typeName: string, opVal: number, hasType: boolean, debitKey: string, creditKey: string, balanceKey: string) => {
        if (!hasType) return;
        if (data.length === 0 && opVal === 0) return;
        
        // User requested descending order (Newest to Oldest)
        const sheetData = [...data].reverse();
        
        // Create worksheet starting from row 5 to leave space for headers
        const ws = XLSX.utils.aoa_to_sheet([]);
        XLSX.utils.sheet_add_json(ws, sheetData, { origin: "A5" });
        const keys = Object.keys(sheetData[0]);

        // Add Header Info (Title and Metadata) for a professional look
        const headerInfo = [
          [`كشف حساب: ${selectedAccount} (${typeName})`],
          [`تاريخ استخراج التقرير: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`],
          [`الفترة: من ${startDate || 'أول حركة'} إلى ${endDate || 'اليوم'}`],
          [] // Spacer
        ];
        XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: "A1" });

        // Merge Headers across the table width
        if (!ws['!merges']) ws['!merges'] = [];
        for (let i = 0; i < 3; i++) {
          ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: keys.length - 1 } });
        }

        // Optimized Column Widths - Compact for better viewing/printing
        ws['!cols'] = keys.map(k => {
          if (k === 'التاريخ') return { wch: 11 };
          if (k === 'البيان') return { wch: 22 };
          if (k === 'الطرف المقابل') return { wch: 15 };
          return { wch: 11 }; // Numbers (Debit, Credit, Balance)
        });

        const dIdx = keys.indexOf(debitKey);
        const cIdx = keys.indexOf(creditKey);

        // Apply Styles
        // Header Static Info Styles
        for (let R = 0; R < 3; R++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: 0 });
          if (ws[cellRef]) {
            ws[cellRef].s = {
              font: { 
                bold: R === 0, 
                sz: R === 0 ? 16 : 11, 
                color: { rgb: R === 0 ? "FFFFFF" : "475569" } 
              },
              fill: { fgColor: { rgb: R === 0 ? "1E293B" : "F1F5F9" } },
              alignment: { horizontal: "center", vertical: "center" }
            };
          }
        }

        // Table Header Styling (Row 5)
        for (let C = 0; C < keys.length; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: 4, c: C });
          if (ws[cellRef]) {
            ws[cellRef].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "334155" } }, // Slate 700
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "medium", color: { rgb: "000000" } },
                bottom: { style: "medium", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
              }
            };
          }
        }

        // Data Rows Styling with Borders
        for (let R = 5; R < 5 + sheetData.length; R++) {
          for (let C = 0; C < keys.length; C++) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            if (!ws[cellRef]) continue;

            const baseStyle: any = {
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
              }
            };

            const dVal = (ws[XLSX.utils.encode_col(dIdx) + (R + 1)]?.v || 0);
            const cVal = (ws[XLSX.utils.encode_col(cIdx) + (R + 1)]?.v || 0);
            const isD = typeof dVal === 'number' && dVal > 0;
            const isC = typeof cVal === 'number' && cVal > 0;

            if (isD || isC) {
              ws[cellRef].s = {
                ...baseStyle,
                fill: { fgColor: { rgb: isD ? "DCFCE7" : "FEE2E2" } }, // Success Green or Danger Red
                font: { color: { rgb: isD ? "166534" : "991B1B" } }
              };
            } else {
              ws[cellRef].s = baseStyle;
            }
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, `كشف - ${typeName}`);
      };

      addSheet(exportDataCash, 'نقدية', opCash, hasCash, 'مدين', 'دائن', 'الرصيد');
      addSheet(exportDataGold, 'ذهب', opGold, hasGold, 'مدين (جم)', 'دائن (جم)', 'الرصيد (جم)');
      addSheet(exportDataSilver, 'فضة', opSilver, hasSilver, 'مدين (فضة)', 'دائن (فضة)', 'الرصيد (فضة)');

      if (wb.SheetNames.length === 0) {
        console.log("No sheets were added to the workbook");
        return;
      }
      XLSX.writeFile(wb, `Ledger_${selectedAccount}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      console.error("Export Fail:", err);
    }
  };

  const balanceSummary = useMemo(() => {
    if (!selectedAccount) return null;
    
    // Check if account is naturally Credit (Credit - Debit) or Debit (Debit - Credit)
    const accountInfo = (accountsDb || []).find(a => a.name === selectedAccount);
    const isNaturallyCredit = accountInfo?.mainType === 'خصوم' || 
                             accountInfo?.mainType === 'الخصوم' ||
                             accountInfo?.mainType === 'حقوق ملكية' || 
                             accountInfo?.mainType === 'حقوق الملكية' ||
                             accountInfo?.mainType === 'ايرادات' || 
                             accountInfo?.mainType === 'الايرادات';

    let cash = 0;
    let gold = 0;
    let silver = 0;
    let accs = 0;
    
    const safeEntries = Array.isArray(entries) ? entries : [];
    safeEntries.forEach(e => {
      // Filter by end date for balance summary to match Balance Sheet
      if (endDate && e.date > endDate) return;

      const isDebit = e.debit === selectedAccount;
      const isCredit = e.credit === selectedAccount;
      if (!isDebit && !isCredit) return;
      
      let multiplier = 0;
      if (isNaturallyCredit) {
        multiplier = isCredit ? 1 : -1;
      } else {
        multiplier = isDebit ? 1 : -1;
      }
      
      // Extract values for all possible ledgers
      const valC = getMetricValue(e, 'cash', accountsDb);
      const valG = getMetricActualValue(e, 'gold', accountsDb);
      const valS = getMetricActualValue(e, 'silver', accountsDb);
      const valA = getMetricActualValue(e, 'accs', accountsDb);
      
      cash += (valC * multiplier);
      gold += (valG * multiplier);
      silver += (valS * multiplier);
      accs += (valA * multiplier);
    });

    return { cash, gold, silver, accs, nature: getDynamicAccountNature(selectedAccount, accountsDb || []) };
  }, [entries, selectedAccount, accountsDb, endDate]);

  const karatBalances = useMemo(() => {
    if (!selectedAccount) return {};
    
    const balances: Record<string, number> = {};
    const accountInfo = (accountsDb || []).find(a => a.name === selectedAccount);
    const isCr = accountInfo?.mainType === 'خصوم' || 
                 accountInfo?.mainType === 'الخصوم' ||
                 accountInfo?.mainType === 'حقوق ملكية' || 
                 accountInfo?.mainType === 'حقوق الملكية' ||
                 accountInfo?.mainType === 'ايرادات' || 
                 accountInfo?.mainType === 'الايرادات';

    const safeEntries = Array.isArray(entries) ? entries : [];
    safeEntries.forEach(e => {
      if (endDate && e.date > endDate) return;
      const isDebit = e.debit === selectedAccount;
      const isCredit = e.credit === selectedAccount;
      if (!isDebit && !isCredit) return;

      // For Karat break-down, we always use raw weight
      const weightVal = getMetricActualValue(e, 'gold', accountsDb);
      if (weightVal === 0) return;

      const karatLabel = e.karat ? e.karat.toString() : 'أخرى';
      const multiplier = isCr ? (isCredit ? 1 : -1) : (isDebit ? 1 : -1);
      
      balances[karatLabel] = (balances[karatLabel] || 0) + (weightVal * multiplier);
    });

    return balances;
  }, [entries, selectedAccount, accountsDb, endDate]);

  const unit = metric === 'cash' ? 'ج.م' : (metric === 'gold' ? 'جم' : (metric === 'silver' ? 'جرام' : 'قطعة'));

  return (
    <div className="space-y-4 pb-20">
      {/* Report Summary & Selection Controls */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1a1e2a] pb-3">
          <div className="flex items-center gap-3">
            <Book className="w-6 h-6 md:w-8 md:h-8 text-[#c9a84c]" />
            <div>
              <h3 className="text-lg md:text-xl font-bold text-[#ddd8cc]">دفتر الأستاذ العام</h3>
              <p className="text-[10px] text-[#5a5548]">تحليل تفصيلي لحركة الحساب</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              disabled={!selectedAccount || ledgerEntries.length === 0}
              className="group flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-[#080a0f] rounded-xl hover:bg-[#d4b96a] transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold shadow-lg shadow-[#c9a84c]/10 text-xs"
            >
              <Download className="w-3.5 h-3.5 group-hover:bounce" />
              تصدير XLSX
            </button>
          </div>
        </div>

        {balanceSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             {(balanceSummary.gold !== 0 || [AccountNature.GOLD, AccountNature.MIXED_GOLD].includes(balanceSummary.nature)) && (
               <div className="bg-[#c9a84c]/5 p-3 rounded-xl border border-[#c9a84c]/20">
                 <p className="text-[9px] text-[#c9a84c] font-bold uppercase mb-1">إجمالي الذهب (الفعلي)</p>
                 <div className="flex justify-between items-end">
                   <p className="text-xl font-mono font-bold text-[#c9a84c]">{Math.abs(balanceSummary.gold).toFixed(2)} <span className="text-[10px]">جم</span></p>
                   <span className="text-[9px] px-1.5 py-0.5 bg-[#c9a84c]/20 rounded-full text-[#c9a84c]">
                     {(() => {
                        const accountInfo = accountsDb.find(a => a.name === selectedAccount);
                        const isCr = accountInfo?.mainType === 'خصوم' || accountInfo?.mainType === 'حقوق ملكية' || accountInfo?.mainType === 'ايرادات';
                        return balanceSummary.gold >= 0 ? (isCr ? 'دائن' : 'مدين') : (isCr ? 'مدين' : 'دائن');
                     })()}
                   </span>
                 </div>
               </div>
             )}
             {(balanceSummary.silver !== 0 || [AccountNature.SILVER, AccountNature.MIXED_SILVER].includes(balanceSummary.nature)) && (
               <div className="bg-[#6a8a9e]/5 p-3 rounded-xl border border-[#6a8a9e]/20">
                 <p className="text-[9px] text-[#6a8a9e] font-bold uppercase mb-1">إجمالي الفضة</p>
                 <div className="flex justify-between items-end">
                   <p className="text-xl font-mono font-bold text-[#6a8a9e]">{Math.abs(balanceSummary.silver).toFixed(2)} <span className="text-[10px]">جم</span></p>
                   <span className="text-[9px] px-1.5 py-0.5 bg-[#6a8a9e]/20 rounded-full text-[#6a8a9e]">
                     {(() => {
                        const accountInfo = accountsDb.find(a => a.name === selectedAccount);
                        const isCr = accountInfo?.mainType === 'خصوم' || accountInfo?.mainType === 'حقوق ملكية' || accountInfo?.mainType === 'ايرادات';
                        return balanceSummary.silver >= 0 ? (isCr ? 'دائن' : 'مدين') : (isCr ? 'مدين' : 'دائن');
                     })()}
                   </span>
                 </div>
               </div>
             )}
             {(balanceSummary.cash !== 0 || [AccountNature.CASH, AccountNature.MIXED_GOLD, AccountNature.MIXED_SILVER].includes(balanceSummary.nature)) && (
               <div className="bg-[#6a9e6a]/5 p-3 rounded-xl border border-[#6a9e6a]/20">
                 <p className="text-[9px] text-[#6a9e6a] font-bold uppercase mb-1">إجمالي النقدية</p>
                 <div className="flex justify-between items-end">
                   <p className="text-xl font-mono font-bold text-[#6a9e6a]">{Math.abs(balanceSummary.cash).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px]">ج.م</span></p>
                   <span className="text-[9px] px-1.5 py-0.5 bg-[#6a9e6a]/20 rounded-full text-[#6a9e6a]">
                     {(() => {
                        const accountInfo = accountsDb.find(a => a.name === selectedAccount);
                        const isCr = accountInfo?.mainType === 'خصوم' || accountInfo?.mainType === 'حقوق ملكية' || accountInfo?.mainType === 'ايرادات';
                        return balanceSummary.cash >= 0 ? (isCr ? 'دائن' : 'مدين') : (isCr ? 'مدين' : 'دائن');
                     })()}
                   </span>
                 </div>
               </div>
             )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[#5a5548] uppercase tracking-widest block pr-1">الحساب المستهدف</label>
            <div className="relative group">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a5548] group-focus-within:text-[#c9a84c] transition-colors" />
              <input 
                type="text"
                value={searchTerm !== '' ? searchTerm : selectedAccount}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value === '') {
                    setSelectedAccount('');
                  } else if (selectedAccount && e.target.value !== selectedAccount) {
                    setSelectedAccount('');
                  }
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                placeholder="ابحث عن حساب..."
                className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl py-2.5 pr-9 pl-10 text-[#ddd8cc] text-sm focus:outline-none focus:border-[#c9a84c] transition-all"
              />
              {(searchTerm || selectedAccount) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedAccount('');
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5548] hover:text-[#c9a84c]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {showResults && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-[#0e1018] border border-[#c9a84c]/30 rounded-xl shadow-2xl divide-y divide-[#1a1e2a]">
                  {filteredAccounts.map(acc => (
                    <button
                      key={acc}
                      onClick={() => {
                        setSelectedAccount(acc);
                        setSearchTerm('');
                        setShowResults(false);
                      }}
                      className={cn(
                        "w-full text-right px-4 py-2.5 text-xs transition-all hover:bg-[#c9a84c]/10",
                        selectedAccount === acc ? "bg-[#c9a84c]/10 text-[#c9a84c] font-bold" : "text-[#8a8578]"
                      )}
                    >
                      {acc}
                    </button>
                  ))}
                </div>
              )}
              {showResults && <div className="fixed inset-0 z-40" onClick={() => setShowResults(false)} />}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-[#5a5548] uppercase tracking-widest block pr-1">عملة التقرير</label>
            <div className="flex p-0.5 bg-[#080a0f] rounded-xl border border-[#1a1e2a]">
               {(() => {
                 const currentNature = getDynamicAccountNature(selectedAccount, accountsDb);
                 const availableMetrics: ('cash' | 'gold' | 'silver' | 'accs')[] = ['cash', 'gold', 'silver'];
                 if (currentNature === AccountNature.ACC) availableMetrics.push('accs');
                 
                 return availableMetrics.map((m) => (
                   <button
                     key={m}
                     onClick={() => setMetric(m)}
                     className={cn(
                       "flex-1 py-2 rounded-lg text-[10px] font-bold transition-all",
                       metric === m 
                         ? "bg-[#c9a84c] text-[#080a0f] shadow-md" 
                         : "text-[#5a5548] hover:text-[#8a8578]"
                     )}
                   >
                     {m === 'cash' ? 'نقدية' : (m === 'gold' ? 'ذهب' : (m === 'silver' ? 'فضة' : 'قطع'))}
                   </button>
                 ));
               })()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Report Table Container */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Visual Report Header */}
        <div className="bg-[#1a1e2a]/50 p-4 md:p-6 border-b border-[#c9a84c]/20 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-xl md:text-2xl font-black text-[#ddd8cc] tracking-tight">كشف حساب: {selectedAccount || '---'}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:text-sm font-medium text-[#5a5548]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#c9a84c]" />
                الفترة: <span className="text-[#ddd8cc] font-bold">{startDate || 'أول حركة'}</span> - <span className="text-[#ddd8cc] font-bold">{endDate || 'اليوم'}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-[#1a1e2a] px-2 py-0.5 md:px-3 md:py-1 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" />
                استخراج: <span className="text-[#c9a84c] font-black">{format(new Date(), 'yyyy-MM-dd')}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#c9a84c]" />
                الوحدة: <span className="text-[#c9a84c] font-bold">{unit}</span>
              </span>
            </div>
          </div>
        </div>

        {/* The Grid Table */}
        <div className="overflow-x-auto overflow-y-hidden border-t border-[#1a1e2a]">
          <table className="w-full text-right border-collapse table-fixed min-w-[500px]">
            <thead>
              <tr className="bg-[#1a1e2a] text-[#c9a84c] border-b border-[#c9a84c]/30 font-black">
                <th className="py-2 px-1 text-[9px] md:text-xs uppercase tracking-tight border-l border-[#080a0f] w-[75px]">التاريخ</th>
                <th className="py-2 px-1 text-[9px] md:text-xs uppercase tracking-tight border-l border-[#080a0f] w-auto">البيان / الحركة</th>
                <th className="py-2 px-0.5 text-[9px] md:text-xs uppercase tracking-tight border-l border-[#080a0f] text-center w-[40px]">عيار</th>
                <th className="py-2 px-1 text-[9px] md:text-xs uppercase tracking-tight border-l border-[#080a0f] w-[80px]">المقابل</th>
                <th className="py-2 px-1 text-[9px] md:text-xs uppercase tracking-tight border-l border-[#080a0f] text-left w-[85px]">مدين (+)</th>
                <th className="py-2 px-1 text-[9px] md:text-xs uppercase tracking-tight border-l border-[#080a0f] text-left w-[85px]">دائن (-)</th>
                <th className="py-2 px-1 text-[9px] md:text-xs uppercase tracking-tight text-left w-[100px]">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1e2a]">
              {ledgerEntries.map((row, i) => (
                <tr key={i} className="hover:bg-[#c9a84c]/5 transition-all group">
                  <td className="py-1 px-1 text-[#ddd8cc] font-mono text-[9px] md:text-xs border-l border-[#1a1e2a]/50 truncate">{row.date}</td>
                  <td className="py-1 px-1 text-[#8a8578] text-[9px] md:text-xs border-l border-[#1a1e2a]/50 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:z-10 relative">{row.tx}</td>
                  <td className="py-1 px-0.5 text-center border-l border-[#1a1e2a]/50">
                    <span className="px-1 py-0.5 bg-[#c9a84c]/10 text-[#c9a84c] rounded text-[8px] md:text-[9px] font-bold font-mono">{row.karat}</span>
                  </td>
                  <td className="py-1 px-1 text-[#c9a84c] text-[9px] md:text-xs font-bold border-l border-[#1a1e2a]/50 truncate">{row.counterPart}</td>
                  <td className="py-1 px-1 text-left font-mono border-l border-[#1a1e2a]/50 text-[10px] md:text-xs">
                    <span className={cn(row.debit > 0 ? "text-[#6a9e6a] font-bold" : "text-[#5a5548] opacity-20")}>
                      {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </td>
                  <td className="py-1 px-1 text-left font-mono border-l border-[#1a1e2a]/50 text-[10px] md:text-xs">
                    <span className={cn(row.credit > 0 ? "text-[#9e6a6a] font-bold" : "text-[#5a5548] opacity-20")}>
                      {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </td>
                  <td className="py-1 px-1 text-left font-mono font-black text-[10px] md:text-xs bg-[#080a0f]/30">
                    <span className={cn(
                      row.balance >= 0 ? "text-[#ddd8cc]" : "text-red-500"
                    )}>
                      {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
              
              {/* Opening Balance Row at the BOTTOM (Chronologically first) */}
              {openingBalance !== 0 && (
                <tr className="bg-[#1a1e2a]/20 italic border-t border-[#1a1e2a]">
                  <td className="py-1 px-1 md:px-2 text-[#5a5548] font-mono text-[9px] border-l border-[#1a1e2a]/50">{startDate || '-'}</td>
                  <td colSpan={5} className="py-1 px-1 md:px-2 text-[#5a5548] text-[9px] md:text-[10px] font-bold border-l border-[#1a1e2a]/50 tracking-wider">
                    رصيد أول المدة المرحل
                  </td>
                  <td className="py-1 px-1 md:px-2 text-left font-mono font-bold text-[#8a8578] bg-[#0a0c10]/50 text-[10px] md:text-xs">
                    {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}

              {/* Summary Bottom Bar */}
              {ledgerEntries.length > 0 && (
                <tr className="bg-[#c9a84c]/5 border-t-2 border-[#c9a84c]/30">
                  <td colSpan={6} className="py-2.5 px-1 md:px-2 text-[#c9a84c] font-black text-[10px] md:text-sm text-right tracking-tighter border-l border-[#1a1e2a]/50">الإجمالي الختامي في {endDate || 'اليوم'}</td>
                  <td className="py-2.5 px-1 md:px-2 text-left font-mono font-black text-xs md:text-sm text-[#ddd8cc] bg-[#080a0f]">
                    {ledgerEntries[0].balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-[8px] md:text-[9px] mr-1 text-[#c9a84c] font-medium">{unit}</span>
                  </td>
                </tr>
              )}

              {ledgerEntries.length === 0 && !openingBalance && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#5a5548] italic tracking-widest text-xs">لا توجد حركات مسجلة لهذا الحساب</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
