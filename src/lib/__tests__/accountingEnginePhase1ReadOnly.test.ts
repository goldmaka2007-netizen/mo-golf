import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildLegacyJournalProjection } from '../legacyLedger';
import { buildOperationalProjection } from '../operationalProjection';

const accounts: Account[] = [
  { id: 'cash', name: 'الخزنة', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', userId: 'test' },
  { id: 'silver', name: 'كسر فضة', mainType: 'asset', subType: 'inventory', balanceNature: 'silver', type: 'silver', metal: 'silver', is_inventory: true, userId: 'test' },
];
const entries: Entry[] = [{
  id: 'read-only-row', tx: 'شراء فضة', operationKind: 'purchase', debit: 'كسر فضة', debitAccountId: 'silver',
  credit: 'الخزنة', creditAccountId: 'cash', date: '2026-01-01', cash: '100', weight: '2', arabicWeight: '2',
  count: '0', notes: '', userId: 'test',
}];

describe('Phase 1 engines are read-only', () => {
  it('does not mutate imported documents or contain Firestore write/delete calls', () => {
    const before = JSON.stringify(entries);
    buildLegacyJournalProjection(entries, accounts);
    buildOperationalProjection(entries, accounts);
    expect(JSON.stringify(entries)).toBe(before);
    const sources = ['../legacyLedger.ts', '../operationalProjection.ts', '../trialBalanceReport.ts', '../ledgerReport.ts']
      .map(relative => readFileSync(new URL(relative, import.meta.url), 'utf8'))
      .join('\n');
    expect(sources).not.toMatch(/from ['"]firebase|setDoc\(|addDoc\(|deleteDoc\(|writeBatch\(/);
  });
});
