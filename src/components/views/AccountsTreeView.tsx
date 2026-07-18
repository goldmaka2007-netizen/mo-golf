import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, CheckCircle2, X, ChevronRight, ChevronDown, Package, Wallet, Scale, TrendingUp, TrendingDown, Users, Coins } from 'lucide-react';
import { useAppStore } from '../../store';
import { Account, OperationType, AccountNature } from '../../types';
import { doc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { cn } from '../../lib/utils';
import { getDynamicAccountNature } from '../../utils/accountLogic';
import { FormInput } from '../ui/FormInput';

export const AccountsTreeView = React.memo(() => {
  const { accountsDb, user } = useAppStore();
  const [editingAcc, setEditingAcc] = useState<any>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [groupMode, setGroupMode] = useState<'nature' | 'accounting'>('nature');

  const groupedAccounts = useMemo(() => {
    if (groupMode === 'nature') {
        // Strict order: Gold, Silver, Cash
        const order = ['ذهب', 'فضة', 'نقدية', 'أخرى'];
        const groups: Record<string, Record<string, Account[]>> = {
          'ذهب': {},
          'فضة': {},
          'نقدية': {},
          'أخرى': {}
        };
        accountsDb.forEach(acc => {
            const nature = getDynamicAccountNature(acc.name, accountsDb);
            const sub = acc.mainType;

            const addToCat = (cat: string) => {
                if (!groups[cat][sub]) groups[cat][sub] = [];
                groups[cat][sub].push(acc);
            };

            if (nature === AccountNature.GOLD) {
                addToCat('ذهب');
            } else if (nature === AccountNature.SILVER) {
                addToCat('فضة');
            } else if (nature === AccountNature.CASH) {
                addToCat('نقدية');
            } else if (nature === AccountNature.MIXED_GOLD) {
                addToCat('ذهب');
                addToCat('نقدية');
            } else if (nature === AccountNature.MIXED_SILVER) {
                addToCat('فضة');
                addToCat('نقدية');
            } else {
                addToCat('أخرى');
            }
        });
        return groups;
    }

    const groups: Record<string, Record<string, Account[]>> = {
      'اصول': {},
      'خصوم': {},
      'حقوق ملكية': {},
      'ايرادات': {},
      'مصروفات': {}
    };

    accountsDb.forEach(acc => {
      const main = acc.mainType;
      const sub = acc.subType;
      if (!groups[main]) groups[main] = {};
      if (!groups[main][sub]) groups[main][sub] = [];
      groups[main][sub].push(acc);
    });

    return groups;
  }, [accountsDb, groupMode]);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleSaveAcc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const data = {
        name: editingAcc.name,
        mainType: editingAcc.mainType,
        subType: editingAcc.subType,
        balanceNature: editingAcc.balanceNature,
        userId: user.uid,
        updatedAt: serverTimestamp()
      };

      if (isAddingNew) {
        await addDoc(collection(db, 'accounts'), { ...data, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'accounts', editingAcc.id), data);
      }
      setEditingAcc(null);
      setIsAddingNew(false);
    } catch (error) {
      handleFirestoreError(error, isAddingNew ? OperationType.CREATE : OperationType.UPDATE, 'accounts');
    }
  };

  const handleDeleteAcc = async (id: string) => {
    if (!user || !window.confirm('هل أنت متأكد من مسح هذا الحساب؟ فكر جيداً، قد يكون له قيود مرتبطة.')) return;
    try {
      await deleteDoc(doc(db, 'accounts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `accounts/${id}`);
    }
  };

  const handleAddNew = (main?: string, sub?: string) => {
    let balanceNature = 'جنية مصري';
    let mainType = main || 'اصول';
    let subType = sub || 'عام';

    if (groupMode === 'nature') {
        if (main === 'ذهب') balanceNature = 'جرام ذهب';
        else if (main === 'فضة') balanceNature = 'جرام فضة';
        else balanceNature = 'جنية مصري';
        mainType = sub || 'اصول'; // In nature mode, 'sub' was passed as mainType
        subType = 'عام';
    }

    setEditingAcc({ name: '', mainType, subType, balanceNature });
    setIsAddingNew(true);
  };

  const getMainIcon = (key: string) => {
    switch (key) {
        case 'ذهب': return <Scale className="w-4 h-4 text-[#c9a84c]" />;
        case 'فضة': return <Coins className="w-4 h-4 text-[#6a8a9e]" />;
        case 'نقدية': return <Wallet className="w-4 h-4 text-[#6a9e6a]" />;
        case 'اصول': return <Wallet className="w-4 h-4 text-[#ddd8cc]" />;
        case 'خصوم': return <Users className="w-4 h-4 text-[#ddd8cc]" />;
        case 'حقوق ملكية': return <Scale className="w-4 h-4 text-[#ddd8cc]" />;
        case 'ايرادات': return <TrendingUp className="w-4 h-4 text-[#ddd8cc]" />;
        case 'مصروفات': return <TrendingDown className="w-4 h-4 text-[#ddd8cc]" />;
        default: return <Package className="w-4 h-4 text-[#ddd8cc]" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 bg-[#0e1018] p-4 rounded-2xl border border-[#1a1e2a]">
        <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#c9a84c]">شجرة الحسابات (الدليل)</h3>
            <button 
            onClick={() => handleAddNew()}
            className="p-2 bg-[#c9a84c22] text-[#c9a84c] rounded-xl hover:bg-[#c9a84c33] transition-all"
            >
            <Plus className="w-4 h-4" />
            </button>
        </div>
        
        <div className="flex p-1 bg-[#080a0f] border border-[#1a1e2a] rounded-xl">
            <button 
                onClick={() => setGroupMode('nature')}
                className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all", groupMode === 'nature' ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}
            >
                تصنيف (ذهب/فضة/كاش)
            </button>
            <button 
                onClick={() => setGroupMode('accounting')}
                className={cn("flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all", groupMode === 'accounting' ? "bg-[#c9a84c] text-[#080a0f]" : "text-[#5a5548]")}
            >
                التصنيف المحاسبي
            </button>
        </div>
      </div>

      <div className="space-y-3">
        {(groupMode === 'nature' ? ['ذهب', 'فضة', 'نقدية', 'أخرى'] : ['اصول', 'خصوم', 'حقوق ملكية', 'ايرادات', 'مصروفات']).map(main => {
          const subs = (groupedAccounts as any)[main];
          if (!subs || Object.keys(subs).length === 0) return null;

          return (
            <div key={main} className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl overflow-hidden">
            <button 
              onClick={() => toggleCat(main)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#1a1e2a] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="text-[#c9a84c]">{getMainIcon(main)}</div>
                <span className={cn(
                    "font-bold",
                    main === 'ذهب' ? "text-[#c9a84c]" : 
                    main === 'فضة' ? "text-[#6a8a9e]" : 
                    main === 'نقدية' ? "text-[#6a9e6a]" : "text-[#ddd8cc]"
                )}>{main}</span>
              </div>
              {expandedCats.includes(main) ? <ChevronDown className="w-4 h-4 text-[#5a5548]" /> : <ChevronRight className="w-4 h-4 text-[#5a5548]" />}
            </button>

            <AnimatePresence>
              {expandedCats.includes(main) && (
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-[#1a1e2a]"
                >
                  <div className="p-2 space-y-2">
                    {(Object.entries(subs) as [string, Account[]][]).map(([sub, accs]) => (
                      <div key={sub} className="bg-[#080a0f] p-3 rounded-xl space-y-2 border border-[#1a1e2a88]">
                        <div className="flex justify-between items-center text-[10px] text-[#5a5548] font-bold uppercase tracking-widest border-b border-[#1a1e2a] pb-1">
                          <div className="flex items-center gap-1.5">
                            {getMainIcon(sub)}
                            <span>{sub}</span>
                          </div>
                          <button onClick={() => handleAddNew(main, sub)} className="hover:text-[#c9a84c] bg-[#1a1e2a] p-1 rounded-md transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {accs.map(acc => (
                            <div key={acc.id} className="group flex items-center justify-between p-2 bg-[#0e1018] border border-[#1a1e2a] rounded-lg hover:border-[#c9a84c55] transition-all">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[#ddd8cc]">{acc.name}</span>
                                    {(getDynamicAccountNature(acc.name, accountsDb) === AccountNature.GOLD || getDynamicAccountNature(acc.name, accountsDb) === AccountNature.MIXED_GOLD) && <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" title="ذهب" />}
                                    {(getDynamicAccountNature(acc.name, accountsDb) === AccountNature.SILVER || getDynamicAccountNature(acc.name, accountsDb) === AccountNature.MIXED_SILVER) && <div className="w-1.5 h-1.5 rounded-full bg-[#6a8a9e]" title="فضة" />}
                                    {(getDynamicAccountNature(acc.name, accountsDb) === AccountNature.CASH || getDynamicAccountNature(acc.name, accountsDb) === AccountNature.MIXED_GOLD || getDynamicAccountNature(acc.name, accountsDb) === AccountNature.MIXED_SILVER) && <div className="w-1.5 h-1.5 rounded-full bg-[#6a9e6a]" title="نقدية" />}
                                </div>
                                <span className="text-[9px] text-[#5a5548]">{acc.balanceNature}</span>
                              </div>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingAcc(acc)} className="text-[#c9a84c] hover:scale-110"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeleteAcc(acc.id!)} className="text-red-400 hover:scale-110"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>

    {/* Account Edit Modal/Overlay */}
      <AnimatePresence>
        {(isAddingNew || editingAcc) && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-[#080a0fcc] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <h4 className="text-lg font-bold text-[#c9a84c]">{isAddingNew ? 'إضافة حساب جديد' : 'تعديل حساب'}</h4>
              <div className="space-y-4">
                <FormInput 
                  label="اسم الحساب"
                  value={editingAcc?.name || ''} 
                  onChangeValue={v => setEditingAcc({...editingAcc, name: v})}
                  placeholder="أدخل اسم الحساب..."
                  labelClassName="text-xs"
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-[#5a5548] font-black uppercase block">النوع الرئيسي</label>
                    <select 
                      value={editingAcc?.mainType || ''} 
                      onChange={e => setEditingAcc({...editingAcc, mainType: e.target.value})}
                      className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55] transition-all"
                    >
                      <option value="اصول">اصول</option>
                      <option value="خصوم">خصوم</option>
                      <option value="حقوق ملكية">حقوق ملكية</option>
                      <option value="ايرادات">ايرادات</option>
                      <option value="مصروفات">مصروفات</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-[#5a5548] font-black uppercase block">طبيعة الرصيد</label>
                    <select 
                      value={editingAcc?.balanceNature || ''} 
                      onChange={e => setEditingAcc({...editingAcc, balanceNature: e.target.value})}
                      className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55] transition-all"
                    >
                      <option value="جنية مصري">جنية مصري</option>
                      <option value="جرام ذهب">جرام ذهب</option>
                      <option value="جرام فضة">جرام فضة</option>
                      <option value="قطعة">قطعة</option>
                      <option value="مختلط (ذهب + نقدي)">مختلط (ذهب + نقدي)</option>
                      <option value="مختلط (فضة + نقدي)">مختلط (فضة + نقدي)</option>
                    </select>
                  </div>
                </div>
                
                <FormInput 
                  label="التصنيف الفرعي"
                  value={editingAcc?.subType || ''} 
                  onChangeValue={v => setEditingAcc({...editingAcc, subType: v})}
                  placeholder="مثال: متداول، ثابت، عام..."
                  labelClassName="text-xs"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={handleSaveAcc}
                  className="flex-1 py-3 bg-[#c9a84c] text-[#080a0f] font-bold rounded-xl hover:bg-[#d6b96b]"
                >
                  حفظ
                </button>
                <button 
                  onClick={() => { setIsAddingNew(false); setEditingAcc(null); }}
                  className="flex-1 py-3 bg-[#1a1e2a] text-[#5a5548] font-bold rounded-xl hover:text-[#ddd8cc]"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
