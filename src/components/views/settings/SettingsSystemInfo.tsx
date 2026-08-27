import React from 'react';

interface SettingsSystemInfoProps { email?: string | null; onReload: () => void; }

export const SettingsSystemInfo = React.memo(({ email, onReload }: SettingsSystemInfoProps) => (
  <section className="space-y-4 pt-8"><h3 className="text-xs font-bold text-[#5a5548] uppercase tracking-widest px-2">معلومات النظام</h3><div className="bg-[#0e1018] border border-[#1a1e2a] rounded-3xl p-6 space-y-4">
    <div className="flex justify-between items-center text-xs"><span className="text-[#5a5548]">إصدار التطبيق</span><span className="text-[#ddd8cc] font-mono">v2.4.1-pro</span></div>
    <div className="flex justify-between items-center text-xs"><span className="text-[#5a5548]">تحديث التطبيق</span><button onClick={onReload} className="text-[#c9a84c] underline hover:text-[#d4b455] active:scale-95 transition-all text-[10px]">تحديث إجباري الآن</button></div>
    <div className="flex justify-between items-center text-xs"><span className="text-[#5a5548]">حالة الاتصال</span><span className="flex items-center gap-2 text-[#6a9e6a]"><div className="w-1.5 h-1.5 bg-[#6a9e6a] rounded-full animate-pulse" />متصل بالخادم</span></div>
    <div className="flex justify-between items-center text-xs"><span className="text-[#5a5548]">المستخدم الحالي</span><span className="text-[#ddd8cc]">{email}</span></div>
  </div></section>
));
