import React from 'react';
import { Image, BookOpen, Settings, Maximize2, Minimize2, LogOut, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../store';

export const MoreView = React.memo(({
  isFullscreen,
  onToggleFullscreen,
  onLogOut
}: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLogOut: () => void;
}) => {
  const { setView } = useAppStore();

  const tools = [
    { label: 'حالة واتساب', detail: 'تجهيز الحالة اليومية بسرعة', icon: <Image className="h-5 w-5" />, onClick: () => setView('story') },
    { label: 'الدليل المحاسبي', detail: 'الحسابات والقواعد المرجعية', icon: <BookOpen className="h-5 w-5" />, onClick: () => setView('guide') },
    { label: 'الإعدادات', detail: 'الأسعار والحسابات وإعدادات النظام', icon: <Settings className="h-5 w-5" />, onClick: () => setView('settings') },
    { label: isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة', detail: 'على iOS استخدم تعليمات Safari عند الحاجة', icon: isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />, onClick: onToggleFullscreen },
  ];

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <div className="text-sm font-black text-[#f5f1e8]">المزيد</div>
        <div className="mt-1 text-xs font-bold text-[#8a8172]">أدوات أقل استخداما بعيدة عن شاشة الإدخال اليومية.</div>
      </div>

      <div className="grid gap-3">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.onClick}
            className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4 text-right transition-all active:scale-[0.99] hover:border-[#c9a84c55]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c22] bg-[#c9a84c11] text-[#c9a84c]">
              {tool.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-[#f5f1e8]">{tool.label}</div>
              <div className="mt-1 text-xs font-bold leading-5 text-[#8a8172]">{tool.detail}</div>
            </div>
            <ChevronLeft className="h-4 w-4 shrink-0 text-[#8a8172]" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onLogOut}
        className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl border border-[#b56a6a33] bg-[#b56a6a12] p-4 text-sm font-black text-[#b56a6a] transition-all active:scale-[0.99]"
      >
        <LogOut className="h-5 w-5" />
        تسجيل الخروج
      </button>
    </div>
  );
});
