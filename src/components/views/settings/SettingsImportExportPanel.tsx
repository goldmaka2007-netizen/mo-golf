import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Download, FilePlus, Loader2, Save, Trash2, Upload } from 'lucide-react';
interface ImportProgress { current:number; total:number; success:number; failed:number; }
interface Props { importText:string; importProgress:ImportProgress|null; isImporting:boolean; isDeletingAll:boolean; isGeneratingWacAudit:boolean; showDeleteAllConfirm:boolean; onExportNew:()=>void; onExportUpdate:()=>void; onExportWacAudit:()=>void; onRequestDeleteAll:()=>void; onCancelDeleteAll:()=>void; onConfirmDeleteAll:()=>void; onFileUpload:(event:React.ChangeEvent<HTMLInputElement>)=>void; onImport:()=>void; onRetroactiveInvoiceNumbers:()=>void; onOpenInventory:()=>void; }
export const SettingsImportExportPanel=React.memo(({importText,importProgress,isImporting,isDeletingAll,isGeneratingWacAudit,showDeleteAllConfirm,onExportNew,onExportUpdate,onExportWacAudit,onRequestDeleteAll,onCancelDeleteAll,onConfirmDeleteAll,onFileUpload,onImport,onRetroactiveInvoiceNumbers,onOpenInventory}:Props)=>(<motion.div key="import" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-4">
            <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 space-y-6">
              <div className="pb-6 border-b border-[#1a1e2a] space-y-4">
                <div>
                  <div className="text-sm font-bold text-[#ddd8cc]">تصدير كافة البيانات (CSV)</div>
                  <div className="text-[10px] text-[#5a5548]">تحميل نسخة احتياطية من جميع القيود المسجلة</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onExportNew()}
                    className="flex-1 py-3 bg-[#1a1e2a] text-[#c9a84c] rounded-xl hover:bg-[#c9a84c22] transition-all text-xs font-bold border border-[#c9a84c22] flex items-center justify-center gap-2"
                  >
                    <FilePlus className="w-4 h-4" />
                    تصدير كملف جديد
                  </button>
                  <button
                    onClick={() => onExportUpdate()}
                    className="flex-1 py-3 bg-[#c9a84c] text-[#080a0f] rounded-xl hover:bg-[#d4b455] transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#c9a84c22]"
                  >
                    <Save className="w-4 h-4" />
                    تحديث نفس الملف
                  </button>
                </div>
                <div className="text-[9px] text-[#5a5548] italic">* عند استبدال الملف في iCloud، اختر "Keep Both" لملف جديد، أو "Replace" لتحديث الملف الحالي.</div>
              </div>

              <div className="pb-6 border-b border-[#1a1e2a] space-y-4" dir="rtl">
                <div>
                  <div className="text-sm font-bold text-[#ddd8cc]">تصدير تقرير WAC الشامل</div>
                  <div className="text-[10px] text-[#5a5548]">سجل كامل لتكلفة المخزون والتجار ومتوسط التكلفة قبل وبعد الحركات</div>
                </div>
                <button
                  type="button"
                  onClick={onExportWacAudit}
                  disabled={isGeneratingWacAudit}
                  className="w-full py-3 bg-[#1a1e2a] text-[#c9a84c] rounded-xl hover:bg-[#c9a84c22] transition-all text-xs font-bold border border-[#c9a84c22] flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isGeneratingWacAudit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isGeneratingWacAudit ? 'جاري تجهيز تقرير WAC...' : 'تصدير تقرير WAC الشامل'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <div className="text-sm font-bold text-[#ddd8cc]">مسح كافة البيانات</div>
                  <div className="text-[10px] text-[#5a5548]">سيتم حذف جميع القيود المسجلة نهائياً</div>
                </div>
                {!showDeleteAllConfirm ? (
                  <button
                    onClick={() => onRequestDeleteAll()}
                    className="p-3 bg-[#9e6a6a11] text-[#9e6a6a] rounded-2xl hover:bg-[#9e6a6a22] transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onCancelDeleteAll()}
                      className="px-4 py-2 bg-[#1a1e2a] text-[#5a5548] rounded-xl text-[10px] font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={onConfirmDeleteAll}
                      disabled={isDeletingAll}
                      className="px-4 py-2 bg-[#9e6a6a] text-[#080a0f] rounded-xl text-[10px] font-bold flex items-center gap-2"
                    >
                      {isDeletingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                      تأكيد الحذف
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-[#1a1e2a] space-y-4">
                <div className="text-sm font-bold text-[#ddd8cc]">استيراد بيانات CSV</div>
                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={onFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="bg-[#080a0f] border-2 border-dashed border-[#1a1e2a] rounded-2xl p-8 text-center group-hover:border-[#c9a84c33] transition-all">
                      <Upload className="w-8 h-8 text-[#5a5548] mx-auto mb-2 group-hover:text-[#c9a84c] transition-colors" />
                      <div className="text-xs text-[#5a5548]">اسحب الملف هنا أو اضغط للاختيار</div>
                      <div className="text-[9px] text-[#5a5548] mt-1">يدعم ملفات CSV فقط</div>
                    </div>
                  </div>

                  {importText && (
                    <div className="space-y-3">
                      <div className="text-[10px] text-[#6a9e6a] flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3" /> تم تجهيز {importText.split('\n').length} سطر للاستيراد
                      </div>
                      <button
                        onClick={onImport}
                        disabled={isImporting}
                        className="w-full py-4 bg-[#c9a84c] text-[#080a0f] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#c9a84c22]"
                      >
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        بدء عملية الاستيراد الآن
                      </button>
                    </div>
                  )}

                  {importProgress && (
                    <div className="bg-[#080a0f] p-4 rounded-2xl border border-[#1a1e2a] space-y-2">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-[#c9a84c]">جاري الاستيراد...</span>
                        <span className="text-[#5a5548]">{importProgress.current} / {importProgress.total}</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1a1e2a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#c9a84c] transition-all duration-300"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                      <div className="flex gap-4 text-[9px]">
                        <span className="text-[#6a9e6a]">ناجح: {importProgress.success}</span>
                        <span className="text-[#9e6a6a]">فشل: {importProgress.failed}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-6 border-t border-[#1a1e2a]">
                    <h4 className="text-sm font-bold text-[#ddd8cc] mb-2 flex items-center gap-2">
                       صيانة البيانات وتحديث الترقيم
                    </h4>
                    <div className="p-4 bg-[#6a8a9e11] border border-[#6a8a9e22] rounded-2xl flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#6a8a9e]">تحديث أرقام الفواتير للقيود السابقة (تلقائي)</div>
                        <div className="text-[10px] text-[#5a5548] mt-1 pr-1">إضافة أرقام تسلسلية ذكية (مثل S1 و P1) لكل القيود السابقة الخالية من الأرقام.</div>
                      </div>
                      <button
                        onClick={onRetroactiveInvoiceNumbers}
                        disabled={isImporting}
                        className="px-4 py-2 bg-[#6a8a9e] text-[#080a0f] text-[10px] font-bold rounded-xl hover:bg-[#5a7a8e] transition-all disabled:opacity-50"
                      >
                        {isImporting ? 'جاري التحديث...' : 'بدء التحديث الآن'}
                      </button>
                    </div>

                    <div className="p-4 bg-[#c9a84c11] border border-[#c9a84c22] rounded-2xl flex items-center justify-between mt-4">
                      <div>
                        <div className="text-xs font-bold text-[#c9a84c]">شاشة جرد ومطابقة المخزون</div>
                        <div className="text-[10px] text-[#5a5548] mt-1 pr-1">مطابقة القائمة الدفترية مع الجرد الفعلي للمحلات وحفظها بالسجلات.</div>
                      </div>
                      <button
                        onClick={() => onOpenInventory}
                        className="px-4 py-2 bg-[#c9a84c] text-[#0e1018] text-[10px] font-bold rounded-xl hover:bg-[#d4b455] transition-all"
                      >
                        فتح الشاشة
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
</motion.div>));
