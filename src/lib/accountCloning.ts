import type {
  Account,
  CanonicalAccountDefinition,
  CanonicalAccountSubType,
  CanonicalMainType,
  CustomRule,
  TransactionRule,
  TransactionType,
} from '../types';
import { buildAccountRegistry, validateCanonicalAccount } from './accountRegistry';
import { exposeInventoryLinkedAccounts } from './inventoryAccountLinkage';
import { getLedgerAccountGroupId } from './ledgerReport';
import { auditSupportedInvoiceInventoryAccountCoverage } from './runtimeCostAccountResolver';

export interface AccountCloneIds {
  primary: string;
}

export interface AccountClonePlan {
  account: Account & { id: string };
  transactionRules: Array<TransactionRule & { id: string }>;
}

export interface CloneEligibility {
  allowed: boolean;
  reason?: string;
  canonical?: CanonicalAccountDefinition;
  sourceRules?: TransactionRule[];
}

export interface CloneEligibilityContext {
  accounts: Account[];
  canonicalAccounts?: CanonicalAccountDefinition[];
  transactionRules: TransactionRule[];
}

const protectedCanonicalTypes = new Set([
  'cash',
  'capital',
  'retained_earnings',
  'withdrawals',
  'gold_surplus',
  'gold_shortage',
  'silver_surplus',
  'silver_shortage',
  'adjustment',
  'historical',
]);

/** Conservative identity normalization: no Arabic letter folding. */
export const normalizeCloneAccountName = (value: unknown): string => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('en-US');

export const cleanCloneDisplayName = (value: unknown): string => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ');

const ruleUsesAccount = (rule: TransactionRule, account: Account): boolean => {
  const accountName = normalizeCloneAccountName(account.name);
  return rule.debitAccountId === account.id
    || rule.creditAccountId === account.id
    || normalizeCloneAccountName(rule.debit) === accountName
    || normalizeCloneAccountName(rule.credit) === accountName;
};

const canonicalMainTypeFor = (definition: CanonicalAccountDefinition): CanonicalMainType =>
  definition.mainGroup === 'expenses' ? 'expense' : definition.mainGroup;

const canonicalSubTypeFor = (account: Account): CanonicalAccountSubType | undefined => {
  if (account.canonicalSubType && account.canonicalSubType !== 'unclassified') return account.canonicalSubType;
  const group = getLedgerAccountGroupId(account);
  const supported: Partial<Record<typeof group, CanonicalAccountSubType>> = {
    inventory_gold: 'inventory_gold',
    inventory_silver: 'inventory_silver',
    inventory_accessory: 'inventory_accessory',
    merchant_gold: 'merchant_gold',
    merchant_silver: 'merchant_silver',
    customer: 'customer',
    fixed_asset: 'fixed_asset',
    other_due: 'other_due',
    revenue: 'revenue',
    expense: 'expense',
  };
  return supported[group];
};

const inventoryDimensions = (source: Account): Account['dimensions'] => {
  if (source.type === 'accessory') return ['quantity', 'book_value'];
  if (source.metal === 'silver' || source.type === 'silver') return ['silver', 'book_value'];
  return ['gold', 'book_value'];
};

const inferredDimensions = (source: Account, canonical: CanonicalAccountDefinition): Account['dimensions'] => {
  if (source.dimensions?.length) return [...source.dimensions];
  if (source.is_inventory) return inventoryDimensions(source);
  if (source.type === 'merchant') {
    return source.metal === 'silver'
      ? ['silver', 'book_value', 'cash']
      : ['gold', 'book_value', 'cash'];
  }
  return canonical.allowedDimensions.includes('cash') ? ['cash'] : [...canonical.allowedDimensions];
};

const dedupeRules = (rules: TransactionRule[]): TransactionRule[] => {
  const seen = new Set<string>();
  return rules.filter(rule => {
    const signature = [
      rule.tx,
      normalizeCloneAccountName(rule.debit),
      normalizeCloneAccountName(rule.credit),
      rule.karat ?? '',
      rule.multiplier ?? 1,
    ].join('|');
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
};

/** The same effective rule sources consumed by EntryForm, flattened for persistence. */
export const buildOperationalRuleCatalog = (args: {
  transactionRules: TransactionRule[];
  customRules: CustomRule[];
  rawRules: TransactionType[];
  userId: string;
}): TransactionRule[] => dedupeRules([
  ...args.transactionRules,
  ...args.customRules.map(rule => ({
    id: rule.id,
    tx: rule.t,
    debit: rule.d,
    credit: rule.c,
    karat: rule.k ?? null,
    multiplier: rule.m,
    category: 'قواعد مخصصة',
    userId: args.userId,
  })),
  ...args.rawRules.map(rule => ({
    tx: rule.t,
    debit: rule.d,
    credit: rule.c,
    karat: rule.k,
    multiplier: rule.m,
    category: 'قواعد التشغيل الأساسية',
    userId: args.userId,
  })),
]);

export const canCloneAccount = (
  source: Account,
  context?: CloneEligibilityContext,
): CloneEligibility => {
  if (!source.id) return { allowed: false, reason: 'الحساب بلا هوية ثابتة.' };
  if (source.isActive === false) return { allowed: false, reason: 'لا يمكن النسخ من حساب معطل أو مؤرشف.' };
  if (!source.name.trim() || !source.mainType?.trim() || !source.subType?.trim() || !source.balanceNature?.trim()) {
    return { allowed: false, reason: 'بيانات تصنيف الحساب غير مكتملة.' };
  }
  if (source.type === undefined || source.metal === undefined || source.is_inventory === undefined) {
    return { allowed: false, reason: 'الحساب قديم أو غير مكتمل التصنيف التشغيلي.' };
  }
  if (source.accountRole && !['standard', 'inventory'].includes(source.accountRole)) {
    return { allowed: false, reason: 'الحساب مشتق أو نظامي ولا يمثل كيانًا تشغيليًا مستقلًا.' };
  }
  if (source.type === 'cash' || source.accountRole === 'system' || source.accountRole === 'revaluation') {
    return { allowed: false, reason: 'الحساب النقدي أو النظامي محمي.' };
  }
  if (!context) return { allowed: false, reason: 'تعذر التحقق من التسجيل والقواعد التشغيلية للحساب.' };

  const registry = buildAccountRegistry(context.accounts, [], context.canonicalAccounts ?? []);
  const resolution = registry.resolve(source.id, source.name);
  if (resolution.status !== 'resolved' || resolution.account.sourceAccountId !== source.id) {
    return { allowed: false, reason: 'الحساب غير مسجل بصورة كاملة في دليل الحسابات.' };
  }
  const canonical = resolution.account;
  if (canonical.isHistoricalOnly || canonical.reviewStatus !== 'reviewed'
    || canonical.classificationConflicts.length > 0 || validateCanonicalAccount(canonical).length > 0) {
    return { allowed: false, reason: 'الحساب Legacy أو غير مكتمل/متعارض التصنيف.' };
  }
  if (protectedCanonicalTypes.has(canonical.entityType) || getLedgerAccountGroupId(source) === 'unclassified') {
    return { allowed: false, reason: 'الحساب جذري أو هيكلي أو نظامي وغير مسموح باستنساخه.' };
  }
  if (!canonicalSubTypeFor(source)) {
    return { allowed: false, reason: 'لا يوجد تصنيف Ledger تشغيلي آمن لهذا الحساب.' };
  }
  if (source.is_inventory) {
    if (source.type === 'gold_product' && !source.karat) {
      return { allowed: false, reason: 'عيار مخزون الذهب غير مكتمل.' };
    }
    if (source.type === 'accessory' && source.quantityStep === undefined) {
      return { allowed: false, reason: 'وحدة كمية الملحق غير مكتملة.' };
    }
    const coverage = auditSupportedInvoiceInventoryAccountCoverage(context.accounts);
    const costSourceId = source.cloneSourceAccountId ?? source.id;
    if (!coverage.coverage.some(item => item.emittedAccountId === source.id || item.emittedAccountId === costSourceId)) {
      return { allowed: false, reason: 'مصدر المخزون غير مربوط بمسار Cost/WAC التشغيلي.' };
    }
  }
  const sourceRules = dedupeRules(context.transactionRules.filter(rule => ruleUsesAccount(rule, source)));
  if (sourceRules.length === 0) {
    return { allowed: false, reason: 'الحساب لا يملك قواعد تشغيل فعلية يمكن توريثها بأمان.' };
  }
  if (sourceRules.length > 450) {
    return { allowed: false, reason: 'عدد قواعد الحساب يتجاوز حد الإنشاء الذري الآمن.' };
  }
  return { allowed: true, canonical, sourceRules };
};

const utf8Hex = (value: string): string => Array.from(new TextEncoder().encode(value))
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('');

/** Collision-free for the exact tenant + conservative normalized name pair. */
export const accountCloneDocumentId = (userId: string, name: string): string =>
  `clone_${utf8Hex(userId)}_${utf8Hex(normalizeCloneAccountName(name))}`;

const resolveRuleAccountId = (name: string, currentId: string | undefined, accounts: Account[]): string | undefined =>
  currentId ?? accounts.find(account => normalizeCloneAccountName(account.name) === normalizeCloneAccountName(name))?.id;

export const buildAccountClonePlan = (args: {
  source: Account;
  newName: string;
  userId: string;
  ids: AccountCloneIds;
  existingAccounts: Account[];
  canonicalAccounts?: CanonicalAccountDefinition[];
  transactionRules: TransactionRule[];
  reservedNames?: string[];
}): AccountClonePlan => {
  const name = cleanCloneDisplayName(args.newName);
  if (!name) throw new Error('اسم الحساب الجديد مطلوب.');
  if (name.length > 120) throw new Error('اسم الحساب أطول من الحد المسموح (120 حرفًا).');
  const eligibility = canCloneAccount(args.source, {
    accounts: args.existingAccounts,
    canonicalAccounts: args.canonicalAccounts,
    transactionRules: args.transactionRules,
  });
  if (!eligibility.allowed || !eligibility.canonical || !eligibility.sourceRules) {
    throw new Error(eligibility.reason ?? 'الحساب المصدر غير صالح للاستنساخ.');
  }

  const candidate = normalizeCloneAccountName(name);
  const occupiedNames = [
    ...exposeInventoryLinkedAccounts(args.existingAccounts).map(account => account.name),
    ...(args.canonicalAccounts ?? []).flatMap(account => [account.canonicalName, account.displayName]),
    ...(args.reservedNames ?? []),
  ];
  if (occupiedNames.some(existing => normalizeCloneAccountName(existing) === candidate)) {
    throw new Error('اسم الحساب مستخدم بالفعل، بما في ذلك الحسابات المعطلة أو المؤرشفة.');
  }

  const canonicalSubType = canonicalSubTypeFor(args.source);
  if (!canonicalSubType) throw new Error('تعذر إكمال التصنيف التشغيلي للحساب المصدر.');
  const account: Account & { id: string } = {
    id: args.ids.primary,
    name,
    mainType: args.source.mainType,
    subType: args.source.subType,
    canonicalMainType: args.source.canonicalMainType ?? canonicalMainTypeFor(eligibility.canonical),
    canonicalSubType,
    merchantDirection: args.source.merchantDirection,
    balanceNature: args.source.balanceNature,
    userId: args.userId,
    type: args.source.type,
    karat: args.source.karat,
    metal: args.source.metal,
    is_inventory: args.source.is_inventory,
    measurementDimension: args.source.measurementDimension,
    quantityStep: args.source.quantityStep,
    isActive: true,
    dimensions: inferredDimensions(args.source, eligibility.canonical),
    accountRole: args.source.is_inventory ? 'inventory' : 'standard',
    cloneSourceAccountId: args.source.cloneSourceAccountId ?? args.source.id,
  };

  const transactionRules = eligibility.sourceRules.map((rule, index): TransactionRule & { id: string } => {
    const debitIsSource = rule.debitAccountId === args.source.id
      || normalizeCloneAccountName(rule.debit) === normalizeCloneAccountName(args.source.name);
    const creditIsSource = rule.creditAccountId === args.source.id
      || normalizeCloneAccountName(rule.credit) === normalizeCloneAccountName(args.source.name);
    return {
      id: `${args.ids.primary}__rule_${index + 1}`,
      tx: rule.tx,
      debit: debitIsSource ? name : rule.debit,
      credit: creditIsSource ? name : rule.credit,
      debitAccountId: debitIsSource ? args.ids.primary : resolveRuleAccountId(rule.debit, rule.debitAccountId, args.existingAccounts),
      creditAccountId: creditIsSource ? args.ids.primary : resolveRuleAccountId(rule.credit, rule.creditAccountId, args.existingAccounts),
      karat: rule.karat ?? null,
      multiplier: rule.multiplier ?? 1,
      category: rule.category,
      userId: args.userId,
    };
  });

  return { account, transactionRules };
};
