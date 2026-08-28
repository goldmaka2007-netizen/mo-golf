import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = readFileSync(new URL('../CanonicalAccountsView.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../settings/SettingsAccountsPanel.tsx', import.meta.url), 'utf8');
describe('account management UI regressions', () => {
  it('routes accounts to chart and rules to guide', () => { expect(settings).toContain('onOpenAccounts'); expect(readFileSync(new URL('../SettingsView.tsx', import.meta.url), 'utf8')).toContain("onOpenAccounts={() => setView('chart-of-accounts')}"); expect(readFileSync(new URL('../SettingsView.tsx', import.meta.url), 'utf8')).toContain("onOpenGuide={() => setView('guide')}"); });
  it('keeps clone modal above navigation and viewport-safe', () => { expect(source).toContain('z-[60]'); expect(source).toContain('100dvh'); expect(source).toContain('safe-area-inset-bottom'); expect(source).toContain('overflow-y-auto'); });
  it('exposes Manage Uses and protected copy', () => { expect(source).toContain('إدارة استخدامات الحساب'); expect(source).toContain('هذا الحساب محمي'); expect(source).toContain('إضافة استخدام'); });
});
