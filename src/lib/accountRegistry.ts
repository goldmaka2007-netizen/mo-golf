import {
  Account,
  AccountTrackingDimension,
  AccountingDimension,
  AccountingOperationKind,
  CanonicalAccountDefinition,
  CanonicalAccountType,
  CanonicalMainGroup,
  Entry,
  ReportParticipation,
} from '../types';
import { getEntryArabicWeight, parseCash, resolveOperationKind } from './engine';
import { applyApprovedCanonicalEquityTaxonomy } from './canonicalEquityCatalog';
import { applyRuntimeAccountOverride } from './runtimeAccountOverrides';
import { exposeInventoryLinkedAccounts, inventoryAccountDisplayName } from './inventoryAccountLinkage';

export type AccountResolution =
  | { status: 'resolved'; account: CanonicalAccountDefinition; via: 'id' | 'alias' }
  | { status: 'unknown'; value: string }
  | { status: 'ambiguous'; value: string; candidates: CanonicalAccountDefinition[] };

export interface AccountRegistry {
  accounts: CanonicalAccountDefinition[];
  byId: Map<string, CanonicalAccountDefinition>;
  bySourceAccountId: Map<string, CanonicalAccountDefinition>;
  aliases: Map<string, CanonicalAccountDefinition[]>;
  ambiguousAliases: Map<string, CanonicalAccountDefinition[]>;
  resolve: (accountId?: string, legacyName?: string) => AccountResolution;
}

export interface DiscoveredAccount {
  discoveryId: string;
  name: string;
  variants: string[];
  debitCount: number;
  creditCount: number;
  cashTotal: number;
  goldTotal: number;
  silverTotal: number;
  quantityTotal: number;
  counterparties: { name: string; count: number }[];
  operationKinds: AccountingOperationKind[];
  firstDate: string;
  lastDate: string;
  proposedAccount: CanonicalAccountDefinition;
  samples: Entry[];
}

const now = () => new Date().toISOString();
export const normalizeAccountName = (value: string | undefined): string => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .replace(/[ـ]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/[ؤ]/g, 'و')
  .replace(/[ئ]/g, 'ي')
  .replace(/[ة]/g, 'ه')
  .replace(/[\s_-]+/g, ' ')
  .toLocaleLowerCase('ar-EG');

const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const groupFor = (account?: Account): CanonicalMainGroup => {
  const value = String(account?.mainType ?? '').trim().toLocaleLowerCase('ar-EG');
  if (['خصوم', 'الخصوم', 'liability', 'liabilities'].includes(value)) return 'liabilities';
  if (['حقوق ملكية', 'حقوق الملكيه', 'حقوق الملكية', 'equity'].includes(value)) return 'equity';
  if (['ايرادات', 'إيرادات', 'الايرادات', 'الإيرادات', 'revenue', 'revenues'].includes(value)) return 'revenue';
  if (['مصروفات', 'المصروفات', 'expense', 'expenses'].includes(value)) return 'expenses';
  return 'assets';
};

const metalFor = (account?: Account): CanonicalAccountDefinition['metal'] => {
  if (account?.type === 'accessory') return 'accessory';
  if (account?.metal === 'gold' || account?.metal === 'silver') return account.metal;
  if (account?.type === 'silver') return 'silver';
  if (['gold_product', 'gold_raw', 'gold_direct'].includes(account?.type ?? '')) return 'gold';
  const evidence = `${account?.balanceNature ?? ''} ${account?.subType ?? ''}`;
  if (/فضة|silver/i.test(evidence)) return 'silver';
  if (/ذهب|gold/i.test(evidence)) return 'gold';
  return null;
};

const typeFor = (account: Account | undefined, group: CanonicalMainGroup, metal: CanonicalAccountDefinition['metal']): CanonicalAccountType => {
  const normalizedName = normalizeAccountName(account?.name);
  if (account?.type === 'cash') return 'cash';
  if (account?.type === 'merchant') return 'merchant';
  if (account?.is_inventory) return metal === 'silver' ? 'silver_inventory' : metal === 'accessory' ? 'accessory_inventory' : 'gold_inventory';
  if (normalizedName === normalizeAccountName('زيادة-الذهب')) return 'gold_surplus';
  if (normalizedName === normalizeAccountName('عجز-الذهب')) return 'gold_shortage';
  if (normalizedName === normalizeAccountName('زيادة-الفضة')) return 'silver_surplus';
  if (normalizedName === normalizeAccountName('عجز-الفضة')) return 'silver_shortage';
  if (group === 'revenue') return 'revenue';
  if (group === 'expenses') return 'expense';
  if (group === 'equity') {
    const subtype = normalizeAccountName(account?.subType);
    if (subtype === normalizeAccountName('\u0645\u0633\u062d\u0648\u0628\u0627\u062a')) return 'withdrawals';
    if ([
      '\u0627\u0644\u0627\u0631\u0628\u0627\u062d \u0648 \u0627\u0644\u062e\u0633\u0627\u064a\u0631',
      '\u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0626\u0631',
      '\u0627\u0644\u0623\u0631\u0628\u0627\u062d \u0648 \u0627\u0644\u062e\u0633\u0627\u0626\u0631',
      'retained earnings',
      'accumulated profit and loss',
    ].map(normalizeAccountName).includes(subtype)) return 'retained_earnings';
    return 'capital';
  }
  if (group === 'liabilities') return 'creditor';
  if (/ثابت/.test(account?.subType ?? '')) return 'fixed_asset';
  if (/ذمم مدينة/.test(account?.subType ?? '')) return 'debtor';
  return 'other';
};

const dimensionsFor = (
  account: Account | undefined,
  type: CanonicalAccountType,
  metal: CanonicalAccountDefinition['metal'],
  group: CanonicalMainGroup,
): AccountTrackingDimension[] => {
  const dimensions: AccountTrackingDimension[] = [];
  if (type === 'merchant') dimensions.push('cash');
  const explicitCash = /\u062c\u0646\u064a\u0647|\u062c\u0646\u064a\u0629|cash|egp/i.test(
    `${account?.balanceNature ?? ''} ${account?.subType ?? ''}`,
  );
  if (type === 'cash' || (explicitCash && metal !== 'accessory') || (!metal && type !== 'historical' && group !== 'equity')) {
    dimensions.push('cash');
  }
  if (metal === 'gold') dimensions.push('gold');
  if (metal === 'silver') dimensions.push('silver');
  if (metal === 'accessory' || account?.quantityStep !== undefined) dimensions.push('quantity');
  return [...new Set(dimensions)];
};

const reportParticipationFor = (group: CanonicalMainGroup, inventory: boolean): ReportParticipation[] => {
  const reports: ReportParticipation[] = [];
  if (group === 'revenue' || group === 'expenses') reports.push('incomeStatement');
  if (group === 'assets' || group === 'liabilities') reports.push('financialPosition');
  if (group === 'equity') reports.push('equityStatement', 'financialPosition');
  if (inventory) reports.push('inventoryReports');
  return reports;
};

const normalBalance = (group: CanonicalMainGroup): 'debit' | 'credit' =>
  ['liabilities', 'equity', 'revenue'].includes(group) ? 'credit' : 'debit';

const allowedOperations: AccountingOperationKind[] = [
  'opening', 'purchase', 'sale', 'transfer', 'tifeet', 'adjustment',
  'merchant_settlement', 'personal_withdrawal', 'expense', 'other',
];

const createDefinition = (account: Account | undefined, name: string, historical: boolean, evidenceSource: 'account_document' | 'entry_name'): CanonicalAccountDefinition => {
  const group = groupFor(account);
  const metal = metalFor(account);
  const entityType = historical ? 'historical' : typeFor(account, group, metal);
  const allowedDimensions = dimensionsFor(account, entityType, metal, group);
  const baseBalance = normalBalance(group);
  const timestamp = now();
  const sourceId = account?.id;
  const id = sourceId ? `account:${sourceId}` : `discovered:${stableHash(normalizeAccountName(name))}`;
  const isInventory = !!account?.is_inventory;
  const tracksQuantity = allowedDimensions.includes('quantity');
  const tracksWeight = allowedDimensions.includes('gold') || allowedDimensions.includes('silver');
  const confidence = account ? 1 : 0.45;
  return {
    id,
    entityId: id,
    sourceAccountId: sourceId,
    userId: account?.userId,
    canonicalName: name,
    displayName: name,
    legacyNames: [name],
    aliases: [name],
    entityType,
    mainGroup: group,
    allowedDimensions,
    normalBalanceByDimension: {
      cash: allowedDimensions.includes('cash') ? baseBalance : null,
      gold: allowedDimensions.includes('gold') ? baseBalance : null,
      silver: allowedDimensions.includes('silver') ? baseBalance : null,
      quantity: tracksQuantity ? baseBalance : null,
    },
    metal,
    karat: account?.karat && account.karat !== 'silver' ? Number(account.karat) as 18 | 21 | 24 : null,
    trackingMode: tracksWeight && tracksQuantity ? 'weight_and_quantity' : tracksWeight ? 'weight' : tracksQuantity ? 'quantity' : 'value',
    tracksCash: allowedDimensions.includes('cash'),
    tracksGold: allowedDimensions.includes('gold'),
    tracksSilver: allowedDimensions.includes('silver'),
    tracksQuantity,
    tracksWeight,
    tracksValue: allowedDimensions.includes('cash'),
    tracksCost: isInventory,
    isInventory,
    isMerchant: account?.type === 'merchant',
    isHistoricalOnly: historical,
    isActive: account?.isActive !== false,
    reportParticipation: reportParticipationFor(group, isInventory),
    allowedOperationKinds: allowedOperations,
    classificationSource: 'legacy_code',
    classificationConfidence: confidence,
    classificationEvidence: [{ source: evidenceSource, field: evidenceSource === 'account_document' ? 'type/metal/mainType/subType/balanceNature/is_inventory' : 'debit/credit', value: name, file: evidenceSource === 'account_document' ? 'accounts collection + src/migrationData.ts' : 'entries collection' }],
    classificationConflicts: [],
    reviewStatus: account ? 'reviewed' : 'discovered',
    approvalStatus: 'draft',
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    audit: { createdBy: 'legacy-classifier', updatedBy: 'legacy-classifier' },
  };
};

const mergeManual = (generated: CanonicalAccountDefinition, manual: CanonicalAccountDefinition): CanonicalAccountDefinition => ({
  ...generated,
  ...manual,
  id: generated.id,
  entityId: generated.entityId,
  sourceAccountId: generated.sourceAccountId ?? manual.sourceAccountId,
  legacyNames: [...new Set([...generated.legacyNames, ...manual.legacyNames])],
  aliases: [...new Set([...generated.aliases, ...manual.aliases])],
  classificationSource: 'manual',
  classificationConfidence: 1,
  classificationEvidence: [...generated.classificationEvidence, ...manual.classificationEvidence],
});

/** Builds the source of truth for the shadow path. Manual records always win. */
export const buildAccountRegistry = (accounts: Account[], entries: Entry[] = [], manualDefinitions: CanonicalAccountDefinition[] = []): AccountRegistry => {
  const linkedAccounts = exposeInventoryLinkedAccounts(accounts);
  const manualBySource = new Map(manualDefinitions.filter(item => item.sourceAccountId).map(item => [item.sourceAccountId!, item]));
  const manualByName = new Map(manualDefinitions.map(item => [normalizeAccountName(item.canonicalName), item]));
  const definitions = linkedAccounts.filter(account => account.isActive !== false).map((rawAccount): CanonicalAccountDefinition => {
    const account = applyRuntimeAccountOverride(rawAccount);
    const displayName = inventoryAccountDisplayName(account);
    const generated = applyApprovedCanonicalEquityTaxonomy(
      createDefinition(account, displayName, false, 'account_document'),
      account,
    );
    if (displayName !== account.name) {
      generated.legacyNames = [...new Set([...generated.legacyNames, account.name])];
      generated.aliases = [...new Set([...generated.aliases, account.name])];
    }
    const manual = (account.id && manualBySource.get(account.id)) || manualByName.get(normalizeAccountName(account.name));
    if (!manual) return generated;
    const governed = generated.approvalStatus === 'approved'
      && generated.mainGroup === 'equity'
      ? generated
      : undefined;
    const conflicts = governed
      && (manual.mainGroup !== 'equity'
        || manual.entityType !== governed.entityType
        || manual.metal !== governed.metal
        || [...manual.allowedDimensions].sort().join('|')
          !== [...governed.allowedDimensions].sort().join('|'));
    if (!conflicts) return mergeManual(generated, manual);
    return {
      ...generated,
      allowedDimensions: [],
      normalBalanceByDimension: { cash: null, gold: null, silver: null, quantity: null },
      tracksCash: false,
      tracksGold: false,
      tracksSilver: false,
      tracksQuantity: false,
      tracksWeight: false,
      tracksValue: false,
      trackingMode: 'value',
      classificationConflicts: [
        ...generated.classificationConflicts,
        `approved_equity_taxonomy_conflict:${account.id}`,
      ],
      reviewStatus: 'needs_review',
      approvalStatus: 'draft',
    };
  });

  const knownIds = new Set(linkedAccounts.map(account => account.id).filter(Boolean));
  const knownNames = new Set(definitions.flatMap(item => [...item.legacyNames, ...item.aliases]).map(normalizeAccountName));
  entries.forEach(entry => {
    (['debit', 'credit'] as const).forEach(side => {
      const sourceId = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
      const name = entry[side];
      if (!name || (sourceId && knownIds.has(sourceId)) || knownNames.has(normalizeAccountName(name))) return;
      const manual = manualByName.get(normalizeAccountName(name));
      const generated = createDefinition(undefined, name, true, 'entry_name');
      definitions.push(manual ? mergeManual(generated, manual) : generated);
      knownNames.add(normalizeAccountName(name));
    });
  });

  manualDefinitions.forEach(manual => {
    if (!definitions.some(item => item.id === manual.id || item.sourceAccountId && item.sourceAccountId === manual.sourceAccountId || normalizeAccountName(item.canonicalName) === normalizeAccountName(manual.canonicalName))) {
      definitions.push({ ...manual, classificationSource: 'manual', classificationConfidence: 1 });
    }
  });

  const byId = new Map(definitions.map(item => [item.id, item]));
  const bySourceAccountId = new Map(definitions.filter(item => item.sourceAccountId).map(item => [item.sourceAccountId!, item]));
  const aliases = new Map<string, CanonicalAccountDefinition[]>();
  definitions.forEach(item => [...item.aliases, ...item.legacyNames, item.canonicalName, item.displayName].forEach(alias => {
    const key = normalizeAccountName(alias);
    if (!key) return;
    const candidates = aliases.get(key) ?? [];
    if (!candidates.some(candidate => candidate.id === item.id)) candidates.push(item);
    aliases.set(key, candidates);
  }));
  const ambiguousAliases = new Map([...aliases].filter(([, candidates]) => candidates.length > 1));
  ambiguousAliases.forEach((candidates, alias) => candidates.forEach(candidate => {
    if (!candidate.classificationConflicts.includes(`ambiguous_alias:${alias}`)) candidate.classificationConflicts.push(`ambiguous_alias:${alias}`);
  }));
  const resolve = (accountId?: string, legacyName?: string): AccountResolution => {
    if (accountId) {
      const account = bySourceAccountId.get(accountId) ?? byId.get(accountId);
      if (account) return { status: 'resolved', account, via: 'id' };
    }
    const value = legacyName ?? '';
    const candidates = aliases.get(normalizeAccountName(value)) ?? [];
    if (candidates.length === 1) return { status: 'resolved', account: candidates[0], via: 'alias' };
    if (candidates.length > 1) return { status: 'ambiguous', value, candidates };
    return { status: 'unknown', value };
  };
  return { accounts: definitions, byId, bySourceAccountId, aliases, ambiguousAliases, resolve };
};

export const validateCanonicalAccount = (account: CanonicalAccountDefinition): string[] => {
  const errors: string[] = [];
  if (!account.canonicalName.trim()) errors.push('اسم الحساب مطلوب');
  if (!account.mainGroup) errors.push('المجموعة الرئيسية مطلوبة');
  if (!account.entityType) errors.push('نوع الحساب مطلوب');
  if (!account.allowedDimensions.length) errors.push('يجب تفعيل بُعد واحد على الأقل');
  account.allowedDimensions.forEach(dimension => {
    if (!account.normalBalanceByDimension[dimension]) errors.push(`طبيعة الرصيد مطلوبة لبُعد ${dimension}`);
  });
  if ((account.tracksGold || account.tracksSilver || account.isInventory) && !account.metal) errors.push('المعدن مطلوب');
  if (account.metal === 'gold' && account.isInventory && !account.karat) errors.push('العيار مطلوب لمخزون الذهب');
  if (account.isMerchant && account.isInventory) errors.push('حساب التاجر ليس مخزونًا');
  if (!account.reportParticipation.length && account.allowedDimensions.some(dimension => dimension !== 'quantity')) errors.push('مشاركة التقارير مطلوبة');
  return errors;
};

export const canApproveRegistry = (registry: AccountRegistry, entries: Entry[]): { allowed: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  const unreviewed = registry.accounts.filter(item => item.reviewStatus !== 'reviewed');
  if (unreviewed.length) reasons.push(`${unreviewed.length} حساب مكتشف غير مراجع`);
  const unapproved = registry.accounts.filter(item => item.approvalStatus !== 'approved');
  if (unapproved.length) reasons.push(`${unapproved.length} حساب غير معتمد`);
  if (registry.ambiguousAliases.size) reasons.push(`${registry.ambiguousAliases.size} Alias غامض`);
  const invalid = registry.accounts.filter(item => validateCanonicalAccount(item).length);
  if (invalid.length) reasons.push(`${invalid.length} حساب ناقص التصنيف`);
  const unresolved = entries.flatMap(entry => [
    registry.resolve(entry.debitAccountId, entry.debit),
    registry.resolve(entry.creditAccountId, entry.credit),
  ]).filter(result => result.status !== 'resolved');
  if (unresolved.length) reasons.push(`${unresolved.length} طرف حركة غير مربوط`);
  const missingIds = entries.filter(entry => !entry.debitAccountId || !entry.creditAccountId);
  if (missingIds.length) reasons.push(`${missingIds.length} حركة بلا IDs ثابتة`);
  return { allowed: reasons.length === 0, reasons };
};

/** Complete historical discovery with evidence and usage statistics. */
export const discoverAccounts = (accounts: Account[], entries: Entry[], manualDefinitions: CanonicalAccountDefinition[] = []): DiscoveredAccount[] => {
  const registry = buildAccountRegistry(accounts, entries, manualDefinitions);
  const masterIds = new Set(accounts.map(account => account.id).filter(Boolean));
  const buckets = new Map<string, { names: Set<string>; debit: number; credit: number; cash: number; gold: number; silver: number; quantity: number; counterparties: Map<string, number>; kinds: Set<AccountingOperationKind>; dates: string[]; samples: Entry[] }>();
  entries.forEach(entry => (['debit', 'credit'] as const).forEach(side => {
    const id = side === 'debit' ? entry.debitAccountId : entry.creditAccountId;
    if (id && masterIds.has(id)) return;
    const name = entry[side];
    const resolution = registry.resolve(id, name);
    if (resolution.status === 'resolved' && !resolution.account.isHistoricalOnly) return;
    const key = normalizeAccountName(name);
    if (!key) return;
    const bucket = buckets.get(key) ?? { names: new Set(), debit: 0, credit: 0, cash: 0, gold: 0, silver: 0, quantity: 0, counterparties: new Map(), kinds: new Set(), dates: [], samples: [] };
    bucket.names.add(name);
    bucket[side] += 1;
    bucket.cash += Math.abs(parseCash(entry));
    const proposed = resolution.status === 'resolved' ? resolution.account : createDefinition(undefined, name, true, 'entry_name');
    const oppositeSide = side === 'debit' ? 'credit' : 'debit';
    const oppositeResolution = registry.resolve(oppositeSide === 'debit' ? entry.debitAccountId : entry.creditAccountId, entry[oppositeSide]);
    const evidenceMetal = proposed.metal ?? (oppositeResolution.status === 'resolved' ? oppositeResolution.account.metal : null) ?? (entry.karat && (Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0) ? 'gold' : null);
    if (evidenceMetal === 'gold') bucket.gold += Math.abs(getEntryArabicWeight(entry));
    if (evidenceMetal === 'silver') bucket.silver += Math.abs(Number(entry.weight) || 0);
    bucket.quantity += Math.abs(Number(entry.count) || 0);
    const opposite = entry[side === 'debit' ? 'credit' : 'debit'];
    bucket.counterparties.set(opposite, (bucket.counterparties.get(opposite) ?? 0) + 1);
    bucket.kinds.add(resolveOperationKind(entry));
    if (entry.date) bucket.dates.push(entry.date);
    if (bucket.samples.length < 5) bucket.samples.push(entry);
    buckets.set(key, bucket);
  }));
  return [...buckets].map(([key, bucket]) => {
    const name = [...bucket.names][0];
    const resolution = registry.resolve(undefined, name);
    const baseProposal = resolution.status === 'resolved' ? resolution.account : createDefinition(undefined, name, true, 'entry_name');
    const proposedDimensions: AccountTrackingDimension[] = [];
    if (bucket.cash > 0) proposedDimensions.push('cash');
    if (bucket.gold > 0) proposedDimensions.push('gold');
    if (bucket.silver > 0) proposedDimensions.push('silver');
    if (bucket.quantity > 0) proposedDimensions.push('quantity');
    const proposedGroup: CanonicalMainGroup = bucket.debit > 0 && bucket.credit === 0 ? 'assets' : bucket.credit > 0 && bucket.debit === 0 ? 'liabilities' : baseProposal.mainGroup;
    const proposedNormal = normalBalance(proposedGroup);
    const proposalConflict: string[] = [];
    const proposedAccount: CanonicalAccountDefinition = {
      ...baseProposal,
      entityType: proposedGroup === 'liabilities' ? 'creditor' : proposedGroup === 'assets' ? 'debtor' : baseProposal.entityType,
      mainGroup: proposedGroup,
      allowedDimensions: proposedDimensions.length ? proposedDimensions : baseProposal.allowedDimensions,
      normalBalanceByDimension: {
        cash: proposedDimensions.includes('cash') ? proposedNormal : null,
        gold: proposedDimensions.includes('gold') ? proposedNormal : null,
        silver: proposedDimensions.includes('silver') ? proposedNormal : null,
        quantity: proposedDimensions.includes('quantity') ? proposedNormal : null,
      },
      metal: proposedDimensions.includes('gold') && !proposedDimensions.includes('silver') ? 'gold' : proposedDimensions.includes('silver') && !proposedDimensions.includes('gold') ? 'silver' : baseProposal.metal,
      tracksCash: proposedDimensions.includes('cash'), tracksGold: proposedDimensions.includes('gold'), tracksSilver: proposedDimensions.includes('silver'), tracksQuantity: proposedDimensions.includes('quantity'),
      tracksWeight: proposedDimensions.includes('gold') || proposedDimensions.includes('silver'), tracksValue: proposedDimensions.includes('cash'),
      trackingMode: proposedDimensions.includes('quantity') && (proposedDimensions.includes('gold') || proposedDimensions.includes('silver')) ? 'weight_and_quantity' : proposedDimensions.includes('quantity') ? 'quantity' : proposedDimensions.includes('gold') || proposedDimensions.includes('silver') ? 'weight' : 'value',
      reportParticipation: reportParticipationFor(proposedGroup, false),
      classificationConfidence: proposalConflict.length ? 0.35 : 0.65,
      classificationConflicts: [...baseProposal.classificationConflicts, ...proposalConflict],
      classificationEvidence: [...baseProposal.classificationEvidence, { source: 'legacy_rule', rule: 'dimension and balance proposal derived from debit/credit movement evidence', value: `${bucket.debit}/${bucket.credit}` }],
      reviewStatus: proposalConflict.length ? 'needs_review' : 'discovered',
    };
    const dates = [...bucket.dates].sort();
    return {
      discoveryId: `discovery:${stableHash(key)}`,
      name,
      variants: [...bucket.names],
      debitCount: bucket.debit,
      creditCount: bucket.credit,
      cashTotal: bucket.cash,
      goldTotal: bucket.gold,
      silverTotal: bucket.silver,
      quantityTotal: bucket.quantity,
      counterparties: [...bucket.counterparties].map(([counterparty, count]) => ({ name: counterparty, count })).sort((a, b) => b.count - a.count).slice(0, 5),
      operationKinds: [...bucket.kinds],
      firstDate: dates[0] ?? '',
      lastDate: dates.at(-1) ?? '',
      proposedAccount,
      samples: bucket.samples,
    };
  });
};

export const financialDimensions = (account: CanonicalAccountDefinition): AccountingDimension[] =>
  account.allowedDimensions.filter((dimension): dimension is AccountingDimension => dimension !== 'quantity');
