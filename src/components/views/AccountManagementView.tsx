import React, { useMemo, useState } from 'react';
import { ChevronRight, CopyPlus, ShieldAlert } from 'lucide-react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppStore } from '../../store';
import { buildAccountClonePlan, canCloneAccount } from '../../lib/accountCloning';

const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const AccountManagementView = React.memo(() => {
  const { accountsDb, transactionRules, user, setView } = useAppStore();
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const cloneable = useMemo(
    () => accountsDb.filter(account => canCloneAccount(account).allowed).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [accountsDb],
  );
  const source = accountsDb.find(account => account.id === sourceId);

  const createClone = async () => {
    if (!user?.uid || !source || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const primaryRef = doc(collection(db, 'accounts'));
      const salesRef = source.is_inventory ? doc(collection(db, 'accounts')) : undefined;
      const costRef = source.is_inventory ? doc(collection(db, 'accounts')) : undefined;
      const plan = buildAccountClonePlan({
        source,
        newName: name,
        userId: user.uid,
        ids: { primary: primaryRef.id, sales: salesRef?.id, costOfSales: costRef?.id },
        existingAccounts: accountsDb,
        transactionRules,
      });
      const batch = writeBatch(db);
      plan.accounts.forEach(account => batch.set(doc(db, 'accounts', account.id), clean(account)));
      plan.transactionRules.forEach(rule => batch.set(doc(collection(db, 'transactionRules')), clean(rule)));
      batch.set(doc(collection(db, 'audit_logs')), {
        userId: user.uid,
        action: 'account_configuration_cloned',
        sourceAccountId: source.id,
        createdAccountIds: plan.accounts.map(account => account.id),
        clonedRuleCount: plan.transactionRules.length,
        createdAt: new Date().toISOString(),
      });
      await batch.commit();
      setMessage(source.is_inventory
        ? `تم إنشاء المخزون والمبيعات وتكلفة المبيعات لـ ${name.trim()} دون أرصدة.`
        : `تم إنشاء ${name.trim()} دون نسخ أي رصيد.`);
      setName('');
      setSourceId('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء الحساب.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 pb-8">
      <div className="flex items-center justify-between rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#c9a84c11] text-[#c9a84c]"><CopyPlus className="h-5 w-5" /></span>
          <div><h2 className="text-base font-black text-[#f5f1e8]">إدارة الحسابات</h2><p className="mt-1 text-[11px] font-bold text-[#8a8172]">إنشاء آمن بالاستنساخ فقط</p></div>
        </div>
        <button type="button" onClick={() => setView('more')} className="flex min-h-11 items-center gap-1 rounded-xl border border-[#1a1e2a] px-3 text-xs font-black text-[#c9a84c]"><ChevronRight className="h-4 w-4" />رجوع</button>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#c9a84c33] bg-[#0e1018] p-4">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
          <div className="flex items-center gap-2 font-black"><ShieldAlert className="h-4 w-4" />يُنسخ الإعداد فقط</div>
          <p className="mt-1">لا تُنسخ أرصدة أو قيود. حساب المخزون ينشئ تلقائيًا حساب مبيعات وحساب تكلفة مبيعات.</p>
        </div>

        <label className="block text-xs font-black text-[#ddd8cc]">
          الحساب النموذج
          <select value={sourceId} onChange={event => setSourceId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 outline-none">
            <option value="">اختر حسابًا مسموحًا</option>
            {cloneable.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>

        <label className="block text-xs font-black text-[#ddd8cc]">
          اسم الحساب الجديد
          <input value={name} onChange={event => setName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 outline-none" placeholder="مثال: خاتم حريمي جديد" />
        </label>

        {source && (
          <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-[11px] leading-5 text-[#9b9588]">
            <div>النوع: {source.subType}</div>
            <div>الأبعاد: {(source.dimensions ?? (source.is_inventory ? ['Weight/Quantity', 'Book Value'] : ['Cash'])).join(' + ')}</div>
            {source.is_inventory && <div className="font-bold text-[#c9a84c]">سيتم إنشاء 3 حسابات مترابطة.</div>}
          </div>
        )}

        {message && <div className="rounded-xl border border-[#c9a84c33] bg-[#c9a84c11] p-3 text-xs text-[#ddd8cc]">{message}</div>}
        <button type="button" disabled={busy || !source || !name.trim()} onClick={createClone} className="min-h-12 w-full rounded-xl bg-[#c9a84c] text-sm font-black text-[#080a0f] disabled:opacity-40">
          {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
        </button>
      </div>
    </section>
  );
});
