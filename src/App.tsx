import React, { useState, useEffect } from 'react';
import { deleteDoc, doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store';
import { db, firebaseProjectId, firestoreDatabaseId, logOut } from './firebase';
import { buildGoldEquivalent21Audit, canCalculateGoldEquivalent21, inferGoldKaratFromMultiplier } from './lib/goldEquivalent';
import { isGoldEquivalentEntry } from './utils/accountLogic';
import { resolveEntryIdentity } from './lib/entryIdentity';
import { validateAccountingPolicy } from './lib/accountingPolicy';

import { Home, BookOpenCheck, PlusCircle, BarChart3, Menu } from 'lucide-react';

import { EditingEntryModal } from './components/views/EditingEntryModal';
import { InvoicePrintModal } from './components/views/InvoicePrintModal';
import { AppHeader } from './components/app/AppHeader';
import { AppViewContent } from './components/app/AppViewContent';
import { getPageTitle, moreViews, reportViews, type AppView } from './components/app/NavigationMetadata';

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

export default function App() {
  const {
    user, isAuthReady, view, setView, setReportsTab,
    globalError, setGlobalError,
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
          <AppHeader view={view} pageTitle={pageTitle} isEntryDarkShell={isEntryDarkShell} />

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

          <AppViewContent view={view} isEntryDarkShell={isEntryDarkShell} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onLogOut={logOut} onEntryStepChange={setEntryStep} />
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
