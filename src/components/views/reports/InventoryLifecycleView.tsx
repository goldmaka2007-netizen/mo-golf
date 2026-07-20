import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, Download, RefreshCw, RotateCcw, Settings2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { Entry } from '../../../types';
import { useAppStore } from '../../../store';
import { cn } from '../../../lib/utils';
import { exportToExcel } from '../../../utils/exportUtils';
import { buildInventoryCycleExcelSheets, canExportInventoryCycleReport } from '../../../lib/inventoryCycleExcel';
import { buildOpeningCostConfig } from '../../../lib/openingCostConfig';
import { useInventoryCycleReportCache } from '../../../hooks/useInventoryCycleReportCache';
import { loadInventoryWarningState, markWarningReviewed, saveInventoryWarningState, updateWarningTypeConfig, type InventoryWarningState } from '../../../lib/inventoryCycleWarnings';
import {
  buildInventoryCycleItemChart,
  getDefaultInventoryCycleFilters,
  type InventoryCycleFilters,
  type InventoryCycleItemReport,
  type InventoryCycleTab,
} from '../../../lib/inventoryCycleReport';

interface Props {
  entries: Entry[];
}

const tabLabels: Record<InventoryCycleTab, string> = { gold: 'ذهب', silver: 'فضة', accessory: 'ملحقات' };
const storageKey = (tab: InventoryCycleTab) => `inventory-cycle-filters-${tab}`;
const fmtQty = (value?: number | null) => value === null || value === undefined ? 'غير متاحة' : Number(value.toFixed(3)).toLocaleString('ar-EG', { maximumFractionDigits: 3 });
const fmtMoney = (value?: number | null) => value === null || value === undefined ? 'غير متاحة' : value.toLocaleString('ar-EG', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const fmtPct = (value?: number | null) => value === null || value === undefined ? 'غير متاحة' : `${value.toFixed(1)}%`;

const movementLabel = (kind: string) => ({
  opening: 'افتتاح', purchase: 'شراء', sale: 'بيع', transfer: 'تحويل', tifeet: 'تفييت', adjustment: 'تسوية', merchant_settlement: 'تسوية تاجر', personal_withdrawal: 'مسحوبات', expense: 'مصروف', other: 'أخرى', all: 'كل الحركات',
} as Record<string, string>)[kind] ?? kind;

const currentMonthBounds = () => {
  const now = new Date();
  return {
    startDate: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'),
  };
};

const monthBounds = (monthIndex: number) => {
  const y = new Date().getFullYear();
  return {
    startDate: format(new Date(y, monthIndex, 1), 'yyyy-MM-dd'),
    endDate: format(new Date(y, monthIndex + 1, 0), 'yyyy-MM-dd'),
  };
};

const loadFilters = (tab: InventoryCycleTab): InventoryCycleFilters => {
  try {
    const raw = localStorage.getItem(storageKey(tab));
    return raw ? { ...getDefaultInventoryCycleFilters(tab), ...JSON.parse(raw) } : getDefaultInventoryCycleFilters(tab);
  } catch {
    return getDefaultInventoryCycleFilters(tab);
  }
};

const Stat = ({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'gold' | 'green' | 'red' | 'blue' }) => (
  <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 min-w-0">
    <div className="text-[10px] font-bold text-[#8a8172] leading-4">{label}</div>
    <div className={cn('mt-1 truncate font-mono text-lg font-black', tone === 'gold' && 'text-[#c9a84c]', tone === 'green' && 'text-[#6a9e6a]', tone === 'red' && 'text-[#d06a6a]', tone === 'blue' && 'text-[#6a8a9e]', tone === 'default' && 'text-[#f5f1e8]')}>{value}</div>
  </div>
);

const MiniChart = ({ data, color = '#c9a84c', secondLine, marketPrice, tab }: { data: any[]; color?: string; secondLine?: boolean; marketPrice?: number; tab: InventoryCycleTab }) => {
  const chartData = useMemo(() => data.map(row => ({ ...row, marketPrice })), [data, marketPrice]);
  if (!chartData.length) return <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-4 text-center text-xs text-[#8a8172]">لا توجد نقاط كافية للرسم</div>;
  return (
    <div className="h-56 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1a1e2a" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#8a8172', fontSize: 10 }} minTickGap={18} />
          <YAxis tick={{ fill: '#8a8172', fontSize: 10 }} width={42} />
          <Tooltip contentStyle={{ background: '#0e1018', border: '1px solid #1a1e2a', color: '#f5f1e8', direction: 'rtl' }} />
          <Line type="monotone" dataKey="balance" name={tab === 'gold' ? 'رصيد Equivalent-21' : 'الرصيد'} stroke={color} strokeWidth={2} dot={false} />
          {secondLine && <Line type="monotone" dataKey="averageCost" name="المتوسط المرجح" stroke="#6a8a9e" strokeWidth={2} dot={false} yAxisId={0} />}
          {marketPrice !== undefined && <Line type="monotone" dataKey="marketPrice" name="تقييم بسعر اليوم" stroke="#6a9e6a" strokeDasharray="4 4" dot={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const MoneyChart = ({ data }: { data: any[] }) => (
  <div className="h-56 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2" dir="ltr">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 6, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1a1e2a" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#8a8172', fontSize: 10 }} minTickGap={18} />
        <YAxis tick={{ fill: '#8a8172', fontSize: 10 }} width={42} />
        <Tooltip contentStyle={{ background: '#0e1018', border: '1px solid #1a1e2a', color: '#f5f1e8', direction: 'rtl' }} />
        <Area type="monotone" dataKey="bookValue" name="القيمة الدفترية" stroke="#c9a84c" fill="#c9a84c22" />
        <Area type="monotone" dataKey="sales" name="المبيعات" stroke="#6a9e6a" fill="#6a9e6a18" />
        <Area type="monotone" dataKey="cogs" name="COGS" stroke="#6a8a9e" fill="#6a8a9e18" />
        <Area type="monotone" dataKey="grossProfit" name="مجمل الربح" stroke="#d1b35f" fill="#d1b35f18" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const InventoryLifecycleView: React.FC<Props> = ({ entries }) => {
  const { user, accountsDb, goldPrice, silverPrice, openingCostConfig, setEditingEntry, setView } = useAppStore();
  const [tab, setTab] = useState<InventoryCycleTab>('gold');
  const [filtersByTab, setFiltersByTab] = useState<Record<InventoryCycleTab, InventoryCycleFilters>>({ gold: loadFilters('gold'), silver: loadFilters('silver'), accessory: loadFilters('accessory') });
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [openOperationId, setOpenOperationId] = useState<string | null>(null);
  const [showAccessoryMore, setShowAccessoryMore] = useState(false);
  const [showAccessoryCharts, setShowAccessoryCharts] = useState(false);
  const [warningState, setWarningState] = useState<InventoryWarningState>(() => loadInventoryWarningState(user?.uid || 'local'));
  const filters = filtersByTab[tab];
  const openingConfig = useMemo(() => buildOpeningCostConfig(openingCostConfig), [openingCostConfig]);

  useEffect(() => {
    localStorage.setItem(storageKey(tab), JSON.stringify(filters));
  }, [filters, tab]);

  useEffect(() => {
    setOpenItemId(null);
    setOpenOperationId(null);
    setShowAccessoryMore(false);
    setShowAccessoryCharts(false);
  }, [tab]);

  const { report } = useInventoryCycleReportCache({
    userKey: user?.uid || 'local',
    entries,
    accountsDb,
    tab,
    filters,
    goldPrice,
    silverPrice,
    openingConfig,
    warningState,
  });

  const setFilters = (patch: Partial<InventoryCycleFilters>) => setFiltersByTab(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  const resetFilters = () => setFiltersByTab(prev => ({ ...prev, [tab]: getDefaultInventoryCycleFilters(tab) }));

  const applyPreset = (preset: InventoryCycleFilters['periodPreset']) => {
    if (preset === 'current-month') setFilters({ periodPreset: preset, ...currentMonthBounds() });
    else if (preset === 'year-to-date') setFilters({ periodPreset: preset, startDate: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') });
    else if (String(preset).startsWith('month-')) setFilters({ periodPreset: preset, ...monthBounds(Number(String(preset).split('-')[1])) });
    else setFilters({ periodPreset: preset });
  };

  const exportCurrentTab = () => {
    if (!canExportInventoryCycleReport(report)) return;
    const suffix = `${filters.startDate}_${filters.endDate}_${format(new Date(), 'yyyy-MM-dd')}`;
    exportToExcel(buildInventoryCycleExcelSheets(report, tab), `inventory-cycle-${tab}_${suffix}`);
  };

  const openOriginal = (id: string) => {
    const entry = entries.find(e => (e.id ?? String(e.seq)) === id);
    if (entry) {
      setEditingEntry(entry);
      setView('entry');
    }
  };

  const persistWarningState = (next: InventoryWarningState) => {
    setWarningState(next);
    saveInventoryWarningState(next, user?.uid || 'local');
  };

  const reviewWarning = (warningId: string) => {
    const warning = report.warnings.find(item => item.id === warningId);
    if (!warning) return;
    persistWarningState(markWarningReviewed(warningState, warning));
  };

  const setWarningSeverity = (typeCode: string, severity: 'critical' | 'medium' | 'info') => {
    persistWarningState(updateWarningTypeConfig(warningState, typeCode, { severity }));
  };

  const setWarningEnabled = (typeCode: string, enabled: boolean) => {
    persistWarningState(updateWarningTypeConfig(warningState, typeCode, { enabled }));
  };

  const Summary = () => tab === 'accessory' ? (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Stat label="إجمالي القيمة الدفترية" value={fmtMoney(report.summary.closingCost)} tone="gold" />
        <Stat label="إجمالي المبيعات" value={fmtMoney(report.summary.salesRevenue)} tone="green" />
        <Stat label="مجمل الربح" value={fmtMoney(report.summary.grossProfit)} tone={report.summary.grossProfit !== null && report.summary.grossProfit < 0 ? 'red' : 'green'} />
      </div>
      <button onClick={() => setShowAccessoryMore(v => !v)} className="w-full rounded-xl border border-[#1a1e2a] bg-[#0e1018] px-3 py-2 text-xs font-bold text-[#c9a84c]">{showAccessoryMore ? 'إخفاء التفاصيل' : 'عرض المزيد'}</button>
      {showAccessoryMore && <div className="grid grid-cols-2 gap-2"><Stat label="أصناف لها رصيد" value={String(report.summary.activeItemCount ?? 0)} /><Stat label="COGS" value={fmtMoney(report.summary.cogs)} /><Stat label="عدد العمليات" value={String(report.summary.operationsCount)} /><Stat label="التحذيرات" value={String(report.summary.warningsCount)} tone="red" /></div>}
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Stat label="رصيد أول المدة" value={fmtQty(report.summary.opening)} tone="gold" />
      <Stat label="إجمالي الداخل" value={fmtQty(report.summary.incoming)} tone="green" />
      <Stat label="إجمالي الخارج" value={fmtQty(report.summary.outgoing)} tone="red" />
      <Stat label={tab === 'gold' ? 'رصيد آخر المدة Equivalent-21' : 'رصيد آخر المدة'} value={fmtQty(report.summary.closing)} tone="gold" />
      <Stat label="تكلفة رصيد آخر المدة" value={fmtMoney(report.summary.closingCost)} />
      <Stat label="متوسط التكلفة" value={fmtMoney(report.summary.averageCost)} />
      <Stat label="القيمة السوقية بسعر اليوم" value={fmtMoney(report.summary.marketValue)} tone="blue" />
      <Stat label="فرق إعادة التقييم" value={fmtMoney(report.summary.revaluation)} tone={(report.summary.revaluation ?? 0) < 0 ? 'red' : 'green'} />
    </div>
  );

  const ItemCard: React.FC<{ item: InventoryCycleItemReport }> = ({ item }) => {
    const open = openItemId === item.accountId;
    const itemChart = useMemo(() => open ? buildInventoryCycleItemChart(entries, accountsDb, item.account, tab, filters.startDate, filters.endDate, openingConfig) : [], [open, entries, accountsDb, item.account, tab, filters.startDate, filters.endDate, openingConfig]);
    return (
      <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] overflow-hidden">
        <button onClick={() => setOpenItemId(open ? null : item.accountId)} className="w-full p-4 text-right">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h3 className="truncate text-sm font-black text-[#f5f1e8]">{item.accountName}</h3>{!item.isActive && <span className="rounded-full bg-[#8a817222] px-2 py-0.5 text-[9px] text-[#8a8172]">غير نشط</span>}{item.warnings.length > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] text-red-300">{item.warnings.length} تحذير</span>}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-[#8a8172]">
                <span>الرصيد: <b className="font-mono text-[#c9a84c]">{fmtQty(tab === 'gold' ? item.closingEquivalent21 : item.closingPhysical)}</b></span>
                <span>التكلفة: <b className="font-mono text-[#f5f1e8]">{fmtMoney(item.closingCost)}</b></span>
                {tab !== 'accessory' && <span>السوق: <b className="font-mono text-[#6a8a9e]">{fmtMoney(item.marketValue)}</b></span>}
                <span>{tab === 'accessory' ? 'الربح' : 'فرق التقييم'}: <b className="font-mono text-[#6a9e6a]">{fmtMoney(tab === 'accessory' ? item.grossProfit : item.revaluation)}</b></span>
              </div>
            </div>
            {open ? <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-[#c9a84c]" /> : <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-[#8a8172]" />}
          </div>
        </button>
        {open && <div className="space-y-4 border-t border-[#1a1e2a] p-4">
          <div className="grid grid-cols-2 gap-2"><Stat label="رصيد أول المدة" value={fmtQty(tab === 'gold' ? item.openingEquivalent21 : item.openingPhysical)} /><Stat label="رصيد آخر المدة" value={fmtQty(tab === 'gold' ? item.closingEquivalent21 : item.closingPhysical)} /><Stat label="صافي حركة الوزن" value={fmtQty(item.incoming - item.outgoing)} tone="gold" /><Stat label="متوسط التكلفة" value={fmtMoney(item.closingAverage)} /></div>
          <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><h4 className="mb-2 text-xs font-black text-[#c9a84c]">حركة الفترة</h4><div className="grid grid-cols-2 gap-2 text-xs text-[#ddd8cc]"><span>مشتريات: {fmtQty(item.purchaseQuantity)}</span><span>مبيعات: {fmtQty(item.salesQuantity)}</span><span>تحويلات داخلة: {fmtQty(item.transferIn)}</span><span>تحويلات خارجة: {fmtQty(item.transferOut)}</span><span>تفييت داخل: {fmtQty(item.tifeetIn)}</span><span>تفييت خارج: {fmtQty(item.tifeetOut)}</span><span>زيادة جرد: {fmtQty(item.surplus)}</span><span>عجز جرد: {fmtQty(item.shortage)}</span></div></div>
          <div className="grid grid-cols-2 gap-2"><Stat label="المبيعات" value={fmtMoney(item.salesRevenue)} tone="green" /><Stat label="COGS تاريخي" value={fmtMoney(item.cogs)} /><Stat label="مجمل ربح المبيعات" value={fmtMoney(item.grossProfit)} tone="green" /><Stat label="هامش الربح" value={fmtPct(item.grossMarginPct)} /><Stat label="خسائر العجز" value={fmtMoney(item.adjustmentLoss)} tone="red" /><Stat label="مكاسب الزيادة" value={fmtMoney(item.adjustmentGain)} tone="green" /></div>
          {tab !== 'accessory' && <div className="grid grid-cols-3 gap-2"><Stat label="القيمة الدفترية" value={fmtMoney(item.closingCost)} /><Stat label="القيمة السوقية" value={fmtMoney(item.marketValue)} tone="blue" /><Stat label="فرق إعادة التقييم" value={fmtMoney(item.revaluation)} tone={(item.revaluation ?? 0) < 0 ? 'red' : 'green'} /></div>}
          {tab === 'gold' && item.karatBreakdown && <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><h4 className="mb-2 text-xs font-black text-[#c9a84c]">تفاصيل العيارات</h4>{Object.entries(item.karatBreakdown as Record<string, { closingPhysical: number }>).map(([karat, row]) => <div key={karat} className="flex justify-between border-b border-[#1a1e2a] py-1 text-xs text-[#ddd8cc]"><span>عيار {karat}</span><span className="font-mono">{fmtQty(row.closingPhysical)} جم فعلي</span></div>)}</div>}
          <MiniChart data={itemChart} secondLine marketPrice={tab === 'gold' ? goldPrice : tab === 'silver' ? silverPrice : undefined} tab={tab} />
          <div className="space-y-2"><h4 className="text-xs font-black text-[#c9a84c]">تفاصيل العمليات</h4>{item.operations.length === 0 ? <div className="rounded-xl bg-[#080a0f] p-4 text-center text-xs text-[#8a8172]">لا توجد حركات في الفترة لهذا الصنف</div> : item.operations.map(op => <div key={`${op.id}-${op.direction}`} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><button onClick={() => setOpenOperationId(openOperationId === `${item.accountId}-${op.id}-${op.direction}` ? null : `${item.accountId}-${op.id}-${op.direction}`)} className="w-full text-right"><div className="flex justify-between gap-2 text-xs"><span className="font-bold text-[#f5f1e8]">{op.date} - {op.invoiceNumber || op.id}</span><span className={op.direction === 'in' ? 'text-[#6a9e6a]' : 'text-[#d06a6a]'}>{op.direction === 'in' ? 'داخل' : 'خارج'}</span></div><div className="mt-1 text-[11px] text-[#8a8172]">{movementLabel(op.kind)} | {fmtQty(op.physicalQuantity)} {tab === 'gold' && `| Equivalent-21 ${fmtQty(op.equivalent21)}`}</div></button>{openOperationId === `${item.accountId}-${op.id}-${op.direction}` && <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#1a1e2a] pt-3 text-[11px] text-[#ddd8cc]"><span>مدين: {op.debit}</span><span>دائن: {op.credit}</span><span>العيار: {op.karat || '-'}</span><span>الرصيد قبل: {fmtQty(op.balanceBefore)}</span><span>الرصيد بعد: {fmtQty(op.balanceAfter)}</span><span>التكلفة المنقولة: {fmtMoney(op.movedCost)}</span><span>المتوسط قبل: {fmtMoney(op.averageBefore)}</span><span>المتوسط بعد: {fmtMoney(op.averageAfter)}</span><span>الإيراد: {fmtMoney(op.revenue)}</span><span>COGS: {fmtMoney(op.cogs)}</span><span>الربح: {fmtMoney(op.grossProfit)}</span><span>الحالة: {op.status || '-'}</span>{op.notes && <span className="col-span-2">ملاحظات: {op.notes}</span>}<button onClick={() => openOriginal(op.id)} className="col-span-2 rounded-lg bg-[#c9a84c] py-2 text-xs font-black text-[#080a0f]">فتح العملية الأصلية</button></div>}</div>)}</div>
        </div>}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-[calc(6rem+env(safe-area-inset-bottom))]" dir="rtl">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-[#f5f1e8]">تقارير دورة المخزون</h2><p className="text-[10px] font-bold text-[#8a8172]">التكلفة والرصيد مبنيان على المحرك المركزي، والتقييم يستخدم سعر اليوم فقط.</p></div><button onClick={exportCurrentTab} disabled={!canExportInventoryCycleReport(report)} className="rounded-xl bg-[#c9a84c] p-3 text-[#080a0f] disabled:opacity-40"><Download className="h-5 w-5" /></button></div>
      <div className="grid grid-cols-3 gap-2">{(['gold','silver','accessory'] as InventoryCycleTab[]).map(t => <button key={t} onClick={() => setTab(t)} className={cn('rounded-xl border px-3 py-3 text-xs font-black', tab === t ? 'border-[#c9a84c] bg-[#c9a84c] text-[#080a0f]' : 'border-[#1a1e2a] bg-[#0e1018] text-[#8a8172]')}>{tabLabels[t]}</button>)}</div>
      <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 space-y-3"><div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"><button onClick={() => applyPreset('current-month')} className="shrink-0 rounded-full border border-[#1a1e2a] bg-[#080a0f] px-3 py-2 text-[11px] font-bold text-[#ddd8cc]">الشهر الحالي</button><button onClick={() => applyPreset('year-to-date')} className="shrink-0 rounded-full border border-[#1a1e2a] bg-[#080a0f] px-3 py-2 text-[11px] font-bold text-[#ddd8cc]">من بداية السنة</button>{Array.from({ length: 12 }, (_, i) => <button key={i} onClick={() => applyPreset(`month-${i}` as any)} className="shrink-0 rounded-full border border-[#1a1e2a] bg-[#080a0f] px-3 py-2 text-[11px] font-bold text-[#ddd8cc]">{i + 1}</button>)}</div><div className="grid grid-cols-2 gap-2"><input type="date" value={filters.startDate} onChange={e => setFilters({ periodPreset: 'custom', startDate: e.target.value })} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc]" /><input type="date" value={filters.endDate} onChange={e => setFilters({ periodPreset: 'custom', endDate: e.target.value })} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc]" /></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><select value={filters.accountId} onChange={e => setFilters({ accountId: e.target.value })} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs text-[#ddd8cc]"><option value="all">كل الأصناف</option>{report.accounts.map(acc => <option key={acc.id ?? acc.name} value={acc.id ?? acc.name}>{acc.name}</option>)}</select><select value={filters.movementKind} onChange={e => setFilters({ movementKind: e.target.value as any })} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs text-[#ddd8cc]"><option value="all">كل الحركات</option>{report.movementKinds.map(kind => <option key={kind} value={kind}>{movementLabel(kind)}</option>)}</select><button onClick={resetFilters} className="flex items-center justify-center gap-2 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs font-black text-[#c9a84c]"><RotateCcw className="h-4 w-4" />إعادة ضبط الفلاتر</button></div></div>
      {report.cache.status !== 'current' && <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-100"><div className="flex items-center gap-2 font-black"><RefreshCw className="h-4 w-4 animate-spin" />حالة التقرير: {report.cache.status}. يتم عرض آخر نتيجة محفوظة إن وجدت، وتصدير Excel معطل حتى يكتمل البناء.</div>{report.cache.lastUpdatedAt && <div className="mt-1 text-[10px]">آخر تحديث مؤكد: {new Date(report.cache.lastUpdatedAt).toLocaleString('ar-EG')}</div>}{report.cache.error && <div className="mt-1 text-[10px] text-red-200">الخطأ: {report.cache.error}</div>}</div>}
      {tab !== 'accessory' && <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 space-y-3"><div className="flex items-center gap-2 text-xs font-black text-yellow-100"><AlertTriangle className="h-4 w-4" />تحذيرات نشطة: خطير {report.summary.criticalWarnings}، متوسط {report.summary.mediumWarnings}، تنبيهي {report.summary.infoWarnings}</div>{report.warnings.length > 0 && <div className="space-y-2">{report.warnings.slice(0, 8).map(w => <div key={w.id} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs text-[#ddd8cc]"><div className="flex items-start justify-between gap-2"><div><div className="font-black text-[#f5f1e8]">{w.type}</div><div className="mt-1 text-[11px] text-[#8a8172]">{w.accountName || '-'} | {w.operationNumber || '-'} | {w.date || '-'}</div><div className="mt-1 text-[11px] text-[#ddd8cc]">{w.description}</div></div><span className={cn('rounded-full px-2 py-1 text-[9px] font-black', w.severity === 'critical' ? 'bg-red-500/15 text-red-200' : w.severity === 'medium' ? 'bg-yellow-500/15 text-yellow-100' : 'bg-blue-500/15 text-blue-100')}>{w.severity === 'critical' ? 'خطير' : w.severity === 'medium' ? 'متوسط' : 'تنبيهي'}</span></div><div className="mt-3 grid grid-cols-3 gap-2"><button onClick={() => w.operationId && openOriginal(w.operationId)} className="rounded-lg border border-[#1a1e2a] px-2 py-2 text-[10px] font-bold text-[#c9a84c]">فتح العملية</button><button onClick={() => w.operationId && openOriginal(w.operationId)} className="rounded-lg border border-[#1a1e2a] px-2 py-2 text-[10px] font-bold text-[#6a8a9e]">تعديل</button><button onClick={() => reviewWarning(w.id)} className="rounded-lg bg-[#1a1e2a] px-2 py-2 text-[10px] font-bold text-[#ddd8cc]">تمت المراجعة</button></div></div>)}</div>}{report.reviewedWarnings.length > 0 && <details className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><summary className="cursor-pointer text-xs font-black text-[#c9a84c]">سجل المراجعة ({report.reviewedWarnings.length})</summary><div className="mt-3 space-y-2">{report.reviewedWarnings.slice(0, 20).map(review => <div key={review.warningId} className="rounded-lg bg-[#0e1018] p-2 text-[11px] text-[#ddd8cc]"><div className="font-bold">{review.typeLabel} - {review.accountName || '-'}</div><div className="text-[#8a8172]">{new Date(review.reviewedAt).toLocaleString('ar-EG')} | المستوى وقت المراجعة: {review.severityAtReview}</div><div>{review.description}</div></div>)}</div></details>}<details className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><summary className="cursor-pointer text-xs font-black text-[#c9a84c]">إعدادات التحذيرات</summary><div className="mt-3 space-y-2">{Object.values(warningState.configs).map((config: any) => <div key={config.typeCode} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-[#0e1018] p-2 text-[11px]"><label className="flex items-center gap-2 text-[#ddd8cc]"><input type="checkbox" checked={config.enabled} onChange={e => setWarningEnabled(config.typeCode, e.target.checked)} />{config.label}</label><select value={config.severity} onChange={e => setWarningSeverity(config.typeCode, e.target.value as any)} className="rounded-lg border border-[#1a1e2a] bg-[#080a0f] px-2 py-1 text-[#ddd8cc]"><option value="critical">خطير</option><option value="medium">متوسط</option><option value="info">تنبيهي</option></select></div>)}</div></details></div>}      <Summary />
      {tab === 'accessory' ? <div className="space-y-2"><div className="grid grid-cols-[1fr_auto] gap-2"><button onClick={() => setShowAccessoryCharts(v => !v)} className="flex items-center justify-center gap-2 rounded-xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-xs font-black text-[#c9a84c]"><BarChart3 className="h-4 w-4" />{showAccessoryCharts ? 'إخفاء الرسوم' : 'عرض الرسوم'}</button><select value={filters.chartGrouping ?? ''} onChange={e => setFilters({ chartGrouping: e.target.value ? e.target.value as any : undefined })} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-xs text-[#ddd8cc]"><option value="">تلقائي</option><option value="daily">يومي</option><option value="weekly">أسبوعي</option><option value="monthly">شهري</option></select></div>{showAccessoryCharts && <MoneyChart data={report.chart} />}</div> : <MiniChart data={report.chart} color={tab === 'gold' ? '#c9a84c' : '#d1d5db'} tab={tab} />}
      {report.items.length === 0 ? <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-8 text-center text-sm text-[#8a8172]">لا يوجد رصيد ولا حركة في هذه الفترة.</div> : <div className="space-y-3">{report.items.map(item => <ItemCard key={item.accountId} item={item} />)}</div>}
      <div className="rounded-xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-[10px] text-[#8a8172]"><Settings2 className="mb-1 inline h-3 w-3" /> حالة إعادة البناء: {report.cache.status} | آخر تحديث: {new Date(report.cache.updatedAt).toLocaleString('ar-EG')}</div>
    </div>
  );
};








