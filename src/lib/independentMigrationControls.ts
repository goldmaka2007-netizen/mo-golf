import type { Account, Entry } from '../types';
import { calculateGoldEquivalent21, canCalculateGoldEquivalent21, type SupportedGoldKarat } from './goldEquivalent';

export interface IndependentMigrationControlTotal {
  inventoryAccountId: string;
  year: string;
  closingQuantityUnits: number;
  closingCarryingCostMinor: number;
  cogsMinor: number;
  salesRevenueMinor: number;
  grossProfitMinor: number;
}
export interface IndependentMigrationControls {
  rows: IndependentMigrationControlTotal[];
  complete: boolean;
  unresolvedOperationIds: string[];
}
interface State { quantity: number; cost: number }
interface Original { quantity: number; cost: number; revenue: number; kind: 'sale' | 'purchase' }
const money = (value: string): number => Math.round((Number(value) || 0) * 100);
const operationId = (entry: Entry): string => entry.id || entry.legacyOperationId || entry.legacyOperationNo || String(entry.seq);
const quantity = (entry: Entry, account: Account): number => {
  if (account.type === 'accessory') return Math.round((Number(entry.count || entry.weight) || 0) * 1000);
  if (account.metal === 'silver' || account.type === 'silver') return Math.round((Number(entry.weight) || 0) * 100);
  if (entry.goldEquivalent21Snapshot) return entry.goldEquivalent21Snapshot.equivalent21Units;
  const karat = Number(account.karat) as SupportedGoldKarat;
  return canCalculateGoldEquivalent21(entry.weight, karat)
    ? calculateGoldEquivalent21(entry.weight, karat).equivalent21Units : 0;
};
const proportional = (total: number, part: number, whole: number) => part === whole ? total : Math.round(total * part / whole);

/** Independent reference controls. This deliberately does not call the production Cost Engine. */
export const buildIndependentMigrationControlTotals = (entries: Entry[], accounts: Account[]): IndependentMigrationControls => {
  const inventory = new Map(accounts.filter(account => account.id && account.is_inventory).map(account => [account.id!, account]));
  const states = new Map<string, State>();
  const originals = new Map<string, Original>();
  const returned = new Map<string, number>();
  const flow = new Map<string, { cogs: number; revenue: number }>();
  const unresolvedOperationIds: string[] = [];
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date) || Number(a.seq ?? 0) - Number(b.seq ?? 0) || operationId(a).localeCompare(operationId(b)));
  const years = [...new Set(ordered.map(entry => entry.date.slice(0, 4)))].sort();
  const rows: IndependentMigrationControlTotal[] = [];
  for (const year of years) {
    for (const entry of ordered.filter(item => item.date.startsWith(year))) {
      const id = operationId(entry);
      const debit = entry.debitAccountId ? inventory.get(entry.debitAccountId) : undefined;
      const credit = entry.creditAccountId ? inventory.get(entry.creditAccountId) : undefined;
      const isPurchase = entry.operationKind === 'purchase' || entry.tx.startsWith('شراء') || entry.tx.startsWith('تاجر ');
      const isSale = entry.operationKind === 'sale' || entry.tx.startsWith('بيع');
      const isCustomerReturn = entry.operationKind === 'customer_return';
      const isSupplierReturn = entry.operationKind === 'supplier_return';
      if (isPurchase && debit?.id) {
        const qty = quantity(entry, debit);
        const cost = entry.tx.startsWith('تاجر ') ? Number(entry.transactionGoldValueMinor ?? entry.merchantGoldBookValueMinor) : money(entry.cash);
        if (qty <= 0 || !Number.isSafeInteger(cost) || cost < 0 || (entry.tx.startsWith('تاجر ') && cost <= 0)) { unresolvedOperationIds.push(id); continue; }
        const state = states.get(debit.id) ?? { quantity: 0, cost: 0 };
        state.quantity += qty; state.cost += cost; states.set(debit.id, state);
        originals.set(id, { quantity: qty, cost, revenue: 0, kind: 'purchase' });
      } else if (isSale && credit?.id) {
        const qty = quantity(entry, credit); const state = states.get(credit.id) ?? { quantity: 0, cost: 0 };
        if (qty <= 0 || qty > state.quantity) { unresolvedOperationIds.push(id); continue; }
        const cogs = proportional(state.cost, qty, state.quantity); state.quantity -= qty; state.cost -= cogs; states.set(credit.id, state);
        const revenue = money(entry.cash); const f = flow.get(`${year}:${credit.id}`) ?? { cogs: 0, revenue: 0 }; f.cogs += cogs; f.revenue += revenue; flow.set(`${year}:${credit.id}`, f);
        originals.set(id, { quantity: qty, cost: cogs, revenue, kind: 'sale' });
      } else if ((isCustomerReturn || isSupplierReturn) && entry.originalOperationId) {
        const original = originals.get(entry.originalOperationId); const account = isCustomerReturn ? debit : credit;
        if (!original || !account?.id || original.kind !== (isCustomerReturn ? 'sale' : 'purchase')) { unresolvedOperationIds.push(id); continue; }
        const qty = quantity(entry, account); const already = returned.get(entry.originalOperationId) ?? 0;
        if (qty <= 0 || already + qty > original.quantity) { unresolvedOperationIds.push(id); continue; }
        const cost = proportional(original.cost, qty, original.quantity); const state = states.get(account.id) ?? { quantity: 0, cost: 0 };
        if (isCustomerReturn) { state.quantity += qty; state.cost += cost; const f = flow.get(`${year}:${account.id}`) ?? { cogs: 0, revenue: 0 }; f.cogs -= cost; f.revenue -= proportional(original.revenue, qty, original.quantity); flow.set(`${year}:${account.id}`, f); }
        else { if (qty > state.quantity || cost > state.cost) { unresolvedOperationIds.push(id); continue; } state.quantity -= qty; state.cost -= cost; }
        states.set(account.id, state); returned.set(entry.originalOperationId, already + qty);
      } else if (debit || credit) unresolvedOperationIds.push(id);
    }
    inventory.forEach((account, accountId) => {
      const state = states.get(accountId) ?? { quantity: 0, cost: 0 }; const f = flow.get(`${year}:${accountId}`) ?? { cogs: 0, revenue: 0 };
      rows.push({ inventoryAccountId: accountId, year, closingQuantityUnits: state.quantity, closingCarryingCostMinor: state.cost, cogsMinor: f.cogs, salesRevenueMinor: f.revenue, grossProfitMinor: f.revenue - f.cogs });
    });
  }
  return { rows, complete: unresolvedOperationIds.length === 0, unresolvedOperationIds };
};