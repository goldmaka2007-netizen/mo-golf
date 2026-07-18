import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { Award, BarChart2, Package, TrendingUp } from "lucide-react";
import { useAppStore } from "../../store";
import { analyzeProfitability, getKaratMultiplier, type ProfitAccountRow } from "../../lib/engine";
import { cn } from "../../lib/utils";

interface ItemMetrics {
  name: string;
  karat: string;
  salesAr: number;
  salesCash: number;
  cogs: number;
  margin: number;
  marginPct: number;
  avgSalePrice: number;
  avgCost: number;
  closingAr: number;
  closingValue: number;
  closingMtm: number;
  unrealizedPnl: number;
  turnover: number;
  daysOnHand: number;
}

export const AdvancedAnalyticsView = () => {
  const { entries, goldPrice, silverPrice, accountsDb } = useAppStore();
  const [activeTab, setActiveTab] = useState<"pl" | "margin" | "inventory">("pl");
  const [sortBy, setSortBy] = useState<keyof Pick<ItemMetrics, "margin" | "marginPct" | "salesCash" | "turnover" | "daysOnHand" | "unrealizedPnl">>("margin");
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

  const { accData, costBasis } = useMemo(
    () => analyzeProfitability(entries, accountsDb, goldPrice, silverPrice, startDate, endDate),
    [entries, accountsDb, goldPrice, silverPrice, startDate, endDate],
  );

  const items = useMemo<ItemMetrics[]>(() => {
    return (Object.entries(accData) as [string, ProfitAccountRow][])
      .filter(([, row]) => row.karat !== "silver" && (row.salesAr > 0 || row.closingAr > 0 || row.openingAr > 0))
      .map(([name, row]) => {
        const avgCost = costBasis.getCost(name);
        const cogs = row.salesAr * avgCost;
        const margin = row.salesCash - cogs;
        const marginPct = row.salesCash > 0 ? (margin / row.salesCash) * 100 : 0;
        const avgSalePrice = row.salesAr > 0 ? row.salesCash / row.salesAr : 0;
        const karatMult = getKaratMultiplier(row.karat);
        const fallbackCost = row.closingAr * goldPrice * karatMult;
        const closingValue = row.closingAr * (avgCost || goldPrice * karatMult);
        const closingMtm = fallbackCost;
        const avgInventory = (row.openingAr + row.closingAr) / 2;
        const turnover = avgInventory > 0 ? row.salesAr / avgInventory : 0;
        return {
          name,
          karat: row.karat,
          salesAr: row.salesAr,
          salesCash: row.salesCash,
          cogs,
          margin,
          marginPct,
          avgSalePrice,
          avgCost: avgCost || goldPrice * karatMult,
          closingAr: row.closingAr,
          closingValue,
          closingMtm,
          unrealizedPnl: closingMtm - closingValue,
          turnover,
          daysOnHand: turnover > 0 ? 365 / turnover : 999,
        };
      });
  }, [accData, costBasis, goldPrice]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => Math.abs(Number(b[sortBy])) - Math.abs(Number(a[sortBy]))), [items, sortBy]);
  const summary = items.reduce((sum, item) => ({
    salesCash: sum.salesCash + item.salesCash,
    cogs: sum.cogs + item.cogs,
    margin: sum.margin + item.margin,
    closingValue: sum.closingValue + item.closingValue,
    closingMtm: sum.closingMtm + item.closingMtm,
    unrealizedPnl: sum.unrealizedPnl + item.unrealizedPnl,
  }), { salesCash: 0, cogs: 0, margin: 0, closingValue: 0, closingMtm: 0, unrealizedPnl: 0 });

  const marginColor = (pct: number) => pct >= 20 ? "text-emerald-400" : pct >= 12 ? "text-green-400" : pct >= 6 ? "text-yellow-400" : "text-red-400";
  const daysColor = (days: number) => days <= 60 ? "text-emerald-400" : days <= 120 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-5 pb-24" dir="rtl">
      <div className="bg-gradient-to-l from-[#0e1018] to-[#1a1e2a] p-5 rounded-2xl border border-[#c9a84c33]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#c9a84c15] rounded-xl border border-[#c9a84c44]"><Award className="w-5 h-5 text-[#c9a84c]" /></div>
            <div><h1 className="text-lg font-bold text-[#ddd8cc]">تحليلات الأداء المتقدمة</h1><p className="text-[11px] text-[#5a5548]">تعتمد على محرك الحسابات المركزي</p></div>
          </div>
          <div className="flex flex-wrap gap-1 bg-[#080a0f] p-1 rounded-xl border border-[#1a1e2a]">
            <button onClick={() => setSelectedMonth("all")} className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold", selectedMonth === "all" ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}>الكل</button>
            {availableMonths.slice(0, 6).map(month => {
              let label = month;
              try { label = format(parseISO(`${month}-01`), "MMM yy", { locale: ar }); } catch {}
              return <button key={month} onClick={() => setSelectedMonth(month)} className={cn("px-3 py-1.5 rounded-lg text-[11px] font-bold", selectedMonth === month ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}>{label}</button>;
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          {[
            { label: "إجمالي الإيرادات", value: summary.salesCash, color: "text-green-400" },
            { label: "إجمالي التكلفة", value: summary.cogs, color: "text-blue-400" },
            { label: "الهامش", value: summary.margin, color: summary.margin >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "قيمة المخزون السوقية", value: summary.closingMtm, color: "text-[#c9a84c]" },
            { label: "ربح غير محقق", value: summary.unrealizedPnl, color: summary.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400" },
          ].map(kpi => <div key={kpi.label} className="bg-[#080a0f] rounded-xl p-3 border border-[#1a1e2a]"><p className="text-[9px] text-[#5a5548] mb-1">{kpi.label}</p><div className={cn("text-lg font-black font-mono", kpi.color)}>{Math.round(kpi.value).toLocaleString()} <span className="text-[10px]">ج.م</span></div></div>)}
        </div>
      </div>

      <div className="flex gap-1 bg-[#080a0f] p-1 rounded-xl border border-[#1a1e2a]">
        {([{ id: "pl", label: "P&L", icon: TrendingUp }, { id: "margin", label: "هامش الأصناف", icon: BarChart2 }, { id: "inventory", label: "المخزون", icon: Package }] as const).map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold", activeTab === tab.id ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}><tab.icon className="w-3.5 h-3.5" /><span>{tab.label}</span></button>)}
      </div>

      <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#1a1e2a] flex flex-wrap gap-2 items-center justify-between">
          <h3 className="text-sm font-bold text-[#ddd8cc]">{activeTab === "inventory" ? "المخزون والدوران" : activeTab === "margin" ? "هامش كل صنف" : "الأداء حسب الصنف"}</h3>
          <div className="flex gap-1 flex-wrap">
            {(["margin", "marginPct", "salesCash", "turnover", "daysOnHand", "unrealizedPnl"] as const).map(key => <button key={key} onClick={() => setSortBy(key)} className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold border", sortBy === key ? "bg-[#c9a84c] text-[#080a0f] border-[#c9a84c]" : "text-[#5a5548] border-[#1a1e2a]")}>{key}</button>)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[11px] min-w-[900px]">
            <thead><tr className="border-b border-[#1a1e2a] [&>th]:p-3 [&>th]:text-[#5a5548]"><th>الصنف</th><th>عيار</th><th>مبيعات جم</th><th>إيراد</th><th>تكلفة</th><th>هامش</th><th>% هامش</th><th>مخزون</th><th>دوران</th><th>أيام</th></tr></thead>
            <tbody className="divide-y divide-[#1a1e2a] [&>tr>td]:p-3 [&>tr>td]:font-mono">
              {sortedItems.map(item => <tr key={item.name}><td className="font-bold font-sans text-[#ddd8cc]">{item.name}</td><td className="text-[#c9a84c]">{item.karat}</td><td>{item.salesAr.toFixed(2)}</td><td className="text-green-400">{Math.round(item.salesCash).toLocaleString()}</td><td className="text-blue-400">{Math.round(item.cogs).toLocaleString()}</td><td className={item.margin >= 0 ? "text-emerald-400" : "text-red-400"}>{Math.round(item.margin).toLocaleString()}</td><td className={marginColor(item.marginPct)}>{item.marginPct.toFixed(1)}%</td><td>{item.closingAr.toFixed(2)}</td><td>{item.turnover > 0 ? `${item.turnover.toFixed(2)}x` : "-"}</td><td className={daysColor(item.daysOnHand)}>{item.daysOnHand < 999 ? Math.round(item.daysOnHand) : "-"}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

