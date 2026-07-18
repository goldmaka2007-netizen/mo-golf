import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  TrendingUp, 
  Wallet, 
  Scale, 
  Database, 
  CheckCircle2,
  ClipboardPaste,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx-js-style';
import { Entry } from '../../types';
import { useAppStore } from '../../store';
import { GOLD_ORDER } from '../../constants';
import { cn } from '../../lib/utils';
import { 
  calculateArabicWeight, 
  parseWeight, 
  formatCurrency 
} from '../../lib/accounting';

export const DailyJournalView = React.memo(() => {
  const { setView, entries, setEditingEntry, goldPrice, silverPrice, accounts, accountCategories } = useAppStore();
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    if (entries.length > 0 && !selectedDate) {
      const dates = entries.map(e => e.date).filter(d => typeof d === 'string' && d.length > 0);
      if (dates.length > 0) {
        setSelectedDate(dates.reduce((max, curr) => curr > max ? curr : max));
      } else {
        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
      }
    } else if (entries.length === 0 && !selectedDate) {
      setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [entries, selectedDate]);

  const dayAverages = useMemo(() => {
    const result: Record<string, {
      gold: { buyCash: number, buyWeight: number, sellCash: number, sellWeight: number },
      silver: { buyCash: number, buyWeight: number, sellCash: number, sellWeight: number }
    }> = {};

    entries.forEach(e => {
      if (!e.date || !e.cash || !e.weight) return;
      const w = parseFloat(e.weight);
      const c = parseFloat(e.cash);
      if (w <= 0 || c <= 0) return;

      const isSilver = (e.tx || '').includes('فضة') || (e.debit || '').includes('فضة') || (e.credit || '').includes('فضة');
      const isAcc = (e.tx || '').includes('ملحقات') || (e.debit || '').includes('ملحقات') || (e.credit || '').includes('ملحقات');

      if (isAcc) return; // Do not calculate average for accessories per weight

      const aw = parseFloat(e.arabicWeight || '0') || calculateArabicWeight(e.weight, e.multiplier || (e.karat === 18 ? 0.857142857 : e.karat === 24 ? 1.142857143 : 1));
      const targetWeight = isSilver ? w : (typeof aw === 'string' ? parseFloat(aw) : aw);

      if (!result[e.date]) {
        result[e.date] = {
          gold: { buyCash: 0, buyWeight: 0, sellCash: 0, sellWeight: 0 },
          silver: { buyCash: 0, buyWeight: 0, sellCash: 0, sellWeight: 0 }
        };
      }

      const target = isSilver ? result[e.date].silver : result[e.date].gold;

      if ((e.tx || '').includes('شراء')) {
        target.buyCash += c;
        target.buyWeight += targetWeight;
      } else if ((e.tx || '').includes('بيع')) {
        target.sellCash += c;
        target.sellWeight += targetWeight;
      }
    });

    return result;
  }, [entries]);

  const exportToExcel = () => {
    try {
      const { dayEntries, dayStats } = journalData;
      
      const wb = XLSX.utils.book_new();
      
      const headerInfo = [
        ["تقرير اليومية العامة", "", "", "", "", "", "", ""],
        [`التاريخ: ${selectedDate}`, "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["--- ملخص اليوم ---", "", "", "", "", "", "", ""],
        ["إجمالي وارد نقدي", String(dayStats.cashIn), "", "إجمالي منصرف نقدي", String(dayStats.cashOut), "", "", ""],
        ["وارد ذهب 21", dayStats.goldIn.toFixed(2), "", "منصرف ذهب 21", dayStats.goldOut.toFixed(2), "", "", ""],
        ["وارد فضة", dayStats.silverIn.toFixed(2), "", "منصرف فضة", dayStats.silverOut.toFixed(2), "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["--- تفاصيل الحركات ---", "", "", "", "", "", "", ""]
      ];

      const tableData = dayEntries.map((e, index) => ({
        "م": index + 1,
        "البيان": e.tx || '',
        "من حساب": e.debit || '',
        "إلى حساب": e.credit || '',
        "القيمة (نقدي)": parseFloat(e.cash || '0'),
        "الوزن": parseFloat(e.weight || '0'),
        "العيار": e.karat ? e.karat : '',
        "ملاحظات": e.notes || ''
      }));

      const ws = XLSX.utils.aoa_to_sheet(headerInfo);
      
      XLSX.utils.sheet_add_json(ws, tableData, { origin: "A11" });

      const wscols = [
        { wch: 5 },  // م
        { wch: 20 }, // البيان
        { wch: 20 }, // من حساب
        { wch: 20 }, // إلى حساب
        { wch: 15 }, // القيمة
        { wch: 15 }, // الوزن
        { wch: 10 }, // العيار
        { wch: 30 }, // ملاحظات
      ];
      ws['!cols'] = wscols;

      if (!ws['!views']) ws['!views'] = [];
      ws['!views'].push({ rightToLeft: true });

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:H11');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = { c: C, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          if (!ws[cell_ref]) continue;

          if (!ws[cell_ref].s) {
            ws[cell_ref].s = {
              font: { name: 'Arial', sz: 12 },
              alignment: { vertical: 'center', horizontal: 'center' }
            };
          }

          if (R === 0) {
            ws[cell_ref].s.font.bold = true;
            ws[cell_ref].s.font.sz = 16;
            ws[cell_ref].s.font.color = { rgb: "C9A84C" };
          }
          if (R === 9) { // Because the index is 9 since A11 means it starts at row index 10 (which is the header row, so row 11 is data, row 10 is header)
            ws[cell_ref].s.font.bold = true;
            ws[cell_ref].s.fill = { fgColor: { rgb: "1A1E2A" } };
            ws[cell_ref].s.font.color = { rgb: "FFFFFF" };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, "اليومية");
      XLSX.writeFile(wb, `Journal_${selectedDate}.xlsx`);
    } catch (err) {
      console.error(err);
    }
  };

  const journalData = useMemo(() => {
    let dayEntries = entries.filter(e => e.date === selectedDate);
    
    const cashAccounts = accountCategories?.assets?.["النقدية بالخزنة"] || accountCategories?.assets?.["النقدية"] || [];
    const goldInventory = accountCategories?.assets?.["مخزون ذهب"] || accountCategories?.assets?.["المخزون ذهب"] || [];
    const silverInventory = accountCategories?.assets?.["مخزون فضة"] || accountCategories?.assets?.["المخزون فضة"] || [];

    let openingSafeBalance = 0;
    let closingSafeBalance = 0;

    // Calculate cumulative cash balance up to the end of selectedDate
    entries.forEach(e => {
      const cash = parseFloat(e.cash) || 0;
      if (cash === 0) return;
      
      const isDebitCash = cashAccounts.includes(e.debit);
      const isCreditCash = cashAccounts.includes(e.credit);

      // Opening Calculation (strictly < selectedDate)
      if (e.date < selectedDate) {
        if (isDebitCash) openingSafeBalance += cash;
        if (isCreditCash) openingSafeBalance -= cash;
      }
      
      // Closing Calculation (<= selectedDate)
      if (e.date <= selectedDate) {
        if (isDebitCash) closingSafeBalance += cash;
        if (isCreditCash) closingSafeBalance -= cash;
      }
    });

    const sales = dayEntries.filter(e => ['بيع ذهب', 'بيع فضة', 'بيع ملحقات'].includes(e.tx || ''));
    const purchases = dayEntries.filter(e => ['شراء ذهب', 'شراء فضة', 'شراء ملحقات'].includes(e.tx || ''));
    const expenses = dayEntries.filter(e => ['م ت', 'م ا ع', 'مصاريف'].includes(e.tx || ''));
    const other = dayEntries.filter(e => !sales.includes(e) && !purchases.includes(e) && !expenses.includes(e));

    const dayStats = dayEntries.reduce((acc, e) => {
      const cash = parseFloat(e.cash) || 0;
      if (cashAccounts.includes(e.debit)) acc.cashIn += cash;
      if (cashAccounts.includes(e.credit)) acc.cashOut += cash;

      const awVal = parseFloat(e.arabicWeight) || (parseFloat(e.weight) || 0) * (e.multiplier || (e.karat === 18 ? 0.857142857 : e.karat === 24 ? 1.142857143 : 1));
      const w = parseFloat(e.weight) || 0;
      const c = parseInt(e.count) || 0;

      const isSilver = (e.tx || '').includes('فضة') || (e.debit || '').includes('فضة') || (e.credit || '').includes('فضة');
      const isAcc = (e.tx || '').includes('ملحقات') || (e.debit || '').includes('ملحقات') || (e.credit || '').includes('ملحقات');

      const isGoldDebitRaw = goldInventory.includes(e.debit);
      const isGoldCreditRaw = goldInventory.includes(e.credit);
      const isSilverDebitRaw = silverInventory.includes(e.debit);
      const isSilverCreditRaw = silverInventory.includes(e.credit);

      let isGoldDebit = isGoldDebitRaw;
      let isGoldCredit = isGoldCreditRaw;
      let isSilverDebit = isSilverDebitRaw;
      let isSilverCredit = isSilverCreditRaw;

      if ((e.tx || '').startsWith("حساب تاجر")) {
        isGoldDebit = isGoldCreditRaw;
        isGoldCredit = isGoldDebitRaw;
        isSilverDebit = isSilverCreditRaw;
        isSilverCredit = isSilverDebitRaw;
      }

      const isGold = e.karat || isGoldDebitRaw || isGoldCreditRaw;

      // Gold Movement
      if (isGold && !isSilver && !isAcc) {
        // Only count external movements (one side is not gold asset)
        if (isGoldDebit && !isGoldCredit) acc.goldIn += awVal;
        if (isGoldCredit && !isGoldDebit) acc.goldOut += awVal;
      } 
      // Silver
      else if (isSilver) {
        if (isSilverDebit && !isSilverCredit) acc.silverIn += w;
        if (isSilverCredit && !isSilverDebit) acc.silverOut += w;
      }
      // Accessories
      else if (isAcc) {
        const isAccDebit = accounts.assets.includes(e.debit) && !cashAccounts.includes(e.debit) && !silverInventory.includes(e.debit) && !goldInventory.includes(e.debit);
        const isAccCredit = accounts.assets.includes(e.credit) && !cashAccounts.includes(e.credit) && !silverInventory.includes(e.credit) && !goldInventory.includes(e.credit);
        if (isAccDebit && !isAccCredit) acc.accIn += c;
        if (isAccCredit && !isAccDebit) acc.accOut += c;
      }

      // Profit Calculation Logic
      const isTrading = ['بيع ذهب', 'شراء ذهب', 'بيع فضة', 'شراء فضة', 'بيع ملحقات', 'شراء ملحقات', 'تيفيت', 'تصليح'].includes(e.tx || '');
      const isExpense = ['م ت', 'م ا ع', 'مصاريف'].includes(e.tx || '');

      if (isTrading) {
        // Trading Profit = (Cash Change) + (Gold Change * Price) + (Silver Change * Price)
        // For a single entry:
        let entryCashChange = 0;
        if (cashAccounts.includes(e.debit)) entryCashChange += cash;
        if (cashAccounts.includes(e.credit)) entryCashChange -= cash;

        let entryGoldChange = 0; // in 21k equiv
        if (isGold && !isSilver && !isAcc) {
          if (isGoldDebit && !isGoldCredit) entryGoldChange += awVal;
          if (isGoldCredit && !isGoldDebit) entryGoldChange -= awVal;
        }

        let entrySilverChange = 0;
        if (isSilver) {
          const isSilverDebit = silverInventory.includes(e.debit);
          const isSilverCredit = silverInventory.includes(e.credit);
          if (isSilverDebit && !isSilverCredit) entrySilverChange += w;
          if (isSilverCredit && !isSilverDebit) entrySilverChange -= w;
        }

        acc.tradingProfit += entryCashChange + (entryGoldChange * goldPrice) + (entrySilverChange * silverPrice);
      }

      if (isExpense) {
        acc.totalExpenses += cash;
      }

      return acc;
    }, { cashIn: 0, cashOut: 0, goldIn: 0, goldOut: 0, silverIn: 0, silverOut: 0, accIn: 0, accOut: 0, tradingProfit: 0, totalExpenses: 0 });

    return {
      dayEntries,
      openingSafeBalance,
      closingSafeBalance,
      sales,
      purchases,
      expenses,
      other,
      dayStats
    };
  }, [entries, selectedDate, goldPrice, silverPrice, accounts, accountCategories]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-10"
    >
      <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-black text-[#c9a84c]">
            <Calendar className="h-5 w-5" />
            اليومية العامة
          </h2>
          <button
            type="button"
            onClick={exportToExcel}
            title="تصدير اليومية إكسل"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c9a84c22] bg-[#c9a84c11] text-[#c9a84c] transition-colors hover:bg-[#c9a84c22]"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(format(d, 'yyyy-MM-dd'));
            }}
            className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc] transition-colors hover:text-[#c9a84c]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-[#c9a84c]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-[#ddd8cc] outline-none [color-scheme:dark]"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className="rounded-lg border border-[#6a9e6a33] bg-[#6a9e6a22] px-2 py-1.5 text-[10px] font-black text-[#6a9e6a]"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => {
                  if (entries.length > 0) {
                    const dates = entries.map(e => e.date).filter(Boolean);
                    if (dates.length > 0) {
                      setSelectedDate(dates.reduce((a, b) => a > b ? a : b));
                    }
                  }
                }}
                className="rounded-lg border border-[#c9a84c33] bg-[#c9a84c22] px-2 py-1.5 text-[10px] font-black text-[#c9a84c]"
              >
                أحدث
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(format(d, 'yyyy-MM-dd'));
            }}
            className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc] transition-colors hover:text-[#c9a84c]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Daily Summary Report */}
      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#c9a84c] via-[#6a9e6a] to-[#c9a84c]" />
        
        <div className="flex flex-col gap-8 relative z-10">
          {/* Gold Section */}
          <div className="space-y-4">
            <div className="text-[10px] text-[#5a5548] font-bold uppercase tracking-widest flex items-center gap-2">
              <Scale className="w-3 h-3 text-[#c9a84c]" /> حركة الذهب (21)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] flex flex-col justify-between">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">وارد ذهب</div>
                <div className="text-sm font-bold text-[#c9a84c]">{journalData.dayStats.goldIn.toFixed(2)}</div>
                {dayAverages[selectedDate]?.gold?.buyWeight > 0 && (
                  <div className="text-[10px] text-[#6a9e6a] mt-2 pt-1 border-t border-[#1a1e2a]/50">
                    متوسط الشراء: {(dayAverages[selectedDate].gold.buyCash / dayAverages[selectedDate].gold.buyWeight).toFixed(2)} ج
                  </div>
                )}
              </div>
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] flex flex-col justify-between">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">صادر ذهب</div>
                <div className="text-sm font-bold text-[#c9a84c] opacity-80">{journalData.dayStats.goldOut.toFixed(2)}</div>
                {dayAverages[selectedDate]?.gold?.sellWeight > 0 && (
                  <div className="text-[10px] text-[#c9a84c] mt-2 pt-1 border-t border-[#1a1e2a]/50">
                    متوسط البيع: {(dayAverages[selectedDate].gold.sellCash / dayAverages[selectedDate].gold.sellWeight).toFixed(2)} ج
                  </div>
                )}
              </div>
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] flex flex-col justify-between">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">الفرق</div>
                <div className={cn("text-sm font-bold", (journalData.dayStats.goldIn - journalData.dayStats.goldOut) >= 0 ? "text-[#6a9e6a]" : "text-[#9e6a6a]")}>
                  {(journalData.dayStats.goldIn - journalData.dayStats.goldOut).toFixed(2)}
                </div>
                {dayAverages[selectedDate]?.gold?.buyWeight > 0 && dayAverages[selectedDate]?.gold?.sellWeight > 0 && (
                  <div className={cn("text-[10px] mt-2 pt-1 border-t border-[#1a1e2a]/50",
                    ((dayAverages[selectedDate].gold.sellCash / dayAverages[selectedDate].gold.sellWeight) - (dayAverages[selectedDate].gold.buyCash / dayAverages[selectedDate].gold.buyWeight)) >= 0 ? "text-[#6a9e6a]" : "text-[#9e6a6a]"
                  )}>
                    فرق السعر: {((dayAverages[selectedDate].gold.sellCash / dayAverages[selectedDate].gold.sellWeight) - (dayAverages[selectedDate].gold.buyCash / dayAverages[selectedDate].gold.buyWeight)).toFixed(2)} ج
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Silver Section */}
          <div className="space-y-4 pt-4 border-t border-[#1a1e2a]">
            <div className="text-[10px] text-[#5a5548] font-bold uppercase tracking-widest flex items-center gap-2">
              <Database className="w-3 h-3 text-[#6a8a9e]" /> حركة الفضة
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] flex flex-col justify-between">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">وارد فضة</div>
                <div className="text-sm font-bold text-[#6a8a9e]">{journalData.dayStats.silverIn.toFixed(2)}</div>
                {dayAverages[selectedDate]?.silver?.buyWeight > 0 && (
                  <div className="text-[10px] text-[#6a9e6a] mt-2 pt-1 border-t border-[#1a1e2a]/50">
                    متوسط الشراء: {(dayAverages[selectedDate].silver.buyCash / dayAverages[selectedDate].silver.buyWeight).toFixed(2)} ج
                  </div>
                )}
              </div>
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] flex flex-col justify-between">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">صادر فضة</div>
                <div className="text-sm font-bold text-[#6a8a9e] opacity-80">{journalData.dayStats.silverOut.toFixed(2)}</div>
                {dayAverages[selectedDate]?.silver?.sellWeight > 0 && (
                  <div className="text-[10px] text-[#c9a84c] mt-2 pt-1 border-t border-[#1a1e2a]/50">
                    متوسط البيع: {(dayAverages[selectedDate].silver.sellCash / dayAverages[selectedDate].silver.sellWeight).toFixed(2)} ج
                  </div>
                )}
              </div>
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] flex flex-col justify-between">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">الفرق</div>
                <div className={cn("text-sm font-bold", (journalData.dayStats.silverIn - journalData.dayStats.silverOut) >= 0 ? "text-[#6a9e6a]" : "text-[#9e6a6a]")}>
                  {(journalData.dayStats.silverIn - journalData.dayStats.silverOut).toFixed(2)}
                </div>
                {dayAverages[selectedDate]?.silver?.buyWeight > 0 && dayAverages[selectedDate]?.silver?.sellWeight > 0 && (
                  <div className={cn("text-[10px] mt-2 pt-1 border-t border-[#1a1e2a]/50",
                    ((dayAverages[selectedDate].silver.sellCash / dayAverages[selectedDate].silver.sellWeight) - (dayAverages[selectedDate].silver.buyCash / dayAverages[selectedDate].silver.buyWeight)) >= 0 ? "text-[#6a9e6a]" : "text-[#9e6a6a]"
                  )}>
                    فرق السعر: {((dayAverages[selectedDate].silver.sellCash / dayAverages[selectedDate].silver.sellWeight) - (dayAverages[selectedDate].silver.buyCash / dayAverages[selectedDate].silver.buyWeight)).toFixed(2)} ج
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cash Section */}
          <div className="space-y-4 pt-4 border-t border-[#1a1e2a]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-[#5a5548] font-bold uppercase tracking-widest flex items-center gap-2">
                <Wallet className="w-3 h-3 text-[#5a9e6a]" /> حركة النقدية
              </div>
              <div className="text-[10px] font-bold text-[#c9a84c]">
                الرصيد الافتتاحي: <span className="font-mono">{journalData.openingSafeBalance.toLocaleString()} ج.م</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a]">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">وارد نقدي (مقبوضات)</div>
                <div className="text-sm font-bold text-[#6a9e6a]">{journalData.dayStats.cashIn.toLocaleString()} <span className="text-[9px] font-normal text-[#5a5548]">ج.م</span></div>
              </div>
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a]">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">صادر نقدي (مدفوعات)</div>
                <div className="text-sm font-bold text-[#9e6a6a]">{journalData.dayStats.cashOut.toLocaleString()} <span className="text-[9px] font-normal text-[#5a5548]">ج.م</span></div>
              </div>
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] ring-1 ring-[#c9a84c22]">
                <div className="text-[10px] text-[#c9a84c] font-bold mb-1">صافي الحركة اليومية</div>
                <div className={cn("text-sm font-bold", (journalData.dayStats.cashIn - journalData.dayStats.cashOut) >= 0 ? "text-[#6a9e6a]" : "text-[#9e6a6a]")}>
                  {(journalData.dayStats.cashIn - journalData.dayStats.cashOut).toLocaleString()} <span className="text-[9px] font-normal opacity-50">ج.م</span>
                </div>
              </div>
              <div className="bg-[#080a0f] p-3 rounded-2xl border border-[#1a1e2a] shadow-inner">
                <div className="text-[10px] text-[#5a5548] font-bold mb-1">الرصيد الختامي (الخزنة)</div>
                <div className={cn("text-sm font-bold", journalData.closingSafeBalance >= 0 ? "text-[#c9a84c]" : "text-red-500")}>
                  {journalData.closingSafeBalance.toLocaleString()} <span className="text-[9px] font-normal text-[#5a5548]">ج.م</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#1a1e2a] grid grid-cols-2 gap-4 relative z-10">
          <div className="p-4 bg-[#6a9e6a0a] border border-[#6a9e6a22] rounded-2xl">
            <div className="text-[9px] text-[#6a9e6a] font-bold uppercase mb-1">المكسب قبل المصاريف</div>
            <div className="text-xl font-bold text-[#6a9e6a]">
              {Math.round(journalData.dayStats.tradingProfit).toLocaleString()} <span className="text-[10px]">ج.م</span>
            </div>
          </div>
          <div className="p-4 bg-[#c9a84c0a] border border-[#c9a84c22] rounded-2xl">
            <div className="text-[9px] text-[#c9a84c] font-bold uppercase mb-1">المكسب بعد المصاريف</div>
            <div className="text-xl font-bold text-[#c9a84c]">
              {Math.round(journalData.dayStats.tradingProfit - journalData.dayStats.totalExpenses).toLocaleString()} <span className="text-[10px]">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="space-y-8">
        {/* Sales Section */}
        {journalData.sales.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <TrendingUp className="w-3 h-3 text-[#6a9e6a]" />
              <h3 className="text-[10px] font-bold text-[#5a5548] uppercase">المبيعات</h3>
            </div>
            {journalData.sales.map(e => <JournalEntryRow key={e.id} e={e} setEditingEntry={setEditingEntry} accountCategories={accountCategories} />)}
          </section>
        )}

        {/* Purchases Section */}
        {journalData.purchases.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <TrendingUp className="w-3 h-3 text-[#9e6a6a] rotate-180" />
              <h3 className="text-[10px] font-bold text-[#5a5548] uppercase">المشتريات</h3>
            </div>
            {journalData.purchases.map(e => <JournalEntryRow key={e.id} e={e} setEditingEntry={setEditingEntry} accountCategories={accountCategories} />)}
          </section>
        )}

        {/* Expenses Section */}
        {journalData.expenses.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <TrendingUp className="w-3 h-3 text-[#9e6a6a]" />
              <h3 className="text-[10px] font-bold text-[#5a5548] uppercase">المصاريف</h3>
            </div>
            {journalData.expenses.map(e => <JournalEntryRow key={e.id} e={e} setEditingEntry={setEditingEntry} accountCategories={accountCategories} />)}
          </section>
        )}

        {/* Other Movements */}
        {journalData.other.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-2">
              <Database className="w-3 h-3 text-[#c9a84c]" />
              <h3 className="text-[10px] font-bold text-[#5a5548] uppercase">حركات أخرى</h3>
            </div>
            {journalData.other.map(e => <JournalEntryRow key={e.id} e={e} setEditingEntry={setEditingEntry} accountCategories={accountCategories} />)}
          </section>
        )}

        {journalData.dayEntries.length === 0 && (
          <div className="text-center py-20 bg-[#0e1018] border border-[#1a1e2a] rounded-2xl">
            <Calendar className="w-10 h-10 text-[#1a1e2a] mx-auto mb-3" />
            <p className="text-sm text-[#5a5548]">لا توجد عمليات مسجلة في هذا اليوم</p>
          </div>
        )}
      </div>
    </motion.div>
  );
});

const JournalEntryRow = React.memo(({ e, setEditingEntry, accountCategories }: { e: Entry, setEditingEntry: (e: any) => void, accountCategories: any, key?: any }) => {
  const [copied, setCopied] = useState(false);
  const isSilver = (e.tx || '').includes('فضة') || (e.debit || '').includes('فضة') || (e.credit || '').includes('فضة');
  const isAcc = (e.tx || '').includes('ملحقات') || (e.debit || '').includes('ملحقات') || (e.credit || '').includes('ملحقات');
  const unit = isSilver ? "جرام فضة" : isAcc ? "قطعة" : "جرام";

  const cashAccounts = accountCategories?.assets?.["النقدية"] || [];
  let displaySide = `${e.debit} ← ${e.credit}`;
  if (cashAccounts.includes(e.debit)) displaySide = e.credit;
  else if (cashAccounts.includes(e.credit)) displaySide = e.debit;
  else if (e.tx === 'تيفيت') {
    if (e.debit === 'كسر عربي' || e.debit === 'كسر افرنجي') displaySide = e.credit;
    else if (e.credit === 'كسر عربي' || e.credit === 'كسر افرنجي') displaySide = e.debit;
  }

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    const text = `${e.tx}: ${displaySide} | ${e.cash ? e.cash + ' ج' : ''} ${e.weight ? e.weight + ' ' + unit : ''} ${e.notes ? '(' + e.notes + ')' : ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const c = parseFloat(e.cash || '0');
  const w = parseFloat(e.weight || '0');
  const aw = parseFloat(e.arabicWeight || '0') || (w * (e.multiplier || (e.karat === 18 ? 0.857142857 : e.karat === 24 ? 1.142857143 : 1)));
  const pricePerGram = w > 0 ? (c / w).toFixed(2) : '0.00';

  return (
    <div 
      onClick={() => setEditingEntry(e)}
      className="w-full bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-5 flex justify-between items-center text-right hover:border-[#c9a84c33] transition-all active:scale-[0.99] relative overflow-hidden group cursor-pointer"
    >
      <div className="absolute top-0 right-0 w-1 h-full bg-[#c9a84c00] group-hover:bg-[#c9a84c] transition-all" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-sm font-bold text-[#c9a84c]">{e.tx}</div>
          {e.invoiceNumber && (
            <div className="text-[10px] font-mono font-bold text-[#6a8a9e] bg-[#6a8a9e11] border border-[#6a8a9e22] px-2 py-0.5 rounded-lg">
              #{e.invoiceNumber}
            </div>
          )}
          <button 
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              useAppStore.getState().setPrintEntry(e);
            }}
            className="p-1.5 rounded-lg bg-[#1a1e2a] text-[#5a5548] hover:text-[#c9a84c] transition-all mr-2"
            title="طباعة الفاتورة"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
          </button>
          <button 
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-[#1a1e2a] text-[#5a5548] hover:text-[#c9a84c] transition-all"
            title="نسخ"
          >
            {copied ? <CheckCircle2 className="w-3 h-3 text-[#6a9e6a]" /> : <ClipboardPaste className="w-3 h-3" />}
          </button>
        </div>
        <div className="text-xs font-bold text-[#ddd8cc]">{displaySide}</div>
        {e.notes && <div className="text-[10px] text-[#5a5548] mt-2 italic bg-[#080a0f] px-2 py-1 rounded-lg w-fit">{e.notes}</div>}
      </div>
      <div className="text-left">
        {e.cash && e.tx !== 'تيفيت' && (
          <div className="text-base font-bold text-[#c9a84c] font-mono">
            {Math.round(c).toLocaleString()} <span className="text-[10px] font-sans">ج</span>
          </div>
        )}
        <div className="flex flex-col items-end gap-1 mt-1">
          {e.weight && (
            <div className="text-[11px] text-[#ddd8cc] font-bold bg-[#1a1e2a] px-2 py-0.5 rounded-lg">
              {w.toFixed(2)} <span className="text-[9px] opacity-60">{unit}</span>
              {e.karat ? <span className="mr-1 text-[#c9a84c]">(عيار {e.karat})</span> : ''}
            </div>
          )}
          {e.weight && ((e.tx || '').includes('بيع') || (e.tx || '').includes('شراء')) && w > 0 && c > 0 && (
            <div className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1",
              (e.tx || '').includes('بيع') ? "text-[#c9a84c] bg-[#c9a84c11] border-[#c9a84c22]" : "text-[#6a9e6a] bg-[#6a9e6a11] border-[#6a9e6a22]"
            )}>
              {((e.tx || '').includes('بيع') ? (isAcc ? 'سعر القطعة (بيع): ' : 'سعر الجرام (بيع): ') : (isAcc ? 'سعر القطعة (شراء): ' : 'سعر الجرام (شراء): '))}
              <span className={cn("font-mono text-xs mx-0.5", (e.tx || '').includes('بيع') ? "text-[#c9a84c]" : "text-[#6a9e6a]")}>
                {pricePerGram}
              </span> ج.م
            </div>
          )}
          {e.arabicWeight && (
            <div className="text-[9px] text-[#c9a84c88] font-bold border border-[#c9a84c22] px-1.5 rounded mt-1">
              {parseFloat(e.arabicWeight).toFixed(2)} جرام عربي
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

