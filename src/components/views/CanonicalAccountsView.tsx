import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CopyPlus, Landmark, Search, ShieldCheck, X } from 'lucide-react';
import { RAW_DATA } from '../../constants';
import { db } from '../../firebase';
import {
  buildOperationalRuleCatalog,
  canCloneAccount,
  type CloneEligibility,
} from '../../lib/accountCloning';
import { createAccountClone } from '../../lib/accountCloneService';
import { getAccountGroup } from '../../lib/ledgerReport';
import { useAppStore } from '../../store';
import type { Account } from '../../types';
import { cn } from '../../lib/utils';

interface AccountRow {
  account: Account;
  eligibility: CloneEligibility;
}

const classificationLabel = (account: Account): string => {
  if (account.type === 'merchant') return account.metal === 'silver' ? 'تاجر فضة' : 'تاجر ذهب';
  if (account.is_inventory) {
    if (account.type === 'accessory') return 'مخزون ملحقات';
    if (account.metal === 'silver') return 'مخزون فضة';
    return `مخزون ذهب${account.karat ? ` عيار ${account.karat}` : ''}`;
  }
  return getAccountGroup(account);
};

/** One mobile-first operational chart; legacy review/migration tools are intentionally absent. */
export const CanonicalAccountsView = React.memo(() => {
  const {
    accountsDb,
    canonicalAccounts,
    transactionRules,
    customRules,
    user,
    setView,
  } = useAppStore();
  const [search, setSearch] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const operationalRules = useMemo(() => buildOperationalRuleCatalog({
    transactionRules: transactionRules ?? [],
    customRules: customRules ?? [],
    rawRules: RAW_DATA,
    userId: user?.uid ?? '',
  }), [transactionRules, customRules, user?.uid]);

  const rows = useMemo<AccountRow[]>(() => (accountsDb ?? []).map(account => ({
    account,
    eligibility: canCloneAccount(account, {
      accounts: accountsDb ?? [],
      canonicalAccounts: canonicalAccounts ?? [],
      transactionRules: operationalRules,
    }),
  })), [accountsDb, canonicalAccounts, operationalRules]);

  const filtered = useMemo(() => {
    const term = search.trim();
    return rows.filter(row => !term
      || row.account.name.includes(term)
      || row.account.mainType.includes(term)
      || row.account.subType.includes(term));
  }, [rows, search]);

  const hierarchy = useMemo(() => {
    const groups = new Map<string, Map<string, AccountRow[]>>();
    filtered.forEach(row => {
      const main = row.account.mainType || 'أخرى';
      const sub = row.account.subType || 'أخرى';
      const subgroups = groups.get(main) ?? new Map<string, AccountRow[]>();
      subgroups.set(sub, [...(subgroups.get(sub) ?? []), row]);
      groups.set(main, subgroups);
    });
    return [...groups.entries()].map(([main, subgroups]) => ({
      main,
      subgroups: [...subgroups.entries()].map(([sub, items]) => ({
        sub,
        items: items.sort((a, b) => a.account.name.localeCompare(b.account.name, 'ar')),
      })),
    }));
  }, [filtered]);

  const selected = rows.find(row => row.account.id === sourceId);

  const submit = async () => {
    if (!user?.uid || !selected?.account.id || !selected.eligibility.allowed || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await createAccountClone({
        firestore: db,
        userId: user.uid,
        sourceAccountId: selected.account.id,
        newName: name,
        operationalRules,
      });
      setMessage({
        type: 'success',
        text: `تم إنشاء ${result.plan.account.name} وتشغيله بالكامل برصيد ابتدائي صفر.`,
      });
      setName('');
      setSourceId(null);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر إنشاء الحساب.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section dir="rtl" className="space-y-4 pb-8" aria-label="دليل الحسابات">
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c33] bg-[#c9a84c11] text-[#c9a84c]">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-[#f5f1e8]">دليل الحسابات</h2>
            <p className="mt-1 text-[11px] font-bold text-[#8a8172]">الحسابات والكيانات التشغيلية الفعلية</p>
          </div>
        </div>
        <button type="button" onClick={() => setView('more')} className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-xs font-black text-[#c9a84c]">
          <ChevronRight className="h-4 w-4" />رجوع
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3">
          <div className="text-[10px] font-bold text-[#8a8172]">إجمالي الكيانات</div>
          <div className="mt-1 text-xl font-black text-[#f5f1e8]">{rows.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="text-[10px] font-bold text-emerald-200/70">متاح للاستنساخ</div>
          <div className="mt-1 text-xl font-black text-emerald-300">{rows.filter(row => row.eligibility.allowed).length}</div>
        </div>
      </div>

      <label className="relative block">
        <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777164]" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث باسم الحساب أو التصنيف" className="min-h-12 w-full rounded-2xl border border-[#1a1e2a] bg-[#0e1018] pr-11 pl-4 text-sm outline-none focus:border-[#c9a84c66]" />
      </label>

      {message && (
        <div className={cn('rounded-2xl border p-3 text-xs font-bold leading-5', message.type === 'success' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-200')}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {hierarchy.map(group => (
          <details key={group.main} open className="overflow-hidden rounded-2xl border border-[#1a1e2a] bg-[#0e1018]">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-black text-[#f5f1e8]">
              <span>{group.main}</span>
              <ChevronDown className="h-4 w-4 text-[#c9a84c]" />
            </summary>
            <div className="space-y-3 border-t border-[#1a1e2a] p-3">
              {group.subgroups.map(subgroup => (
                <div key={`${group.main}-${subgroup.sub}`} className="rounded-xl border border-[#171a24] bg-[#080a0f] p-3">
                  <div className="mb-2 text-[10px] font-black text-[#8a8172]">{subgroup.sub}</div>
                  <div className="divide-y divide-[#171a24]">
                    {subgroup.items.map(({ account, eligibility }) => (
                      <div key={account.id ?? account.name} className="flex min-h-[68px] items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-[#ddd8cc]">{account.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                            <span className="text-[#8a8172]">{classificationLabel(account)}</span>
                            {account.isActive === false && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-300">معطل</span>}
                            {!eligibility.allowed && account.isActive !== false && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-200">محمي</span>}
                          </div>
                        </div>
                        {eligibility.allowed && (
                          <button type="button" onClick={() => { setSourceId(account.id ?? null); setName(''); setMessage(null); }} className="min-h-11 shrink-0 rounded-xl border border-[#c9a84c55] bg-[#c9a84c11] px-3 text-[11px] font-black text-[#c9a84c]">
                            إنشاء حساب مشابه
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
        {hierarchy.length === 0 && <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-6 text-center text-xs text-[#8a8172]">لا توجد نتائج مطابقة.</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="إنشاء حساب مشابه">
          <div className="w-full rounded-t-3xl border border-[#252a36] bg-[#0e1018] p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-base font-black text-[#f5f1e8]"><CopyPlus className="h-5 w-5 text-[#c9a84c]" />إنشاء حساب مشابه</div>
                <div className="mt-1 text-xs font-bold text-[#8a8172]">المصدر: {selected.account.name}</div>
              </div>
              <button type="button" disabled={busy} onClick={() => setSourceId(null)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#252a36] text-[#9b9588]" aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100">
              <div className="flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4" />إنشاء آمن</div>
              <p className="mt-1">سيتم إنشاء حساب جديد بنفس خصائص وتشغيل الحساب المحدد، ويبدأ برصيد صفر.</p>
            </div>
            <label className="mt-4 block text-xs font-black text-[#ddd8cc]">
              اسم الحساب الجديد
              <input autoFocus maxLength={120} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && name.trim()) void submit(); }} placeholder="اكتب الاسم الجديد فقط" className="mt-2 min-h-12 w-full rounded-xl border border-[#252a36] bg-[#080a0f] px-3 text-sm outline-none focus:border-[#c9a84c66]" />
            </label>
            <button type="button" disabled={busy || !name.trim()} onClick={() => void submit()} className="mt-4 min-h-12 w-full rounded-xl bg-[#c9a84c] text-sm font-black text-[#080a0f] disabled:opacity-40">
              {busy ? 'جارٍ الإنشاء والتحقق…' : 'إنشاء الحساب المشابه'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
});
