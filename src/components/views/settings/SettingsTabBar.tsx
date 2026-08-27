import React from 'react';
import { cn } from '../../../lib/utils';

export type SettingsTab = 'rules' | 'cost' | 'import' | 'accounts';

interface SettingsTabBarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export const SettingsTabBar = React.memo(({ activeTab, onTabChange }: SettingsTabBarProps) => (
  <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
    {([
      ['rules', 'القواعد المخصصة'], ['accounts', 'شجرة الحسابات'], ['cost', 'أسعار افتتاح التكلفة'], ['import', 'استيراد وتصدير'],
    ] as const).map(([tab, label]) => (
      <button key={tab} onClick={() => onTabChange(tab)} className={cn("px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all", activeTab === tab ? "bg-[#c9a84c] text-[#080a0f]" : "bg-[#1a1e2a] text-[#5a5548] hover:text-[#ddd8cc]")}>
        {label}
      </button>
    ))}
  </div>
));
