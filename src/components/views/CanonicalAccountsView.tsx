import React, { useState } from 'react';
import { ChevronRight, Landmark } from 'lucide-react';
import { useAppStore } from '../../store';
import { CanonicalAccountsPanel } from './CanonicalAccountsPanel';
import { AccountManagementView } from './AccountManagementView';

/** Standalone, mobile-first route for the canonical chart of accounts. */
export const CanonicalAccountsView = React.memo(() => {
  const setView = useAppStore(state => state.setView);
  const [screen, setScreen] = useState<'chart' | 'management'>('chart');

  if (screen === 'management') return <AccountManagementView />;

  return (
    <section className="space-y-4 pb-6" aria-label="دليل الحسابات المركزي">
      <div className="flex items-center justify-between rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c33] bg-[#c9a84c11] text-[#c9a84c]">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-[#f5f1e8]">دليل الحسابات</h2>
            <p className="mt-1 text-[11px] font-bold text-[#8a8172]">الدليل المركزي والمراجعة قبل Cutover</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setView('more')}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-xs font-black text-[#c9a84c]"
          aria-label="العودة إلى المزيد"
        >
          <ChevronRight className="h-4 w-4" />
          رجوع
        </button>
      </div>
      <button type="button" onClick={() => setScreen('management')} className="w-full rounded-2xl border border-[#c9a84c55] bg-[#c9a84c11] p-4 text-sm font-black text-[#c9a84c]">فتح إدارة الحسابات والاستنساخ</button>
      <CanonicalAccountsPanel />
    </section>
  );
});
