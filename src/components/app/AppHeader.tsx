import { Gem, RefreshCw } from 'lucide-react';
import type { AppView } from './NavigationMetadata';

interface AppHeaderProps {
  view: AppView;
  pageTitle: string;
  isEntryDarkShell: boolean;
  onRefresh: () => void;
}

export function AppHeader({ view, pageTitle, isEntryDarkShell, onRefresh }: AppHeaderProps) {
  return (
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
                onClick={onRefresh}
                aria-label="تحديث البيانات"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-[#c9a84c] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99a2e] ${isEntryDarkShell ? 'border-[#1a1e2a] bg-[#0e1018]' : view === 'entry' ? 'border-[#15203b]/10 bg-white shadow-sm' : 'border-[#1a1e2a] bg-[#0e1018]'}`}
                title="تحديث البيانات"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </header>
  );
}
