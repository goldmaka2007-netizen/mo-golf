import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../../types';
import { buildWacAuditCsv } from '../wacAuditExcel';

const inventory: Account = { id: 'gold-stock', name: 'Gold stock', mainType: 'assets', subType: 'inventory_gold', canonicalMainType: 'assets', canonicalSubType: 'inventory_gold', balanceNature: 'gold', type: 'gold_product', metal: 'gold', is_inventory: true, userId: 'u', karat: '21' };
const legacyAlaa: Account = { id: 'CGuSD99FTGDiX3fdfuCc', name: 'الاء ياسر', mainType: 'liabilities', subType: 'other_due', balanceNature: 'gold', type: 'other', metal: 'gold', is_inventory: false, userId: 'u' };
const entry: Entry = { id: 'receipt', seq: 1, tx: 'merchant receipt', operationKind: 'purchase', date: '2026-01-01', debit: inventory.name, debitAccountId: inventory.id, credit: legacyAlaa.name, creditAccountId: legacyAlaa.id, cash: '0', weight: '1', arabicWeight: '1', count: '0', notes: '', userId: 'u', karat: 21, invoiceOfficialPricePerGramEgp: 5000 };
const inventoryTimeline = { valid: true, results: [], resultsByOperationId: {}, finalStates: {}, diagnostics: [], orderingDiagnostics: [], calculationVersion: 'test' } as any;

describe('Merchant WAC runtime account normalization', () => {
  it('includes an approved stable-ID runtime merchant override in the WAC summary', () => {
    const report = buildWacAuditCsv({ entries: [entry], accounts: [inventory, legacyAlaa], openingCostConfig: {} as any, inventoryTimeline });
    expect(report.rows.some(row => row['Account ID'] === legacyAlaa.id && row['نوع الحساب'] === 'تاجر')).toBe(true);
  });
});
