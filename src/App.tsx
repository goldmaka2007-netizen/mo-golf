import React, { useState, useEffect } from 'react';
import { deleteDoc, doc, updateDoc, serverTimestamp, addDoc, collection, getDocsFromServer, query, where, getDocFromServer } from 'firebase/firestore';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store';
import { db, logOut } from './firebase';
import { Entry } from './types';
import { buildGoldEquivalent21Audit, canCalculateGoldEquivalent21, inferGoldKaratFromMultiplier } from './lib/goldEquivalent';
import { isGoldEquivalentEntry } from './utils/accountLogic';

import { Home, BookOpenCheck, PlusCircle, BarChart3, Menu, RefreshCw } from 'lucide-react';

import { MainDashboard } from './components/views/MainDashboard';
import { EntryForm } from './components/views/EntryForm';
import { SettingsView } from './components/views/SettingsView';
import { EditingEntryModal } from './components/views/EditingEntryModal';
import { DailyJournalView } from './components/views/DailyJournalView';
import { AccountingGuideView } from './components/views/AccountingGuideView';
import { ReportsView } from './components/views/ReportsView';
import { StoryBuilderView } from './components/views/StoryBuilderView';
import { InvoicePrintModal } from './components/views/InvoicePrintModal';
import { MoreView } from './components/views/MoreView';

import { ErrorBoundary } from './components/ErrorBoundary';
import { NavButton } from './components/ui/NavButton';
import { LoadingView } from './components/views/LoadingView';
import { LoginView } from './components/views/LoginView';
import { GlobalErrorView } from './components/views/GlobalErrorView';

import { useAuthInit } from './hooks/useAuthInit';
import { useDataSync } from './hooks/useDataSync';

type AppView = ReturnType<typeof useAppStore.getState>['view'];

const reportViews: AppView[] = ['reports', 'inventory', 'profit-analysis', 'advanced-analytics'];
const moreViews: AppView[] = ['more', 'story', 'guide', 'settings'];

export default function App() {
  const {
    user, isAuthReady, setEntries, view, setView, setReportsTab,
    globalError, setGlobalError, setIsUpdatingPrice,
    editingEntry, setEditingEntry, accountsDb
  } = useAppStore();

  const {
    loading, authError, isSigningIn, isStandalone, handleSignIn
  } = useAuthInit();

  useDataSync(user, isAuthReady);

  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isIOS = typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  const refreshData = async () => {
    if (!user) return;
    setIsUpdatingPrice(true);
    try {
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || "mohamedyasser757.my@gmail.com";
      const isAdmin = user.email?.toLowerCase() === adminEmail.toLowerCase();
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
    if (view === 'profit-analysis') setReportsTab('profit-analysis');
    if (view === 'advanced-analytics') setReportsTab('advanced-analytics');
  }, [view, setReportsTab]);

  const handleDelete = async (id: string) => {
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
    if (!editingEntry?.id || isUpdatingEntry) return;

    const entryToUpdate = { ...editingEntry };
    setIsUpdatingEntry(true);
    try {
      const { id, ...rawData } = entryToUpdate;
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

  useEffect(() => {
    if (isAuthReady && user) {
      getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
    }
  }, [isAuthReady, user]);

  const handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      ['firebaseLocalStorageDb', 'firestore/[DEFAULT]/gen-lang-client-0332689520/main'].forEach(n => {
        try { indexedDB.deleteDatabase(n); } catch(e) {}
      });
    } catch (e) {
      console.error("Reset error:", e);
    }
    window.location.href = window.location.origin + '?reset=' + Date.now();
  };

  const navItems = [
    { id: 'home' as AppView, label: 'الرئيسية', icon: <Home className="h-5 w-5" />, active: view === 'home', onClick: () => setView('home') },
    { id: 'journal' as AppView, label: 'اليومية', icon: <BookOpenCheck className="h-5 w-5" />, active: view === 'journal' || view === 'database', onClick: () => setView('journal') },
    { id: 'entry' as AppView, label: 'عملية', icon: <PlusCircle className="h-8 w-8" />, active: view === 'entry', onClick: () => setView('entry'), variant: 'primary' as const },
    { id: 'reports' as AppView, label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, active: reportViews.includes(view), onClick: () => setView('reports') },
    { id: 'more' as AppView, label: 'المزيد', icon: <Menu className="h-5 w-5" />, active: moreViews.includes(view), onClick: () => setView('more') },
  ];

  const pageTitle = (() => {
    if (view === 'entry') return 'عملية جديدة';
    if (view === 'journal' || view === 'database') return 'اليومية';
    if (reportViews.includes(view)) return 'التقارير';
    if (view === 'story') return 'حالة واتساب';
    if (view === 'guide') return 'الدليل المحاسبي';
    if (view === 'settings') return 'الإعدادات';
    if (view === 'more') return 'المزيد';
    return 'الرئيسية';
  })();

  if (globalError) {
    return <GlobalErrorView globalError={globalError} setGlobalError={setGlobalError} />;
  }

  if (loading) {
    return <LoadingView authHangError={false} authStage="فحص الحساب..." handleHardReset={handleHardReset} />;
  }

  if (!user) {
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
      <div className="min-h-screen bg-[#020408] pb-28 font-sans text-[#f5f1e8]" dir="rtl">
        <div className="mx-auto max-w-2xl px-4 pt-4 sm:pt-6">
          <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-[#1a1e2a]/80 bg-[#020408]/92 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c9a84c]">نظام مؤسسة مكة</div>
                <h1 className="mt-1 truncate text-lg font-black text-[#f5f1e8]">{pageTitle}</h1>
              </div>
              <button
                type="button"
                onClick={refreshData}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#1a1e2a] bg-[#0e1018] text-[#c9a84c] transition-all active:scale-95"
                title="تحديث البيانات"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {view === 'home' && <MainDashboard refreshData={refreshData} />}
              {view === 'entry' && <EntryForm />}
              {(view === 'journal' || view === 'database') && <DailyJournalView />}
              {reportViews.includes(view) && <ReportsView />}
              {view === 'more' && <MoreView isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onLogOut={logOut} />}
              {view === 'story' && <StoryBuilderView />}
              {view === 'guide' && <AccountingGuideView />}
              {view === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
          <nav className="mx-auto grid h-[76px] max-w-2xl grid-cols-5 items-end gap-1 rounded-[28px] border border-[#1a1e2a] bg-[#0e1018]/96 px-2 pb-2 pt-3 shadow-[0_-18px_44px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
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
          </nav>
        </div>

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
