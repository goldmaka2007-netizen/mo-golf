import type { Account } from '../types';
import type { InventoryCostState, InventoryCostTimeline, OperationCostResultV2 } from './inventoryCostTypes';

export type InventoryProfitabilityScope = { type: 'item'; accountId: string } | { type: 'karat'; karat: 18 | 21 | 24 } | { type: 'gold-total' };
export type InventoryProfitabilityAccount = Pick<Account, 'id' | 'name' | 'is_inventory' | 'metal' | 'karat'>;

export interface InventoryProfitabilityRow {
  result: OperationCostResultV2;
  accountId: string;
  incomingE21Units: number;
  outgoingE21Units: number;
  incomingPhysicalUnits: number;
  outgoingPhysicalUnits: number;
  incomingCostMinor: number;
  outgoingCostMinor: number;
}

export interface InventoryProfitabilitySummary {
  rows: InventoryProfitabilityRow[];
  accountIds: string[];
  currentStates: InventoryCostState[];
  currentE21Units: number;
  currentPhysicalUnits: number;
  currentBookValueMinor: number;
  externalIncomingE21Units: number;
  externalOutgoingE21Units: number;
  saleAmountMinor: number;
  totalCogsMinor: number;
  grossProfitMinor: number;
  adjustmentGainMinor: number;
  adjustmentLossMinor: number;
}

const selectedAccounts = (accounts: readonly InventoryProfitabilityAccount[], scope: InventoryProfitabilityScope) =>
  accounts.filter(account => account.id && account.is_inventory && account.metal === 'gold' && (
    scope.type === 'gold-total' || scope.type === 'item'
      ? scope.type !== 'item' || account.id === scope.accountId
      : Number(account.karat) === scope.karat
  ));

const isInternal = (result: OperationCostResultV2, selected: ReadonlySet<string>, scope: InventoryProfitabilityScope) =>
  scope.type !== 'item'
  && (result.classification === 'transfer' || result.classification === 'tafyeet')
  && !!result.sourceInventoryAccountId
  && !!result.destinationInventoryAccountId
  && selected.has(result.sourceInventoryAccountId)
  && selected.has(result.destinationInventoryAccountId);

/** Read-only projection of the authoritative timeline; it never replays WAC or COGS. */
export const buildInventoryProfitabilityReport = (
  timeline: InventoryCostTimeline,
  accounts: readonly InventoryProfitabilityAccount[],
  scope: InventoryProfitabilityScope,
  startDate = '0000-01-01',
  endDate = '9999-12-31',
): InventoryProfitabilitySummary => {
  const selected = new Set(selectedAccounts(accounts, scope).map(account => account.id!));
  const rows = timeline.results.flatMap(result => {
    if (result.entry.date < startDate || result.entry.date > endDate) return [];
    const sourceSelected = !!result.sourceInventoryAccountId && selected.has(result.sourceInventoryAccountId);
    const destinationSelected = !!result.destinationInventoryAccountId && selected.has(result.destinationInventoryAccountId);
    const directSelected = !!result.inventoryAccountId && selected.has(result.inventoryAccountId);
    if (!sourceSelected && !destinationSelected && !directSelected) return [];
    const accountId = sourceSelected ? result.sourceInventoryAccountId! : destinationSelected ? result.destinationInventoryAccountId! : result.inventoryAccountId!;
    const incomingForScope = destinationSelected || (!result.destinationInventoryAccountId && directSelected);
    const outgoingForScope = sourceSelected || (!result.sourceInventoryAccountId && directSelected && result.outgoingStandardizedQuantityUnits > 0);
    return [{ result, accountId,
      incomingE21Units: incomingForScope ? result.incomingStandardizedQuantityUnits : 0,
      outgoingE21Units: outgoingForScope ? result.outgoingStandardizedQuantityUnits : 0,
      incomingPhysicalUnits: incomingForScope ? result.incomingActualPhysicalWeightUnits : 0,
      outgoingPhysicalUnits: outgoingForScope ? result.outgoingActualPhysicalWeightUnits : 0,
      incomingCostMinor: incomingForScope ? result.incomingTotalCostMinor : 0,
      outgoingCostMinor: outgoingForScope ? result.outgoingTotalCostMinor : 0,
    }];
  });
  const currentStates = Object.values(timeline.finalStates).filter(state => selected.has(state.inventoryAccountId));
  const externalRows = rows.filter(row => !isInternal(row.result, selected, scope));
  return {
    rows,
    accountIds: [...selected],
    currentStates,
    currentE21Units: currentStates.reduce((sum, state) => sum + state.standardizedQuantityUnits, 0),
    currentPhysicalUnits: currentStates.reduce((sum, state) => sum + state.actualPhysicalWeightUnits, 0),
    currentBookValueMinor: currentStates.reduce((sum, state) => sum + state.remainingTotalCostMinor, 0),
    externalIncomingE21Units: externalRows.reduce((sum, row) => sum + row.incomingE21Units, 0),
    externalOutgoingE21Units: externalRows.reduce((sum, row) => sum + row.outgoingE21Units, 0),
    saleAmountMinor: rows.filter(row => row.result.classification === 'sale').reduce((sum, row) => sum + row.result.saleAmountMinor, 0),
    totalCogsMinor: rows.filter(row => row.result.classification === 'sale').reduce((sum, row) => sum + row.result.totalCogsMinor, 0),
    grossProfitMinor: rows.filter(row => row.result.classification === 'sale').reduce((sum, row) => sum + (row.result.profitMinor ?? 0), 0),
    adjustmentGainMinor: rows.reduce((sum, row) => sum + row.result.adjustmentGainMinor, 0),
    adjustmentLossMinor: rows.reduce((sum, row) => sum + row.result.adjustmentLossMinor, 0),
  };
};

export const groupProfitabilityRowsByMonth = (report: InventoryProfitabilitySummary) => {
  const months = new Map<string, InventoryProfitabilityRow[]>();
  for (const row of report.rows) {
    const key = row.result.entry.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), row]);
  }
  let closing = 0;
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, rows]) => {
    const incoming = rows.reduce((sum, row) => sum + row.incomingE21Units, 0);
    const outgoing = rows.reduce((sum, row) => sum + row.outgoingE21Units, 0);
    const opening = closing;
    closing = opening + incoming - outgoing;
    const customerPurchases = rows.filter(row => row.result.classification === 'customer_purchase');
    const sales = rows.filter(row => row.result.classification === 'sale');
    const sum = (set: InventoryProfitabilityRow[], field: keyof InventoryProfitabilityRow) => set.reduce((total, row) => total + (row[field] as number), 0);
    const saleAmountMinor = sales.reduce((total, row) => total + row.result.saleAmountMinor, 0);
    const cogsMinor = sales.reduce((total, row) => total + row.result.totalCogsMinor, 0);
    const grossProfitMinor = sales.reduce((total, row) => total + (row.result.profitMinor ?? 0), 0);
    return { month, openingE21Units: opening, closingE21Units: closing, incomingE21Units: incoming, outgoingE21Units: outgoing,
      customerPurchaseE21Units: sum(customerPurchases, 'incomingE21Units'), customerPurchaseCostMinor: sum(customerPurchases, 'incomingCostMinor'),
      merchantReceiptE21Units: sum(rows.filter(row => row.result.classification === 'merchant_receipt'), 'incomingE21Units'),
      saleE21Units: sum(sales, 'outgoingE21Units'), merchantDeliveryE21Units: sum(rows.filter(row => row.result.classification === 'merchant_delivery'), 'outgoingE21Units'),
      saleAmountMinor, cogsMinor, grossProfitMinor,
      adjustmentGainMinor: rows.reduce((total, row) => total + row.result.adjustmentGainMinor, 0), adjustmentLossMinor: rows.reduce((total, row) => total + row.result.adjustmentLossMinor, 0),
    };
  });
};
