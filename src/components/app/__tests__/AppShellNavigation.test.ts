import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getPageTitle, moreViews, reportViews } from '../NavigationMetadata';

const appSource = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8');
const viewContentSource = readFileSync(new URL('../AppViewContent.tsx', import.meta.url), 'utf8');

describe('App shell navigation metadata', () => {
  it('preserves report and more navigation grouping and page-title equivalence', () => {
    expect(reportViews).toEqual(['reports', 'inventory', 'profit-analysis', 'advanced-analytics']);
    expect(moreViews).toEqual(['more', 'story', 'guide', 'settings', 'chart-of-accounts']);
    expect(getPageTitle('reports')).toBe(getPageTitle('inventory'));
    expect(getPageTitle('reports')).toBe(getPageTitle('advanced-analytics'));
    expect(getPageTitle('home')).not.toBe(getPageTitle('reports'));
  });
});

describe('App shell view routing contract', () => {
  it('keeps every existing view mapped to the same screen', () => {
    for (const screen of ['MainDashboard', 'EntryForm', 'DailyJournalView', 'InventoryCheckView', 'ReportsView', 'MoreView', 'StoryBuilderView', 'AccountingGuideView', 'SettingsView', 'CanonicalAccountsView']) {
      expect(viewContentSource).toContain(screen);
    }
  });

  it('keeps the entry write-lock gate in App navigation', () => {
    const entryNavigation = appSource.slice(appSource.indexOf("id: 'entry'"), appSource.indexOf("id: 'reports'"));
    expect(entryNavigation).toContain('areOperationWritesLocked(costCalculationRun)');
    expect(entryNavigation).toContain("setView('entry')");
  });

  it('keeps lazy-loaded screens behind Suspense', () => {
    expect(viewContentSource).toContain('React.lazy');
    expect(viewContentSource).toContain('<Suspense');
    expect(viewContentSource).toContain("import('../views/ReportsView')");
    expect(viewContentSource).toContain("import('../views/InventoryCheckView')");
    expect(viewContentSource).toContain("import('../views/StoryBuilderView')");
    expect(viewContentSource).toContain("import('../views/SettingsView')");
  });
});
