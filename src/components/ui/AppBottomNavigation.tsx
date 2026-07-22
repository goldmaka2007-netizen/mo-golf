import type { ReactNode } from 'react';

export function AppBottomNavigation({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 bg-[#0e1018]/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      <nav
        className="grid h-[var(--bottom-nav-height)] grid-cols-5 items-end gap-1 border-t border-[#2a2e3a] px-2 pb-2 pt-2"
        aria-label="التنقل الرئيسي"
      >
        {children}
      </nav>
    </div>
  );
}
