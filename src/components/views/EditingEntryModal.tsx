import React from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Save, BarChart3, Printer } from 'lucide-react';
import { Entry } from '../../types';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { normalizeNumerals, calculateArabicWeight } from '../../lib/accounting';
import { FormInput } from '../ui/FormInput';
import { buildGoldEquivalent21Audit, canCalculateGoldEquivalent21, inferGoldKaratFromMultiplier } from '../../lib/goldEquivalent';
import { isGoldEquivalentEntry } from '../../utils/accountLogic';
import { AccountSearchSelect } from '../ui/AccountSearchSelect';
import { isMerchantReceiptEntry, resolveMerchantReceiptMetal } from '../../lib/merchantInvoiceValuation';

interface EditingEntryModalProps {
  editingEntry: Partial<Entry> | null;
  setEditingEntry: (e: Partial<Entry> | null) => void;
  handleUpdate: (e: React.FormEvent) => void;
  handleDelete: (id: string) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  isUpdating?: boolean;
}

export const EditingEntryModal = ({
  editingEntry,
  setEditingEntry,
  handleUpdate,
  handleDelete,
  deleteConfirmId,
  setDeleteConfirmId,
  isUpdating
}: EditingEntryModalProps) => {
  const { accounts, accountsDb, goldPrice, silverPrice } = useAppStore();

  React.useEffect(() => {
    if (editingEntry && editingEntry.tx) {
      const tx = editingEntry.tx;
      let basePrice = 0;
      let mult = editingEntry.multiplier || 1;
      
      const merchantMetal = resolveMerchantReceiptMetal(editingEntry as Entry, accountsDb);
      const merchantReceipt = isMerchantReceiptEntry(editingEntry as Entry);
      const isGold = merchantMetal === 'gold' || (!merchantMetal && (tx.includes('ذهب') || (editingEntry.debit || '').includes('ذهب') || (editingEntry.credit || '').includes('ذهب')));
      const isSilver = merchantMetal === 'silver' || (!merchantMetal && (tx.includes('فضة') || (editingEntry.debit || '').includes('فضة') || (editingEntry.credit || '').includes('فضة')));

      if (isSilver) {
        basePrice = silverPrice || 0;
        mult = 1;
      } else if (isGold) {
        basePrice = goldPrice || 0;
      }
      
      if (basePrice > 0) {
        const displayedPrice = merchantReceipt ? basePrice : Math.round(basePrice * mult);
        if (!editingEntry.marketPrice || editingEntry.marketPrice === goldPrice || editingEntry.marketPrice === silverPrice) {
           setEditingEntry({
             ...editingEntry,
             marketPrice: displayedPrice,
             invoiceOfficialPricePerGramEgp: merchantReceipt ? displayedPrice : editingEntry.invoiceOfficialPricePerGramEgp,
           });
        }
      }
    }
  }, [editingEntry?.karat, editingEntry?.multiplier, editingEntry?.debit, editingEntry?.credit, goldPrice, silverPrice, accountsDb]);
  
  const normalize = normalizeNumerals;

  const withGoldAudit = (next: Partial<Entry>): Partial<Entry> => {
    const calculationKarat = next.karat ?? inferGoldKaratFromMultiplier(next.multiplier);
    if (!isGoldEquivalentEntry(next, accountsDb) || !canCalculateGoldEquivalent21(next.weight || '', calculationKarat)) {
      return {
        ...next,
        goldEquivalent21Snapshot: undefined,
        goldEquivalent21LegacyComparison: undefined,
      };
    }

    const audit = buildGoldEquivalent21Audit(next.weight || '', calculationKarat, next.arabicWeight);
    if (!audit) return next;
    return {
      ...next,
      goldEquivalent21Snapshot: audit.snapshot,
      goldEquivalent21LegacyComparison: audit.legacyComparison || undefined,
    };
  };

  if (!editingEntry) return null;

  const { showClientInfo, showWeightAndCount, showCash } = React.useMemo(() => {
    const txStr = editingEntry.tx || '';
    return {
      showClientInfo: /بيع|شراء|مبيعات|مشتريات|مرتجع/.test(txStr),
      showWeightAndCount: !/ايراد|تصليح|قبض|دفع|مصاريف|مصروفات|م ت|م ا ع|مسحوبات|سحب|ايداع|إيداع|سلفة|مرتب|ايجار|شراء اصل/.test(txStr),
      showCash: !/تيفيت|تحويل/.test(txStr)
    };
  }, [editingEntry.tx]);

  const allAccountNames = React.useMemo(() => {
    const all = [
      ...(editingEntry.debit ? [editingEntry.debit] : []),
      ...(editingEntry.credit ? [editingEntry.credit] : []),
      ...accountsDb.map(a => a.name),
      ...accounts.assets, 
      ...accounts.liabilities, 
      ...accounts.equity,
      ...accounts.revenue,
      ...accounts.expenses
    ];
    return Array.from(new Set(all.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [editingEntry.debit, editingEntry.credit, accountsDb, accounts]);

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-[#0e1018] border border-[#c9a84c22] rounded-[2.5rem] p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto relative shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#c9a84c] via-[#9a7830] to-[#c9a84c]" />
        
        <button 
          onClick={() => setEditingEntry(null)} 
          className="absolute left-6 top-6 p-2.5 bg-[#1a1e2a] rounded-full text-[#5a5548] hover:text-[#c9a84c] transition-all active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>

        <button 
          type="button"
          onClick={() => {
            if (editingEntry) {
              useAppStore.getState().setPrintEntry(editingEntry as Entry);
            }
          }}
          className="absolute left-20 top-6 p-2.5 bg-[#1a1e2a] rounded-full text-[#5a5548] hover:text-[#c9a84c] transition-all active:scale-90"
          title="طباعة"
        >
          <Printer className="w-5 h-5" />
        </button>

        <div className="mb-8">
          <h3 className="text-2xl font-bold text-[#c9a84c] mb-1">تعديل القيد</h3>
          <p className="text-[10px] text-[#5a5548] font-bold uppercase tracking-widest">تحديث بيانات العملية المحفوظة</p>
        </div>
        
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="grid grid-cols-2 gap-3 bg-[#11141d]/10 p-2.5 rounded-3xl border border-[#1a1e2a] relative">
            <AccountSearchSelect 
              label="المدين"
              theme="debit"
              value={editingEntry.debit || ''}
              options={allAccountNames}
              onSelect={(val) => setEditingEntry({ ...editingEntry, debit: val })}
            />
            <AccountSearchSelect 
              label="الدائن"
              theme="credit"
              value={editingEntry.credit || ''}
              options={allAccountNames}
              onSelect={(val) => setEditingEntry({ ...editingEntry, credit: val })}
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            {showWeightAndCount && (
              <div className="col-span-2 space-y-2">
                <label className="text-xs text-[#5a5548] font-bold uppercase tracking-widest px-1">العيار / النوع</label>
                <div className="flex gap-2">
                  {[18, 21, 24].map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        const m = k === 18 ? 0.857142857 : k === 24 ? 1.142857143 : 1;
                        setEditingEntry(withGoldAudit({ ...editingEntry, karat: k, multiplier: m }));
                      }}
                      className={cn(
                        "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                        editingEntry.karat === k ? "bg-[#c9a84c11] border-[#c9a84c] text-[#c9a84c]" : "bg-[#080a0f] border-[#1a1e2a] text-[#5a5548]"
                      )}
                    >
                      {k}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditingEntry({ ...editingEntry, karat: null, multiplier: 1 })}
                    className={cn(
                      "flex-1 py-3 rounded-xl border text-sm font-bold transition-all",
                      editingEntry.karat === null ? "bg-[#c9a84c11] border-[#c9a84c] text-[#c9a84c]" : "bg-[#080a0f] border-[#1a1e2a] text-[#5a5548]"
                    )}
                  >
                    بدون
                  </button>
                </div>
              </div>
            )}
            
            <FormInput 
              label="التاريخ"
              type="date"
              value={editingEntry.date}
              onChangeValue={(v) => setEditingEntry({ ...editingEntry, date: v })}
              labelClassName="text-xs tracking-widest"
              className="rounded-2xl p-4 text-base [color-scheme:dark]"
            />
            
            <FormInput 
              label="رقم الفاتورة"
              type="text"
              value={editingEntry.invoiceNumber || ''}
              onChangeValue={(v) => setEditingEntry({ ...editingEntry, invoiceNumber: v })}
              placeholder="رقم الفاتورة..."
              labelClassName="text-xs tracking-widest"
              className="rounded-2xl p-4 text-base"
            />
            
            {showClientInfo && (
              <>
                <FormInput 
                  label="اسم العميل"
                  type="text"
                  value={editingEntry.clientName || ''}
                  onChangeValue={(v) => setEditingEntry({ ...editingEntry, clientName: v })}
                  labelClassName="text-xs tracking-widest"
                  className="rounded-2xl p-4 text-base"
                />
                
                <FormInput 
                  label="رقم الموبايل"
                  type="tel"
                  inputMode="tel"
                  value={editingEntry.clientPhone || ''}
                  onChangeValue={(v) => setEditingEntry({ ...editingEntry, clientPhone: normalize(v) })}
                  labelClassName="text-xs tracking-widest"
                  className="rounded-2xl p-4 text-base text-center font-mono"
                  dir="ltr"
                />
              </>
            )}
            
            <FormInput 
              label={`سعر السوق الرسمي ${editingEntry.karat ? `(عيار ${editingEntry.karat})` : ((editingEntry.tx || '').includes('فضة') ? '(فضة)' : '(ذهب)')}`}
              type="text"
              inputMode="numeric"
              value={editingEntry.marketPrice || ''}
              onChangeValue={(v) => {
                const price = parseFloat(normalize(v)) || undefined;
                const merchantReceipt = isMerchantReceiptEntry(editingEntry as Entry);
                setEditingEntry({ ...editingEntry, marketPrice: price, invoiceOfficialPricePerGramEgp: merchantReceipt ? price : editingEntry.invoiceOfficialPricePerGramEgp });
              }}
              containerClassName={showWeightAndCount ? "col-span-2" : "col-span-2"}
              labelClassName="text-xs tracking-widest text-right w-full block"
              className="rounded-2xl p-4 text-base font-mono"
              placeholder="سعر السوق..."
            />
            
            {showCash && (
              <FormInput 
                label="نقداً (جنيه)"
                type="text"
                inputMode="numeric"
                value={editingEntry.cash || ''}
                onChangeValue={(v) => setEditingEntry({ ...editingEntry, cash: normalize(v) })}
                containerClassName={!showWeightAndCount ? "col-span-2" : ""}
                labelClassName="text-xs tracking-widest text-[#5a5548]"
                className="rounded-2xl p-4 text-base text-[#6a9e6a] font-bold text-center font-mono"
                dir="ltr"
              />
            )}

            {showWeightAndCount && (
              <>
                <FormInput 
                  label="الوزن (جم)"
                  type="text"
                  inputMode="decimal"
                  value={editingEntry.weight || ''}
                  onChangeValue={(v) => {
                    let w = normalize(v);
                    setEditingEntry(withGoldAudit({ ...editingEntry, weight: w }));
                  }}
                  containerClassName={!showCash ? "col-span-2" : ""}
                  labelClassName="text-xs tracking-widest"
                  className="rounded-2xl p-4 text-base font-bold text-center font-mono"
                  dir="ltr"
                />
                
                <div className="space-y-2">
                  <label className="text-xs text-[#5a5548] font-bold uppercase tracking-widest px-1">جرام عربي</label>
                  <div className="w-full bg-[#0a0e06] border border-[#c9a84c33] rounded-2xl p-4 text-base font-bold text-[#c9a84c] min-h-[54px] flex items-center justify-center font-mono">
                    {canCalculateGoldEquivalent21(editingEntry.weight || '', editingEntry.karat ?? inferGoldKaratFromMultiplier(editingEntry.multiplier)) ? calculateArabicWeight(editingEntry.weight || '', editingEntry.multiplier || 1, editingEntry.karat) : (editingEntry.goldEquivalent21Snapshot?.equivalent21 ?? '-')}
                  </div>
                </div>

                {((editingEntry.tx || '').includes('ذهب') || (editingEntry.tx || '').includes('فضة') || editingEntry.tx === 'تحويل' || [18, 21, 24].includes(editingEntry.karat as number)) && 
                 (editingEntry.tx === 'تحويل' || (!["كسر افرنجي", "كسر عربي", "بريمة"].includes(editingEntry.debit || '') && 
                  !["كسر افرنجي", "كسر عربي", "بريمة"].includes(editingEntry.credit || ''))) && (
                  <FormInput 
                    label="العدد"
                    type="text"
                    inputMode="numeric"
                    value={editingEntry.count || ''}
                    onChangeValue={(v) => setEditingEntry({ ...editingEntry, count: normalize(v) })}
                    containerClassName="col-span-1"
                    labelClassName="text-xs tracking-widest"
                    className="rounded-2xl p-4 text-base font-bold text-center font-mono"
                    dir="ltr"
                  />
                )}
              </>
            )}
            
            <div className="col-span-2 space-y-2">
              <label className="text-xs text-[#5a5548] font-bold uppercase tracking-widest px-1">ملاحظات</label>
              <textarea 
                value={editingEntry.notes || ''}
                onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-2xl p-4 text-base text-[#ddd8cc] outline-none focus:border-[#c9a84c55] transition-all h-24 resize-none"
                placeholder="أضف ملاحظاتك هنا..."
              />
            </div>
          </div>


          <div className="flex gap-4 pt-4">
            {deleteConfirmId === editingEntry.id ? (
              <div className="flex-1 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setDeleteConfirmId(null)} 
                  className="flex-1 py-4 bg-[#1a1e2a] text-[#5a5548] font-bold rounded-2xl border border-[#1a1e2a] hover:bg-[#252a3a] transition-all"
                >
                  إلغاء
                </button>
                <button 
                  type="button" 
                  onClick={() => handleDelete(editingEntry.id!)} 
                  className="flex-1 py-4 bg-red-500/10 text-red-500 font-bold rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  تأكيد الحذف
                </button>
              </div>
            ) : (
              <button 
                type="button" 
                onClick={() => setDeleteConfirmId(editingEntry.id!)} 
                className="flex-1 py-4 bg-red-500/5 text-red-500/60 font-bold rounded-2xl border border-red-500/10 hover:bg-red-500/10 hover:text-red-500 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                حذف
              </button>
            )}
            <button 
              type="submit" 
              disabled={isUpdating}
              className="flex-[2] py-4 bg-gradient-to-r from-[#c9a84c] to-[#9a7830] text-[#080a0f] font-bold rounded-2xl shadow-lg shadow-[#c9a84c22] hover:shadow-[#c9a84c44] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUpdating ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <BarChart3 className="w-4 h-4 animate-pulse" />
                </motion.div>
              ) : <Save className="w-4 h-4" />}
              حفظ التغييرات
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
