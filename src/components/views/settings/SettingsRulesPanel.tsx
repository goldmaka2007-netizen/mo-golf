import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';

interface SettingsRulesPanelProps { onOpenGuide: () => void; }

export const SettingsRulesPanel = React.memo(({ onOpenGuide }: SettingsRulesPanelProps) => (
  <div className="space-y-4"><div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-8 text-center space-y-6">
    <div className="p-4 bg-[#c9a84c11] rounded-2xl w-20 h-20 mx-auto flex items-center justify-center border border-[#c9a84c22]"><BookOpen className="w-10 h-10 text-[#c9a84c]" /></div>
    <div><h3 className="text-lg font-bold text-[#ddd8cc] mb-2">إدارة قيود الحسابات</h3><p className="text-xs text-[#5a5548] leading-relaxed">يمكنك الآن إدارة جميع القيود المحاسبية وتوجيه الحسابات (المدين والدائن) وعيارات الذهب من شاشة واحدة متكاملة ومنظمة.</p></div>
    <button onClick={onOpenGuide} className="w-full py-4 bg-[#c9a84c] text-[#080a0f] rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-[#c9a84c11] active:scale-95 transition-all">الدخول لمركز إدارة القيود <ChevronRight className="w-4 h-4 rotate-180" /></button>
  </div></div>
));
