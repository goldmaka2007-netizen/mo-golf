import { Account, CanonicalAccountDefinition, Entry } from '../types';
import { getEntryArabicWeight, parseCash, resolveOperationKind } from './engine';
import { buildAccountRegistry as buildCentralAccountRegistry } from './accountRegistry';

export type AccountingDimension = 'cash' | 'gold' | 'silver';
export type AccountingGroup = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expenses';
export type CanonicalEntityType = 'cash' | 'product' | 'inventory' | 'merchant' | 'creditor' | 'debtor' | 'equity' | 'revenue' | 'expense' | 'fixed_asset' | 'adjustment';
export interface CanonicalAccountEntity {
  entityId: string; canonicalName: string; legacyNames: string[]; entityType: CanonicalEntityType;
  mainGroup: AccountingGroup; allowedDimensions: AccountingDimension[]; metal: 'gold' | 'silver' | 'accessory' | null; trackingMode: 'value' | 'weight' | 'quantity';
  normalBalance: 'debit' | 'credit'; isInventory: boolean; isMerchant: boolean; isHistoricalOnly: boolean; displayDescription: string;
  sourceAccount?: Account;
  aliases?: string[];
  tracksQuantity?: boolean;
  normalBalanceByDimension?: Record<'cash' | 'gold' | 'silver' | 'quantity', 'debit' | 'credit' | null>;
  classificationSource?: 'legacy_code' | 'manual';
  classificationConfidence?: number;
  classificationEvidence?: unknown[];
  reviewStatus?: 'discovered' | 'needs_review' | 'reviewed';
  approvalStatus?: 'draft' | 'approved' | 'rejected';
}
export interface CanonicalAccountRegistry { entities: CanonicalAccountEntity[]; byId: Map<string, CanonicalAccountEntity>; byLegacyName: Map<string, CanonicalAccountEntity>; ambiguousAliases?: Map<string, CanonicalAccountEntity[]>; }
export interface AccountingLeg { entityId: string; accountName: string; dimension: AccountingDimension; side: 'debit' | 'credit'; amount: number; sourceEntryId: string; operationKind: string; date: string; isOpening: boolean; group: AccountingGroup; entity: CanonicalAccountEntity; entry: Entry; oppositeAccount: string; }

const normalized = (value: string | undefined) => String(value ?? '').trim().replace(/\s+/g, ' ');
interface CanonicalReference { canonicalName: string; aliases: string[]; entityType: CanonicalEntityType; mainGroup: AccountingGroup; metal: CanonicalAccountEntity['metal']; allowedDimensions: AccountingDimension[]; normalBalance: 'debit' | 'credit'; }
const canonicalReferences: CanonicalReference[] = [
  { canonicalName: '\u0632\u064a\u0627\u062f\u0629-\u0627\u0644\u0630\u0647\u0628', aliases: ['\u0632\u064a\u0627\u062f\u0629-\u0627\u0644\u0630\u0647\u0628', '\u0632\u064a\u0627\u062f\u0629 \u0627\u0644\u0630\u0647\u0628', '\u0632\u064a\u0627\u062f\u0647 \u0627\u0644\u0630\u0647\u0628', '\u0632\u064a\u0627\u062f\u0629 \u0630\u0647\u0628'], entityType: 'revenue', mainGroup: 'revenue', metal: 'gold', allowedDimensions: ['gold'], normalBalance: 'credit' },
  { canonicalName: '\u0639\u062c\u0632-\u0627\u0644\u0630\u0647\u0628', aliases: ['\u0639\u062c\u0632-\u0627\u0644\u0630\u0647\u0628', '\u0639\u062c\u0632 \u0627\u0644\u0630\u0647\u0628', '\u0639\u062c\u0632 \u0630\u0647\u0628'], entityType: 'expense', mainGroup: 'expenses', metal: 'gold', allowedDimensions: ['gold'], normalBalance: 'debit' },
  { canonicalName: '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a', aliases: ['\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a', '\u0645\u0635\u0631\u0648\u0641\u0627\u062a'], entityType: 'expense', mainGroup: 'expenses', metal: null, allowedDimensions: ['cash'], normalBalance: 'debit' },
];
const referenceForName = (name: string | undefined) => canonicalReferences.find(reference => reference.aliases.some(alias => normalized(alias) === normalized(name)));const excluded = (entry: Entry) => { const raw = entry as Entry & Record<string, unknown>; return raw.isDeleted === true || raw.deleted === true || raw.isVoided === true || raw.voided === true || raw.isReversed === true || raw.reversed === true || ['voided', 'deleted', 'reversed', 'excluded', 'invalid'].includes(String(raw.status ?? '').toLowerCase()); };
export const isValidAccountingEntry = (entry: Entry) => !excluded(entry);
const groupFor = (account: Account): AccountingGroup => {
  const type = String(account.mainType ?? '').toLowerCase();
  if (['liability', 'liabilities', '\u062e\u0635\u0648\u0645', '\u0627\u0644\u062e\u0635\u0648\u0645'].includes(type)) return 'liabilities';
  if (['equity', '\u062d\u0642\u0648\u0642 \u0645\u0644\u0643\u064a\u0629', '\u062d\u0642\u0648\u0642 \u0627\u0644\u0645\u0644\u0643\u064a\u0629'].includes(type)) return 'equity';
  if (['revenue', 'revenues', '\u0625\u064a\u0631\u0627\u062f\u0627\u062a', '\u0627\u0644\u0627\u064a\u0631\u0627\u062f\u0627\u062a'].includes(type)) return 'revenue';
  if (['expense', 'expenses', '\u0645\u0635\u0631\u0648\u0641\u0627\u062a'].includes(type)) return 'expenses';
  return 'assets';
};const entityTypeFor = (account: Account, group: AccountingGroup): CanonicalEntityType => {
  if (account.type === 'cash') return 'cash'; if (account.type === 'merchant') return 'merchant';
  if (account.is_inventory) return account.type === 'gold_raw' ? 'inventory' : 'product';
  if (group === 'equity') return 'equity'; if (group === 'revenue') return 'revenue'; if (group === 'expenses') return 'expense';
  if (group === 'liabilities') return 'creditor'; return account.subType?.includes('ثابت') ? 'fixed_asset' : 'debtor';
};
const explicitMetalFor = (account: Account): CanonicalAccountEntity['metal'] => {
  if (account.type === 'accessory') return 'accessory';
  if (account.metal === 'gold' || account.metal === 'silver') return account.metal;
  if (account.type === 'silver') return 'silver';
  if (['gold_product', 'gold_raw', 'gold_direct'].includes(account.type ?? '')) return 'gold';
  const nature = String(account.balanceNature ?? '').toLowerCase();
  if (nature.includes('\u0641\u0636\u0629') || nature.includes('silver')) return 'silver';
  if (nature.includes('\u0630\u0647\u0628') || nature.includes('gold')) return 'gold';
  return null;
};const dimensionsFor = (account: Account): AccountingDimension[] => {
  const metal = explicitMetalFor(account);
  if (account.type === 'cash' || metal === 'accessory') return ['cash'];
  if (metal === 'gold') return account.type === 'merchant' ? ['cash', 'gold'] : ['gold'];
  if (metal === 'silver') return account.type === 'merchant' ? ['cash', 'silver'] : ['silver'];
  return ['cash'];
};
const descriptionFor = (entity: Pick<CanonicalAccountEntity, 'entityType' | 'metal' | 'mainGroup' | 'isInventory'>) => entity.entityType === 'cash' ? 'خزنة' : entity.entityType === 'merchant' ? 'تاجر' : entity.isInventory ? `مخزون ${entity.metal === 'silver' ? 'فضة' : 'ذهب'}` : entity.mainGroup === 'liabilities' ? 'خصوم' : entity.mainGroup === 'equity' ? 'حقوق ملكية' : entity.mainGroup === 'revenue' ? 'إيراد' : entity.mainGroup === 'expenses' ? 'مصروف' : 'حساب أصل';

/** Registry identity comes from stable document IDs first, then legacy names only for historical records. */
export const buildCanonicalAccountRegistry = (accounts: Account[], entries: Entry[] = [], manualDefinitions?: CanonicalAccountDefinition[]): CanonicalAccountRegistry => {
  if (manualDefinitions) {
  const central = buildCentralAccountRegistry(accounts, entries, manualDefinitions);
  const entities = central.accounts.map(definition => {
    const sourceAccount = definition.sourceAccountId ? accounts.find(account => account.id === definition.sourceAccountId) : undefined;
    const financialDimensions = definition.allowedDimensions.filter((dimension): dimension is AccountingDimension => dimension !== 'quantity');
    const primaryDimension = financialDimensions[0] ?? 'cash';
    const normalBalance = definition.normalBalanceByDimension[primaryDimension] ?? (['liabilities', 'equity', 'revenue'].includes(definition.mainGroup) ? 'credit' : 'debit');
    const entityType: CanonicalEntityType = definition.entityType === 'gold_inventory' || definition.entityType === 'silver_inventory' || definition.entityType === 'accessory_inventory' ? 'inventory'
      : definition.entityType === 'cash' ? 'cash'
      : definition.entityType === 'merchant' ? 'merchant'
      : definition.entityType === 'creditor' ? 'creditor'
      : definition.entityType === 'debtor' || definition.entityType === 'customer' ? 'debtor'
      : definition.entityType === 'capital' || definition.entityType === 'retained_earnings' || definition.entityType === 'withdrawals' ? 'equity'
      : definition.entityType === 'revenue' || definition.entityType.endsWith('_surplus') ? 'revenue'
      : definition.entityType === 'expense' || definition.entityType.endsWith('_shortage') ? 'expense'
      : definition.entityType === 'fixed_asset' ? 'fixed_asset'
      : definition.entityType === 'adjustment' ? 'adjustment' : sourceAccount?.is_inventory ? 'product' : 'debtor';
    const entity: CanonicalAccountEntity = {
      entityId: definition.id,
      canonicalName: definition.canonicalName,
      legacyNames: definition.legacyNames,
      aliases: definition.aliases,
      entityType,
      mainGroup: definition.mainGroup,
      allowedDimensions: financialDimensions,
      metal: definition.metal,
      trackingMode: definition.trackingMode === 'quantity' ? 'quantity' : definition.tracksWeight ? 'weight' : 'value',
      normalBalance,
      normalBalanceByDimension: definition.normalBalanceByDimension,
      tracksQuantity: definition.tracksQuantity,
      isInventory: definition.isInventory,
      isMerchant: definition.isMerchant,
      isHistoricalOnly: definition.isHistoricalOnly,
      displayDescription: definition.description || definition.displayName,
      sourceAccount,
      classificationSource: definition.classificationSource,
      classificationConfidence: definition.classificationConfidence,
      classificationEvidence: definition.classificationEvidence,
      reviewStatus: definition.reviewStatus,
      approvalStatus: definition.approvalStatus,
    };
    return entity;
  });
  const byId = new Map(entities.map(entity => [entity.entityId, entity]));
  const byLegacyName = new Map<string, CanonicalAccountEntity>();
  central.aliases.forEach((candidates, alias) => {
    if (candidates.length !== 1) return;
    const entity = byId.get(candidates[0].id);
    if (entity) byLegacyName.set(alias, entity);
  });
  central.accounts.forEach(definition => {
    const entity = byId.get(definition.id);
    if (!entity) return;
    [...definition.legacyNames, ...definition.aliases, definition.canonicalName].forEach(alias => {
      if (!byLegacyName.has(normalized(alias))) byLegacyName.set(normalized(alias), entity);
    });
  });
  const ambiguousAliases = new Map<string, CanonicalAccountEntity[]>();
  central.ambiguousAliases.forEach((candidates, alias) => ambiguousAliases.set(alias, candidates.map(candidate => byId.get(candidate.id)).filter((entity): entity is CanonicalAccountEntity => !!entity)));
  return { entities, byId, byLegacyName, ambiguousAliases };
  }

  /* Legacy builder intentionally retained below during Parallel Run. */
  /* c8 ignore start */
  // eslint-disable-next-line no-unreachable
  {
  const entities: CanonicalAccountEntity[] = [];
  const byId = new Map<string, CanonicalAccountEntity>();
  const byLegacyName = new Map<string, CanonicalAccountEntity>();
  const ambiguousAliases = new Map<string, CanonicalAccountEntity[]>();
  accounts.filter(account => account.isActive !== false).forEach((account, index) => {
    const group = groupFor(account);
    const entityType = entityTypeFor(account, group);
    const identityType = entityType === 'cash' ? 'account' : entityType;
    const entityId = `${identityType}:${account.id || `${normalized(account.name)}:${index}`}`;
    const metal = explicitMetalFor(account);
    const reference = referenceForName(account.name);
    const governedDefinition = account.id
      ? buildCentralAccountRegistry([account], [], []).bySourceAccountId.get(account.id)
      : undefined;
    const governed = governedDefinition?.approvalStatus === 'approved'
      && governedDefinition.mainGroup === 'equity'
      ? governedDefinition
      : undefined;
    const governedDimensions = governed?.allowedDimensions.filter(
      (dimension): dimension is AccountingDimension => dimension !== 'quantity',
    );
    const resolvedMetal = governed?.metal ?? reference?.metal ?? metal;
    const resolvedGroup = governed?.mainGroup ?? reference?.mainGroup ?? group;
    const resolvedType = governed
      ? 'equity'
      : reference?.entityType ?? entityType;
    const resolvedDimensions = governedDimensions ?? reference?.allowedDimensions ?? dimensionsFor(account);
    const entity: CanonicalAccountEntity = {
      entityId,
      canonicalName: governed?.displayName ?? reference?.canonicalName ?? account.name,
      legacyNames: [...new Set([account.name, ...(reference?.aliases ?? [])])],
      entityType: resolvedType,
      mainGroup: resolvedGroup,
      allowedDimensions: resolvedDimensions,
      metal: resolvedMetal,
      normalBalance: reference?.normalBalance
        ?? (['liabilities', 'equity', 'revenue'].includes(resolvedGroup) ? 'credit' : 'debit'),
      trackingMode: governed?.tracksWeight
        ? 'weight'
        : resolvedMetal === 'accessory' ? 'quantity' : resolvedMetal ? 'weight' : 'value',
      isInventory: !!account.is_inventory,
      isMerchant: account.type === 'merchant',
      isHistoricalOnly: false,
      displayDescription: governed?.description ?? '',
      sourceAccount: account,
      classificationSource: governed?.classificationSource,
      classificationConfidence: governed?.classificationConfidence,
      classificationEvidence: governed?.classificationEvidence,
      reviewStatus: governed?.reviewStatus,
      approvalStatus: governed?.approvalStatus,
    };
    entity.displayDescription ||= descriptionFor(entity);
    entities.push(entity);
    byId.set(entityId, entity);
    entity.legacyNames.forEach(alias => {
      const key = normalized(alias);
      const existing = byLegacyName.get(key);
      const ambiguous = ambiguousAliases.get(key);
      if (ambiguous) {
        if (!ambiguous.some(candidate => candidate.entityId === entity.entityId)) ambiguous.push(entity);
      } else if (existing && existing.entityId !== entity.entityId) {
        byLegacyName.delete(key);
        ambiguousAliases.set(key, [existing, entity]);
      } else if (!existing) byLegacyName.set(key, entity);
    });
  });
  // A historical entity is admitted only when evidence exists. Classification is derived from its counterpart/leg evidence, never its Arabic spelling.
  entries.filter(isValidAccountingEntry).forEach(entry => (['debit', 'credit'] as const).forEach(side => {
    const name = normalized(entry[side]); if (!name || byLegacyName.has(name) || ambiguousAliases.has(name)) return;
    const opposite = byLegacyName.get(normalized(entry[side === 'debit' ? 'credit' : 'debit'])); const reference = referenceForName(name);
    const kind = resolveOperationKind(entry); const dimension: AccountingDimension = reference?.metal === 'gold' || reference?.metal === 'silver' ? reference.metal : opposite?.metal === 'gold' || opposite?.metal === 'silver' ? opposite.metal : 'cash';
    const group: AccountingGroup = reference?.mainGroup ?? (side === 'credit' ? (kind === 'opening' && opposite?.mainGroup === 'assets' ? 'equity' : 'liabilities') : 'assets');
    const entity: CanonicalAccountEntity = { entityId: `historical:${reference?.canonicalName ?? name}`, canonicalName: reference?.canonicalName ?? name, legacyNames: [...new Set([name, ...(reference?.aliases ?? [])])], entityType: reference?.entityType ?? (group === 'liabilities' ? 'creditor' : group === 'equity' ? 'equity' : 'debtor'), mainGroup: group, allowedDimensions: reference?.allowedDimensions ?? [dimension], metal: reference?.metal ?? (dimension === 'cash' ? null : dimension), trackingMode: dimension === 'cash' ? 'value' : 'weight', normalBalance: reference?.normalBalance ?? (group === 'assets' ? 'debit' : 'credit'), isInventory: false, isMerchant: false, isHistoricalOnly: true, displayDescription: group === 'liabilities' ? 'خصوم تاريخية' : group === 'equity' ? 'حقوق ملكية تاريخية' : 'حساب تاريخي' };
    entities.push(entity); byId.set(entity.entityId, entity); entity.legacyNames.forEach(alias => byLegacyName.set(normalized(alias), entity));  }));
  return { entities, byId, byLegacyName, ambiguousAliases };
  }
  /* c8 ignore stop */
};

const entityFor = (entry: Entry, side: 'debit' | 'credit', registry: CanonicalAccountRegistry) => registry.entities.find(entity => entity.sourceAccount?.id && entity.sourceAccount.id === entry[side === 'debit' ? 'debitAccountId' : 'creditAccountId']) ?? registry.byLegacyName.get(normalized(entry[side]));
const weightFor = (entry: Entry, entity?: CanonicalAccountEntity) => { if (!entity || entity.metal === 'accessory' || entity.trackingMode !== 'weight') return 0; const amount = entity.metal === 'silver' ? Number(entry.weight) || 0 : getEntryArabicWeight(entry, entity.sourceAccount); return amount || Number(entry.arabicWeight) || 0; };
const addLeg = (out: AccountingLeg[], entry: Entry, entity: CanonicalAccountEntity | undefined, side: 'debit' | 'credit', dimension: AccountingDimension, amount: number, oppositeAccount: string) => { if (!entity || !entity.allowedDimensions.includes(dimension) || (entity.metal === 'accessory' && dimension !== 'cash') || (entity.metal === 'silver' && dimension === 'gold') || (entity.metal === 'gold' && dimension === 'silver') || !Number.isFinite(amount) || amount <= 0) return; out.push({ entityId: entity.entityId, accountName: entity.canonicalName, dimension, side, amount, sourceEntryId: entry.id || String(entry.seq), operationKind: resolveOperationKind(entry), date: entry.date, isOpening: resolveOperationKind(entry) === 'opening', group: entity.mainGroup, entity, entry, oppositeAccount }); };

/** Central posting matrix: a value is posted only to the account that owns that dimension. */
export const buildCanonicalAccountingLegs = (entries: Entry[], registry: CanonicalAccountRegistry): AccountingLeg[] => {
  const out: AccountingLeg[] = [];
  entries.filter(isValidAccountingEntry).forEach(entry => {
    const debit = entityFor(entry, 'debit', registry), credit = entityFor(entry, 'credit', registry); const kind = resolveOperationKind(entry); const cash = parseCash(entry);
    const metals = [debit, credit].map(entity => entity?.metal).filter((metal): metal is 'gold' | 'silver' => metal === 'gold' || metal === 'silver');
    const metal = metals.length === 1 || (metals.length === 2 && metals[0] === metals[1]) ? metals[0] : null; const dimension = metal ?? null; const metalOwner = dimension === 'gold' ? (debit?.metal === 'gold' ? debit : credit?.metal === 'gold' ? credit : undefined) : dimension === 'silver' ? (debit?.metal === 'silver' ? debit : credit?.metal === 'silver' ? credit : undefined) : undefined; const weight = weightFor(entry, metalOwner);
    const debitCash = debit?.allowedDimensions.includes('cash') ? debit : credit?.allowedDimensions.includes('cash') ? credit : undefined;
    const creditCash = credit?.allowedDimensions.includes('cash') ? credit : debit?.allowedDimensions.includes('cash') ? debit : undefined;
    const sideOf = (entity: CanonicalAccountEntity | undefined): 'debit' | 'credit' => entity === debit ? 'debit' : 'credit';
    const metalEntity = metalOwner;
    if (kind === 'sale') { addLeg(out, entry, debitCash, sideOf(debitCash), 'cash', cash, entry.credit); if (dimension) addLeg(out, entry, metalEntity, sideOf(metalEntity), dimension, weight, metalEntity === debit ? entry.credit : entry.debit); return; }
    if (kind === 'purchase') { if (dimension) { addLeg(out, entry, metalEntity, sideOf(metalEntity), dimension, weight, metalEntity === debit ? entry.credit : entry.debit); if (credit?.isMerchant && credit.metal === dimension) addLeg(out, entry, credit, 'credit', dimension, weight, entry.debit); } addLeg(out, entry, creditCash, sideOf(creditCash), 'cash', cash, entry.debit); return; }
    if (kind === 'merchant_settlement') { if (cash > 0) { addLeg(out, entry, debit, 'debit', 'cash', cash, entry.credit); addLeg(out, entry, credit, 'credit', 'cash', cash, entry.debit); return; } if (dimension) { addLeg(out, entry, debit, 'debit', dimension, weight, entry.credit); addLeg(out, entry, credit, 'credit', dimension, weight, entry.debit); } return; }
    if (kind === 'expense') { addLeg(out, entry, debit, 'debit', 'cash', cash, entry.credit); addLeg(out, entry, creditCash, 'credit', 'cash', cash, entry.debit); return; }
    if (kind === 'opening' || kind === 'transfer' || kind === 'tifeet' || kind === 'adjustment' || kind === 'other' || kind === 'personal_withdrawal') {
      const dims: AccountingDimension[] = []; if (cash > 0 && (debit?.allowedDimensions.includes('cash') || credit?.allowedDimensions.includes('cash'))) dims.push('cash'); if (weight > 0 && dimension) dims.push(dimension);
      dims.forEach(dim => { const amount = dim === 'cash' ? cash : weight; const d = dim === 'cash' ? debitCash : debit; const c = dim === 'cash' ? creditCash : credit; addLeg(out, entry, d, 'debit', dim, amount, entry.credit); addLeg(out, entry, c, 'credit', dim, amount, entry.debit); });
    }
  }); return out;
};

export interface AccountingCoverageAudit { totalUniqueNames: number; totalRegistryEntities: number; totalHistoricalOnlyEntities: number; namesWithValidMovementButNoLeg: string[]; resolvedAliases: string[]; unknownNames: string[]; ambiguousAliases: string[]; knownAccountsWithoutLeg: string[]; disallowedDimensionRecords: string[]; zeroOrInvalidAmountRecords: string[]; postingMatrixMisses: string[]; conflictingClassifications: string[]; namesInMultipleDimensions: string[]; excluded: { id: string; reason: string }[]; unhandledOperationKinds: string[]; zeroLegRecords: string[]; debitCreditDifference: Record<AccountingDimension, number>; }
export const auditAccountingCoverage = (entries: Entry[], registry: CanonicalAccountRegistry, legs: AccountingLeg[]): AccountingCoverageAudit => {
  const names = new Set(entries.filter(isValidAccountingEntry).flatMap(e => [normalized(e.debit), normalized(e.credit)]).filter(Boolean)); const legEntityIds = new Set(legs.map(l => l.entityId));
  const dimensions = new Map<string, Set<string>>(); legs.forEach(l => { const s = dimensions.get(l.entityId) || new Set(); s.add(l.dimension); dimensions.set(l.entityId, s); });
  const diff: Record<AccountingDimension, number> = { cash: 0, gold: 0, silver: 0 }; legs.forEach(l => diff[l.dimension] += l.side === 'debit' ? l.amount : -l.amount);
  const resolved = [...names].map(name => ({ name, entity: registry.byLegacyName.get(name) }));
  const zeroLegRecords = entries.filter(isValidAccountingEntry).filter(e => (parseCash(e) > 0 || Number(e.weight) > 0 || Number(e.count) > 0) && !legs.some(l => l.entry === e)).map(e => e.id || String(e.seq));
  const zeroOrInvalidAmountRecords = entries.filter(isValidAccountingEntry).filter(e => ![parseCash(e), Number(e.weight), Number(e.arabicWeight), Number(e.count)].some(value => Number.isFinite(value) && value > 0)).map(e => e.id || String(e.seq));
  const disallowedDimensionRecords = entries.filter(isValidAccountingEntry).flatMap(entry => (['debit', 'credit'] as const).flatMap(side => { const entity = registry.byLegacyName.get(normalized(entry[side])); if (!entity) return []; const cash = parseCash(entry) > 0 && !entity.allowedDimensions.includes('cash'); const metal = (Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0) && entity.metal && !entity.allowedDimensions.includes(entity.metal === 'silver' ? 'silver' : 'gold'); return cash || metal ? [entry.id || String(entry.seq)] : []; }));
  return { totalUniqueNames: names.size, totalRegistryEntities: registry.entities.length, totalHistoricalOnlyEntities: registry.entities.filter(e => e.isHistoricalOnly).length, namesWithValidMovementButNoLeg: resolved.filter(item => item.entity && !legEntityIds.has(item.entity.entityId)).map(item => item.name), resolvedAliases: resolved.filter(item => item.entity && normalized(item.entity.canonicalName) !== item.name).map(item => item.name), unknownNames: resolved.filter(item => !item.entity).map(item => item.name), ambiguousAliases: [...(registry.ambiguousAliases?.keys() ?? [])], knownAccountsWithoutLeg: resolved.filter(item => item.entity && !legEntityIds.has(item.entity.entityId)).map(item => item.entity!.canonicalName), disallowedDimensionRecords: [...new Set(disallowedDimensionRecords)], zeroOrInvalidAmountRecords, postingMatrixMisses: zeroLegRecords, conflictingClassifications: registry.entities.filter(e => e.legacyNames.some(n => registry.entities.filter(x => x.entityId !== e.entityId && x.legacyNames.map(normalized).includes(normalized(n))).length > 0)).map(e => e.canonicalName), namesInMultipleDimensions: [...dimensions].filter(([, v]) => v.size > 1).map(([id]) => registry.byId.get(id)?.canonicalName || id), excluded: entries.filter(e => !isValidAccountingEntry(e)).map(e => ({ id: e.id || String(e.seq), reason: 'deleted/voided/reversed/excluded/invalid' })), unhandledOperationKinds: [...new Set(entries.filter(isValidAccountingEntry).filter(e => !['opening','purchase','sale','transfer','tifeet','adjustment','merchant_settlement','personal_withdrawal','expense','other'].includes(resolveOperationKind(e))).map(e => resolveOperationKind(e)))], zeroLegRecords, debitCreditDifference: diff };
};

export interface EntityClassificationAudit {
  accessoryEntitiesWithMetalLegs: string[];
  silverEntitiesWithGoldLegs: string[];
  goldEntitiesWithSilverLegs: string[];
  inferredMetalConflicts: string[];
  fallbackClassifiedEntities: string[];
  legacyWeightNonMetalEntities: string[];
  passed: boolean;
}
/** Development-only invariant audit. Explicit registry metadata always wins over legacy payload fields. */
export const auditEntityClassification = (registry: CanonicalAccountRegistry, entries: Entry[]): EntityClassificationAudit => {
  const legs = buildCanonicalAccountingLegs(entries, registry);
  const named = (predicate: (entity: CanonicalAccountEntity) => boolean, dimension: AccountingDimension) => registry.entities.filter(predicate).filter(entity => legs.some(leg => leg.entityId === entity.entityId && leg.dimension === dimension)).map(entity => entity.canonicalName);
  const accessoryEntitiesWithMetalLegs = registry.entities.filter(entity => entity.metal === 'accessory').filter(entity => legs.some(leg => leg.entityId === entity.entityId && leg.dimension !== 'cash')).map(entity => entity.canonicalName);
  const silverEntitiesWithGoldLegs = named(entity => entity.metal === 'silver', 'gold');
  const goldEntitiesWithSilverLegs = named(entity => entity.metal === 'gold', 'silver');
  const inferredMetalConflicts = registry.entities.filter(entity => !entity.isHistoricalOnly && entity.sourceAccount?.type === 'accessory' && entity.metal !== 'accessory').map(entity => entity.canonicalName);
  const fallbackClassifiedEntities = registry.entities.filter(entity => entity.isHistoricalOnly && entity.metal !== null && !entries.some(entry => [entry.debit, entry.credit].includes(entity.canonicalName) && [entry.debit, entry.credit].some(name => registry.byLegacyName.get(normalized(name))?.metal === entity.metal))).map(entity => entity.canonicalName);
  const legacyWeightNonMetalEntities = registry.entities.filter(entity => entity.metal === 'accessory' || (!entity.metal && entity.trackingMode !== 'weight')).filter(entity => entries.some(entry => (normalized(entry.debit) === normalized(entity.canonicalName) || normalized(entry.credit) === normalized(entity.canonicalName)) && (Number(entry.weight) > 0 || Number(entry.arabicWeight) > 0))).map(entity => entity.canonicalName);
  const passed = !accessoryEntitiesWithMetalLegs.length && !silverEntitiesWithGoldLegs.length && !goldEntitiesWithSilverLegs.length && !inferredMetalConflicts.length;
  return { accessoryEntitiesWithMetalLegs, silverEntitiesWithGoldLegs, goldEntitiesWithSilverLegs, inferredMetalConflicts, fallbackClassifiedEntities, legacyWeightNonMetalEntities, passed };
};
export interface MetalPostingDiagnostic {
  sourceEntryId: string; operationKind: string; dimension: 'gold' | 'silver'; amount: number; debitAccount: string; creditAccount: string;
  debitEntity?: string; creditEntity?: string; debitGroup?: AccountingGroup; creditGroup?: AccountingGroup; debitAllowedDimensions?: AccountingDimension[]; creditAllowedDimensions?: AccountingDimension[];
  debitLeg?: AccountingLeg; creditLeg?: AccountingLeg; droppedReasons: string[];
}
export const diagnoseMetalPostings = (entries: Entry[], registry: CanonicalAccountRegistry, legs = buildCanonicalAccountingLegs(entries, registry)): MetalPostingDiagnostic[] => entries.filter(isValidAccountingEntry).flatMap(entry => {
  const debit = entityFor(entry, 'debit', registry); const credit = entityFor(entry, 'credit', registry); const metals = [debit, credit].map(entity => entity?.metal).filter((metal): metal is 'gold' | 'silver' => metal === 'gold' || metal === 'silver');
  const dimension = metals.length === 1 || (metals.length === 2 && metals[0] === metals[1]) ? metals[0] : null; if (!dimension) return [];
  const sourceEntryId = entry.id || String(entry.seq); const recordLegs = legs.filter(leg => leg.sourceEntryId === sourceEntryId && leg.dimension === dimension); const amount = weightFor(entry, dimension === 'gold' ? (debit?.metal === 'gold' ? debit : credit) : (debit?.metal === 'silver' ? debit : credit));
  const droppedReasons: string[] = []; if (!debit?.allowedDimensions.includes(dimension)) droppedReasons.push('debit entity does not allow dimension'); if (!credit?.allowedDimensions.includes(dimension)) droppedReasons.push('credit entity does not allow dimension'); if (amount > 0 && !recordLegs.some(leg => leg.side === 'debit')) droppedReasons.push('missing debit metal leg'); if (amount > 0 && !recordLegs.some(leg => leg.side === 'credit')) droppedReasons.push('missing credit metal leg');
  return [{ sourceEntryId, operationKind: resolveOperationKind(entry), dimension, amount, debitAccount: entry.debit, creditAccount: entry.credit, debitEntity: debit?.canonicalName, creditEntity: credit?.canonicalName, debitGroup: debit?.mainGroup, creditGroup: credit?.mainGroup, debitAllowedDimensions: debit?.allowedDimensions, creditAllowedDimensions: credit?.allowedDimensions, debitLeg: recordLegs.find(leg => leg.side === 'debit'), creditLeg: recordLegs.find(leg => leg.side === 'credit'), droppedReasons }];
});
export const findUnbalancedMetalPostings = (entries: Entry[], legs: AccountingLeg[]): { sourceEntryId: string; dimension: 'gold' | 'silver'; debit: number; credit: number }[] => {
  const validIds = new Set(entries.filter(isValidAccountingEntry).map(entry => entry.id || String(entry.seq))); const totals = new Map<string, { debit: number; credit: number }>();
  legs.filter(leg => leg.dimension !== 'cash' && validIds.has(leg.sourceEntryId)).forEach(leg => { const key = `${leg.sourceEntryId}:${leg.dimension}`; const total = totals.get(key) || { debit: 0, credit: 0 }; total[leg.side] += leg.amount; totals.set(key, total); });
  return [...totals].flatMap(([key, total]) => Math.abs(total.debit - total.credit) > 0.000001 ? [{ sourceEntryId: key.substring(0, key.lastIndexOf(':')), dimension: key.substring(key.lastIndexOf(':') + 1) as 'gold' | 'silver', ...total }] : []);
};
export interface GoldSurplusAuditRow {
  id: string; date: string; operationNumber: string; product: string; actualWeight: number; karat?: number; equivalent21Weight: number;
  debitLeg?: AccountingLeg; creditLeg?: AccountingLeg; missingCreditReason?: string;
}
/** Runtime audit for the gold-surplus entries that should offset a debit inventory leg with revenue credit. */
export const auditGoldSurplusOperations = (entries: Entry[], registry: CanonicalAccountRegistry, legs = buildCanonicalAccountingLegs(entries, registry)): GoldSurplusAuditRow[] => entries.filter(isValidAccountingEntry).flatMap(entry => {
  if (resolveOperationKind(entry) !== 'adjustment') return [];
  const debit = entityFor(entry, 'debit', registry); const credit = entityFor(entry, 'credit', registry);
  if (debit?.metal !== 'gold' || credit?.mainGroup !== 'revenue' || credit.metal !== 'gold') return [];
  const id = entry.id || String(entry.seq); const recordLegs = legs.filter(leg => leg.sourceEntryId === id && leg.dimension === 'gold'); const debitLeg = recordLegs.find(leg => leg.side === 'debit'); const creditLeg = recordLegs.find(leg => leg.side === 'credit');
  return [{ id, date: entry.date, operationNumber: entry.invoiceNumber || String(entry.seq), product: debit.canonicalName, actualWeight: Number(entry.weight) || 0, karat: entry.karat, equivalent21Weight: weightFor(entry, debit), debitLeg, creditLeg, missingCreditReason: creditLeg ? undefined : !credit.allowedDimensions.includes('gold') ? 'surplus account does not allow gold' : 'posting matrix did not generate credit leg' }];
});
