import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Save } from 'lucide-react';
import type { Account, AnnualOpeningCostConfig } from '../../../types';
import { formatMinorUnitsToEgpInput, getAccessoryOpeningCostsMinorByAccountId, getGoldOpeningPriceMinor, getSilverOpeningPriceMinor } from '../../../lib/openingCostConfig';
import { normalizeNumerals } from '../../../lib/accounting';
import { GoldPricingConfig, APPROVED_BULLION_UNIT_WEIGHTS, APPROVED_COIN_UNIT_WEIGHTS, SUPPORTED_JEWELRY_TAXONOMY_KEYS, SMART_PURCHASE_TAXONOMY_KEYS } from '../../../lib/goldPricingAssistant';
interface Props { salePricingForm:{rate18:string;rate21:string}; salePricingError:string; salePricingSuccess:string; isSavingSalePricing:boolean; onSalePricingRateChange:(field:'rate18'|'rate21',value:string)=>void; onSaveSalePricing:(event:React.FormEvent)=>void; storySpreadForm:string; storySpreadError:string; storySpreadSuccess:string; isSavingStorySpread:boolean; onStorySpreadChange:(value:string)=>void; onSaveStorySpread:()=>void; smartMarginForm:{minimumEgpPerE21:number;minimumPercent:number}; onSmartMarginChange:(field:'minimumEgpPerE21'|'minimumPercent',value:number)=>void; onSaveSmartMargin:()=>void; pricingConfigForm:GoldPricingConfig; onUnitWorkmanshipChange:(field:'bullionWorkmanshipByWeight'|'coinWorkmanshipByWeight',unitWeight:number,mode:'perGram'|'perPiece',value:string)=>void; onJewelryDefaultChange:(key:string,mode:'perGram'|'perPiece',value:string)=>void; onPurchaseDefaultChange:(key:string,value:string)=>void; onSavePricingConfig:()=>void; openingPriceForm:{year:string;gold:string;silver:string;accessories:Record<string,string>}; openingPriceError:string; openingPriceSuccess:string; isSavingOpeningPrice:boolean; sortedOpeningCostConfig:AnnualOpeningCostConfig[]; accessoryAccounts:Account[]; onOpeningYearChange:(value:string)=>void; onOpeningGoldChange:(value:string)=>void; onOpeningSilverChange:(value:string)=>void; onOpeningAccessoryChange:(accountId:string,value:string)=>void; onSaveOpeningPrice:(event:React.FormEvent)=>void; onEditOpeningPrice:(row:AnnualOpeningCostConfig)=>void; onDeleteOpeningPrice:(year:number)=>void; }
export const SettingsCostPanel=React.memo((props:Props)=>{const {salePricingForm,salePricingError,salePricingSuccess,isSavingSalePricing,onSalePricingRateChange,onSaveSalePricing,storySpreadForm,storySpreadError,storySpreadSuccess,isSavingStorySpread,onStorySpreadChange,onSaveStorySpread,smartMarginForm,onSmartMarginChange,onSaveSmartMargin,pricingConfigForm, onUnitWorkmanshipChange,onJewelryDefaultChange,onPurchaseDefaultChange,onSavePricingConfig,openingPriceForm,openingPriceError,openingPriceSuccess,isSavingOpeningPrice,sortedOpeningCostConfig,accessoryAccounts,onOpeningYearChange,onOpeningGoldChange,onOpeningSilverChange,onOpeningAccessoryChange,onSaveOpeningPrice,onEditOpeningPrice,onDeleteOpeningPrice}=props;return(<motion.div key="cost" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} className="space-y-4" dir="rtl">
            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#f0cc6b]">إعدادات تسعير البيع</h3>
                <p className="text-[11px] leading-6 text-[#8a8172]">
                  ضريبة ودمغة تسعيرية فقط. لا تدخل في Entry أو Opening Cost أو WAC أو COGS.
                </p>
              </div>
              <form onSubmit={onSaveSalePricing} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-[#c9a84c]">ضريبة ودمغة عيار 18 — ج/جم</span>
                    <input
                      value={salePricingForm.rate18}
                      onChange={event => onSalePricingRateChange('rate18', event.target.value)}
                      inputMode="decimal"
                      className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] font-bold text-[#c9a84c]">ضريبة ودمغة عيار 21 — ج/جم</span>
                    <input
                      value={salePricingForm.rate21}
                      onChange={event => onSalePricingRateChange('rate21', event.target.value)}
                      inputMode="decimal"
                      className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
                    />
                  </label>
                </div>
                <button type="submit" disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60">
                  {isSavingSalePricing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ إعدادات التسعير
                </button>
              </form>
              {salePricingError && <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-200">{salePricingError}</div>}
              {salePricingSuccess && <div className="mt-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-xs font-bold text-green-300">{salePricingSuccess}</div>}
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#f0cc6b]">فرق شراء الستوري</h3>
                <p className="text-[11px] leading-6 text-[#8a8172]">يُخصم من سعر بيع عيار 21 داخل الستوري فقط، ولا يغيّر سعر الشراء الرسمي في التطبيق.</p>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-[#c9a84c]">الفرق بالجنيه لكل جرام (EGP)</span>
                  <input value={storySpreadForm} onChange={event => onStorySpreadChange(event.target.value)} inputMode="decimal" aria-label="فرق شراء الستوري" className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]" />
                </label>
                <button type="button" onClick={onSaveStorySpread} disabled={isSavingStorySpread} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60">
                  {isSavingStorySpread ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ فرق شراء الستوري
                </button>
              </div>
              {storySpreadError && <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-200">{storySpreadError}</div>}
              {storySpreadSuccess && <div className="mt-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-xs font-bold text-green-300">{storySpreadSuccess}</div>}
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-6" dir="rtl">
              <h3 className="text-sm font-bold text-[#f0cc6b]">حواجز قرار شراء الذهب</h3>
              <p className="mt-2 text-[11px] leading-6 text-[#8a8172]">تستخدم للتحليل فقط: الحد الأدنى بالجنيه لكل E21 والحد الأدنى كنسبة من متوسط البيع.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[10px] font-bold text-[#c9a84c]">حد أدنى ج/جم E21<input value={smartMarginForm.minimumEgpPerE21} onChange={event => onSmartMarginChange('minimumEgpPerE21', Math.max(0, Number(normalizeNumerals(event.target.value)) || 0))} inputMode="decimal" className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc]" /></label>
                <label className="space-y-1 text-[10px] font-bold text-[#c9a84c]">حد أدنى نسبة %<input value={smartMarginForm.minimumPercent} onChange={event => onSmartMarginChange('minimumPercent', Math.max(0, Number(normalizeNumerals(event.target.value)) || 0))} inputMode="decimal" className="w-full rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-3 text-sm text-[#ddd8cc]" /></label>
              </div>
              <button type="button" onClick={onSaveSmartMargin} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f]"><Save className="h-4 w-4" />حفظ حواجز قرار الشراء</button>
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-4 space-y-4" dir="rtl">
              <div><h3 className="text-sm font-bold text-[#f0cc6b]">مصنعية السبائك والجنيهات</h3><p className="text-[11px] leading-6 text-[#8a8172]">قيمة واحدة فقط تُحفظ لكل وزن؛ الإدخال الآخر مشتق مباشرة. لا يتم الحفظ إلا بالزر.</p></div>
              {([['bullionWorkmanshipByWeight', 'سبيكة', APPROVED_BULLION_UNIT_WEIGHTS], ['coinWorkmanshipByWeight', 'جنيه', APPROVED_COIN_UNIT_WEIGHTS]] as const).map(([field, title, weights]) => <div key={field} className="space-y-2"><strong className="text-xs text-[#ddd8cc]">{title}</strong>{weights.map(unitWeight => {
                const saved = pricingConfigForm[field][String(unitWeight)] ?? { mode: 'perGram' as const, value: 0 };
                const perGram = saved.mode === 'perGram' ? saved.value : saved.value / unitWeight;
                const perPiece = saved.mode === 'perPiece' ? saved.value : saved.value * unitWeight;

                return <div key={unitWeight} className="grid grid-cols-1 gap-2 rounded-2xl border border-[#252b37] p-3 sm:grid-cols-3"><span className="text-xs font-bold text-[#f0cc6b]">{unitWeight} جم</span><input value={String(Number(perGram.toFixed(2)))} onChange={event => onUnitWorkmanshipChange(field, unitWeight, 'perGram', event.target.value)} inputMode="decimal" aria-label={`مصنعية ${unitWeight} للجرام`} className="min-w-0 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]"/><input value={String(Number(perPiece.toFixed(2)))} onChange={event => onUnitWorkmanshipChange(field, unitWeight, 'perPiece', event.target.value)} inputMode="decimal" aria-label={`مصنعية ${unitWeight} للقطعة`} className="min-w-0 rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]"/></div>;
              })}</div>)}
              <button type="button" onClick={onSavePricingConfig} disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60"><Save className="h-4 w-4" />حفظ إعدادات المصنعية</button>
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-4 space-y-4" dir="rtl">
              <div><h3 className="text-sm font-bold text-[#f0cc6b]">مصنعية المشغولات الذهبية</h3><p className="text-[11px] leading-6 text-[#8a8172]">لكل taxonomy قيمة مرجعية واحدة فقط؛ لا تُشتق قيمة ثانية في الإعدادات.</p></div>
              <div className="space-y-2">{SUPPORTED_JEWELRY_TAXONOMY_KEYS.map(key => { const saved = pricingConfigForm.saleWorkmanshipDefaults[key] ?? { mode: 'perGram' as const, value: 0 }; return <div key={key} className="grid grid-cols-1 gap-2 rounded-2xl border border-[#252b37] p-3 sm:grid-cols-[1fr_120px_1fr]"><span className="break-all text-[10px] font-bold text-[#ddd8cc]">{key}</span><select value={saved.mode} onChange={event => onJewelryDefaultChange(key, event.target.value as 'perGram' | 'perPiece', String(saved.value))} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-xs text-[#ddd8cc]"><option value="perGram">EGP/gram</option><option value="perPiece">EGP/piece</option></select><input value={String(saved.value)} onChange={event => onJewelryDefaultChange(key, saved.mode, event.target.value)} inputMode="decimal" className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]" /></div>; })}</div>
              <button type="button" onClick={onSavePricingConfig} disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60"><Save className="h-4 w-4" />حفظ مصنعية المشغولات</button>
            </div>

            <div className="rounded-3xl border border-[#c9a84c]/35 bg-[#0e1018] p-4 space-y-4" dir="rtl">
              <div><h3 className="text-sm font-bold text-[#f0cc6b]">خصم الشراء الافتراضي</h3><p className="text-[11px] leading-6 text-[#8a8172]">للمنتجات الأربعة المعتمدة في مساعد الشراء فقط.</p></div>
              {SMART_PURCHASE_TAXONOMY_KEYS.map(key => <label key={key} className="grid grid-cols-1 gap-2 rounded-2xl border border-[#252b37] p-3 sm:grid-cols-[1fr_150px]"><span className="break-all text-[10px] font-bold text-[#ddd8cc]">{key}</span><input value={String(pricingConfigForm.purchaseDiscountPercent[key] ?? 0)} onChange={event => onPurchaseDefaultChange(key, event.target.value)} inputMode="decimal" aria-label={`Default discount ${key}`} className="rounded-xl border border-[#1a1e2a] bg-[#080a0f] p-2 text-sm text-[#ddd8cc]" /></label>)}
              <button type="button" onClick={onSavePricingConfig} disabled={isSavingSalePricing} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 text-xs font-bold text-[#080a0f] disabled:opacity-60"><Save className="h-4 w-4" />حفظ خصم الشراء</button>
            </div>

            <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#ddd8cc]">أسعار الافتتاح السنوية للتكلفة</h3>
                <p className="text-[11px] text-[#8a8172] leading-6">
                  تفستخدم هذه الأسعار فقط لتحديد تكلفة المخزون الافتتاحي وحساب متوسط التكلفة. لا تفستخدم كتقييم سوقي حالي.
                </p>
              </div>

              <form onSubmit={onSaveOpeningPrice} className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr] gap-3 items-end">
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-[#c9a84c]">السنة</span>
                  <input value={openingPriceForm.year} onChange={(e) => onOpeningYearChange(e.target.value)} inputMode="numeric" className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]" placeholder="2026" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-[#c9a84c]">سعر افتتاح جرام الذهب عيار 21 بالجنيه</span>
                  <input value={openingPriceForm.gold} onChange={(e) => onOpeningGoldChange(e.target.value)} inputMode="decimal" className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]" placeholder="4000" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-bold text-[#c9a84c]">سعر افتتاح جرام الفضة بالجنيه</span>
                  <input value={openingPriceForm.silver} onChange={(e) => onOpeningSilverChange(e.target.value)} inputMode="decimal" className="w-full bg-[#080a0f] border border-[#1a1e2a] rounded-xl p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]" placeholder="60" />
                </label>
                </div>
                <div className="rounded-2xl border border-[#1a1e2a] bg-[#080a0f] p-3">
                  <div className="mb-3 text-[11px] font-black text-[#ddd8cc]">
                    تكلفة الافتتاح للوحدة — ليست سعر بيع
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {accessoryAccounts.map(account => (
                      <label key={account.id} className="space-y-1">
                        <span className="text-[10px] font-bold text-[#c9a84c]">{account.name}</span>
                        <input
                          value={openingPriceForm.accessories[account.id!] || ''}
                          onChange={event => onOpeningAccessoryChange(account.id!, event.target.value)}
                          inputMode="decimal"
                          className="w-full rounded-xl border border-[#1a1e2a] bg-[#0e1018] p-3 text-sm text-[#ddd8cc] outline-none focus:border-[#c9a84c55]"
                          placeholder="غير محدد"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={isSavingOpeningPrice} className="px-5 py-3 bg-[#c9a84c] text-[#080a0f] rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                  {isSavingOpeningPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ
                </button>
              </form>

              {openingPriceError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-2xl p-3 text-xs font-bold">
                  {openingPriceError}
                </div>
              )}
              {openingPriceSuccess && (
                <div className="whitespace-pre-line rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-xs font-bold text-green-300">
                  {openingPriceSuccess}
                </div>
              )}

              <div className="overflow-x-auto border border-[#1a1e2a] rounded-2xl">
                <table className="w-full text-right text-xs min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[#1a1e2a] [&>th]:p-3 [&>th]:text-[#8a8172]">
                      <th>السنة</th>
                      <th>ذهب 21 بالجنيه</th>
                      <th>فضة بالجنيه</th>
                      <th>{'\u0645\u0644\u062d\u0642\u0627\u062a'}</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1e2a] [&>tr>td]:p-3">
                    {sortedOpeningCostConfig.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-[#8a8172]">لا توجد أسعار افتتاح محفوظة بعد.</td>
                      </tr>
                    ) : sortedOpeningCostConfig.map(row => (
                      <tr key={row.year}>
                        <td className="font-mono font-bold text-[#ddd8cc]">{row.year}</td>
                        <td className="font-mono text-[#ddd8cc]">{formatMinorUnitsToEgpInput(getGoldOpeningPriceMinor(row)) || "-"}</td>
                        <td className="font-mono text-[#ddd8cc]">{formatMinorUnitsToEgpInput(getSilverOpeningPriceMinor(row)) || "-"}</td>
                        <td className="text-[#ddd8cc]">
                          {(() => {
                            const accessoryCosts = getAccessoryOpeningCostsMinorByAccountId(row);
                            const savedAccessories = accessoryAccounts.filter(account => account.id && accessoryCosts[account.id] !== undefined && accessoryCosts[account.id] !== '');
                            if (savedAccessories.length === 0) return <span className="text-[#8a8172]">0</span>;
                            return (
                              <details>
                                <summary className="cursor-pointer font-bold text-[#c9a84c]">{savedAccessories.length} {'\u0645\u062d\u0641\u0648\u0638'}</summary>
                                <div className="mt-2 space-y-1">
                                  {savedAccessories.map(account => (
                                    <div key={account.id} className="flex justify-between gap-3 font-mono text-[10px]">
                                      <span className="font-sans text-[#8a8172]">{account.name}</span>
                                      <span>{formatMinorUnitsToEgpInput(accessoryCosts[account.id!])} {'\u062c.\u0645'}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            );
                          })()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => onEditOpeningPrice(row)} className="px-3 py-2 bg-[#1a1e2a] text-[#c9a84c] rounded-lg text-[10px] font-bold">تعديل</button>
                            <button type="button" onClick={() => onDeleteOpeningPrice(Number(row.year))} className="px-3 py-2 bg-red-500/10 text-red-300 rounded-lg text-[10px] font-bold">حذف السنة</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
</motion.div>);});
