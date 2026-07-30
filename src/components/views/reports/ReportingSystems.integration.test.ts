import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('accounting and legacy reporting UI integration', () => {
  it('keeps official EGP statements and restores separately labelled legacy operational views', () => {
    const source = readFileSync(new URL('../ReportsView.tsx', import.meta.url), 'utf8');
    expect(source).toContain('قائمة الدخل المحاسبية');
    expect(source).toContain('المركز المالي المحاسبي');
    expect(source).toContain('التغير في حقوق الملكية');
    expect(source).toContain('تقرير الدخل التشغيلي القديم');
    expect(source).toContain('المركز المالي التشغيلي القديم');
    expect(source).toContain("import('./reports/IncomeStatementView')");
    expect(source).toContain("import('./reports/BalanceSheetView')");
    expect(source).toContain('هذا تقرير تشغيلي حسب طريقة العمل القديمة، وليس قائمة مالية محاسبية رسمية.');
  });

  it('shows the mandatory fail-closed Arabic cost warning with record-level remediation', () => {
    const source = readFileSync(new URL('./CostDataBlockedView.tsx', import.meta.url), 'utf8');
    expect(source).toContain('لا يمكن احتساب التكلفة والربح بدقة قبل استكمال بيانات التكلفة المطلوبة.');
    expect(source).toContain('التصحيح المطلوب');
    expect(source).toContain('التقارير المحجوبة');
  });
});