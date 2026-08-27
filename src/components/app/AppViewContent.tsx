import React, { Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { reportViews, type AppView } from './NavigationMetadata';
import { MainDashboard } from '../views/MainDashboard';
import { EntryForm } from '../views/EntryForm';
import { DailyJournalView } from '../views/DailyJournalView';
import { AccountingGuideView } from '../views/AccountingGuideView';
import { MoreView } from '../views/MoreView';
import { CanonicalAccountsView } from '../views/CanonicalAccountsView';

const ReportsView = React.lazy(() => import('../views/ReportsView').then(module => ({ default: module.ReportsView })));
const InventoryCheckView = React.lazy(() => import('../views/InventoryCheckView').then(module => ({ default: module.InventoryCheckView })));
const StoryBuilderView = React.lazy(() => import('../views/StoryBuilderView').then(module => ({ default: module.StoryBuilderView })));
const SettingsView = React.lazy(() => import('../views/SettingsView').then(module => ({ default: module.SettingsView })));

const LazyViewFallback = ({ label }: { label: string }) => (
  <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-8 text-center text-sm font-bold text-[#8a8172]" dir="rtl">
    <div className="flex flex-col items-center gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9a84c] border-t-transparent" />
      <span>جارٍ تحميل {label}...</span>
    </div>
  </div>
);


interface AppViewContentProps {
  view: AppView;
  isEntryDarkShell: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLogOut: () => void;
  onEntryStepChange: (step: number) => void;
}

export function AppViewContent({ view, isEntryDarkShell, isFullscreen, onToggleFullscreen, onLogOut, onEntryStepChange }: AppViewContentProps) {
  return (
          <AnimatePresence mode="wait">
              <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className={isEntryDarkShell ? 'flex flex-1 flex-col' : undefined}
            >
              {view === 'home' && <MainDashboard />}
              {view === 'entry' && (
                <EntryForm onStepChange={onEntryStepChange} />
              )}
              {view === 'journal' && <DailyJournalView />}
              {view === 'database' && (
                <Suspense fallback={<LazyViewFallback label="المخزون" />}>
                  <InventoryCheckView />
                </Suspense>
              )}
              {reportViews.includes(view) && (
                <Suspense fallback={<LazyViewFallback label="التقارير" />}>
                  <ReportsView />
                </Suspense>
              )}
              {view === 'more' && <MoreView isFullscreen={isFullscreen} onToggleFullscreen={onToggleFullscreen} onLogOut={onLogOut} />}
              {view === 'story' && (
                <Suspense fallback={<LazyViewFallback label="حالة واتساب" />}>
                  <StoryBuilderView />
                </Suspense>
              )}
              {view === 'guide' && <AccountingGuideView />}
              {view === 'settings' && (
                <Suspense fallback={<LazyViewFallback label="الإعدادات" />}>
                  <SettingsView />
                </Suspense>
              )}
              {view === 'chart-of-accounts' && <CanonicalAccountsView />}
            </motion.div>
          </AnimatePresence>
  );
}
