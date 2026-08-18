import { Account, Entry } from '../types';
import { AccountingLeg, buildCanonicalAccountRegistry, buildCanonicalAccountingLegs } from './canonicalAccounting';
import { parseCash, resolveMerchantMetalOperationSemantic, resolveOperationKind, resolveAccount, buildAccountIndex } from './engine';

export interface SmartMarginSettings { minimumEgpPerE21: number; minimumPercent: number; }
export const DEFAULT_SMART_MARGIN_SETTINGS: SmartMarginSettings = { minimumEgpPerE21: 0, minimumPercent: 0 };
export const normalizeSmartMarginSettings = (value: unknown): SmartMarginSettings => {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const fixed = Number(input.minimumEgpPerE21 ?? input.fixedEgpPerE21 ?? 0);
  const percent = Number(input.minimumPercent ?? input.minimumPercentMargin ?? 0);
  return { minimumEgpPerE21: Number.isFinite(fixed) && fixed >= 0 ? fixed : 0, minimumPercent: Number.isFinite(percent) && percent >= 0 ? percent : 0 };
};
export const resolveDailyJournalMarketPrice = (selectedDate: string, today: string, currentPrice: number | null): number | null => selectedDate === today && currentPrice !== null && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null;

export interface SmartWindow { e21: number; egp: number; average: number | null; operations: number; excluded: number; }
export interface SmartCommercialAnalysis { today: SmartWindow; last7Days: SmartWindow; last30Days: SmartWindow; blended: number | null; }
export interface CashCategory { label: string; cashIn: number; cashOut: number; }
export interface KaratSummary { physical: number; e21: number; movements: number; }
export type GoldKaratBreakdown = Record<'18' | '21' | '24', KaratSummary>;
const emptyKaratBreakdown = (): GoldKaratBreakdown => ({ '18': { physical: 0, e21: 0, movements: 0 }, '21': { physical: 0, e21: 0, movements: 0 }, '24': { physical: 0, e21: 0, movements: 0 } });
export interface SmartDashboardReport {
  cash: { opening: number; cashIn: number; availableBeforeOut: number; cashOut: number; closing: number; categories: CashCategory[] };
  gold: { sales: SmartCommercialAnalysis; purchases: SmartCommercialAnalysis; movementIn: number; movementOut: number; physicalIn: number; physicalOut: number; excluded: number; };
  decision: { blendedSell: number | null; blendedPurchase: number | null; historicalSpread: number | null; fixedMargin: number; percentMargin: number | null; historicalMargin: number | null; requiredMargin: number | null; suggestedPurchase: number | null; binding: 'historical' | 'fixed' | 'percentage' | null; };
  merchants: { goldReceived: number; goldDelivered: number; goldTransfers: number; goldNet: number; goldReceivedPhysical: number; goldDeliveredPhysical: number; silverReceived: number; silverDelivered: number; workmanshipCash: number; goldByKarat: GoldKaratBreakdown; karatConflicts: number; };
  silver: { salesWeight: number; salesEgp: number; purchasesWeight: number; purchasesEgp: number; internalMovement: number; netMovement: number; merchantReceived: number; merchantDelivered: number; };
  internal: { transfers: number; scrapIn: number; scrapOut: number; netScrap: number; directions: Record<string, KaratSummary>; goldByKarat: GoldKaratBreakdown; karatConflicts: number; };
  marketPrice: number | null;
}

const emptyWindow = (): SmartWindow => ({ e21: 0, egp: 0, average: null, operations: 0, excluded: 0 });
const dateDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const validMoney = (entry: Entry) => { const value = parseCash(entry); return Number.isFinite(value) && value > 0 ? value : null; };
const addCommercial = (window: SmartWindow, entry: Entry, e21: number) => { const money = validMoney(entry); if (!(e21 > 0) || money === null) { window.excluded += 1; return; } window.e21 += e21; window.egp += money; window.operations += 1; };
const finishWindow = (window: SmartWindow) => { window.average = window.e21 > 0 && window.egp > 0 ? window.egp / window.e21 : null; return window; };
const analysis = (entries: Entry[], date: string, kind: 'sale' | 'purchase', legsByEntry: Map<string, AccountingLeg[]>, accounts: Account[]): SmartCommercialAnalysis => {
  const windows = [emptyWindow(), emptyWindow(), emptyWindow()];
  entries.forEach(entry => {
    if (resolveOperationKind(entry) !== kind) return;
    const age = dateDiff(date, entry.date);
    if (age < 0 || age >= 30) return;
    const legs = (legsByEntry.get(entry.id || String(entry.seq)) || []).filter(leg => leg.dimension === 'gold' && leg.entity.isInventory);
    const qualifying = legs.filter(leg => kind === 'sale' ? leg.side === 'credit' : leg.side === 'debit');
    const index = buildAccountIndex(accounts);
    const semantic = resolveMerchantMetalOperationSemantic(entry, resolveAccount(entry, 'debit', index), resolveAccount(entry, 'credit', index));
    const debit = resolveAccount(entry, 'debit', index), credit = resolveAccount(entry, 'credit', index);
    const hasMerchant = debit?.type === 'merchant' || credit?.type === 'merchant';
    const valid = qualifying.length === 1 && semantic.kind === 'none' && !hasMerchant && ['sale', 'purchase'].includes(resolveOperationKind(entry));
    if (!valid) {
      if (age === 0) windows[0].excluded += 1;
      if (age < 7) windows[1].excluded += 1;
      windows[2].excluded += 1;
      return;
    }
    const e21 = qualifying[0].amount;
    const physical = Number(entry.weight);
    if (age === 0) addCommercial(windows[0], entry, e21);
    if (age < 7) addCommercial(windows[1], entry, e21);
    addCommercial(windows[2], entry, e21);
    void physical;
  });
  windows.forEach(finishWindow);
  const available = windows.filter(window => window.average !== null && window.e21 > 0);
  const weight = available.reduce((sum, window) => sum + window.e21, 0);
  return { today: windows[0], last7Days: windows[1], last30Days: windows[2], blended: weight > 0 ? available.reduce((sum, window) => sum + window.e21 * (window.average || 0), 0) / weight : null };
};

const categoryFor = (leg: AccountingLeg, entryLegs: AccountingLeg[]): string => {
  const entry = leg.entry;
  const kind = resolveOperationKind(entry);
  const inventoryMetals = new Set(entryLegs.filter(item => item.entity.isInventory && (item.dimension === 'gold' || item.dimension === 'silver')).map(item => item.dimension));
  if (kind === 'sale') {
    if (inventoryMetals.size === 1 && inventoryMetals.has('gold')) return '\u0645\u0628\u064a\u0639\u0627\u062a \u0630\u0647\u0628';
    if (inventoryMetals.size === 1 && inventoryMetals.has('silver')) return '\u0645\u0628\u064a\u0639\u0627\u062a \u0641\u0636\u0629';
    return '\u0645\u0628\u064a\u0639\u0627\u062a \u0623\u062e\u0631\u0649';
  }
  if (kind === 'purchase') {
    if (inventoryMetals.size === 1 && inventoryMetals.has('gold')) return '\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0630\u0647\u0628';
    if (inventoryMetals.size === 1 && inventoryMetals.has('silver')) return '\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0641\u0636\u0629';
    return '\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0623\u062e\u0631\u0649';
  }
  if (kind === 'expense') return 'مصروفات';
  if (kind === 'personal_withdrawal') return 'مسحوبات';
  if (kind === 'merchant_settlement') return 'تسوية تاجر/مصنعية';
  if (kind === 'adjustment') return 'تعديل نقدي';
  if (kind === 'other') {
    const hasRevenueCounterpart = entryLegs.some(item => item !== leg && item.entity.entityType === 'revenue');
    if (hasRevenueCounterpart && entry.tx === '\u0627\u064a\u0631\u0627\u062f\u0627\u062a \u0627\u062e\u0631\u0649') return '\u0625\u064a\u0631\u0627\u062f \u062a\u0635\u0644\u064a\u062d';
    return '\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0623\u062e\u0631\u0649';
  }
  return 'غير مصنف';
};

const emptySummary = (): KaratSummary => ({ physical: 0, e21: 0, movements: 0 });
const accountForLeg = (leg: AccountingLeg, accounts: Account[]) => leg.entity.sourceAccount?.id ? accounts.find(account => account.id === leg.entity.sourceAccount?.id) : undefined;
const karatForEntry = (entry: Entry, legs: AccountingLeg[], accounts: Account[]): { karat: '18' | '21' | '24' | null; conflict: boolean } => {
  const goldLegs = legs.filter(leg => leg.dimension === 'gold');
  const accountKarat = goldLegs.map(leg => accountForLeg(leg, accounts)?.karat).filter((value): value is '18' | '21' | '24' => value === '18' || value === '21' || value === '24');
  const entryKarat = entry.karat === 18 || entry.karat === 21 || entry.karat === 24 ? String(entry.karat) as '18' | '21' | '24' : null;
  const snapshotKarat = entry.goldEquivalent21Snapshot?.karat === 18 || entry.goldEquivalent21Snapshot?.karat === 21 || entry.goldEquivalent21Snapshot?.karat === 24 ? String(entry.goldEquivalent21Snapshot.karat) as '18' | '21' | '24' : null;
  const sources = [...accountKarat, ...(entryKarat ? [entryKarat] : []), ...(snapshotKarat ? [snapshotKarat] : [])];
  const conflict = new Set(sources).size > 1;
  return { karat: conflict ? null : sources[0] || null, conflict };
};
const addKarat = (breakdown: GoldKaratBreakdown, entry: Entry, legs: AccountingLeg[], accounts: Account[], amount: number, physical: number) => {
  const resolved = karatForEntry(entry, legs, accounts);
  if (!resolved.karat) return resolved.conflict;
  const row = breakdown[resolved.karat]; row.e21 += amount; row.physical += physical; row.movements += 1; return false;
};
const isScrapAccount = (account?: Account) => account?.type === 'gold_raw' || account?.type === 'silver';
const isFinishedAccount = (account?: Account) => account?.type === 'gold_product' || account?.type === 'gold_direct';
const directionFor = (entry: Entry, accounts: Account[]) => {
  const debit = resolveAccount(entry, 'debit', buildAccountIndex(accounts)); const credit = resolveAccount(entry, 'credit', buildAccountIndex(accounts));
  const debitScrap = isScrapAccount(debit), creditScrap = isScrapAccount(credit), debitFinished = isFinishedAccount(debit), creditFinished = isFinishedAccount(credit);
  if (debitFinished && creditScrap) return 'finished → scrap';
  if (debitScrap && creditFinished) return 'scrap → finished';
  if (debitScrap && creditScrap) return 'scrap → scrap';
  if (debitFinished && creditFinished) return 'finished → finished';
  return 'other';
};

export const buildDailyJournalSmartDashboard = (entries: Entry[], accounts: Account[], date: string, marginSettings: SmartMarginSettings = DEFAULT_SMART_MARGIN_SETTINGS, marketPrice: number | null = null): SmartDashboardReport => {
  const registry = buildCanonicalAccountRegistry(accounts, entries);
  const legs = buildCanonicalAccountingLegs(entries, registry);
  const legsByEntry = new Map<string, AccountingLeg[]>(); legs.forEach(leg => legsByEntry.set(leg.sourceEntryId, [...(legsByEntry.get(leg.sourceEntryId) || []), leg]));
  const cashLegs = legs.filter(leg => leg.dimension === 'cash' && leg.entity.entityType === 'cash');
  const cashToday = cashLegs.filter(leg => leg.date === date);
  const opening = cashLegs.filter(leg => leg.date < date || (leg.isOpening && leg.date <= date)).reduce((sum, leg) => sum + (leg.side === 'debit' ? leg.amount : -leg.amount), 0);
  const cashTodayOperational = cashToday.filter(leg => !leg.isOpening);
  const cashIn = cashTodayOperational.filter(leg => leg.side === 'debit').reduce((sum, leg) => sum + leg.amount, 0);
  const cashOut = cashTodayOperational.filter(leg => leg.side === 'credit').reduce((sum, leg) => sum + leg.amount, 0);
  const categoryMap = new Map<string, CashCategory>();
  cashTodayOperational.forEach(leg => { const label = categoryFor(leg, legsByEntry.get(leg.sourceEntryId) || []); const item = categoryMap.get(label) || { label, cashIn: 0, cashOut: 0 }; if (leg.side === 'debit') item.cashIn += leg.amount; else item.cashOut += leg.amount; categoryMap.set(label, item); });
  const sales = analysis(entries, date, 'sale', legsByEntry, accounts); const purchases = analysis(entries, date, 'purchase', legsByEntry, accounts);
  let movementIn = 0, movementOut = 0, physicalIn = 0, physicalOut = 0, excluded = sales.today.excluded + purchases.today.excluded;
  let goldReceived = 0, goldDelivered = 0, goldTransfers = 0, silverReceived = 0, silverDelivered = 0, workmanshipCash = 0, goldReceivedPhysical = 0, goldDeliveredPhysical = 0, merchantKaratConflicts = 0;
  const goldByKarat = emptyKaratBreakdown();
  let silverSalesWeight = 0, silverSalesEgp = 0, silverPurchasesWeight = 0, silverPurchasesEgp = 0, silverInternal = 0;
  let internalTransfers = 0, scrapIn = 0, scrapOut = 0, internalKaratConflicts = 0;
  const internalGoldByKarat = emptyKaratBreakdown(); const internalDirections: Record<string, KaratSummary> = {};
  const accountIndex = buildAccountIndex(accounts);
  legs.filter(leg => leg.date === date && leg.dimension === 'gold' && leg.entity.isInventory).forEach(leg => { if (leg.side === 'debit') movementIn += leg.amount; else movementOut += leg.amount; });
  entries.filter(entry => entry.date === date).forEach(entry => {
    const entryLegs = legsByEntry.get(entry.id || String(entry.seq)) || [];
    const value = Number(entry.weight) || 0; const goldLeg = entryLegs.find(item => item.dimension === 'gold'); if (goldLeg) { if (goldLeg.side === 'debit') physicalIn += value; else physicalOut += value; }
    const debitAccount = resolveAccount(entry, 'debit', accountIndex), creditAccount = resolveAccount(entry, 'credit', accountIndex);
    const semantic = resolveMerchantMetalOperationSemantic(entry, debitAccount, creditAccount);
    const merchantLeg = entryLegs.find(leg => leg.entity.isMerchant && (leg.dimension === 'gold' || leg.dimension === 'silver'));
    if (semantic.kind === 'receipt' && merchantLeg) { if (semantic.metal === 'gold') { goldReceived += merchantLeg.amount; goldReceivedPhysical += value; if (addKarat(goldByKarat, entry, entryLegs, accounts, merchantLeg.amount, value)) merchantKaratConflicts += 1; } else silverReceived += merchantLeg.amount; }
    if (semantic.kind === 'weight_settlement' && merchantLeg) { if (semantic.metal === 'gold') { goldDelivered += merchantLeg.amount; goldDeliveredPhysical += value; if (addKarat(goldByKarat, entry, entryLegs, accounts, merchantLeg.amount, value)) merchantKaratConflicts += 1; } else silverDelivered += merchantLeg.amount; }
    if (semantic.kind === 'merchant_transfer' && semantic.metal === 'gold') goldTransfers += merchantLeg?.amount || 0;
    if (semantic.kind === 'cash_settlement' && semantic.metal === 'gold') workmanshipCash += parseCash(entry);
    const kind = resolveOperationKind(entry);
    if (kind === 'sale' || kind === 'purchase') {
      const silverLegs = entryLegs.filter(leg => leg.dimension === 'silver' && leg.entity.isInventory);
      const validSilver = silverLegs.length === 1 && semantic.kind === 'none' && debitAccount?.type !== 'merchant' && creditAccount?.type !== 'merchant';
      if (validSilver) { if (kind === 'sale') { silverSalesWeight += silverLegs[0].amount; silverSalesEgp += parseCash(entry); } else { silverPurchasesWeight += silverLegs[0].amount; silverPurchasesEgp += parseCash(entry); } }
    }
    if (['transfer', 'tifeet'].includes(kind)) { const metalLegs = entryLegs.filter(leg => leg.dimension === 'gold' || leg.dimension === 'silver'); internalTransfers += metalLegs.length > 0 ? 1 : 0; const direction = directionFor(entry, accounts); const directionRow = internalDirections[direction] || emptySummary(); metalLegs.forEach(leg => { if (leg.dimension === 'silver') silverInternal += leg.side === 'debit' ? leg.amount : -leg.amount; if (leg.dimension === 'gold') { if (leg.side === 'debit' && isScrapAccount(accountForLeg(leg, accounts))) scrapIn += leg.amount; if (leg.side === 'credit' && isScrapAccount(accountForLeg(leg, accounts))) scrapOut += leg.amount; if (addKarat(internalGoldByKarat, entry, entryLegs, accounts, leg.amount, value)) internalKaratConflicts += 1; directionRow.e21 += leg.amount; directionRow.physical += value; } directionRow.movements += 1; }); internalDirections[direction] = directionRow; }
  });
  const historicalSpread = sales.blended !== null && purchases.blended !== null ? sales.blended - purchases.blended : null;
  const fixedMargin = marginSettings.minimumEgpPerE21; const percentMargin = sales.blended !== null ? marginSettings.minimumPercent / 100 * sales.blended : null; const historicalMargin = historicalSpread !== null ? Math.max(historicalSpread, 0) : null;
  const candidates = [{ key: 'fixed' as const, value: fixedMargin }, ...(percentMargin === null ? [] : [{ key: 'percentage' as const, value: percentMargin }]), ...(historicalMargin === null ? [] : [{ key: 'historical' as const, value: historicalMargin }])];
  const binding = candidates.length ? candidates.reduce((best, item) => item.value > best.value ? item : best).key : null; const requiredMargin = sales.blended === null ? null : candidates.reduce((max, item) => Math.max(max, item.value), 0); const suggestedPurchase = sales.blended === null || requiredMargin === null ? null : Math.max(0, sales.blended - requiredMargin);
  return { cash: { opening, cashIn, availableBeforeOut: opening + cashIn, cashOut, closing: opening + cashIn - cashOut, categories: [...categoryMap.values()] }, gold: { sales, purchases, movementIn, movementOut, physicalIn, physicalOut, excluded }, decision: { blendedSell: sales.blended, blendedPurchase: purchases.blended, historicalSpread, fixedMargin, percentMargin, historicalMargin, requiredMargin, suggestedPurchase, binding }, merchants: { goldReceived, goldDelivered, goldTransfers, goldNet: goldReceived - goldDelivered, goldReceivedPhysical, goldDeliveredPhysical, silverReceived, silverDelivered, workmanshipCash, goldByKarat, karatConflicts: merchantKaratConflicts }, silver: { salesWeight: silverSalesWeight, salesEgp: silverSalesEgp, purchasesWeight: silverPurchasesWeight, purchasesEgp: silverPurchasesEgp, internalMovement: silverInternal, netMovement: silverInternal, merchantReceived: silverReceived, merchantDelivered: silverDelivered }, internal: { transfers: internalTransfers, scrapIn, scrapOut, netScrap: scrapIn - scrapOut, directions: internalDirections, goldByKarat: internalGoldByKarat, karatConflicts: internalKaratConflicts }, marketPrice };
};
