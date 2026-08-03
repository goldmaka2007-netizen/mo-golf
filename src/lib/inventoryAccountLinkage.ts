import type { Account } from '../types';

export type InventoryCompanionRole = 'sales' | 'cost_of_sales';

export const isLinkedInventoryAccount = (account: Account | undefined): boolean =>
  !!account && (account.is_inventory === true
    || ['gold_product', 'gold_raw', 'gold_direct', 'silver', 'accessory'].includes(account.type ?? ''));

const baseInventoryName = (name: string): string => name.replace(new RegExp(`\\s+\\u2014\\s+\\u0645\\u062e\\u0632\\u0648\\u0646\\s*$`), '').trim();

export const inventoryAccountDisplayName = (account: Account): string =>
  isLinkedInventoryAccount(account) ? `${baseInventoryName(account.name)} \u2014 \u0645\u062e\u0632\u0648\u0646` : account.name;

export const inventoryCompanionId = (inventoryId: string, role: InventoryCompanionRole): string =>
  `${inventoryId}::${role === 'sales' ? 'sales' : 'cogs'}`;

const companionName = (inventory: Account, role: InventoryCompanionRole): string => {
  const itemName = baseInventoryName(inventory.name);
  return role === 'sales' ? `\u0645\u0628\u064a\u0639\u0627\u062a ${itemName}` : `\u062a\u0643\u0644\u0641\u0629 \u0645\u0628\u064a\u0639\u0627\u062a ${itemName}`;
};

const companionDimensions = (inventory: Account, role: InventoryCompanionRole): Account['dimensions'] => {
  if (role === 'cost_of_sales') return ['book_value'];
  if (inventory.type === 'accessory') return ['cash', 'quantity'];
  if (inventory.metal === 'silver' || inventory.type === 'silver') return ['cash', 'silver'];
  return ['cash', 'gold'];
};

const derivedCompanion = (inventory: Account & { id: string }, role: InventoryCompanionRole): Account => ({
  id: inventoryCompanionId(inventory.id, role),
  name: companionName(inventory, role),
  mainType: role === 'sales' ? '\u0625\u064a\u0631\u0627\u062f\u0627\u062a' : '\u0645\u0635\u0631\u0648\u0641\u0627\u062a',
  subType: role === 'sales' ? '\u0645\u0628\u064a\u0639\u0627\u062a' : '\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a',
  canonicalMainType: role === 'sales' ? 'revenue' : 'expense',
  canonicalSubType: role === 'sales' ? 'revenue' : 'expense',
  balanceNature: role === 'sales' ? '\u062c\u0646\u064a\u0647 \u0645\u0635\u0631\u064a' : '\u0642\u064a\u0645\u0629 \u062f\u0641\u062a\u0631\u064a\u0629',
  userId: inventory.userId,
  type: 'other',
  karat: inventory.karat,
  metal: inventory.metal,
  is_inventory: false,
  isActive: inventory.isActive,
  dimensions: companionDimensions(inventory, role),
  accountRole: role,
  linkedInventoryAccountId: inventory.id,
  cloneSourceAccountId: inventory.cloneSourceAccountId ?? inventory.id,
});

const configuredCompanion = (inventory: Account, accounts: Account[], role: InventoryCompanionRole): Account | undefined => {
  const configuredId = role === 'sales' ? inventory.salesAccountId : inventory.costOfSalesAccountId;
  return accounts.find(candidate => !!configuredId && candidate.id === configuredId)
    ?? accounts.find(candidate => candidate.accountRole === role && candidate.linkedInventoryAccountId === inventory.id);
};

/** Read-only compatibility registry; stored account documents are never mutated. */
export const exposeInventoryLinkedAccounts = (sourceAccounts: Account[]): Account[] => {
  const additions: Account[] = [];
  const linkedIds = new Map<string, { sales: string; cost_of_sales: string }>();
  sourceAccounts.forEach(inventory => {
    if (!isLinkedInventoryAccount(inventory) || !inventory.id) return;
    const sales = configuredCompanion(inventory, sourceAccounts, 'sales') ?? derivedCompanion(inventory as Account & { id: string }, 'sales');
    const costOfSales = configuredCompanion(inventory, sourceAccounts, 'cost_of_sales') ?? derivedCompanion(inventory as Account & { id: string }, 'cost_of_sales');
    linkedIds.set(inventory.id, { sales: sales.id!, cost_of_sales: costOfSales.id! });
    if (!sourceAccounts.some(account => account.id === sales.id)) additions.push(sales);
    if (!sourceAccounts.some(account => account.id === costOfSales.id)) additions.push(costOfSales);
  });
  const accounts = sourceAccounts.map(account => {
    const linkage = account.id ? linkedIds.get(account.id) : undefined;
    return linkage ? { ...account, accountRole: 'inventory' as const, salesAccountId: linkage.sales, costOfSalesAccountId: linkage.cost_of_sales } : account;
  });
  return [...accounts, ...additions];
};
