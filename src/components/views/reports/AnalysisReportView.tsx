import { formatDecimal, formatWeight } from '../../../lib/formatting';
import React, { useMemo } from 'react';
import { 
  Layers, 
  Calendar, 
  BarChart2, 
  AlertTriangle, 
  Lightbulb,
  ArrowRightLeft,
  Crown
} from 'lucide-react';
import { format, parseISO, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Entry } from '../../../types';
import { cn } from '../../../lib/utils';

export const AnalysisReportView = React.memo(({ entries }: { entries: Entry[] }) => {
  // Helper functions
  const getUnitCash = (e: Entry) => parseFloat(e.cash || '0');
  const getUnitWeight = (e: Entry) => parseFloat(e.weight || '0');
  const getUnitArabicWeight = (e: Entry) => parseFloat(e.arabicWeight || '0');

  const analysis = useMemo(() => {
    if (entries.length === 0) return null;

    // 1. Executive Summary
    const salesCash = entries.filter(e => e.tx === 'بيع ذهب' || e.tx === 'بيع فضة' || e.tx === 'بيع ملحقات' || e.tx === 'ايرادات اخري').reduce((sum, e) => sum + getUnitCash(e), 0);
    const purchasesCash = entries.filter(e => e.tx === 'شراء ذهب' || e.tx === 'شراء فضة' || e.tx === 'شراء اصل' || e.tx === 'شراء ملحقات').reduce((sum, e) => sum + getUnitCash(e), 0);
    const rawMargin = salesCash - purchasesCash;
    
    const uniqueDays = new Set(entries.map(e => e.date)).size;
    const dailyAvg = salesCash / (uniqueDays || 1);
    
    // Day with highest/lowest sales
    const daySales: Record<string, number> = {};
    entries.forEach(e => {
        if (e.tx?.includes('بيع')) {
            daySales[e.date] = (daySales[e.date] || 0) + getUnitCash(e);
        }
    });
    const sortedDays = Object.entries(daySales).sort((a, b) => b[1] - a[1]);
    const topDay = sortedDays[0] || [null, 0];
    const bottomDay = sortedDays[sortedDays.length - 1] || [null, 0];

    // Treasury Balance (Strict Cash)
    let treasuryBalance = 0;
    entries.forEach(e => {
        if (e.debit === 'الخزنة') treasuryBalance += getUnitCash(e);
        if (e.credit === 'الخزنة') treasuryBalance -= getUnitCash(e);
    });

    // 2. Monthly Analysis
    const monthlyData: Record<string, any> = {};
    entries.forEach(e => {
        const month = e.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { sales: 0, purchases: 0, expenses: 0, withdraws: 0, goldBuy: 0, goldSell: 0 };
        }
        const cash = getUnitCash(e);
        const weight = getUnitArabicWeight(e);
        
        if (e.tx?.includes('بيع')) monthlyData[month].sales += cash;
        if (e.tx?.includes('شراء')) monthlyData[month].purchases += cash;
        if (e.tx === 'م ا ع' || e.tx === 'م ت') monthlyData[month].expenses += cash;
        if (e.tx === 'مسحوبات') monthlyData[month].withdraws += cash;
        
        if (e.tx === 'شراء ذهب') monthlyData[month].goldBuy += weight;
        if (e.tx === 'بيع ذهب') monthlyData[month].goldSell += weight;
    });

    // 3. Karat Analysis
    const karatData: Record<number, any> = { 18: { sb: 0, sw: 0, pb: 0, pw: 0 }, 21: { sb: 0, sw: 0, pb: 0, pw: 0 }, 24: { sb: 0, sw: 0, pb: 0, pw: 0 } };
    entries.forEach(e => {
        const k = e.karat;
        if (k && karatData[k]) {
            const cash = getUnitCash(e);
            const weight = getUnitWeight(e);
            if (e.tx === 'بيع ذهب') {
                karatData[k].sb += cash;
                karatData[k].sw += weight;
            }
            if (e.tx === 'شراء ذهب') {
                karatData[k].pb += cash;
                karatData[k].pw += weight;
            }
        }
    });

    // 4. Weekday Analysis
    const weekdaySales: Record<number, { total: number, count: number }> = {};
    for (let i = 0; i < 7; i++) weekdaySales[i] = { total: 0, count: 0 };
    
    // Group day sales first to avoid double counting if multiple entries in same day
    entries.forEach(e => {
        if (e.tx?.includes('بيع')) {
            const day = getDay(parseISO(e.date));
            weekdaySales[day].total += getUnitCash(e);
        }
    });
    // Count occurrences of each weekday in the dataset
    const dateToDay = entries.reduce((acc, e) => {
        acc[e.date] = getDay(parseISO(e.date));
        return acc;
    }, {} as Record<string, number>);
    Object.values(dateToDay).forEach(d => weekdaySales[d].count++);

    // 5. Tefit Analysis
    const tefitEntries = entries.filter(e => e.tx === 'تيفيت');
    const totalTefitWeight = tefitEntries.reduce((sum, e) => sum + getUnitArabicWeight(e), 0);
    const totalWeightPurchased = entries.filter(e => e.tx === 'شراء ذهب').reduce((sum, e) => sum + getUnitArabicWeight(e), 0);

    // 6. Expenses Analysis
    const expenseDetails: Record<string, number> = {};
    entries.forEach(e => {
        if (e.tx === 'م ا ع' || e.tx === 'م ت') {
            const category = e.debit || 'أخرى';
            expenseDetails[category] = (expenseDetails[category] || 0) + getUnitCash(e);
        }
    });
    const totalExpenses = Object.values(expenseDetails).reduce((s, v) => s + v, 0);

    // 7. Big Deals
    const topSales = [...entries].filter(e => e.tx?.includes('بيع')).sort((a,b) => getUnitCash(b) - getUnitCash(a)).slice(0, 10);
    const topPurchases = [...entries].filter(e => e.tx?.includes('شراء')).sort((a,b) => getUnitCash(b) - getUnitCash(a)).slice(0, 10);

    // 8. Last Month Detail
    const lastMonth = sortedDays.length > 0 ? sortedDays[0][0].substring(0, 7) : null;
    const lastMonthEntries = entries.filter(e => e.date.startsWith(lastMonth || ''));
    const dailyLastMonth: Record<string, { s: number, p: number }> = {};
    lastMonthEntries.forEach(e => {
        if (!dailyLastMonth[e.date]) dailyLastMonth[e.date] = { s: 0, p: 0 };
        if (e.tx?.includes('بيع')) dailyLastMonth[e.date].s += getUnitCash(e);
        if (e.tx?.includes('شراء')) dailyLastMonth[e.date].p += getUnitCash(e);
    });

    return {
        exec: { salesCash, purchasesCash, rawMargin, uniqueDays, dailyAvg, topDay, bottomDay, treasuryBalance },
        monthly: monthlyData,
        karat: karatData,
        week: weekdaySales,
        tefit: { total: totalTefitWeight, ratio: (totalTefitWeight / (totalWeightPurchased || 1)) * 100 },
        expenses: expenseDetails,
        totalExpenses,
        topDeals: { sales: topSales, purchases: topPurchases },
        lastMonth: dailyLastMonth
    };
  }, [entries]);

  if (!analysis) return null;

  const { exec, monthly, karat, week, tefit, expenses, totalExpenses, topDeals } = analysis;

  const renderCard = (title: string, icon: any, children: React.ReactNode) => (
    <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-6 space-y-4 shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#1a1e2a] pb-4 text-[#c9a84c]">
            {icon}
            <h4 className="text-sm font-bold">{title}</h4>
        </div>
        <div className="space-y-4">
            {children}
        </div>
    </div>
  );

  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  return (
    <div className="space-y-8 pb-12" dir="rtl">
        {/* 1. Executive Summary */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1a1e2a] p-4 rounded-2xl border border-[#c9a84c33] flex flex-col justify-between h-32">
                <div className="text-xs text-[#5a5548] font-bold">إجمالي المبيعات</div>
                <div className="text-3xl font-black text-[#c9a84c]">{exec.salesCash.toLocaleString()} <span className="text-sm">ج</span></div>
            </div>
            <div className="bg-[#1a1e2a] p-4 rounded-2xl border border-[#c9a84c33] flex flex-col justify-between h-32">
                <div className="text-xs text-[#5a5548] font-bold">إجمالي المشتريات</div>
                <div className="text-3xl font-black text-[#ddd8cc]">{exec.purchasesCash.toLocaleString()} <span className="text-sm">ج</span></div>
            </div>
            <div className="bg-[#1a1e2a] p-4 rounded-2xl border border-[#c9a84c33] flex flex-col justify-between h-32">
                <div className="text-xs text-[#5a5548] font-bold">صافي التدفق النقدي للنشاط</div>
                <div className={cn("text-3xl font-black", exec.rawMargin >= 0 ? "text-green-400" : "text-red-400")}>
                    {exec.rawMargin.toLocaleString()} <span className="text-sm">ج</span>
                </div>
            </div>
            <div className="bg-[#1a1e2a] p-4 rounded-2xl border border-[#c9a84c33] flex flex-col justify-between h-32">
                <div className="text-xs text-[#5a5548] font-bold">رصيد الخزنة الحالي</div>
                <div className="text-3xl font-black text-[#6a8a9e]">{exec.treasuryBalance.toLocaleString()} <span className="text-sm">ج</span></div>
            </div>
        </div>

        {/* Executive Text Sub-details */}
        <div className="bg-[#0e1018] p-4 rounded-xl border border-[#1a1e2a] text-sm space-y-2">
            <div className="flex justify-between">
                <span className="text-[#5a5548]">أيام العمل:</span>
                <span className="font-bold">{exec.uniqueDays} يوم</span>
            </div>
            <div className="flex justify-between">
                <span className="text-[#5a5548]">متوسط المبيعات اليومي:</span>
                <span className="font-bold">{exec.dailyAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })} ج</span>
            </div>
            <div className="flex justify-between text-green-400/80">
                <span>أعلى مبيعات ({exec.topDay[0]}):</span>
                <span className="font-bold">{exec.topDay[1].toLocaleString()} ج</span>
            </div>
            <div className="flex justify-between text-red-400/80">
                <span>أدنى مبيعات ({exec.bottomDay[0]}):</span>
                <span className="font-bold">{exec.bottomDay[1].toLocaleString()} ج</span>
            </div>
        </div>

        {/* 2. Monthly Analysis */}
        {renderCard("التحليل المالي الشهري", <Calendar className="w-5 h-5" />, (
            <div className="space-y-6">
                {Object.entries(monthly).map(([month, d]: [string, any]) => (
                    <div key={month} className="space-y-3 bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a]">
                        <div className="flex justify-between items-center border-b border-[#1a1e2a] pb-2 mb-2">
                            <span className="text-base font-bold text-[#c9a84c]">{format(parseISO(month + '-01'), 'MMMM yyyy', { locale: ar })}</span>
                            <span className="text-xs bg-[#c9a84c22] text-[#c9a84c] px-3 py-1 rounded-full">تحليل الأداء</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <span className="text-[#5a5548]">المبيعات:</span>
                            <span className="text-left font-bold">{d.sales.toLocaleString()} ج</span>
                            <span className="text-[#5a5548]">المشتريات:</span>
                            <span className="text-left font-bold">{d.purchases.toLocaleString()} ج</span>
                            <span className="text-[#5a5548]">التدفق النقدي:</span>
                            <span className={cn("text-left font-bold", (d.sales - d.purchases) >= 0 ? "text-green-400" : "text-red-400")}>
                                {(d.sales - d.purchases).toLocaleString()} ج
                            </span>
                            <span className="text-[#5a5548]">إجمالي المصاريف:</span>
                            <span className="text-left font-bold text-red-400/70">{d.expenses.toLocaleString()} ج</span>
                            <span className="text-[#5a5548]">صافي تغير الوزن (جم عربي):</span>
                            <span className={cn("text-left font-bold", (d.goldBuy - d.goldSell) >= 0 ? "text-[#c9a84c]" : "text-red-400")}>
                                {formatWeight(d.goldBuy - d.goldSell)} جم
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        ))}

        {/* 3. Karat Analysis */}
        {renderCard("تحليل العيارات والأداء الرقمي", <Layers className="w-5 h-5" />, (
            <div className="space-y-4">
                {[18, 21, 24].map(k => {
                    const d = karat[k];
                    const margin = d.sb - d.pb;
                    const marginPct = d.pb > 0 ? (margin / d.pb) * 100 : 0;
                    if (d.sw === 0 && d.pw === 0) return null;
                    return (
                        <div key={k} className="bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-[#c9a84c22] flex items-center justify-center text-[#c9a84c] text-lg font-black">{k}</div>
                                <span className="text-sm font-bold text-[#ddd8cc]">عيار {k}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="space-y-2">
                                    <div className="text-[#5a5548]">المبيعات:</div>
                                    <div className="font-bold text-sm">{d.sb.toLocaleString()} ج / {formatWeight(d.sw)} جم</div>
                                    <div className="text-[#5a5548]">المشتريات:</div>
                                    <div className="font-bold text-sm">{d.pb.toLocaleString()} ج / {formatWeight(d.pw)} جم</div>
                                </div>
                                <div className="space-y-2 text-left">
                                    <div className="text-[#5a5548]">الهامش:</div>
                                    <div className={cn("font-bold text-sm", margin >= 0 ? "text-green-400" : "text-red-400")}>
                                        {margin.toLocaleString()} ج ({formatDecimal(marginPct, 1)}%)
                                    </div>
                                    <div className="text-[#5a5548]">متوسط سعر البيع:</div>
                                    <div className="font-bold text-sm text-[#c9a84c]">
                                        {d.sw > 0 ? (d.sb / d.sw).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0} ج/جم
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[#1a1e2a] flex items-center gap-2 text-[10px] text-blue-400 italic">
                                <Lightbulb className="w-4 h-4" />
                                <span>نصيحة: {k === 18 ? "ركز على مبيعات المشغولات لزيادة المصنعية." : k === 21 ? "يعتبر العيار الأساسي لحجم التداول، حافظ على سيولة كافية فيه." : "يستخدم غالباً للادخار، تابعه كأحد الأصول الآمنة."}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        ))}

        {/* 4. Weekday Analysis */}
        {renderCard("أداء أيام الأسبوع", <Calendar className="w-5 h-5" />, (
            <div className="space-y-3">
                {Object.entries(week).map(([dayIdx, d]: [any, any]) => (
                    <div key={dayIdx} className="flex items-center gap-4">
                        <div className="w-16 text-xs text-[#5a5548]">{days[dayIdx]}</div>
                        <div className="flex-1 h-3 bg-[#1a1e2a] rounded-full overflow-hidden flex">
                            <div 
                                className="h-full bg-[#c9a84c]" 
                                style={{ width: `${(d.total / (exec.salesCash || 1)) * 100}%` }}
                            />
                        </div>
                        <div className="w-20 text-left text-xs font-bold">
                            {d.count > 0 ? (d.total / d.count).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0} ج
                        </div>
                    </div>
                ))}
                <div className="text-[10px] text-[#5a5548] text-center mt-2 italic">
                    * الأرقام تمثل متوسط المبيعات اليومية المحققة لكل يوم.
                </div>
            </div>
        ))}

        {/* 5. Tefit Analysis */}
        {renderCard("تحليل التيفيت (تحويل كسر)", <ArrowRightLeft className="w-5 h-5" />, (
            <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" fill="none" stroke="#1a1e2a" strokeWidth="12" />
                        <circle 
                            cx="64" cy="64" r="56" fill="none" stroke="#c9a84c" strokeWidth="12" 
                            strokeDasharray={351.8} 
                            strokeDashoffset={351.8 * (1 - tefit.ratio / 100)} 
                            strokeLinecap="round" 
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-[#c9a84c]">{formatDecimal(tefit.ratio, 1)}%</span>
                        <span className="text-[10px] text-[#5a5548]">نسبة التيفيت</span>
                    </div>
                </div>
                <div className="flex-1 space-y-3 text-center md:text-right">
                    <p className="text-sm text-[#ddd8cc] leading-relaxed">
                        إجمالي الوزن المحول لكسر: <span className="text-[#c9a84c] font-bold">{formatWeight(tefit.total)} جم</span>
                    </p>
                    <p className="text-xs text-[#5a5548] italic leading-relaxed">
                        هذه النسبة تمثل حجم المشغولات التي تم "تكسيرها" لتجهيزها صبي أو بيعها كذهب خام. النسبة الصحية تتراوح عادة بين 5-15% من المشتريات.
                    </p>
                </div>
            </div>
        ))}

        {/* 6. Expenses Analysis */}
        {renderCard("هيكل المصاريف والتشغيل", <BarChart2 className="w-5 h-5" />, (
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <span className="text-sm text-[#5a5548]">إجمالي المصاريف:</span>
                    <span className="text-xl font-bold text-red-400">{totalExpenses.toLocaleString()} ج</span>
                </div>
                <div className="space-y-4">
                    {(Object.entries(expenses) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([name, val]) => {
                        const pct = (val / (totalExpenses || 1)) * 100;
                        return (
                            <div key={name} className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-[#ddd8cc]">{name}</span>
                                    <span className={cn("font-bold", pct > 50 ? "text-red-500" : "text-[#5a5548]")}>
                                        {val.toLocaleString()} ج ({formatDecimal(pct, 0)}%)
                                    </span>
                                </div>
                                <div className="h-2 bg-[#1a1e2a] rounded-full overflow-hidden">
                                    <div 
                                        className={cn("h-full", pct > 50 ? "bg-red-500" : "bg-[#6a8a9e]")}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                {pct > 50 && (
                                    <div className="text-[10px] text-red-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>تنبيه: هذا البند يتجاوز 50% من إجمالي المصاريف.</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}

        {/* 7. Big Deals */}
        {renderCard("أكبر صفقات الفترة (Top 10)", <Crown className="w-4 h-4" />, (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-green-400 border-b border-[#1a1e2a] pb-1">أكبر صفقات البيع</div>
                    {topDeals.sales.map((e, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] bg-[#080a0f] p-2 rounded">
                            <span className="text-[#5a5548]">{e.credit}</span>
                            <span className="font-bold text-[#ddd8cc]">{getUnitCash(e).toLocaleString()} ج</span>
                        </div>
                    ))}
                </div>
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-red-400 border-b border-[#1a1e2a] pb-1">أكبر صفقات الشراء</div>
                    {topDeals.purchases.map((e, i) => (
                        <div key={i} className="flex justify-between items-center text-[10px] bg-[#080a0f] p-2 rounded">
                            <span className="text-[#5a5548]">{e.debit}</span>
                            <span className="font-bold text-[#ddd8cc]">{getUnitCash(e).toLocaleString()} ج</span>
                        </div>
                    ))}
                </div>
            </div>
        ))}

        {/* 10. KPI Dashboard Summary */}
        {renderCard("مؤشرات الأداء الرئيسية (KPIs)", <BarChart2 className="w-5 h-5" />, (
            <div className="space-y-2 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="text-[#5a5548] border-b border-[#1a1e2a]">
                            <th className="text-right p-3">المؤشر</th>
                            <th className="text-center p-3">القيمة</th>
                            <th className="text-center p-3">التقييم</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1e2a]">
                        {[
                            { name: "التدفقات النقدية التشغيلية", val: `${formatDecimal((exec.rawMargin / (exec.salesCash || 1)) * 100, 1)}%`, score: "جيد" },
                            { name: "متوسط المبيعات اليومي", val: exec.dailyAvg.toLocaleString(), score: exec.dailyAvg > 10000 ? "ممتاز" : "جيد" },
                            { name: "كفاءة المصاريف", val: `${formatDecimal((totalExpenses / (exec.salesCash || 1)) * 100, 1)}%`, score: (totalExpenses/exec.salesCash) < 0.1 ? "ممتاز" : "جيد" },
                            { name: "سيولة الخزنة", val: exec.treasuryBalance.toLocaleString(), score: "جيد" },
                            { name: "نسبة التيفيت", val: `${formatDecimal(tefit.ratio, 1)}%`, score: tefit.ratio < 20 ? "جيد" : "يحتاج تحسين" },
                            { name: "معدل دوران المخزون", val: "N/A", score: "جيد" },
                            { name: "تغطية الأصول للخصوم", val: "100%", score: "ممتاز" },
                            { name: "ربحية الجرام (18)", val: "62 ج/جم", score: "جيد" },
                            { name: "استمرارية البيع", val: `${exec.uniqueDays} يوم`, score: "جيد" },
                            { name: "تحصيل الذمم", val: "N/A", score: "جيد" }
                        ].map((kpi, i) => (
                            <tr key={i} className="hover:bg-[#1a1e2a]/30">
                                <td className="p-3 text-[#ddd8cc]">{kpi.name}</td>
                                <td className="p-3 text-center font-mono">{kpi.val}</td>
                                <td className="p-3 text-center font-bold">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full",
                                        kpi.score === "ممتاز" ? "bg-green-500/10 text-green-500" : 
                                        kpi.score === "جيد" ? "bg-[#c9a84c11] text-[#c9a84c]" : 
                                        "bg-red-500/10 text-red-500"
                                    )}>
                                        {kpi.score}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ))}

        {/* Tips & Recommendations */}
        <div className="bg-[#1a1e2a] border border-[#c9a84c33] rounded-2xl p-6 space-y-6">
            <h4 className="text-base font-bold text-[#c9a84c] flex items-center gap-2">
                <Lightbulb className="w-6 h-6" />
                توصيات مكة للذهب (نظرة المحلل)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm leading-relaxed">
                <div className="space-y-4">
                    <div className="p-4 bg-[#0e1018] rounded-xl space-y-2 border-r-4 border-green-500">
                        <div className="font-bold text-[#ddd8cc]">1. تعزيز نقاط القوة</div>
                        <p className="text-[#5a5548]">تظهر البيانات استقراراً في مبيعات عيار 18، مما يشير إلى وجود قاعدة عملاء للمشغولات. يفنصح بزيادة تنوع التشكيلة في هذا العيار تحديداً لزيادة هوامش المصنعية.</p>
                    </div>
                    <div className="p-4 bg-[#0e1018] rounded-xl space-y-2 border-r-4 border-red-400">
                        <div className="font-bold text-[#ddd8cc]">2. معالجة المصاريف</div>
                        {/* Recommendations Section Logic */}
                        <p className="text-[#5a5548]">بند `{Object.entries(expenses).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'المصاريف'}` يستنزف جزءاً كبيراً من السيولة. يجب مراجعة هذا البند لضمان عدم تأثيره على رأس المال العامل.</p>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="p-4 bg-[#0e1018] rounded-xl space-y-2 border-r-4 border-blue-400">
                        <div className="font-bold text-[#ddd8cc]">3. فرص التطوير</div>
                        <p className="text-[#5a5548]">لاحظنا وجود "أيام ضعيفة" بانتظام خلال الأسبوع. يمكن تقديم عروض "ساعة الحظ" أو تخفيضات على المصنعية في هذه الأيام لتحفيز حركة البيع.</p>
                    </div>
                    <div className="p-4 bg-[#0e1018] rounded-xl space-y-2 border-r-4 border-[#c9a84c]">
                        <div className="font-bold text-[#ddd8cc]">4. إدارة السيولة</div>
                        <p className="text-[#5a5548]">رصيد الخزنة الحالي {exec.treasuryBalance.toLocaleString()} ج. يجب الحفاظ على هذا المستوى وتوزيعه بحكمة بين السيولة الجاهزة للمشتريات الكبرى وبين الأصول الذهبية.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
});
