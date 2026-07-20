import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { AlertTriangle, Download, Layers, TrendingUp } from "lucide-react";
import { useAppStore } from "../../store";
import { analyzeProfitability, type ProfitAccountRow } from "../../lib/engine";
import { buildOpeningCostConfig } from "../../lib/openingCostConfig";
import { cn } from "../../lib/utils";
import { exportToExcel } from "../../utils/exportUtils";

export const ProfitAnalysisView = () => {
  const { entries, goldPrice, silverPrice, accountsDb, openingCostConfig, setView } = useAppStore();
  const [selectedMonth, setSelectedMonth] = useState("all");

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    entries.forEach(entry => {
      if (entry.date?.length >= 7) months.add(entry.date.substring(0, 7));
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const startDate = selectedMonth === "all" ? "2000-01-01" : `${selectedMonth}-01`;
  const endDate = selectedMonth === "all" ? "2099-12-31" : `${selectedMonth}-31`;

  const { karatData, accData, flowData, profitStatus, affectedSalesCount, missingOpeningCostBasisCount } = useMemo(
    () => analyzeProfitability(entries, accountsDb, goldPrice, silverPrice, startDate, endDate, buildOpeningCostConfig(openingCostConfig)),
    [entries, accountsDb, goldPrice, silverPrice, startDate, endDate, openingCostConfig],
  );

  const goldRows = ["18", "21", "24"].map(karat => ({ karat, ...karatData[karat] }));
  const silverRow = karatData.silver;
  const totalGold = goldRows.reduce(
    (sum, row) => ({
      openingAr: sum.openingAr + row.openingAr,
      purchAr: sum.purchAr + row.purchAr,
      purchCash: sum.purchCash + row.purchCash,
      salesAr: sum.salesAr + row.salesAr,
      salesCash: sum.salesCash + row.salesCash,
      closingAr: sum.closingAr + row.closingAr,
    }),
    { openingAr: 0, purchAr: 0, purchCash: 0, salesAr: 0, salesCash: 0, closingAr: 0 },
  );

  const goldCOGS = (Object.entries(accData) as [string, ProfitAccountRow][]).reduce((sum, [name, row]) => {
    if (row.karat === "silver") return sum;
    return sum + row.cogs;
  }, 0);
  const silverCOGS = (Object.entries(accData) as [string, ProfitAccountRow][]).reduce((sum, [name, row]) => {
    if (row.karat !== "silver") return sum;
    return sum + row.cogs;
  }, 0);

  const hasIncompleteGoldProfit = (Object.values(accData) as ProfitAccountRow[]).some(row => row.karat !== 'silver' && row.profitStatus !== 'valid');
  const hasIncompleteSilverProfit = (Object.values(accData) as ProfitAccountRow[]).some(row => row.karat === 'silver' && row.profitStatus !== 'valid');
  const goldProfit = hasIncompleteGoldProfit ? null : totalGold.salesCash - goldCOGS;
  const silverProfit = hasIncompleteSilverProfit ? null : silverRow.salesCash - silverCOGS;
  const totalProfit = profitStatus === 'valid' && goldProfit !== null && silverProfit !== null ? goldProfit + silverProfit : null;
  const avgSalePrice = totalGold.salesAr > 0 ? totalGold.salesCash / totalGold.salesAr : 0;
  const avgPurchPrice = totalGold.purchAr > 0 ? totalGold.purchCash / totalGold.purchAr : 0;

  const exportRows = () => {
    const data = (Object.entries(accData) as [string, ProfitAccountRow][]).map(([name, row]) => ({
      "الحساب": name,
      "العيار": row.karat,
      "افتتاحي": Number(row.openingAr.toFixed(2)),
      "مشتريات": Number(row.purchAr.toFixed(2)),
      "مبيعات": Number(row.salesAr.toFixed(2)),
      "إغلاق": Number(row.closingAr.toFixed(2)),
      "قيمة مشتريات": row.purchCash,
      "قيمة مبيعات": row.salesCash,
    }));
    exportToExcel([{ name: "profit_analysis", data }], `profit_analysis_${format(new Date(), "yyyy-MM-dd")}`);
  };

  return (
    <div className="space-y-6 pb-20" dir="rtl">
      <div className="bg-[#1a1e2a] p-5 rounded-2xl border border-[#c9a84c33] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#c9a84c1a] rounded-xl border border-[#c9a84c33]">
            <TrendingUp className="w-5 h-5 text-[#c9a84c]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#ddd8cc]">تحليل الربحية والمخزون</h1>
            <p className="text-xs text-[#5a5548]">مبني على محرك الحسابات المركزي والمتوسط المتحرك</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-[#0e1018] p-1.5 rounded-xl border border-[#1a1e2a]">
          <button onClick={() => setSelectedMonth("all")} className={cn("px-4 py-2 rounded-lg text-xs font-bold", selectedMonth === "all" ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}>الكل</button>
          {availableMonths.map(month => {
            let label = month;
            try { label = format(parseISO(`${month}-01`), "MMMM yyyy", { locale: ar }); } catch {}
            return <button key={month} onClick={() => setSelectedMonth(month)} className={cn("px-4 py-2 rounded-lg text-xs font-bold", selectedMonth === month ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}>{label}</button>;
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إيرادات الذهب", value: totalGold.salesCash.toLocaleString(), color: "text-green-400" },
          { label: "متوسط البيع/جم 21", value: Math.round(avgSalePrice).toLocaleString(), color: "text-[#ddd8cc]" },
          { label: "متوسط الشراء/جم 21", value: Math.round(avgPurchPrice).toLocaleString(), color: "text-blue-400" },
          { label: "صافي الربح التقديري", value: totalProfit === null ? "غير متاح" : Math.round(totalProfit).toLocaleString(), color: totalProfit === null ? "text-yellow-400" : totalProfit >= 0 ? "text-green-400" : "text-red-400" },
        ].map(item => <div key={item.label} className="bg-[#0e1018] border border-[#1a1e2a] p-4 rounded-2xl"><p className="text-[10px] text-[#5a5548] font-bold mb-1">{item.label}</p><div className={cn("text-xl font-black font-mono", item.color)}>{item.value} <span className="text-xs">ج.م</span></div></div>)}
      </div>

      {affectedSalesCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-2xl p-4 text-sm font-bold">
          لا يمكن حساب الربح بدقة لوجود عمليات بيع بدون تكلفة مخزون موثقة.
        </div>
      )}

      {missingOpeningCostBasisCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-2xl p-4 text-sm font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>تكلفة المخزون الافتتاحي غير مكتملة. أدخل سعر الافتتاح السنوي من الإعدادات لإظهار تكلفة المخزون والأرباح بدقة.</span>
          </div>
          <button onClick={() => setView('settings')} className="px-3 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-[11px] font-bold">
            فتح الإعدادات
          </button>
        </div>
      )}

      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1a1e2a] flex justify-between items-center">
          <h3 className="text-sm font-bold text-[#ddd8cc]">تدفقات الذهب حسب العيار</h3>
          <button onClick={exportRows} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a84c1a] text-[#c9a84c] rounded-lg border border-[#c9a84c33] text-xs font-bold"><Download className="w-3.5 h-3.5" /> تصدير</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs min-w-[850px]">
            <thead><tr className="border-b border-[#1a1e2a] [&>th]:p-3 [&>th]:text-[#5a5548]"><th>العيار</th><th>افتتاحي</th><th>شراء</th><th>مبيعات</th><th>تيفيت صافي</th><th>تحويل صافي</th><th>تسوية صافي</th><th>إغلاق</th><th>قيمة سوقية</th></tr></thead>
            <tbody className="divide-y divide-[#1a1e2a] [&>tr>td]:p-3 [&>tr>td]:font-mono">
              {(["18", "21", "24"] as const).map(karat => {
                const flow = flowData[karat];
                return <tr key={karat}><td className="font-bold text-[#c9a84c] font-sans">عيار {karat}</td><td>{flow.opening.toFixed(2)}</td><td className="text-blue-400">{flow.purchase.toFixed(2)}</td><td className="text-red-400">{flow.sales.toFixed(2)}</td><td>{(flow.tifeetIn - flow.tifeetOut).toFixed(2)}</td><td>{(flow.transferIn - flow.transferOut).toFixed(2)}</td><td>{(flow.surplus - flow.deficit).toFixed(2)}</td><td className="text-[#c9a84c] font-bold">{flow.closing.toFixed(2)}</td><td className="text-[#c9a84c]">{Math.round(flow.closingMarket).toLocaleString()}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1a1e2a] flex items-center gap-2"><Layers className="w-4 h-4 text-[#ddd8cc] opacity-60" /><h3 className="text-sm font-bold text-[#ddd8cc]">تفصيل الحسابات المخزنية</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs min-w-[800px]">
            <thead><tr className="border-b border-[#1a1e2a] [&>th]:p-3 [&>th]:text-[#5a5548]"><th>الحساب</th><th>العيار</th><th>افتتاحي</th><th>مشتريات</th><th>مبيعات</th><th>إغلاق</th></tr></thead>
            <tbody className="divide-y divide-[#1a1e2a] [&>tr>td]:p-3 [&>tr>td]:font-mono">
              {(Object.entries(accData) as [string, ProfitAccountRow][]).filter(([, row]) => row.openingAr || row.purchAr || row.salesAr || row.closingAr).map(([name, row]) => <tr key={name}><td className="font-bold text-[#ddd8cc] font-sans">{name}</td><td>{row.karat}</td><td>{row.openingAr.toFixed(2)}</td><td>{row.purchAr.toFixed(2)}</td><td>{row.salesAr.toFixed(2)}</td><td className="text-[#c9a84c] font-bold">{row.closingAr.toFixed(2)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><p className="text-[10px] text-[#5a5548] mb-1">فضة افتتاحي</p><div className="text-lg font-black font-mono text-[#ddd8cc]">{silverRow.openingAr.toFixed(2)}</div></div>
        <div><p className="text-[10px] text-[#5a5548] mb-1">فضة مشتريات</p><div className="text-lg font-black font-mono text-blue-400">{silverRow.purchAr.toFixed(2)}</div></div>
        <div><p className="text-[10px] text-[#5a5548] mb-1">فضة مبيعات</p><div className="text-lg font-black font-mono text-red-400">{silverRow.salesAr.toFixed(2)}</div></div>
        <div><p className="text-[10px] text-[#5a5548] mb-1">ربح الفضة</p><div className={cn("text-lg font-black font-mono", silverProfit === null ? "text-yellow-400" : silverProfit >= 0 ? "text-green-400" : "text-red-400")}>{silverProfit === null ? "غير متاح" : Math.round(silverProfit).toLocaleString()} ج.م</div></div>
      </div>
    </div>
  );
};

