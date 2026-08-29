import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = readFileSync(new URL('../CanonicalAccountsView.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../settings/SettingsAccountsPanel.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8');
const header = readFileSync(new URL('../../app/AppHeader.tsx', import.meta.url), 'utf8');
describe('account management UI regressions', () => {
  it('routes accounts to chart and rules to guide', () => { expect(settings).toContain('onOpenAccounts'); expect(readFileSync(new URL('../SettingsView.tsx', import.meta.url), 'utf8')).toContain("onOpenAccounts={() => setView('chart-of-accounts')}"); expect(readFileSync(new URL('../SettingsView.tsx', import.meta.url), 'utf8')).toContain("onOpenGuide={() => setView('guide')}"); });
  it('keeps clone modal above navigation and viewport-safe', () => { expect(source).toContain('z-[60]'); expect(source).toContain('100dvh'); expect(source).toContain('safe-area-inset-bottom'); expect(source).toContain('overflow-y-auto'); });
  it('keeps account identity separate from tappable actions and hides unavailable use options', () => { expect(source).toContain('flex-col items-stretch'); expect(source).toContain('grid w-full grid-cols-1'); expect(source).toContain('safeUseOptions.length === 0'); expect(source).toContain('لا توجد استخدامات إضافية آمنة متاحة لهذا الحساب.'); expect(source).toContain('{safeUseOptions.map'); });
  it('exposes Manage Uses and protected copy', () => { expect(source).toContain('إدارة استخدامات الحساب'); expect(source).toContain('هذا الحساب محمي'); expect(source).toContain('إضافة استخدام'); });
  it('keeps clone failures inside the active modal with quota-safe copy', () => { expect(source).toContain('role="alert"'); expect(source).toContain('تم تجاوز حد استخدام قاعدة البيانات حاليًا. لم يتم إنشاء الحساب. حاول مرة أخرى لاحقًا.'); expect(source).toContain('setCloneError(cloneErrorMessage(error))'); });
  it('uses realtime sync without a global full-entry server refresh', () => { expect(app).not.toContain('getDocsFromServer'); expect(app).not.toContain('refreshData'); expect(header).not.toContain('onRefresh'); expect(header).toContain('المزامنة تلقائية'); expect(header).not.toContain('onClick'); });
});
