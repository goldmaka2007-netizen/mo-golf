import React, { useState, useEffect, Suspense } from 'react';
import { deleteDoc, doc, updateDoc, serverTimestamp, addDoc, collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store';
import { db, firebaseProjectId, firestoreDatabaseId, logOut } from './firebase';
import { Entry } from './types';
import { buildGoldEquivalent21Audit, canCalculateGoldEquivalent21, inferGoldKaratFromMultiplier } from './lib/goldEquivalent';
import { isGoldEquivalentEntry } from './utils/accountLogic';
import { resolveEntryIdentity } from './lib/entryIdentity';
import { validateAccountingPolicy } from './lib/accountingPolicy';

import { Home, BookOpenCheck, PlusCircle, BarChart3, Menu, RefreshCw, Gem } from 'lucide-react';

import { MainDashboard } from './components/views/MainDashboard';
import { EntryForm } from './components/views/EntryForm';
import { EditingEntryModal } from './components/views/EditingEntryModal';
import { DailyJournalView } from './components/views/DailyJournalView';
import { AccountingGuideView } from './components/views/AccountingGuideView';
import { InvoicePrintModal } from './components/views/InvoicePrintModal';
import { MoreView } from './components/views/MoreView';
import { CanonicalAccountsView } from './components/views/CanonicalAccountsView';

const ReportsView = React.lazy(() =>
  import('./components/views/ReportsView').then(module => ({
    default: module.ReportsView,
  }))
);

const InventoryCheckView = React.lazy(() =>
  import('./components/views/InventoryCheckView').then(module => ({
    default: module.InventoryCheckView,
  }))
);

const StoryBuilderView = React.lazy(() =>
  import('./components/views/StoryBuilderView').then(module => ({
    default: module.StoryBuilderView,
  }))
);

const SettingsView = React.lazy(() =>
  import('./components/views/SettingsView').then(module => ({
    default: module.SettingsView,
  }))
);

import { ErrorBoundary } from './components/ErrorBoundary';
import { NavButton } from './components/ui/NavButton';
import { AppBottomNavigation } from './components/ui/AppBottomNavigation';
import { LoadingView } from './components/views/LoadingView';
import { LoginView } from './components/views/LoginView';
import { GlobalErrorView } from './components/views/GlobalErrorView';

import { useAuthInit } from './hooks/useAuthInit';
import { useDataSync } from './hooks/useDataSync';
import { useCostRecalculation } from './hooks/useCostRecalculation';
import { areOperationWritesLocked } from './lib/costRecalculation';
import { isAdminEmail } from './lib/adminAccess';

type AppView = ReturnType<typeof useAppStore.getState>['view'];

const reportViews: AppView[] = ['reports', 'inventory', 'profit-analysis', 'advanced-analytics'];
const moreViews: AppView[] = ['more', 'story', 'guide', 'settings', 'chart-of-accounts'];

const getPageTitle = (view: AppView) => {
  if (view === 'entry') return 'العمليات';
  if (view === 'journal') return 'اليومية';
  if (view === 'database') return 'المخزون';
  if (reportViews.includes(view)) return 'التقارير';
  if (view === 'story') return 'حالة واتساب';
  if (view === 'guide') return 'الدليل المحاسبي';
  if (view === 'settings') return 'الإعدادات';
  if (view === 'chart-of-accounts') return 'دليل الحسابات';
  if (view === 'more') return 'المزيد';
  return 'الرئيسية';
};

const LazyViewFallback = ({ label }: { label: string }) => (
  <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-8 text-center text-sm font-bold text-[#8a8172]" dir="rtl">
    <div className="flex flex-col items-center gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c9a84c] border-t-transparent" />
      <span>جارٍ تحميل {label}...</span>
    </div>
  </div>
);

export default function App() {
  const {
    user, isAuthReady, setEntries, view, setView, setReportsTab,
    globalError, setGlobalError, setIsUpdatingPrice,
    editingEntry, setEditingEntry, accountsDb,
    costCalculationRun, requestCostRetry
  } = useAppStore();

  const {
    loading, authError, isSigningIn, isStandalone, handleSignIn
  } = useAuthInit();

  useDataSync(user, isAuthReady);
  useCostRecalculation();

  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [entryStep, setEntryStep] = useState(1);
  // Local UI-only preview for responsive navigation checks. Vite removes this
  // branch from production because import.meta.env.DEV is false in builds.
  const isUiNavigationPreview = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ui-preview') === '1';

  const isIOS = typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isEntryDarkShell = view === 'entry' && entryStep >= 2;

  useEffect(() => {
    if (view !== 'entry') setEntryStep(1);
  }, [view]);

  const refreshData = async () => {
    if (!user) return;
    setIsUpdatingPrice(true);
    try {
      const isAdmin = isAdminEmail(user.email);
      const q = isAdmin
        ? query(collection(db, 'entries'))
        : query(collection(db, 'entries'), where('userId', '==', user.uid));

      const snapshot = await getDocsFromServer(q);
      const data = snapshot.docs.map(d => {
        const docData = d.data();
        return { id: d.id, ...docData } as Entry;
      });

      const sortedData = data.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.seq || 0) - (a.seq || 0);
      });

      setEntries(sortedData);
    } catch (error) {
      console.error('Refresh Error:', error);
      setGlobalError('فشل تحديث البيانات من السيرفر. يرجى التحقق من اتصالك بالإنترنت.');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const toggleFullscreen = () => {
    if (isIOS && !isStandalone) {
      alert("للحصول على شاشة كاملة في آيفون:\n1. اضغط على علامة (AA) في شريط العنوان.\n2. اختر Hide Toolbar\nأو أضف التطبيق للشاشة الرئيسية.");
      return;
    }
    const docEl = document.documentElement as any;
    const doc = document as any;
    try {
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (docEl.requestFullscreen) docEl.requestFullscreen();
        else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (view === 'inventory') setReportsTab('inventory');
    if (view === 'profit-analysis' || view === 'advanced-analytics') setReportsTab('inventory-profitability');
  }, [view, setReportsTab]);

  const handleDelete = async (id: string) => {
    if (areOperationWritesLocked(costCalculationRun)) {
      setGlobalError('لا يمكن حذف العمليات أثناء توقف أو إعادة احتساب التكلفة. أصلح الخطأ من الإعدادات ثم أعد المحاولة.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'entries', id));
      if (user) {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'delete', collection: 'entries', documentId: id,
          userId: user.uid, userEmail: user.email, timestamp: serverTimestamp()
        });
      }
      setEditingEntry(null);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Delete Error:", error);
      setGlobalError('فشل حذف القيد. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (areOperationWritesLocked(costCalculationRun)) {
      setGlobalError('لا يمكن تعديل العمليات أثناء توقف أو إعادة احتساب التكلفة. أصلح الخطأ من الإعدادات ثم أعد المحاولة.');
      return;
    }
    if (!editingEntry?.id || isUpdatingEntry) return;

    const entryToUpdate = { ...editingEntry };
    setIsUpdatingEntry(true);
    try {
      const { id, ...rawData } = entryToUpdate;
      const identity = resolveEntryIdentity({ ...rawData, tx: rawData.tx || '', debit: rawData.debit || '', credit: rawData.credit || '' }, accountsDb);
      if (identity.ok === false) {
        setGlobalError(identity.message);
        return;
      }
      Object.assign(rawData, identity.value);
      const accountingPolicyIssues = validateAccountingPolicy(rawData, accountsDb);
      if (accountingPolicyIssues.length > 0) {
        setGlobalError(accountingPolicyIssues.map(issue => issue.message).join(' — '));
        return;
      }
      const calculationKarat = rawData.karat ?? inferGoldKaratFromMultiplier(rawData.multiplier);
      if (isGoldEquivalentEntry(rawData, accountsDb) && canCalculateGoldEquivalent21(rawData.weight || '', calculationKarat)) {
        const goldAudit = buildGoldEquivalent21Audit(rawData.weight || '', calculationKarat, rawData.arabicWeight);
        if (goldAudit) {
          rawData.goldEquivalent21Snapshot = goldAudit.snapshot;
          if (goldAudit.legacyComparison) rawData.goldEquivalent21LegacyComparison = goldAudit.legacyComparison;
        }
      }
      const data: any = {};
      Object.keys(rawData).forEach(key => {
        const val = (rawData as any)[key];
        if (val !== undefined && (typeof val !== 'number' || !isNaN(val))) {
          data[key] = val;
        }
      });

      await updateDoc(doc(db, 'entries', id), { ...data, updatedAt: serverTimestamp() });
      if (user) {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'update', collection: 'entries', documentId: id,
          userId: user.uid, userEmail: user.email, changes: data, timestamp: serverTimestamp()
        });
      }
      setEditingEntry(null);
    } catch (error) {
      console.error("Update Error:", error);
      setGlobalError('فشل تحديث القيد. يرجى مراجعة البيانات والاتصال.');
    } finally {
      setIsUpdatingEntry(false);
    }
  };

  const handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      ['firebaseLocalStorageDb', `firestore/[DEFAULT]/${firebaseProjectId}/${firestoreDatabaseId}`].forEach(n => {
        try { indexedDB.deleteDatabase(n); } catch(e) {}
      });
    } catch (e) {
      console.error("Reset error:", e);
    }
    window.location.href = window.location.origin + '?reset=' + Date.now();
  };

  const navItems = [
    { id: 'home' as AppView, label: 'الرئيسية', icon: <Home className="h-5 w-5" />, active: view === 'home', onClick: () => setView('home') },
    { id: 'journal' as AppView, label: 'اليومية', icon: <BookOpenCheck className="h-5 w-5" />, active: view === 'journal', onClick: () => setView('journal') },
    {
      id: 'entry' as AppView,
      label: 'عملية',
      icon: <PlusCircle className="h-8 w-8" />,
      active: view === 'entry',
      onClick: () => {
        if (areOperationWritesLocked(costCalculationRun)) {
          setGlobalError('العمليات مقفلة حتى يكتمل احتساب التكلفة بنجاح.');
          return;
        }
        setView('entry');
      },
      variant: 'primary' as const,
    },
    { id: 'reports' as AppView, label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, active: reportViews.includes(view), onClick: () => setView('reports') },
    { id: 'more' as AppView, label: 'المزيد', icon: <Menu className="h-5 w-5" />, active: moreViews.includes(view), onClick: () => setView('more') },
  ];

  const pageTitle = getPageTitle(view);

  if (globalError) {
    return <GlobalErrorView globalError={globalError} setGlobalError={setGlobalError} />;
  }

  if (loading && !isUiNavigationPreview) {
    return <LoadingView authHangError={false} authStage="فحص الحساب..." handleHardReset={handleHardReset} />;
  }

  if (!user && !isUiNavigationPreview) {
    return (
      <LoginView
        authError={authError}
        isSigningIn={isSigningIn}
        isStandalone={isStandalone}
        handleSignIn={handleSignIn}
        handleHardReset={handleHardReset}
      />
    );
  }

  return (
    <ErrorBoundary>
      <div
        className={`pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+2rem)] font-sans ${isEntryDarkShell ? 'flex min-h-[100svh] flex-col bg-[#020408] text-[#f5f1e8]' : view === 'entry' ? 'min-h-[100dvh] bg-[#fffdf7] text-[#15203b]' : 'min-h-[100dvh] bg-[#020408] text-[#f5f1e8]'}`}
        dir="rtl"
      >
        <main className={`mx-auto max-w-2xl px-4 pt-4 sm:pt-6 ${isEntryDarkShell ? 'flex w-full flex-1 flex-col' : ''}`}>
          <header className={`sticky top-0 z-30 -mx-4 border-b px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl ${isEntryDarkShell ? 'mb-3 border-[#1a1e2a]/80 bg-[#020408]/92' : view === 'entry' ? 'mb-4 border-[#15203b]/10 bg-[#fffdf7]/94' : 'mb-4 border-[#1a1e2a]/80 bg-[#020408]/92'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {view === 'entry' ? (
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c99a2e]/12 ${isEntryDarkShell ? 'text-[#c9a84c]' : 'text-[#b17f1d]'}`}>
                      <Gem className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <h1 className={`truncate text-[30px] font-black leading-none ${isEntryDarkShell ? 'text-[#f5f1e8]' : 'text-[#15203b]'}`}>{pageTitle}</h1>
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c9a84c]">نظام مؤسسة مكة</div>
                    <h1 className="mt-1 truncate text-lg font-black text-[#f5f1e8]">{pageTitle}</h1>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={refreshData}
                aria-label="تحديث البيانات"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-[#c9a84c] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99a2e] ${isEntryDarkShell ? 'border-[#1a1e2a] bg-[#0e1018]' : view === 'entry' ? 'border-[#15203b]/10 bg-white shadow-sm' : 'border-[#1a1e2a] bg-[#0e1018]'}`}
                title="تحديث البيانات"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </header>

          {(costCalculationRun.status === 'running' || costCalculationRun.status === 'failed') && (
            <div className={`mb-4 rounded-2xl border p-4 text-sm ${costCalculationRun.status === 'failed' ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'}`}>
              <div className="font-black">
                {costCalculationRun.status === 'running'
                  ? 'جارٍ إعادة احتساب التكلفة، برجاء الانتظار'
                  : 'فشل إعادة احتساب التكلفة — العمليات وتقارير التكلفة متوقفة'}
              </div>
              {costCalculationRun.error && (
                <div className="mt-2 break-words text-xs">
                  {costCalculationRun.error.code}: {costCalculationRun.error.message}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={requestCostRetry} className="rounded-xl bg-[#c9a84c] px-4 py-2 text-xs font-black text-[#080a0f]">
                  إعادة المحاولة
                </button>
                <button type="button" onClick={() => setView('settings')} className="rounded-xl border border-current px-4 py-2 text-xs font-black">
                  فتح الإعدادات
                </button>
              </div>
            </div>
          )}

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
                <EntryForm onStepChange={setEntryStep} />
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
              {view === 'more' && <MoreView isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onLogOut={logOut} />}
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
        </main>

        <AppBottomNavigation>
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              active={item.active}
              onClick={item.onClick}
              icon={item.icon}
              label={item.label}
              variant={item.variant}
            />
          ))}
        </AppBottomNavigation>

        <AnimatePresence>
          {editingEntry && (editingEntry as any).id && (
            <EditingEntryModal
              editingEntry={editingEntry}
              setEditingEntry={setEditingEntry}
              handleUpdate={handleUpdate}
              handleDelete={handleDelete}
              deleteConfirmId={deleteConfirmId}
              setDeleteConfirmId={setDeleteConfirmId}
              isUpdating={isUpdatingEntry}
            />
          )}
        </AnimatePresence>

        <InvoicePrintModal />
      </div>
    </ErrorBoundary>
  );
}
