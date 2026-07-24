import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseZap, GitCompareArrows, Search, ShieldCheck } from 'lucide-react';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppStore } from '../../store';
import { AccountTrackingDimension, CanonicalAccountDefinition, CanonicalAccountType, CanonicalMainGroup } from '../../types';
import { buildAccountRegistry, canApproveRegistry, discoverAccounts, validateCanonicalAccount } from '../../lib/accountRegistry';
import { buildMigrationPatch, planAccountIdMigration } from '../../lib/accountMigration';
import { buildParityReport } from '../../lib/shadowAccounting';
import { cn } from '../../lib/utils';
import { areOperationWritesLocked } from '../../lib/costRecalculation';

type Tab = 'registry' | 'discovered' | 'aliases' | 'migration' | 'parity';
const tabLabels: Record<Tab, string> = { registry: 'دليل الحسابات', discovered: 'الحسابات المكتشفة', aliases: 'Aliases الغامضة', migration: 'Migration', parity: 'Parity Report' };
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const CanonicalAccountsPanel = React.memo(() => {
  const { accountsDb, entries, canonicalAccounts, user, costCalculationRun } = useAppStore();
  const [tab, setTab] = useState<Tab>('registry');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; displayName: string; description: string; aliases: string } | null>(null);
  const [draft, setDraft] = useState<{ name: string; group: CanonicalMainGroup; type: CanonicalAccountType; dimensions: AccountTrackingDimension[]; metal: CanonicalAccountDefinition['metal']; karat: CanonicalAccountDefinition['karat']; inventory: boolean; merchant: boolean }>({ name: '', group: 'assets', type: 'other', dimensions: ['cash'], metal: null, karat: null, inventory: false, merchant: false });
  const registry = useMemo(() => buildAccountRegistry(accountsDb, entries, canonicalAccounts), [accountsDb, entries, canonicalAccounts]);
  const discovered = useMemo(() => discoverAccounts(accountsDb, entries, canonicalAccounts), [accountsDb, entries, canonicalAccounts]);
  const migration = useMemo(() => planAccountIdMigration(entries, registry), [entries, registry]);
  const parity = useMemo(() => buildParityReport(entries, accountsDb, registry), [entries, accountsDb, registry]);
  const approval = useMemo(() => canApproveRegistry(registry, entries), [registry, entries]);
  const filtered = registry.accounts.filter(account => !search || `${account.displayName} ${account.canonicalName} ${account.entityType}`.toLocaleLowerCase('ar-EG').includes(search.toLocaleLowerCase('ar-EG')));

  const persistDefinition = async (definition: CanonicalAccountDefinition, reason: string) => {
    if (!user?.uid) return;
    setBusy(true); setMessage('');
    try {
      const timestamp = new Date().toISOString();
      const errors = validateCanonicalAccount(definition);
      if (errors.length) throw new Error(errors.join(' — '));
      const next: CanonicalAccountDefinition = {
        ...definition, userId: user.uid, reviewStatus: 'reviewed', approvalStatus: 'approved', approvedAt: timestamp,
        updatedAt: timestamp, version: definition.version + 1, classificationSource: 'manual', classificationConfidence: 1,
        classificationEvidence: [...definition.classificationEvidence, { source: 'manual', rule: reason, value: user.uid }],
        audit: { ...definition.audit, updatedBy: user.uid, lastReason: reason },
      };
      await setDoc(doc(db, 'canonicalAccounts', next.id), clean(next));
      await setDoc(doc(collection(db, 'audit_logs')), clean({ userId: user.uid, action: 'canonical_account_approved', accountId: next.id, reason, beforeVersion: definition.version, afterVersion: next.version, createdAt: timestamp }));
      setMessage(`تم اعتماد ${next.displayName}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حفظ الحساب.'); }
    finally { setBusy(false); }
  };

  const runMigration = async () => {
    if (areOperationWritesLocked(costCalculationRun)) {
      setMessage('لا يمكن تعديل العمليات أثناء تشغيل أو فشل إعادة احتساب التكلفة.');
      return;
    }
    if (!user?.uid || migration.blocked || !migration.ready) return;
    if (!window.confirm(`سيتم ربط ${migration.ready} حركة بـIDs ثابتة مع الاحتفاظ بالأسماء القديمة. متابعة؟`)) return;
    setBusy(true); setMessage('');
    try {
      const ready = migration.plans.filter(plan => plan.canMigrate && plan.changed && plan.entry.id);
      for (let offset = 0; offset < ready.length; offset += 400) {
        const batch = writeBatch(db);
        ready.slice(offset, offset + 400).forEach(plan => batch.update(doc(db, 'entries', plan.entry.id!), clean(buildMigrationPatch(plan))));
        await batch.commit();
      }
      await setDoc(doc(collection(db, 'audit_logs')), { userId: user.uid, action: 'account_id_migration', migrationVersion: migration.migrationVersion, migratedEntries: ready.length, createdAt: new Date().toISOString() });
      setMessage(`اكتمل ربط ${ready.length} حركة دون تغيير debit/credit التاريخية.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'فشل تنفيذ Migration.'); }
    finally { setBusy(false); }
  };

  const approveRegistry = async () => {
    if (!user?.uid || !approval.allowed || parity.open) return;
    setBusy(true); setMessage('');
    try {
      const timestamp = new Date().toISOString();
      await setDoc(doc(db, 'settings', user.uid), { canonicalRegistryApproval: { status: 'approved', approvedAt: timestamp, approvedBy: user.uid, accountCount: registry.accounts.length, version: Math.max(...registry.accounts.map(account => account.version), 1) } }, { merge: true });
      await setDoc(doc(collection(db, 'audit_logs')), { userId: user.uid, action: 'canonical_registry_approved', accountCount: registry.accounts.length, createdAt: timestamp });
      setMessage('تم اعتماد دليل الحسابات للمسار الجديد. النظام القديم ما زال هو المسار التشغيلي.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر اعتماد الدليل.'); }
    finally { setBusy(false); }
  };

  const createDefinition = async () => {
    if (!user?.uid || !draft.name.trim() || !draft.dimensions.length) return;
    const timestamp = new Date().toISOString();
    const balance: 'debit' | 'credit' = ['liabilities', 'equity', 'revenue'].includes(draft.group) ? 'credit' : 'debit';
    const definition: CanonicalAccountDefinition = {
      id: `manual:${Date.now()}`, entityId: `manual:${Date.now()}`, userId: user.uid,
      canonicalName: draft.name.trim(), displayName: draft.name.trim(), legacyNames: [], aliases: [draft.name.trim()],
      entityType: draft.type, mainGroup: draft.group, allowedDimensions: draft.dimensions,
      normalBalanceByDimension: { cash: draft.dimensions.includes('cash') ? balance : null, gold: draft.dimensions.includes('gold') ? balance : null, silver: draft.dimensions.includes('silver') ? balance : null, quantity: draft.dimensions.includes('quantity') ? balance : null },
      metal: draft.metal, karat: draft.metal === 'gold' ? draft.karat : null,
      trackingMode: draft.dimensions.includes('quantity') && draft.dimensions.some(item => item === 'gold' || item === 'silver') ? 'weight_and_quantity' : draft.dimensions.includes('quantity') ? 'quantity' : draft.dimensions.some(item => item === 'gold' || item === 'silver') ? 'weight' : 'value',
      tracksCash: draft.dimensions.includes('cash'), tracksGold: draft.dimensions.includes('gold'), tracksSilver: draft.dimensions.includes('silver'), tracksQuantity: draft.dimensions.includes('quantity'), tracksWeight: draft.dimensions.includes('gold') || draft.dimensions.includes('silver'), tracksValue: draft.dimensions.includes('cash'), tracksCost: draft.inventory,
      isInventory: draft.inventory, isMerchant: draft.merchant, isHistoricalOnly: false, isActive: true,
      reportParticipation: [...new Set([...(draft.group === 'revenue' || draft.group === 'expenses' ? ['incomeStatement' as const] : []), ...(draft.group === 'equity' ? ['equityStatement' as const, 'financialPosition' as const] : draft.group === 'assets' || draft.group === 'liabilities' ? ['financialPosition' as const] : []), ...(draft.inventory ? ['inventoryReports' as const] : [])])],
      allowedOperationKinds: ['opening', 'purchase', 'sale', 'transfer', 'tifeet', 'adjustment', 'merchant_settlement', 'personal_withdrawal', 'expense', 'other'],
      classificationSource: 'manual', classificationConfidence: 1, classificationEvidence: [{ source: 'manual', rule: 'إنشاء حساب من دليل الحسابات' }], classificationConflicts: [], reviewStatus: 'reviewed', approvalStatus: 'draft',
      createdAt: timestamp, updatedAt: timestamp, version: 1, audit: { createdBy: user.uid, updatedBy: user.uid },
    };
    definition.entityId = definition.id;
    await persistDefinition(definition, 'إنشاء حساب يدوي مكتمل البيانات');
    setShowCreate(false);
    setDraft({ name: '', group: 'assets', type: 'other', dimensions: ['cash'], metal: null, karat: null, inventory: false, merchant: false });
  };

  return <section className="space-y-4 rounded-3xl border border-[#c9a84c33] bg-[#0b0e15] p-4">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-black text-[#c9a84c]"><ShieldCheck className="h-5 w-5" />دليل الحسابات المركزي — Shadow Mode</h3><p className="mt-1 text-[11px] text-[#8d887b]">المسار القديم مستمر؛ النتائج الجديدة للمراجعة والمقارنة فقط.</p></div>
      <button disabled={busy || !approval.allowed || parity.open > 0} onClick={approveRegistry} className="min-h-11 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">اعتماد دليل الحسابات</button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {[['الحسابات', registry.accounts.length], ['تحتاج مراجعة', registry.accounts.filter(a => a.reviewStatus !== 'reviewed').length], ['Alias غامض', registry.ambiguousAliases.size], ['Migration معطل', migration.blocked], ['فروق Parity', parity.open]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><div className="text-[10px] text-[#777164]">{label}</div><div className="mt-1 text-lg font-black text-[#ddd8cc]">{value}</div></div>)}
    </div>
    {(approval.reasons.length > 0 || parity.open > 0) && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-100"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />الاعتماد النهائي متوقف</div><div className="mt-1">{[...approval.reasons, ...(parity.open ? [`${parity.open} فرق غير مفسر في Parity`] : [])].join(' — ')}</div></div>}
    <div className="flex gap-2 overflow-x-auto pb-1">{(Object.keys(tabLabels) as Tab[]).map(item => <button key={item} onClick={() => setTab(item)} className={cn('whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-bold', tab === item ? 'bg-[#c9a84c] text-[#080a0f]' : 'bg-[#1a1e2a] text-[#8d887b]')}>{tabLabels[item]}</button>)}</div>
    {message && <div className="rounded-xl border border-[#c9a84c33] bg-[#c9a84c11] p-3 text-xs text-[#ddd8cc]">{message}</div>}

    {tab === 'registry' && <div className="space-y-3">
      {registry.accounts.length === 0 && <div className="space-y-3 rounded-xl border border-dashed border-[#c9a84c55] bg-[#080a0f] p-5 text-center"><p className="text-sm font-black text-[#f5f1e8]">لا توجد حسابات مركزية محفوظة بعد</p><p className="text-[11px] leading-5 text-[#8a8172]">ابدأ باكتشاف الحسابات من الحسابات والحركات الحالية، أو أضف حسابًا مركزيًا جديدًا.</p><button type="button" onClick={() => { setTab('discovered'); setMessage('تم فحص الحسابات والحركات الحالية. راجع النتائج المكتشفة أدناه.'); }} className="min-h-11 rounded-xl bg-[#c9a84c] px-4 text-xs font-black text-[#080a0f]">تهيئة / اكتشاف الحسابات</button></div>}
      <button onClick={() => setShowCreate(value => !value)} className="w-full rounded-xl border border-dashed border-[#c9a84c66] py-3 text-xs font-bold text-[#c9a84c]">{showCreate ? 'إغلاق نموذج الحساب' : 'إضافة حساب مركزي جديد'}</button>
      {showCreate && <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-xs">
        <input value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} placeholder="اسم الحساب" className="col-span-2 rounded-lg border border-[#1a1e2a] bg-[#0e1018] p-3 outline-none" />
        <select value={draft.group} onChange={event => setDraft(value => ({ ...value, group: event.target.value as CanonicalMainGroup }))} className="rounded-lg border border-[#1a1e2a] bg-[#0e1018] p-3"><option value="assets">الأصول</option><option value="liabilities">الخصوم</option><option value="equity">حقوق الملكية</option><option value="revenue">الإيرادات</option><option value="expenses">المصروفات</option></select>
        <select value={draft.type} onChange={event => setDraft(value => ({ ...value, type: event.target.value as CanonicalAccountType }))} className="rounded-lg border border-[#1a1e2a] bg-[#0e1018] p-3"><option value="other">أخرى</option><option value="cash">نقدية</option><option value="gold_inventory">مخزون ذهب</option><option value="silver_inventory">مخزون فضة</option><option value="accessory_inventory">مخزون ملحقات</option><option value="merchant">تاجر</option><option value="customer">عميل</option><option value="capital">رأس مال</option><option value="revenue">إيراد</option><option value="expense">مصروف</option><option value="fixed_asset">أصل ثابت</option><option value="adjustment">تسوية</option></select>
        <div className="col-span-2 flex flex-wrap gap-2">{(['cash', 'gold', 'silver', 'quantity'] as AccountTrackingDimension[]).map(dimension => <label key={dimension} className="flex items-center gap-1 rounded-lg bg-[#151925] px-2 py-2"><input type="checkbox" checked={draft.dimensions.includes(dimension)} onChange={() => setDraft(value => ({ ...value, dimensions: value.dimensions.includes(dimension) ? value.dimensions.filter(item => item !== dimension) : [...value.dimensions, dimension] }))} />{dimension}</label>)}</div>
        <select value={draft.metal ?? ''} onChange={event => setDraft(value => ({ ...value, metal: (event.target.value || null) as CanonicalAccountDefinition['metal'] }))} className="rounded-lg border border-[#1a1e2a] bg-[#0e1018] p-3"><option value="">بدون معدن</option><option value="gold">ذهب</option><option value="silver">فضة</option><option value="accessory">ملحقات</option></select>
        <select value={draft.karat ?? ''} disabled={draft.metal !== 'gold'} onChange={event => setDraft(value => ({ ...value, karat: event.target.value ? Number(event.target.value) as 18 | 21 | 24 : null }))} className="rounded-lg border border-[#1a1e2a] bg-[#0e1018] p-3 disabled:opacity-40"><option value="">العيار</option><option value="18">18</option><option value="21">21</option><option value="24">24</option></select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.inventory} onChange={event => setDraft(value => ({ ...value, inventory: event.target.checked }))} />مخزون</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.merchant} onChange={event => setDraft(value => ({ ...value, merchant: event.target.checked }))} />تاجر</label>
        <button disabled={busy || !draft.name.trim() || !draft.dimensions.length} onClick={createDefinition} className="col-span-2 rounded-lg bg-[#c9a84c] py-3 font-bold text-[#080a0f] disabled:opacity-40">حفظ واعتماد الحساب</button>
      </div>}
      <label className="flex items-center gap-2 rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3"><Search className="h-4 w-4 text-[#777164]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالاسم أو النوع" className="w-full bg-transparent py-3 text-xs outline-none" /></label>
      <div className="max-h-[460px] space-y-2 overflow-y-auto">{filtered.map(account => { const errors = validateCanonicalAccount(account); const isEditing = editing?.id === account.id; return <div key={account.id} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-bold text-[#ddd8cc]">{account.displayName}</div><div className="mt-1 text-[10px] text-[#777164]">{account.entityType} · {account.mainGroup} · {account.allowedDimensions.join(' + ') || 'بلا أبعاد'} · ثقة {Math.round(account.classificationConfidence * 100)}%</div></div><span className={cn('rounded-full px-2 py-1 text-[9px] font-bold', account.approvalStatus === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200')}>{account.approvalStatus === 'approved' ? 'معتمد' : account.reviewStatus === 'discovered' ? 'مكتشف' : 'مسودة'}</span></div>{errors.length > 0 && <div className="mt-2 text-[10px] text-red-300">{errors.join(' — ')}</div>}<div className="mt-3 flex gap-2">{account.approvalStatus !== 'approved' && <button disabled={busy || errors.length > 0} onClick={() => persistDefinition(account, 'مراجعة واعتماد التصنيف المستخرج من النظام القديم')} className="rounded-lg bg-[#c9a84c] px-3 py-2 text-[10px] font-bold text-[#080a0f] disabled:opacity-40">مراجعة واعتماد</button>}<button onClick={() => setEditing(isEditing ? null : { id: account.id, displayName: account.displayName, description: account.description || '', aliases: account.aliases.join('، ') })} className="rounded-lg border border-[#1a1e2a] px-3 py-2 text-[10px] text-[#ddd8cc]">{isEditing ? 'إلغاء' : 'تعديل البيانات البسيطة'}</button></div>{isEditing && editing && <div className="mt-3 grid gap-2 rounded-lg border border-[#1a1e2a] p-2"><input value={editing.displayName} onChange={event => setEditing(value => value ? { ...value, displayName: event.target.value } : value)} placeholder="اسم العرض" className="rounded-lg bg-[#0e1018] p-2 text-xs" /><input value={editing.description} onChange={event => setEditing(value => value ? { ...value, description: event.target.value } : value)} placeholder="الوصف" className="rounded-lg bg-[#0e1018] p-2 text-xs" /><input value={editing.aliases} onChange={event => setEditing(value => value ? { ...value, aliases: event.target.value } : value)} placeholder="Aliases مفصولة بفاصلة" className="rounded-lg bg-[#0e1018] p-2 text-xs" /><button disabled={busy || !editing.displayName.trim()} onClick={async () => { await persistDefinition({ ...account, displayName: editing.displayName.trim(), description: editing.description.trim(), aliases: editing.aliases.split(/[،,]/).map(item => item.trim()).filter(Boolean) }, 'تعديل displayName/description/aliases مع قفل الحقول الجوهرية'); setEditing(null); }} className="rounded-lg bg-blue-600 py-2 text-[10px] font-bold text-white">حفظ التعديل</button><p className="text-[9px] text-amber-200">النوع والمجموعة والمعدن والأبعاد وطبيعة الرصيد مقفلة بعد الاعتماد. تصحيحها يحتاج Advanced Correction Mode لاحقًا.</p></div>}</div>; })}</div>
    </div>}

    {tab === 'discovered' && <div className="space-y-2">{discovered.length === 0 ? <Empty text="لا توجد حسابات تاريخية غير محفوظة." /> : discovered.map(item => <details key={item.discoveryId} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><summary className="cursor-pointer text-xs font-bold text-[#ddd8cc]">{item.name} — مدين {item.debitCount} / دائن {item.creditCount}</summary><div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-[#9b9588]"><span>النقدية: {item.cashTotal}</span><span>الذهب: {item.goldTotal.toFixed(2)}</span><span>الفضة: {item.silverTotal.toFixed(2)}</span><span>العدد: {item.quantityTotal}</span><span>أول حركة: {item.firstDate || '-'}</span><span>آخر حركة: {item.lastDate || '-'}</span><span className="col-span-2">المقابل: {item.counterparties.map(row => `${row.name} (${row.count})`).join('، ') || '-'}</span><span className="col-span-2">الاقتراح: {item.proposedAccount.entityType} / {item.proposedAccount.allowedDimensions.join(' + ')} / ثقة {Math.round(item.proposedAccount.classificationConfidence * 100)}%</span></div><button disabled={busy} onClick={() => persistDefinition({ ...item.proposedAccount, reviewStatus: 'reviewed' }, 'اعتماد حساب مكتشف من الحركات التاريخية')} className="mt-3 rounded-lg bg-[#c9a84c] px-3 py-2 text-[10px] font-bold text-[#080a0f]">اعتماد الاقتراح</button></details>)}</div>}
    {tab === 'aliases' && <div className="space-y-2">{registry.ambiguousAliases.size === 0 ? <Empty text="لا توجد Aliases غامضة." /> : [...registry.ambiguousAliases].map(([alias, candidates]) => <div key={alias} className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs"><div className="font-bold text-red-200">{alias}</div><div className="mt-1 text-[10px] text-red-100/80">{candidates.map(item => item.displayName).join('، ')}</div></div>)}</div>}
    {tab === 'migration' && <div className="space-y-3"><div className="grid grid-cols-2 gap-2 text-xs"><Metric label="جاهز" value={migration.ready} /><Metric label="مربوط مسبقًا" value={migration.alreadyMigrated} /><Metric label="مجهول" value={migration.unknownSides} /><Metric label="غامض" value={migration.ambiguousSides} /></div><button disabled={busy || migration.blocked > 0 || migration.ready === 0} onClick={runMigration} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white disabled:opacity-40"><DatabaseZap className="h-4 w-4" />تنفيذ الربط الآمن</button>{migration.blocked > 0 && <p className="text-[10px] text-amber-200">لن يبدأ التنفيذ قبل حل كل الأطراف المجهولة والغامضة. لا يوجد fuzzy matching.</p>}</div>}
    {tab === 'parity' && <div className="space-y-2"><div className="flex items-center gap-2 text-xs text-[#ddd8cc]"><GitCompareArrows className="h-4 w-4 text-[#c9a84c]" />متطابق {parity.matched} من {parity.total}</div>{parity.rows.filter(row => row.requiresReview).slice(0, 100).map(row => <details key={row.operationId} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><summary className="cursor-pointer text-[11px] font-bold text-amber-100">#{row.operationId} · {row.operationKind} · {row.severity}</summary><div className="mt-2 space-y-1 text-[10px] text-amber-50/80">{row.differences.map((difference, index) => <div key={`${difference.type}-${index}`}>{difference.reason}: {String(difference.legacyValue ?? '-')} ←→ {String(difference.canonicalValue ?? '-')}</div>)}</div></details>)}{parity.open === 0 && <Empty text="كل نتائج Shadow مطابقة للنظام القديم." />}</div>}
  </section>;
});

const Metric = ({ label, value }: { label: string; value: number }) => <div className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3"><span className="text-[#777164]">{label}</span><strong className="float-left text-[#ddd8cc]">{value}</strong></div>;
const Empty = ({ text }: { text: string }) => <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#1a1e2a] p-6 text-xs text-[#777164]"><CheckCircle2 className="h-4 w-4" />{text}</div>;
