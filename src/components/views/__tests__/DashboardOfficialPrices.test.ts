import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('active dashboard official prices', () => {
  const appSource = readFileSync(new URL('../../../App.tsx', import.meta.url), 'utf8');
  const mainDashboardSource = readFileSync(new URL('../MainDashboard.tsx', import.meta.url), 'utf8');
  const dashboardSource = readFileSync(new URL('../DashboardView.tsx', import.meta.url), 'utf8');

  it('renders DashboardView through the active home route', () => {
    expect(appSource).toContain("view === 'home' && <MainDashboard");
    expect(mainDashboardSource).toContain('<DashboardView refreshData={refreshData} />');
  });

  it('places editable official gold and silver prices before the activity snapshot', () => {
    const prices = dashboardSource.indexOf('الأسعار الرسمية المعتمدة اليوم');
    const activitySnapshot = dashboardSource.indexOf('title="لقطة النشاط"');

    expect(prices).toBeGreaterThanOrEqual(0);
    expect(prices).toBeLessThan(activitySnapshot);
    expect(dashboardSource).toContain('aria-label="سعر الذهب الرسمي عيار 21"');
    expect(dashboardSource).toContain('aria-label="سعر الفضة الرسمي"');
    expect(dashboardSource).toContain('حفظ واعتماد الأسعار');
  });

  it('persists both prices to the signed-in user settings document', () => {
    expect(dashboardSource).toContain("setDoc(doc(db, 'settings', user.uid)");
    expect(dashboardSource).toContain('goldPrice: nextGoldPrice');
    expect(dashboardSource).toContain('silverPrice: nextSilverPrice');
    expect(dashboardSource).toContain('تم حفظ الأسعار واعتمادها في الفواتير والتقييمات.');
  });
});