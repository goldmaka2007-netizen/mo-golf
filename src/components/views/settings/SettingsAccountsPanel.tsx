import React from 'react';
import { ChevronRight, LayoutGrid } from 'lucide-react';

interface SettingsAccountsPanelProps { onOpenAccounts: () => void; }

export const SettingsAccountsPanel = React.memo(({ onOpenAccounts }: SettingsAccountsPanelProps) => (
  <div className="space-y-4"><div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-8 text-center space-y-6">
    <div className="p-4 bg-[#6a8a9e11] rounded-2xl w-20 h-20 mx-auto flex items-center justify-center border border-[#6a8a9e22]"><LayoutGrid className="w-10 h-10 text-[#6a8a9e]" /></div>
    <div><h3 className="text-lg font-bold text-[#ddd8cc] mb-2">شجرة الحسابات والدليل</h3><p className="text-xs text-[#5a5548] leading-relaxed">قم بتنظيم حساباتك (أصول، خصوم، إيرادات...) وإضافة حسابات جديدة للعملاء أو الموردين أو التجار بسهولة من خلال الشجرة الهيكلية.</p></div>
    <button onClick={onOpenAccounts} className="w-full py-4 bg-[#6a8a9e] text-[#080a0f] rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-[#6a8a9e11] active:scale-95 transition-all">تعديل شجرة الحسابات <ChevronRight className="w-4 h-4 rotate-180" /></button>
  </div></div>
));
