import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildLedgerCsv, buildLedgerReport, formatLedgerAmount } from '../ledgerReport';
import { buildTrialBalanceCsv, buildTrialBalanceReport } from '../trialBalanceReport';
import { buildInventoryCycleReport, getDefaultInventoryCycleFilters } from '../inventoryCycleReport';

const mojibakePattern = /[\u00c2\u00c3\u00d8\u00d9\u00db\u00e2\u20ac\ufffd]/;

const accounts: Account[] = [
  { id: 'cash', name: '\u0627\u0644\u062e\u0632\u0646\u0629', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', is_inventory: false, userId: 'u' },
  { id: 'sales', name: '\u0645\u0628\u064a\u0639\u0627\u062a', mainType: 'revenue', subType: 'sales', balanceNature: 'cash', type: 'other', is_inventory: false, userId: 'u' },
  { id: 'acc', name: '\u0645\u0644\u062d\u0642\u0627\u062a', mainType: 'asset', subType: 'inventory', balanceNature: 'piece', type: 'accessory', is_inventory: true, quantityStep: 2, userId: 'u' },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: overrides.id ?? 'e1',
  seq: overrides.seq ?? 1,
  tx: overrides.tx ?? '\u0628\u064a\u0639',
  date: overrides.date ?? '2026-01-01',
  debit: '',
  credit: '',
  cash: '0',
  weight: '0',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u',
  ...overrides,
});

describe('Arabic text integrity', () => {
  it('does not emit mojibake markers from report strings or CSV exports', () => {
    const entries = [
      entry({ id: 'cash-sale', debit: '\u0627\u0644\u062e\u0632\u0646\u0629', debitAccountId: 'cash', credit: '\u0645\u0628\u064a\u0639\u0627\u062a', creditAccountId: 'sales', cash: '125' }),
      entry({ id: 'acc-sale', debit: '\u0627\u0644\u062e\u0632\u0646\u0629', debitAccountId: 'cash', credit: '\u0645\u0644\u062d\u0642\u0627\u062a', creditAccountId: 'acc', cash: '50', weight: '1' }),
    ];

    const ledger = buildLedgerReport(entries, accounts, accounts[0], 'cash', '2026-01-01', '2026-01-31');
    const ledgerCsv = buildLedgerCsv({ accountName: accounts[0].name, dimension: 'cash', startDate: '2026-01-01', endDate: '2026-01-31', report: ledger, rows: ledger.rows, goldDisplayMode: 'equivalent21' });
    const trial = buildTrialBalanceReport(entries, accounts, 'cash', '2026-01-01', '2026-01-31');
    const trialCsv = buildTrialBalanceCsv([trial], '2026-01-01', '2026-01-31');
    const cycle = buildInventoryCycleReport({ entries, accountsDb: accounts, tab: 'accessory', filters: { ...getDefaultInventoryCycleFilters('accessory'), startDate: '2026-01-01', endDate: '2026-01-31', accountId: 'all', movementKind: 'all' }, goldPrice: 1, silverPrice: 1 });

    const output = JSON.stringify({ ledger, ledgerCsv, trial, trialCsv, cycle, quantity: formatLedgerAmount(5, 'quantity') });
    expect(ledgerCsv.startsWith('\uFEFF')).toBe(true);
    expect(trialCsv.startsWith('\uFEFF')).toBe(true);
    expect(output).toContain('\u0642\u0637\u0639\u0629');
    expect(output).not.toMatch(mojibakePattern);
  });

  it('keeps recently touched Arabic source files free of mojibake markers', () => {
    const files = [
      'src/components/views/EntryForm.tsx',
      'src/components/views/HomeView.tsx',
      'src/components/views/reports/GeneralLedgerView.tsx',
      'src/components/views/reports/TrialBalanceView.tsx',
      'index.html',
      'public/manifest.json',
      'src/lib/inventoryCheckSettlement.ts',
      'src/lib/inventoryCycleReport.ts',
      'src/lib/ledgerReport.ts',
      'src/lib/trialBalanceReport.ts',
    ];
    const source = files.map(file => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(mojibakePattern);
    expect(readFileSync('index.html', 'utf8')).toMatch(/<meta charset="UTF-8" \/>/);
  });
});
