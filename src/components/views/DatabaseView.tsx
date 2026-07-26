import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Download, 
  Search, 
  Zap, 
  Users, 
  X, 
  Wallet, 
  Scale, 
  Database, 
  CheckCircle2, 
  ClipboardPaste,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Entry } from '../../types';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';

export const EntryRow = React.memo(({ e, setEditingEntry }: { e: Entry, setEditingEntry: (e: Entry) => void }) => {
  const [copied, setCopied] = useState(false);
  const isSilver = (e.tx || '').includes('فضة') || (e.debit || '').includes('فضة') || (e.credit || '').includes('فضة');
  const isAcc = (e.tx || '').includes('ملحقات') || (e.debit || '').includes('ملحقات') || (e.credit || '').includes('ملحقات');
  const unit = isSilver ? "جرام فضة" : isAcc ? "قطعة" : "جرام ذهب";

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    const text = `عملية: ${e.tx} | من ح/ ${e.debit} إلى ح/ ${e.credit} | ${e.cash ? e.cash + ' ج' : ''} ${e.weight ? e.weight + ' ' + unit : ''} ${e.notes ? '(' + e.notes + ')' : ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const c = parseFloat(e.cash || '0');
  const w = parseFloat(e.weight || '0');
  // Removed targetWeight since we should calculate price per gram using raw weight
  const pricePerGram = w > 0 ? (c / w).toFixed(2) : '0.00';

  return (
    <div 
      onClick={() => setEditingEntry(e)}
      className="w-full bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-4 text-right hover:border-[#c9a84c33] transition-all active:scale-[0.99] relative group cursor-pointer shadow-sm"
    >
      <div className="absolute top-0 right-0 w-1 h-full bg-[#c9a84c00] group-hover:bg-[#c9a84c] transition-all rounded-r-2xl" />
      
      {/* Header: Date & Type */}
      <div className="flex justify-between items-start mb-3 pb-3 border-b border-[#1a1e2a]/50">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-[#c9a84c] bg-[#c9a84c11] border border-[#c9a84c22] px-2 py-0.5 rounded-lg">{e.tx}</div>
          {e.invoiceNumber && (
            <div className="text-xs font-mono font-bold text-[#6a8a9e] bg-[#6a8a9e11] border border-[#6a8a9e22] px-2 py-0.5 rounded-lg">
              #{e.invoiceNumber}
            </div>
          )}
          <button 
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-[#1a1e2a] text-[#5a5548] hover:text-[#c9a84c] transition-all opacity-0 group-hover:opacity-100"
          >
            {copied ? <CheckCircle2 className="w-5 h-5 text-[#6a9e6a]" /> : <ClipboardPaste className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-sm text-[#5a5548] font-bold flex items-center gap-1">
          {(() => {
            if (!e.date) return 'بدون تاريخ';
            try {
              const parts = e.date.split('-');
              const y = parseInt(parts[0]) || new Date().getFullYear();
              const m = parseInt(parts[1]) || 1;
              const d = parseInt(parts[2]) || 1;
              return format(new Date(y, m - 1, d), 'dd MMMM yyyy (EE)', { locale: ar });
            } catch {
              return e.date;
            }
          })()}
        </div>
      </div>

      {/* Body: Debit & Credit */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex-1 bg-gradient-to-l from-[#0d1f0d] to-[#080a0f] border border-[#1a3a1a] rounded-xl p-3 shadow-inner">
          <div className="text-xs text-[#6a9e6a] font-bold mb-1 opacity-70">من ح/ (مدين)</div>
          <div className="text-base font-bold text-[#ddd8cc] truncate" title={e.debit}>{e.debit}</div>
        </div>
        <ArrowLeft className="w-6 h-6 text-[#3a3530] shrink-0" />
        <div className="flex-1 bg-gradient-to-r from-[#1f0d0d] to-[#080a0f] border border-[#3a1a1a] rounded-xl p-3 shadow-inner">
          <div className="text-xs text-[#9e6a6a] font-bold mb-1 opacity-70">إلى ح/ (دائن)</div>
          <div className="text-base font-bold text-[#ddd8cc] truncate" title={e.credit}>{e.credit}</div>
        </div>
      </div>

      {/* Footer: Amounts & Notes */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          {e.notes ? (
            <div className="text-xs text-[#5a5548] italic max-w-[150px] truncate" title={e.notes}>
              « {e.notes} »
            </div>
          ) : <div />}
          {e.weight && ((e.tx || '').includes('بيع') || (e.tx || '').includes('شراء')) && w > 0 && c > 0 && (
            <div className={cn("text-xs font-bold px-2 py-1 rounded border mt-1 w-fit",
              (e.tx || '').includes('بيع') ? "text-[#c9a84c] bg-[#c9a84c11] border-[#c9a84c22]" : "text-[#6a9e6a] bg-[#6a9e6a11] border-[#6a9e6a22]"
            )}>
              {((e.tx || '').includes('بيع') ? (isAcc ? 'سعر القطعة (بيع): ' : 'سعر الجرام (بيع): ') : (isAcc ? 'سعر القطعة (شراء): ' : 'سعر الجرام (شراء): '))}
              <span className="font-mono text-xs">{pricePerGram}</span> ج.م
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {e.weight && (
            <div className="flex flex-col items-end">
              <div className="text-base text-[#ddd8cc] font-bold font-mono">
                {parseFloat(e.weight).toFixed(2)}
                <span className="text-xs font-sans opacity-50 mr-1">{unit}</span>
              </div>
              {e.arabicWeight && (
                <div className="text-xs text-[#c9a84c99] font-bold">
                  {parseFloat(e.arabicWeight).toFixed(2)} عربي {e.karat ? `(ع${e.karat})` : ''}
                </div>
              )}
            </div>
          )}
          {e.cash && e.tx !== 'تيفيت' && (
            <div className="text-2xl font-bold text-[#c9a84c] font-mono bg-[#c9a84c11] px-2.5 py-1 rounded-lg border border-[#c9a84c22]">
              {Math.round(parseFloat(e.cash)).toLocaleString()} <span className="text-sm font-sans">ج.م</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const DatabaseView = React.memo(() => {
  const { entries, setEditingEntry } = useAppStore();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [dateRange, setDateRange] = useState({ 
    start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'), 
    end: format(new Date(), 'yyyy-MM-dd') 
  });
  const [filterType, setFilterType] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'type' | 'account'>('none');

  const filtered = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return entries.filter(e => {
      const tx = String(e.tx || '');
      const debit = String(e.debit || '');
      const credit = String(e.credit || '');
      const date = String(e.date || '');
      const notes = String(e.notes || '');
      const karat = e.karat !== null && e.karat !== undefined ? e.karat : 0;

      if (date < dateRange.start || date > dateRange.end) return false;

      if (filterType !== 'all') {
        if (filterType === 'gold' && !(tx.includes('ذهب') || debit.includes('ذهب') || credit.includes('ذهب') || [18, 21, 24].includes(Number(karat)))) return false;
        if (filterType === 'silver' && !(tx.includes('فضة') || debit.includes('فضة') || credit.includes('فضة'))) return false;
        if (filterType === 'cash' && !e.cash) return false;
      }

      const formattedDate = (() => {
        try {
          if (!date) return '';
          const parts = date.split('-');
          const y = parseInt(parts[0]) || new Date().getFullYear();
          const m = parseInt(parts[1]) || 1;
          const d = parseInt(parts[2]) || 1;
          return format(new Date(y, m - 1, d), 'dd MMMM yyyy', { locale: ar });
        } catch {
          return date;
        }
      })().toLowerCase();

      return tx.toLowerCase().includes(q) || 
             debit.toLowerCase().includes(q) || 
             credit.toLowerCase().includes(q) || 
             date.includes(q) ||
             formattedDate.includes(q) ||
             notes.toLowerCase().includes(q);
    });
  }, [entries, deferredSearch, dateRange, filterType]);

  const groupedData = useMemo<Record<string, Entry[]>>(() => {
    if (groupBy === 'none') return { 'الكل': filtered };
    
    const groups: Record<string, Entry[]> = {};
    filtered.forEach(e => {
      let key = 'أخرى';
      if (groupBy === 'type') {
        key = e.tx;
      } else if (groupBy === 'account') {
        key = e.debit === 'الخزنة' ? e.credit : e.debit;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return groups;
  }, [filtered, groupBy]);

  const [currentPage, setCurrentPage] = useState(1);
  const ENTRIES_PER_PAGE = 50;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateRange, filterType, groupBy]);



  const paginatedGroups = useMemo(() => {
    const pgroups: Record<string, Entry[]> = {};
    const startIdx = (currentPage - 1) * ENTRIES_PER_PAGE;
    const endIdx = startIdx + ENTRIES_PER_PAGE;

    if (groupBy === 'none') {
      pgroups['الكل'] = filtered.slice(startIdx, endIdx);
    } else {
      // For grouped data, we just slice the keys or inner lists?
      // Simpler: Just limit total rendered items across groups.
      let currentIdx = 0;
      for (const [gName, gEntriesRaw] of Object.entries(groupedData)) {
        const gEntries = gEntriesRaw as Entry[];
        if (currentIdx >= endIdx) break; // done
        const groupStart = Math.max(0, startIdx - currentIdx);
        const groupEnd = Math.max(0, endIdx - currentIdx);
        
        if (groupStart < gEntries.length) {
          pgroups[gName] = gEntries.slice(groupStart, groupEnd);
        }
        currentIdx += gEntries.length;
      }
    }
    return pgroups;
  }, [groupedData, filtered, groupBy, currentPage]);

  const totalPages = Math.ceil(filtered.length / ENTRIES_PER_PAGE);



  const handleExportCSV = () => {
    if (entries.length === 0) return;
    
    const headers = [
      "التاريخ", 
      "رقم الفاتورة",
      "العملية", 
      "مدين", 
      "دائن", 
      "نقداً", 
      "الوزن", 
      "العيار", 
      "الوزن العربي", 
      "العدد", 
      "اسم العميل",
      "رقم التليفون",
      "سعر السوق",
      "المعامل",
      "ملاحظات",
      "معرف العملية"
    ];
    
    const rows = entries.map(e => [
      e.date,
      e.invoiceNumber || "",
      e.tx,
      e.debit,
      e.credit,
      e.cash || "0",
      e.weight || "0",
      e.karat || "",
      e.arabicWeight || "0",
      e.count || "0",
      e.clientName || "",
      e.clientPhone || "",
      e.marketPrice || "",
      e.multiplier || "",
      e.notes || "",
      e.id || ""
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gold_entries_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV}
            className="p-2 bg-[#1a1e2a] rounded-xl text-[#c9a84c] flex items-center gap-2 text-xs font-bold border border-[#c9a84c22]"
          >
            <Download className="w-5 h-5" />
            تصدير
          </button>
          <div className="text-xs text-[#c9a84c] bg-[#c9a84c11] border border-[#c9a84c33] font-bold px-3 py-1.5 rounded-xl">{entries.length} حركات</div>
        </div>
      </div>



      <div className="space-y-4 bg-[#0e1018] border border-[#1a1e2a] p-4 rounded-2xl shadow-sm">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3a3530]" />
          <input 
            type="text" 
            placeholder="بحث بالاسم، التاريخ، الحساب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-2xl py-4 pr-12 pl-4 text-sm outline-none focus:border-[#c9a84c55] transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-[#5a5548] font-bold uppercase mr-2">من تاريخ</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-2 text-sm outline-none focus:border-[#c9a84c33]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[#5a5548] font-bold uppercase mr-2">إلى تاريخ</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-2 text-sm outline-none focus:border-[#c9a84c33]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-[#5a5548] font-bold uppercase mr-2">تجميع حسب</div>
          <div className="flex gap-2">
            {[
              { id: 'none', label: 'بدون تجميع', icon: <X className="w-4 h-4" /> },
              { id: 'type', label: 'نوع العملية', icon: <Zap className="w-4 h-4" /> },
              { id: 'account', label: 'الحساب', icon: <Users className="w-4 h-4" /> },
            ].map(g => (
              <button
                key={g.id}
                onClick={() => setGroupBy(g.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border transition-all",
                  groupBy === g.id ? "bg-[#c9a84c22] border-[#c9a84c] text-[#c9a84c]" : "bg-[#080a0f] border-[#1a1e2a] text-[#5a5548]"
                )}
              >
                {g.icon}
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'all', label: 'الكل', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'gold', label: 'ذهب', icon: <Scale className="w-4 h-4" /> },
            { id: 'silver', label: 'فضة', icon: <Database className="w-4 h-4" /> },
            { id: 'cash', label: 'نقدي', icon: <Wallet className="w-4 h-4" /> },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-full text-xs font-bold border transition-all whitespace-nowrap",
                filterType === f.id ? "bg-[#c9a84c] border-[#c9a84c] text-[#080a0f]" : "bg-[#080a0f] border-[#1a1e2a] text-[#5a5548]"
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {Object.keys(paginatedGroups).length === 0 || filtered.length === 0 ? (
          <div className="text-center py-20 text-[#3a3530]">لا توجد نتائج للبحث</div>
        ) : (
          Object.entries(paginatedGroups).map(([groupName, groupEntries]) => {
            const entries = groupEntries as Entry[];
            return (
              <div key={groupName} className="space-y-3">
                {groupBy !== 'none' && (
                  <div className="flex items-center gap-3">
                    <div className="h-[1px] flex-1 bg-[#1a1e2a]" />
                    <div className="text-[10px] font-bold text-[#c9a84c] bg-[#c9a84c11] px-3 py-1 rounded-full border border-[#c9a84c22]">
                      {groupName} ({groupedData[groupName]?.length || entries.length})
                    </div>
                    <div className="h-[1px] flex-1 bg-[#1a1e2a]" />
                  </div>
                )}
                <div className="space-y-3">
                  {entries.map((e) => (
                    <EntryRow key={e.id} e={e} setEditingEntry={setEditingEntry} />
                  ))}
               </div>
             </div>
           );
         })
       )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-[#080a0f] border border-[#1a1e2a] rounded-2xl p-4 mt-6">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="px-4 py-2 bg-[#1a1e2a] rounded-xl text-[#ddd8cc] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#c9a84c22] transition-colors"
          >
            &rarr; السابق
          </button>
          
          <div className="text-xs font-bold text-[#5a5548] font-mono">
            صفحة <span className="text-[#c9a84c] text-sm">{currentPage}</span> من {totalPages}
          </div>

          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="px-4 py-2 bg-[#1a1e2a] rounded-xl text-[#ddd8cc] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#c9a84c22] transition-colors"
          >
            التالي &larr;
          </button>
        </div>
      )}
    </motion.div>
  );
});
