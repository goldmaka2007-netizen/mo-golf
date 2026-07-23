import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, Save, X, ArrowRightLeft } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { OperationType } from '../../types';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { CanonicalAccountsPanel } from './CanonicalAccountsPanel';

const TOP_LEVEL_CATEGORIES = [
  { id: 'assets', label: 'الأصول' },
  { id: 'liabilities', label: 'الخصوم' },
  { id: 'equity', label: 'حقوق الملكية' },
  { id: 'revenue', label: 'الإيرادات' },
  { id: 'expenses', label: 'المصروفات' }
];

export const ChartOfAccountsSettings = React.memo(() => {
  const { accountCategories, setAccountCategories, user } = useAppStore();
  const [activeTab, setActiveTab] = useState('assets');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [addingToCat, setAddingToCat] = useState<string | null>(null);
  const [movingAccount, setMovingAccount] = useState<{ name: string, fromCat: string, fromTop: string } | null>(null);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const saveToFirestore = async (newCategories: any) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'settings', user.uid), {
        accountCategories: newCategories
      });
      setAccountCategories(newCategories);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCategories = { ...accountCategories };
    const currentTabCats = { ...newCategories[activeTab as keyof typeof newCategories] };
    
    if (currentTabCats[newCatName]) {
      alert('هذا التصنيف موجود بالفعل');
      return;
    }

    currentTabCats[newCatName] = [];
    newCategories[activeTab as keyof typeof newCategories] = currentTabCats;
    
    saveToFirestore(newCategories);
    setNewCatName('');
    setExpandedCats(prev => ({ ...prev, [newCatName]: true }));
  };

  const handleDeleteCategory = (catName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف تصنيف "${catName}" وكل الحسابات بداخله؟`)) return;
    
    const newCategories = { ...accountCategories };
    const currentTabCats = { ...newCategories[activeTab as keyof typeof newCategories] };
    delete currentTabCats[catName];
    newCategories[activeTab as keyof typeof newCategories] = currentTabCats;
    
    saveToFirestore(newCategories);
  };

  const handleAddAccount = (catName: string) => {
    if (!newAccName.trim()) return;
    
    const newCategories = { ...accountCategories };
    const currentTabCats = { ...newCategories[activeTab as keyof typeof newCategories] };
    
    if (currentTabCats[catName].includes(newAccName)) {
      alert('هذا الحساب موجود بالفعل');
      return;
    }

    currentTabCats[catName] = [...currentTabCats[catName], newAccName];
    newCategories[activeTab as keyof typeof newCategories] = currentTabCats;
    
    saveToFirestore(newCategories);
    setNewAccName('');
    setAddingToCat(null);
  };

  const handleDeleteAccount = (catName: string, accName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب "${accName}"؟`)) return;
    
    const newCategories = { ...accountCategories };
    const currentTabCats = { ...newCategories[activeTab as keyof typeof newCategories] };
    currentTabCats[catName] = currentTabCats[catName].filter(a => a !== accName);
    newCategories[activeTab as keyof typeof newCategories] = currentTabCats;
    
    saveToFirestore(newCategories);
  };

  const handleMoveAccount = (targetTop: string, targetCat: string) => {
    if (!movingAccount) return;
    const { name, fromCat, fromTop } = movingAccount;

    const newCategories = { ...accountCategories };
    
    // Remove from old
    const oldTopCats = { ...newCategories[fromTop as keyof typeof newCategories] };
    oldTopCats[fromCat] = oldTopCats[fromCat].filter(a => a !== name);
    newCategories[fromTop as keyof typeof newCategories] = oldTopCats;

    // Add to new
    const newTopCats = { ...newCategories[targetTop as keyof typeof newCategories] };
    newTopCats[targetCat] = [...(newTopCats[targetCat] || []), name];
    newCategories[targetTop as keyof typeof newCategories] = newTopCats;

    saveToFirestore(newCategories);
    setMovingAccount(null);
  };

  const currentCategories = accountCategories[activeTab as keyof typeof accountCategories] || {};

  return (
    <div className="space-y-6">
      <CanonicalAccountsPanel />
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {TOP_LEVEL_CATEGORIES.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
              activeTab === tab.id 
                ? "bg-[#c9a84c] text-[#080a0f]" 
                : "bg-[#1a1e2a] text-[#5a5548] hover:text-[#ddd8cc]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-[#080a0f] rounded-2xl p-4 border border-[#1a1e2a] space-y-4">
        {/* Add Category */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="اسم التصنيف الجديد (مثال: بنوك، نقدية...)"
            className="flex-1 bg-[#0e1018] border border-[#1a1e2a] rounded-xl px-4 py-2 text-sm text-[#ddd8cc] focus:outline-none focus:border-[#c9a84c55]"
          />
          <button
            onClick={handleAddCategory}
            disabled={!newCatName.trim() || isSaving}
            className="px-4 py-2 bg-[#c9a84c] text-[#080a0f] rounded-xl text-sm font-bold disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Categories List */}
        <div className="space-y-3">
          {Object.entries(currentCategories).map(([catName, accounts]) => (
            <div key={catName} className="border border-[#1a1e2a] rounded-xl overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 bg-[#0e1018] cursor-pointer hover:bg-[#1a1e2a] transition-colors"
                onClick={() => toggleCat(catName)}
              >
                <div className="flex items-center gap-2">
                  {expandedCats[catName] ? <ChevronDown className="w-4 h-4 text-[#c9a84c]" /> : <ChevronRight className="w-4 h-4 text-[#5a5548]" />}
                  <span className="text-sm font-bold text-[#ddd8cc]">{catName}</span>
                  <span className="text-[10px] text-[#5a5548] bg-[#080a0f] px-2 py-0.5 rounded-full">
                    {accounts.length} حساب
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCategory(catName); }}
                  className="p-1.5 text-[#9e6a6a] hover:bg-[#9e6a6a22] rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <AnimatePresence>
                {expandedCats[catName] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-[#1a1e2a] bg-[#080a0f]"
                  >
                    <div className="p-3 space-y-2">
                      {accounts.map(acc => (
                        <div key={acc} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#1a1e2a] transition-colors group">
                          <span className="text-xs text-[#ddd8cc] flex-1">{acc}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => setMovingAccount({ name: acc, fromCat: catName, fromTop: activeTab })}
                              className="p-1.5 text-[#c9a84c] hover:bg-[#c9a84c22] rounded-lg transition-colors"
                              title="نقل الحساب"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(catName, acc)}
                              className="p-1.5 text-[#9e6a6a] hover:bg-[#9e6a6a22] rounded-lg transition-colors"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {addingToCat === catName ? (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={newAccName}
                            onChange={(e) => setNewAccName(e.target.value)}
                            placeholder="اسم الحساب الجديد"
                            className="flex-1 bg-[#0e1018] border border-[#1a1e2a] rounded-lg px-3 py-1.5 text-xs text-[#ddd8cc] focus:outline-none focus:border-[#c9a84c55]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddAccount(catName);
                              if (e.key === 'Escape') setAddingToCat(null);
                            }}
                          />
                          <button
                            onClick={() => handleAddAccount(catName)}
                            disabled={!newAccName.trim() || isSaving}
                            className="p-1.5 bg-[#c9a84c] text-[#080a0f] rounded-lg disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setAddingToCat(null)}
                            className="p-1.5 bg-[#1a1e2a] text-[#5a5548] rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingToCat(catName); setNewAccName(''); }}
                          className="w-full flex items-center justify-center gap-2 p-2 mt-2 border border-dashed border-[#1a1e2a] rounded-lg text-xs text-[#5a5548] hover:text-[#c9a84c] hover:border-[#c9a84c55] transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          إضافة حساب
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          
          {Object.keys(currentCategories).length === 0 && (
            <div className="text-center py-8 text-xs text-[#5a5548]">
              لا توجد تصنيفات هنا. أضف تصنيفاً جديداً للبدء.
            </div>
          )}
        </div>
      </div>

      {/* Move Account Modal */}
      <AnimatePresence>
        {movingAccount && (
          <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-[#1a1e2a] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#ddd8cc]">نقل الحساب: {movingAccount.name}</h3>
                <button onClick={() => setMovingAccount(null)} className="text-[#5a5548] hover:text-[#ddd8cc]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4 no-scrollbar">
                {TOP_LEVEL_CATEGORIES.map(top => (
                  <div key={top.id} className="space-y-2">
                    <div className="text-[10px] font-bold text-[#5a5548] uppercase tracking-wider px-2">
                      {top.label}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(accountCategories[top.id as keyof typeof accountCategories] || {}).map(cat => (
                        <button
                          key={cat}
                          onClick={() => handleMoveAccount(top.id, cat)}
                          disabled={top.id === movingAccount.fromTop && cat === movingAccount.fromCat}
                          className={cn(
                            "p-2 text-right text-xs rounded-lg border transition-all",
                            top.id === movingAccount.fromTop && cat === movingAccount.fromCat
                              ? "bg-[#1a1e2a] border-[#1a1e2a] text-[#5a5548] cursor-not-allowed"
                              : "bg-[#080a0f] border-[#1a1e2a] text-[#ddd8cc] hover:border-[#c9a84c55] hover:bg-[#1a1e2a]"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
