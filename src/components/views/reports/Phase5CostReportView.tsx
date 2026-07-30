import React, { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../store';
import type { OperationCostResultV2 } from '../../../lib/inventoryCostTypes';

type Grouping = 'invoice' | 'account' | 'day' | 'month' | 'year' | 'shop';

const money = (minor: number | null | undefined): string =>
  minor === null || minor === undefined
    ? 'غير متاح'
    : (minor / 100).toLocaleString('ar-EG', { maximumFractionDigits: 0 });

const quantity = (units: number, accessory: boolean): string =>
  (units / (accessory ? 1000 : 100)).toLocaleString('ar-EG', { maximumFractionDigits: 3 });

const groupKey = (result: OperationCostResultV2, grouping: Grouping): string => {
  if (grouping === 'shop') return 'المحل بالكامل';
  if (grouping === 'account') return result.sourceInventoryAccountId || 'غير محدد';
  if (grouping === 'day') return result.entry.date;
  if (grouping === 'month') return result.entry.date.slice(0, 7);
  if (grouping === 'year') return result.entry.date.slice(0, 4);
  return result.entry.invoiceNumber || result.operationId;
};

export const Phase5CostReportView: React.FC<{ initialSection?: 'inventory' | 'profit' }> = ({
  initialSection = 'inventory',
}) => {
  const {
    costCalculationRun,
    accountsDb,
    goldPrice,
    silverPrice,
    requestCostRetry,
    setView,
  } = useAppStore();
  const [section, setSection] = useState<'inventory' | 'profit'>(initialSection);
  const [grouping, setGrouping] = useState<Grouping>('invoice');
  const [startDate, setStartDate] = useState('2000-01-01');
  const [endDate, setEndDate] = useState('2099-12-31');
  const [accountId, setAccountId] = useState('all');

  const accountNames = useMemo(
    () => new Map(accountsDb.filter(account => account.id).map(account => [account.id as string, account.name])),
    [accountsDb],
  );

  if (costCalculationRun.status !== 'valid' || !costCalculationRun.timeline?.valid) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
        <div className="flex items-center gap-2 font-black">
          <AlertTriangle className="h-5 w-5" />
          تقارير التكلفة غير متاحة
        </div>
        <p className="mt-2 text-xs leading-6">
          {costCalculationRun.status === 'running'
            ? 'جارٍ إعادة احتساب التكلفة، برجاء الانتظار'
            : costCalculationRun.error
              ? `${costCalculationRun.error.code}: ${costCalculationRun.error.message}`
              : 'لم يكتمل Cost Run صالح بعد.'}
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={requestCostRetry} className="rounded-xl bg-[#c9a84c] px-4 py-2 text-xs font-black text-[#080a0f]">
            إعادة المحاولة
          </button>
          <button type="button" onClick={() => setView('settings')} className="rounded-xl border border-red-200/50 px-4 py-2 text-xs font-black">
            فتح الإعدادات
          </button>
        </div>
      </div>
    );
  }

  const timeline = costCalculationRun.timeline;
  const states = Object.values(timeline.finalStates)
    .filter(state => accountId === 'all' || state.inventoryAccountId === accountId);
  const sales = timeline.results.filter(result =>
    result.classification === 'sale'
    && result.entry.date >= startDate
    && result.entry.date <= endDate
    && (accountId === 'all' || result.sourceInventoryAccountId === accountId));

  const groupedSales = Object.values(sales.reduce<Record<string, {
    key: string;
    saleMinor: number;
    cogsMinor: number;
    profitMinor: number;
    count: number;
  }>>((groups, result) => {
    const key = groupKey(result, grouping);
    const row = groups[key] ?? { key, saleMinor: 0, cogsMinor: 0, profitMinor: 0, count: 0 };
    row.saleMinor += result.saleAmountMinor;
    row.cogsMinor += result.totalCogsMinor;
    row.profitMinor += result.profitMinor ?? 0;
    row.count += 1;
    groups[key] = row;
    return groups;
  }, {}));

  const saleTotalMinor = sales.reduce((sum, result) => sum + result.saleAmountMinor, 0);
  const cogsTotalMinor = sales.reduce((sum, result) => sum + result.totalCogsMinor, 0);
  const profitTotalMinor = sales.reduce((sum, result) => sum + (result.profitMinor ?? 0), 0);

  return (
    <div className="space-y-4 pb-20" dir="rtl">
      <div className="rounded-3xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black text-[#f5f1e8]">تقرير تكلفة المخزون — Phase 5</h2>
            <p className="mt-1 text-[10px] text-[#8a8172]">
              {costCalculationRun.catalogVersion} · generation {costCalculationRun.generationId}
            </p>
          </div>
          <button type="button" onClick={requestCostRetry} className="rounded-xl border border-[#1a1e2a] p-2 text-[#c9a84c]" title="إعادة بناء التكلفة">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSection('inventory')} className={`rounded-xl p-3 text-xs font-black ${section === 'inventory' ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#080a0f] text-[#ddd8cc]'}`}>
            تكلفة المخزون
          </button>
          <button type="button" onClick={() => setSection('profit')} className={`rounded-xl p-3 text-xs font-black ${section === 'profit' ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#080a0f] text-[#ddd8cc]'}`}>
            المبيعات والربح
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3">
        <select value={accountId} onChange={event => setAccountId(event.target.value)} className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
          <option value="all">كل حسابات المخزون</option>
          {Object.values(timeline.finalStates).map(state => (
            <option key={state.inventoryAccountId} value={state.inventoryAccountId}>{state.displayName}</option>
          ))}
        </select>
      </div>

      {section === 'inventory' ? (
        <div className="space-y-3">
          {states.map(state => {
            const accessory = state.kind === 'accessory';
            const units = accessory ? state.accessoryQuantityUnits : state.standardizedQuantityUnits;
            const bookCostMinor = state.remainingTotalCostMinor;
            const marketValueMinor = state.kind === 'gold'
              ? Math.round((state.standardizedQuantityUnits / 100) * goldPrice * 100)
              : state.kind === 'silver'
                ? Math.round((state.standardizedQuantityUnits / 100) * silverPrice * 100)
                : null;
            const unrealizedMinor = marketValueMinor === null ? null : marketValueMinor - bookCostMinor;
            return (
              <div key={state.inventoryAccountId} className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
                <div className="font-black text-[#f5f1e8]">{state.displayName}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-[#080a0f] p-3"><div className="text-[#8a8172]">{accessory ? 'الكمية' : state.kind === 'gold' ? 'وزن E21' : 'الوزن'}</div><div className="mt-1 font-mono font-black text-[#ddd8cc]">{quantity(units, accessory)} {accessory ? 'قطعة' : 'جم'}</div></div>
                  <div className="rounded-xl bg-[#080a0f] p-3"><div className="text-[#8a8172]">التكلفة الدفترية</div><div className="mt-1 font-mono font-black text-[#c9a84c]">{money(bookCostMinor)} ج.م</div></div>
                  <div className="rounded-xl bg-[#080a0f] p-3"><div className="text-[#8a8172]">متوسط التكلفة/{accessory ? 'قطعة' : 'جم'}</div><div className="mt-1 font-mono font-black text-[#ddd8cc]">{money(state.totalWacMinorPerDisplayUnit)} ج.م</div></div>
                  <div className="rounded-xl bg-[#080a0f] p-3"><div className="text-[#8a8172]">القيمة السوقية</div><div className="mt-1 font-mono font-black text-[#6a9e6a]">{marketValueMinor === null ? 'غير منطبق' : `${money(marketValueMinor)} ج.م`}</div></div>
                </div>
                {!accessory && (
                  <div className="mt-2 rounded-xl border border-[#1a1e2a] p-3 text-xs">
                    <div className="flex justify-between"><span className="text-[#8a8172]">فرق سوقي غير محقق</span><span className="font-mono text-[#ddd8cc]">{money(unrealizedMinor)} ج.م</span></div>
                    <div className="mt-1 text-[9px] text-[#8a8172]">لا يدخل هذا الفرق في ربح المبيعات المحقق.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3">
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs text-[#ddd8cc]" />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs text-[#ddd8cc]" />
            <select value={grouping} onChange={event => setGrouping(event.target.value as Grouping)} className="col-span-2 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs text-[#ddd8cc]">
              <option value="invoice">حسب الفاتورة</option>
              <option value="account">حسب حساب المخزون</option>
              <option value="day">يومي</option>
              <option value="month">شهري</option>
              <option value="year">سنوي</option>
              <option value="shop">المحل بالكامل</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[#0e1018] p-3 text-center"><div className="text-[10px] text-[#8a8172]">المبيعات</div><div className="mt-1 font-mono text-sm font-black text-[#6a9e6a]">{money(saleTotalMinor)}</div></div>
            <div className="rounded-2xl bg-[#0e1018] p-3 text-center"><div className="text-[10px] text-[#8a8172]">COGS</div><div className="mt-1 font-mono text-sm font-black text-[#ddd8cc]">{money(cogsTotalMinor)}</div></div>
            <div className="rounded-2xl bg-[#0e1018] p-3 text-center"><div className="text-[10px] text-[#8a8172]">الربح</div><div className="mt-1 font-mono text-sm font-black text-[#c9a84c]">{money(profitTotalMinor)}</div></div>
          </div>
          <div className="space-y-2">
            {groupedSales.map(row => (
              <div key={row.key} className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 text-xs">
                <div className="font-black text-[#f5f1e8]">{grouping === 'account' ? accountNames.get(row.key) || row.key : row.key}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[#8a8172]">بيع</div><div className="font-mono text-[#6a9e6a]">{money(row.saleMinor)}</div></div>
                  <div><div className="text-[#8a8172]">COGS</div><div className="font-mono text-[#ddd8cc]">{money(row.cogsMinor)}</div></div>
                  <div><div className="text-[#8a8172]">ربح</div><div className="font-mono text-[#c9a84c]">{money(row.profitMinor)}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
