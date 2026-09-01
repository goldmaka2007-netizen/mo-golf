import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GeneralLedgerView Central runtime routing', () => {
  it('routes Ledger details through the Central read-only runtime without direct report-engine calls', () => {
    const source = readFileSync(new URL('../reports/GeneralLedgerView.tsx', import.meta.url), 'utf8');

    expect(source).toMatch(/buildCentralAccountingReadOnlyRuntimeGeneralLedger/);
    expect(source).toMatch(/sourceAccounts:\s*accountsDb/);
    expect(source).toMatch(/reportAccounts:\s*accounts/);
    expect(source).not.toMatch(/buildLedgerReport\(/);
    expect(source).not.toMatch(/getAvailableDimensions\(/);
    expect(source).not.toMatch(/computePeriodAccountBalances\(/);
    expect(source).toContain('لم يتم الرجوع للمسار القديم');
  });

  it('keeps report cutoff filtering before Central Shadow while preserving all-time summary through today', () => {
    const source = readFileSync(new URL('../reports/GeneralLedgerView.tsx', import.meta.url), 'utf8');

    expect(source).toMatch(/const summaryEndDate = today\(\)/);
    expect(source).toMatch(/const runtimeCutoff = to > summaryEndDate \? to : summaryEndDate/);
    expect(source).toMatch(/entries\.filter\(entry => entry\.date <= runtimeCutoff\)/);
    expect(source).toMatch(/summaryEndDate,/);
  });

  it('keeps the UI free from persistence and alternate accounting authorities', () => {
    const source = readFileSync(new URL('../reports/GeneralLedgerView.tsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/RAW_DATA|OPERATION_RULES|CATS/);
    expect(source).not.toMatch(/setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
    expect(source).not.toMatch(/buildFinancialStatementsEgp/);
  });
});
