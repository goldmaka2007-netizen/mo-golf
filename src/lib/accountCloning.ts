import type { Account, TransactionRule } from '../types';

export interface AccountCloneIds {
  primary: string;
  sales?: string;
  costOfSales?: string;
}

export interface AccountClonePlan {
  accounts: Array<Account & { id: string }>;
  transactionRules: Array<Omit<TransactionRule, 'id'>>;
}

export interface CloneEligibility {
  allowed: boolean;
  reason?: string;
}

const normalized = (value: unknown): string => String(value ?? '').trim().toLocaleLowerCase('ar-EG').replace(/\s+/g, ' ');
const group = (account: Account): 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses' | 'unknown' => {
  if (account.canonicalMainType === 'expense') return 'expenses';
  if (account.canonicalMainType) return account.canonicalMainType;
  const value = normalized(account.mainType);
  if (['اصول', 'الأصول', 'الاصول', 'assets', 'asset'].includes(value)) return 'assets';
  if (['خصوم', 'الخصوم', 'liabilities', 'liability'].includes(value)) return 'liabilities';
  if (['حقوق ملكية', 'حقوق الملكية', 'equity'].includes(value)) return 'equity';
  if (['ايرادات', 'إيرادات', 'الايرادات', 'الإيرادات', 'revenue', 'revenues'].includes(value)) return 'revenue';
  if (['مصروفات', 'المصروفات', 'expense', 'expenses'].includes(value)) return 'expenses';
  return 'unknown';
};

const protectedText = (account: Account): string => normalized(`${account.name} ${account.subType} ${account.canonicalSubType ?? ''}`);

export const canCloneAccount = (account: Account): CloneEligibility => {
  const text = protectedText(account);
  if (!account.id) return { allowed: false, reason: 'الحساب بلا ID ثابت.' };
  if (account.type === 'cash' || account.accountRole === 'system' || account.accountRole === 'revaluation') {
    return { allowed: false, reason: 'حساب نقدية أو حساب نظامي محمي.' };
  }
  if (group(account) === 'equity' || account.canonicalSubType === 'capital' || account.canonicalSubType === 'retained_earnings') {
    return { allowed: false, reason: 'رأس المال والأرباح المحتجزة لا تُستنسخ.' };
  }
  if (/revaluation|system|إعادة تقييم|اعادة تقييم|فروق تقييم|حساب نظام/i.test(text)) {
    return { allowed: false, reason: 'حسابات النظام وإعادة التقييم لا تُستنسخ.' };
  }
  const accountGroup = group(account);
  const supported = account.is_inventory === true
    || account.type === 'merchant'
    || account.canonicalSubType === 'customer'
    || account.canonicalSubType === 'other_due'
    || ['assets', 'liabilities', 'revenue', 'expenses'].includes(accountGroup);
  return supported ? { allowed: true } : { allowed: false, reason: 'نوع الحساب غير مسموح باستنساخه.' };
};

const inventoryDimensions = (source: Account): Account['dimensions'] => {
  if (source.type === 'accessory') return ['quantity', 'book_value'];
  if (source.metal === 'silver' || source.type === 'silver') return ['silver', 'book_value'];
  return ['gold', 'book_value'];
};

const analyticalSalesDimensions = (source: Account): Account['dimensions'] => {
  if (source.type === 'accessory') return ['cash', 'quantity'];
  if (source.metal === 'silver' || source.type === 'silver') return ['cash', 'silver'];
  return ['cash', 'gold'];
};

const inferredDimensions = (source: Account): Account['dimensions'] => {
  if (source.dimensions?.length) return [...source.dimensions];
  if (source.is_inventory) return inventoryDimensions(source);
  if (source.type === 'merchant') return source.metal === 'silver'
    ? ['silver', 'book_value', 'cash']
    : ['gold', 'book_value', 'cash'];
  return ['cash'];
};

/** Copies only account configuration. No balance-like or runtime fields are accepted. */
const cloneConfiguration = (source: Account, id: string, name: string, userId: string): Account & { id: string } => ({
  id,
  name,
  mainType: source.mainType,
  subType: source.subType,
  canonicalMainType: source.canonicalMainType,
  canonicalSubType: source.canonicalSubType,
  merchantDirection: source.merchantDirection,
  balanceNature: source.balanceNature,
  userId,
  type: source.type,
  karat: source.karat,
  metal: source.metal,
  is_inventory: source.is_inventory,
  measurementDimension: source.measurementDimension,
  quantityStep: source.quantityStep,
  isActive: true,
  dimensions: inferredDimensions(source),
  accountRole: source.is_inventory ? 'inventory' : 'standard',
  cloneSourceAccountId: source.id,
});

const companionAccount = (
  source: Account,
  id: string,
  inventoryId: string,
  name: string,
  role: 'sales' | 'cost_of_sales',
  userId: string,
): Account & { id: string } => role === 'sales' ? {
  id,
  name: `مبيعات ${name}`,
  mainType: 'ايرادات',
  subType: 'مبيعات',
  canonicalMainType: 'revenue',
  canonicalSubType: 'revenue',
  balanceNature: 'جنية مصري',
  userId,
  type: 'other',
  karat: source.karat,
  metal: source.metal,
  is_inventory: false,
  isActive: true,
  dimensions: analyticalSalesDimensions(source),
  accountRole: role,
  linkedInventoryAccountId: inventoryId,
  cloneSourceAccountId: source.id,
} : {
  id,
  name: `تكلفة مبيعات ${name}`,
  mainType: 'مصروفات',
  subType: 'تكلفة المبيعات',
  canonicalMainType: 'expense',
  canonicalSubType: 'expense',
  balanceNature: 'قيمة دفترية',
  userId,
  type: 'other',
  karat: source.karat,
  metal: source.metal,
  is_inventory: false,
  isActive: true,
  dimensions: ['book_value'],
  accountRole: role,
  linkedInventoryAccountId: inventoryId,
  cloneSourceAccountId: source.id,
};

export const buildAccountClonePlan = (args: {
  source: Account;
  newName: string;
  userId: string;
  ids: AccountCloneIds;
  existingAccounts: Account[];
  transactionRules: TransactionRule[];
}): AccountClonePlan => {
  const { source, userId, ids, existingAccounts, transactionRules } = args;
  const name = args.newName.trim();
  const eligibility = canCloneAccount(source);
  if (!eligibility.allowed) throw new Error(eligibility.reason);
  if (!name) throw new Error('اسم الحساب الجديد مطلوب.');
  if (existingAccounts.some(account => normalized(account.name) === normalized(name))) throw new Error('اسم الحساب مستخدم بالفعل.');

  const primary = cloneConfiguration(source, ids.primary, name, userId);
  const accounts: Array<Account & { id: string }> = [primary];
  if (source.is_inventory) {
    if (!ids.sales || !ids.costOfSales) throw new Error('حساب المخزون يحتاج IDs للمبيعات وتكلفة المبيعات.');
    primary.salesAccountId = ids.sales;
    primary.costOfSalesAccountId = ids.costOfSales;
    accounts.push(
      companionAccount(source, ids.sales, ids.primary, name, 'sales', userId),
      companionAccount(source, ids.costOfSales, ids.primary, name, 'cost_of_sales', userId),
    );
  }

  const clonedRules = transactionRules.flatMap((rule): Array<Omit<TransactionRule, 'id'>> => {
    if (normalized(rule.debit) !== normalized(source.name) && normalized(rule.credit) !== normalized(source.name)) return [];
    const { id: _id, ...configuration } = rule;
    return [{
      ...configuration,
      debit: normalized(rule.debit) === normalized(source.name) ? name : rule.debit,
      credit: normalized(rule.credit) === normalized(source.name) ? name : rule.credit,
      debitAccountId: normalized(rule.debit) === normalized(source.name) ? ids.primary : rule.debitAccountId,
      creditAccountId: normalized(rule.credit) === normalized(source.name) ? ids.primary : rule.creditAccountId,
      userId,
    }];
  });
  return { accounts, transactionRules: clonedRules };
};
