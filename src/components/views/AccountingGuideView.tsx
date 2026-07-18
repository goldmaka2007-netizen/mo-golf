import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, Edit2, Trash2, CheckCircle2, X, LayoutGrid, List } from 'lucide-react';
import { useAppStore } from '../../store';
import { RAW_DATA } from '../../constants';
import { doc, deleteDoc, updateDoc, writeBatch, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { cn } from '../../lib/utils';
import { AccountsTreeView } from './AccountsTreeView';
import { OperationType } from '../../types';

export const AccountingGuideView = React.memo(() => {
  const { transactionRules, accountsDb, user } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [subView, setSubView] = useState<'rules' | 'accounts'>('rules');
  const [editingRule, setEditingRule] = useState<any>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const filteredRules = useMemo(() => {
    // Combine RAW_DATA and transactionRules
    const baseRules = RAW_DATA.map((r, i) => ({
      id: `raw-${i}`,
      tx: r.t,
      debit: r.d,
      credit: r.c,
      karat: r.k,
      multiplier: r.m,
      category: 'عام',
      isRaw: true
    }));
    
    // Merge them, allowing transactionRules to override by taking precedence? 
    // Wait, the guide shows all of them. Let's just show all of them.
    let combined = [...transactionRules, ...baseRules] as any[];
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      combined = combined.filter(r => 
        (r.tx && r.tx.toLowerCase().includes(lowerSearch)) || 
        (r.debit && r.debit.toLowerCase().includes(lowerSearch)) || 
        (r.credit && r.credit.toLowerCase().includes(lowerSearch))
      );
    }
    return combined;
  }, [transactionRules, searchTerm]);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const multiplier = editingRule.karat === 18 ? 0.857142857 : editingRule.karat === 24 ? 1.142857143 : 1;
      
      const ruleData = {
        tx: editingRule.tx,
        debit: editingRule.debit,
        credit: editingRule.credit,
        karat: editingRule.karat || null,
        multiplier,
        category: editingRule.category || 'عام',
        userId: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isAddingNew || editingRule.isRaw) {
        await addDoc(collection(db, 'transactionRules'), { ...ruleData, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'transactionRules', editingRule.id), ruleData);
      }
      setEditingRule(null);
      setIsAddingNew(false);
    } catch (error) {
      handleFirestoreError(error, isAddingNew ? OperationType.CREATE : OperationType.UPDATE, 'transactionRules');
    }
  };

  const handleDeleteRule = async (r: any) => {
    if (r.isRaw) {
        alert('لا يمكن مسح قيود النظام الأساسية.');
        return;
    }
    if (!user || !window.confirm('هل أنت متأكد من مسح هذا القيد؟')) return;
    try {
      await deleteDoc(doc(db, 'transactionRules', r.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactionRules/${r.id}`);
    }
  };

  const handleAddNew = () => {
    setEditingRule({ tx: '', debit: '', credit: '', karat: null, category: 'عام' });
    setIsAddingNew(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#c9a84c22] rounded-xl">
            <BookOpen className="w-6 h-6 text-[#c9a84c]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#ddd8cc]">إدارة النظام المالي</h2>
            <p className="text-[10px] text-[#5a5548]">تعديل شجرة الحسابات والقيود المحاسبية</p>
          </div>
        </div>
        <div className="flex gap-2 bg-[#0e1018] p-1.5 rounded-2xl border border-[#1a1e2a]">
          <button 
            onClick={() => setSubView('rules')}
            className={cn("px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all", subView === 'rules' ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}
          >
            القيود
          </button>
          <button 
            onClick={() => setSubView('accounts')}
            className={cn("px-4 py-1.5 rounded-xl text-[10px] font-bold transition-all", subView === 'accounts' ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}
          >
            شجرة الحسابات
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {subView === 'rules' ? (
          <motion.div 
            key="rules"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex gap-2 bg-[#0e1018] p-2 rounded-2xl border border-[#1a1e2a]">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-[#5a5548] absolute right-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="بحث عن عملية، حساب..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent pr-9 pl-4 py-1.5 text-xs text-[#ddd8cc] outline-none"
                />
              </div>
              <button 
                onClick={handleAddNew}
                className="flex items-center gap-2 px-6 py-1.5 bg-[#c9a84c] rounded-xl text-xs font-bold text-[#080a0f] hover:bg-[#d6b96b] transition-all whitespace-nowrap active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5" /> قيد جديد
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#1a1e2a] shadow-xl bg-[#0e1018]">
              <table className="w-full text-right text-[10px] sm:text-xs">
                <thead className="bg-[#1a1e2a] text-[#c9a84c] font-bold">
                  <tr>
                    <th className="px-4 py-3 min-w-[120px] whitespace-nowrap">اسم العملية</th>
                    <th className="px-4 py-3 min-w-[100px] whitespace-nowrap">التصنيف</th>
                    <th className="px-4 py-3 min-w-[120px] whitespace-nowrap">الجانب المدين</th>
                    <th className="px-4 py-3 min-w-[120px] whitespace-nowrap">الجانب الدائن</th>
                    <th className="px-4 py-3 min-w-[60px] whitespace-nowrap">العيار</th>
                    <th className="px-4 py-3 w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1e2a]">
                  {isAddingNew && (
                    <tr className="bg-[#c9a84c0a] border-2 border-[#c9a84c33]">
                      <td className="px-4 py-3">
                        <input value={editingRule.tx} onChange={e => setEditingRule({...editingRule, tx: e.target.value})} className="w-full bg-[#080a0f] border border-[#c9a84c55] rounded px-2 py-1 outline-none text-[#ddd8cc]" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={editingRule.category} onChange={e => setEditingRule({...editingRule, category: e.target.value})} className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded px-2 py-1 outline-none text-[#5a5548]" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={editingRule.debit} onChange={e => setEditingRule({...editingRule, debit: e.target.value})} className="w-full bg-[#080a0f] border border-[#6a9e6a55] rounded px-2 py-1 outline-none text-[#6a9e6a]" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={editingRule.credit} onChange={e => setEditingRule({...editingRule, credit: e.target.value})} className="w-full bg-[#080a0f] border border-[#9e6a6a55] rounded px-2 py-1 outline-none text-[#9e6a6a]" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={editingRule.karat || ""} onChange={e => setEditingRule({...editingRule, karat: e.target.value ? parseInt(e.target.value) : null})} className="bg-[#080a0f] p-1 rounded border border-[#1a1e2a] w-full">
                          <option value="">بدون</option>
                          {[18, 21, 24].map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 flex items-center justify-center gap-2">
                        <button onClick={handleSaveRule} className="p-1.5 bg-[#6a9e6a22] text-[#6a9e6a] rounded-lg hover:bg-[#6a9e6a44]"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setIsAddingNew(false)} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"><X className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  )}
                  {filteredRules.map((r) => (
                    <tr key={r.id} className="hover:bg-[#151923] transition-colors group">
                      <td className="px-4 py-3 font-bold text-[#ddd8cc]">
                        {editingRule?.id === r.id ? <input value={editingRule.tx} onChange={e => setEditingRule({...editingRule, tx: e.target.value})} className="w-full bg-[#080a0f] border border-[#c9a84c55] rounded px-2 py-1 outline-none" /> : r.tx}
                      </td>
                      <td className="px-4 py-3 text-[#5a5548]">
                        {editingRule?.id === r.id ? <input value={editingRule.category} onChange={e => setEditingRule({...editingRule, category: e.target.value})} className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded px-2 py-1 outline-none" /> : r.category}
                      </td>
                      <td className="px-4 py-3 text-[#6a9e6a] font-bold">
                        {editingRule?.id === r.id ? <input value={editingRule.debit} onChange={e => setEditingRule({...editingRule, debit: e.target.value})} className="w-full bg-[#080a0f] border border-[#6a9e6a55] rounded px-2 py-1 outline-none" /> : r.debit}
                      </td>
                      <td className="px-4 py-3 text-[#9e6a6a] font-bold">
                        {editingRule?.id === r.id ? <input value={editingRule.credit} onChange={e => setEditingRule({...editingRule, credit: e.target.value})} className="w-full bg-[#080a0f] border border-[#9e6a6a55] rounded px-2 py-1 outline-none" /> : r.credit}
                      </td>
                      <td className="px-4 py-3">
                        {editingRule?.id === r.id ? (
                          <select value={editingRule.karat || ""} onChange={e => setEditingRule({...editingRule, karat: e.target.value ? parseInt(e.target.value) : null})} className="bg-[#080a0f] p-1 rounded border border-[#1a1e2a] w-full">
                            <option value="">بدون</option>
                            {[18, 21, 24].map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        ) : (r.karat ? `عيار ${r.karat}` : '-')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingRule?.id === r.id ? (
                            <>
                              <button onClick={handleSaveRule} className="text-[#6a9e6a]"><CheckCircle2 className="w-4 h-4" /></button>
                              <button onClick={() => setEditingRule(null)} className="text-[#5a5548]"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setEditingRule(r)} className="text-[#c9a84c]"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteRule(r)} className={cn("text-[#9e6a6a]", r.isRaw && "opacity-30 cursor-not-allowed")}><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <AccountsTreeView />
        )}
      </AnimatePresence>
    </motion.div>
  );
});
