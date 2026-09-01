import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Phase 4C Financial Statements Central runtime routing', () => {
  it('routes EGP Income Statement through the Central adapter with no direct engine fallback', () => {
    const source = readFileSync(new URL('../reports/EgpIncomeStatementView.tsx', import.meta.url), 'utf8');

    expect(source).toMatch(/buildCentralAccountingReadOnlyRuntimeFinancialStatements/);
    expect(source).not.toMatch(/buildFinancialStatementsEgp\(/);
    expect(source).toContain('لم يتم الرجوع للمسار القديم');
    expect(source).not.toMatch(/RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
  });

  it('routes both Financial Position display and export through the Central adapter', () => {
    const source = readFileSync(new URL('../reports/EgpBalanceSheetView.tsx', import.meta.url), 'utf8');
    const calls = source.match(/buildCentralAccountingReadOnlyRuntimeMonthlyFinancialPosition\(/g) ?? [];

    expect(calls).toHaveLength(2);
    expect(source).not.toMatch(/buildMonthlyFinancialPosition\(/);
    expect(source).toMatch(/financialPositionCsvRows\(latestReport\)/);
    expect(source).toContain('لم يتم الرجوع للمسار القديم');
    expect(source).not.toMatch(/RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
  });

  it('keeps the comprehensive Financial Statements wrapper delegated to the same two Central-wired child views', () => {
    const source = readFileSync(new URL('../reports/FinancialStatementsView.tsx', import.meta.url), 'utf8');

    expect(source).toMatch(/EgpIncomeStatementView/);
    expect(source).toMatch(/EgpBalanceSheetView/);
    expect(source).not.toMatch(/buildFinancialStatementsEgp|buildMonthlyFinancialPosition/);
  });
});
