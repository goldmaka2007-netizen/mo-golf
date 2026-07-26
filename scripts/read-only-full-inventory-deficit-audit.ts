/**
 * Read-only forensic quantity simulation for the approved 2,169-row fixture.
 *
 * This deliberately does not call the WAC removal code and never represents a
 * valid Cost Run. It mirrors Phase 5 ordering and quantity precision, records
 * every attempted issue that exceeds the mathematical running balance, and
 * continues only so later deficits can be discovered.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Account, Entry } from '../src/types';
import { SEED_ACCOUNTS } from '../src/migrationData';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
  buildInventoryRuntimeCatalog,
} from '../src/lib/inventoryCostCatalog';
import { compareEntriesForPhase5Cost, getPhase5OperationId } from '../src/lib/inventoryCostEngine';

type CsvRow = Record<string, string>;
type Classification =
  | 'opening' | 'customer_purchase' | 'merchant_receipt' | 'merchant_delivery'
  | 'sale' | 'tafyeet' | 'transfer' | 'shortage' | 'surplus'
  | 'two_sided_adjustment' | 'quantity_only' | 'non_cost';

const parseCsv = (text: string): CsvRow[] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else if (character !== '\r') field += character;
  }
  if (field || record.length) records.push([...record, field]);
  const headers = (records.shift() ?? []).map(value => value.replace(/^\uFEFF/, ''));
  return records
    .filter(row => row.some(Boolean))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const fixtureRows = parseCsv(fs.readFileSync(path.resolve('approved_normalized_preview.csv'), 'utf8'));
if (fixtureRows.length !== 2169) throw new Error(`Expected 2169 rows, received ${fixtureRows.length}`);

const inventorySeedAccounts = SEED_ACCOUNTS.filter(account => account.is_inventory);
const inventoryIdByName = new Map(
  inventorySeedAccounts.map((account, index) => [
    account.name,
    CURRENT_DATASET_INVENTORY_BINDINGS[index].inventoryAccountId,
  ]),
);
const accounts: Account[] = SEED_ACCOUNTS.map((account, index) => ({
  ...account,
  id: inventoryIdByName.get(account.name) ?? `phase5-non-inventory-${index + 1}`,
  userId: 'phase5-read-only',
})) as Account[];
const accountIdByName = new Map(accounts.map(account => [account.name, account.id as string]));
const entries: Entry[] = fixtureRows.map(row => {
  const entry = JSON.parse(row.proposed_import_document) as Entry;
  return {
    ...entry,
    id: row.document_id,
    debitAccountId: accountIdByName.get(entry.debit),
    creditAccountId: accountIdByName.get(entry.credit),
  };
});

const catalog = buildInventoryRuntimeCatalog(accounts);
if (catalog.errors.length) throw new Error(catalog.errors.join('\n'));
const accountById = catalog.byAccountId;

const classify = (entry: Entry): Classification => {
  const debitInventory = entry.debitAccountId ? accountById.get(entry.debitAccountId) : undefined;
  const creditInventory = entry.creditAccountId ? accountById.get(entry.creditAccountId) : undefined;
  if (entry.tx === 'تاجر ذهب' || entry.tx === 'تاجر فضة') return 'merchant_receipt';
  if (entry.tx === 'حساب تاجر ذهب' || entry.tx === 'حساب تاجر فضة') {
    return creditInventory ? 'merchant_delivery' : 'non_cost';
  }
  if (entry.operationKind === 'opening' || entry.tx === 'قيد افتتاحي' || entry.subTx?.startsWith('رصيد افتتاحي')) return 'opening';
  if (entry.operationKind === 'sale' || ['بيع ذهب', 'بيع فضة', 'بيع ملحقات'].includes(entry.tx)) return 'sale';
  if (entry.operationKind === 'purchase' || ['شراء ذهب', 'شراء فضة', 'شراء ملحقات'].includes(entry.tx)) return 'customer_purchase';
  if (entry.operationKind === 'tifeet' || entry.tx === 'تيفيت') return 'tafyeet';
  if (entry.operationKind === 'transfer' || entry.tx === 'تحويل') return 'transfer';
  if (entry.operationKind === 'adjustment' || ['تسوية', 'تسوية عجز', 'تسوية زيادة'].includes(entry.tx)) {
    if (debitInventory && creditInventory) return 'two_sided_adjustment';
    if (creditInventory) return 'shortage';
    if (debitInventory) return 'surplus';
  }
  return 'non_cost';
};

const createdAtComparable = (entry: Entry): string => {
  const value: any = entry.createdAt;
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (typeof value.seconds === 'number') return `${value.seconds}.${value.nanoseconds ?? 0}`;
  if (typeof value.toMillis === 'function') return String(value.toMillis());
  return '';
};
const hasReliableLegacyOrder = (entry: Entry): boolean => (
  typeof entry.seq === 'number' && Number.isSafeInteger(entry.seq) && entry.seq >= 0
) || (() => {
  const value: any = entry.createdAt;
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return Number.isFinite(Date.parse(value));
  if (value && typeof value.seconds === 'number') return Number.isFinite(value.seconds);
  if (value && typeof value.toMillis === 'function') {
    try { return Number.isFinite(value.toMillis()); } catch { return false; }
  }
  return false;
})();
const isLegacy = (entry: Entry) =>
  entry.imported === true || !!entry.importVersion || !!entry.legacyOperationId || !!entry.legacyOperationNo;
const eligible = (entry: Entry) => isLegacy(entry) && !hasReliableLegacyOrder(entry);
type Phase = 'opening' | 'incoming' | 'outgoing' | 'none';
const phaseFor = (entry: Entry, accountId: string): Phase => {
  const classification = classify(entry);
  const debit = entry.debitAccountId === accountId;
  const credit = entry.creditAccountId === accountId;
  if (classification === 'opening' && debit) return 'opening';
  if (classification === 'transfer') {
    if (debit) return 'incoming';
    if (credit) return 'outgoing';
    return 'none';
  }
  if (['customer_purchase', 'merchant_receipt', 'surplus'].includes(classification) && debit) return 'incoming';
  if (debit || credit) return ['non_cost', 'quantity_only'].includes(classification) ? 'none' : 'outgoing';
  return 'none';
};
const touchedIds = (entry: Entry) => [entry.debitAccountId, entry.creditAccountId]
  .filter((id, index, all): id is string => !!id && accountById.has(id) && all.indexOf(id) === index);
const reorderSegment = (segment: Entry[]) => {
  if (segment.length < 2) return segment;
  const edges = segment.map(() => new Set<number>());
  const indegree = segment.map(() => 0);
  const add = (from: number, to: number) => {
    if (from === to || edges[from].has(to)) return;
    edges[from].add(to);
    indegree[to] += 1;
  };
  for (const accountId of new Set(segment.flatMap(touchedIds))) {
    const phases = segment.map(entry => phaseFor(entry, accountId));
    const openings = phases.flatMap((phase, index) => phase === 'opening' ? [index] : []);
    const incoming = phases.flatMap((phase, index) => phase === 'incoming' ? [index] : []);
    const outgoing = phases.flatMap((phase, index) => phase === 'outgoing' ? [index] : []);
    for (const opening of openings) for (const later of [...incoming, ...outgoing]) add(opening, later);
    for (const receipt of incoming) for (const issue of outgoing) add(receipt, issue);
  }
  const ready = segment.map((_, index) => index).filter(index => indegree[index] === 0);
  const result: Entry[] = [];
  while (ready.length) {
    ready.sort((left, right) => left - right);
    const index = ready.shift()!;
    result.push(segment[index]);
    for (const target of edges[index]) {
      indegree[target] -= 1;
      if (indegree[target] === 0) ready.push(target);
    }
  }
  if (result.length !== segment.length) throw new Error('Legacy ordering cycle');
  return result;
};
const base = [...entries].sort(compareEntriesForPhase5Cost);
const byDate = new Map<string, Entry[]>();
for (const entry of base) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry]);
const ordered: Entry[] = [];
for (const day of byDate.values()) {
  let segment: Entry[] = [];
  const flush = () => {
    ordered.push(...reorderSegment(segment));
    segment = [];
  };
  for (const entry of day) {
    if (touchedIds(entry).length && !eligible(entry)) {
      flush();
      ordered.push(entry);
    } else segment.push(entry);
  }
  flush();
}

const roundUnits = (value: unknown, scale: number) => Math.round(Number(value || 0) * scale);
const quantity = (entry: Entry, accountId: string) => {
  const account = accountById.get(accountId)!;
  if (account.kind === 'accessory') {
    const count = roundUnits(entry.count, 1000);
    return count || (isLegacy(entry) ? roundUnits(entry.weight, 1000) : 0);
  }
  if (account.kind === 'silver') return roundUnits(entry.weight, 100);
  return isLegacy(entry) && entry.arabicWeight
    ? roundUnits(entry.arabicWeight, 100)
    : roundUnits(Number(entry.weight || 0) * Number(entry.multiplier || 0), 100);
};
const divisor = (accountId: string) => accountById.get(accountId)!.kind === 'accessory' ? 1000 : 100;
const display = (units: number, accountId: string) => units / divisor(accountId);
const fields = (entry: Entry) => ({
  date: entry.date,
  seq: entry.seq ?? null,
  operationNo: (entry as any).operationNo ?? null,
  journalNo: (entry as any).journalNo ?? null,
  sourceRow: entry.sourceRow ?? null,
  legacyOperationNo: entry.legacyOperationNo ?? null,
  createdAt: createdAtComparable(entry) || null,
  stableId: getPhase5OperationId(entry),
});

const dayTotals = new Map<string, { incoming: number; outgoing: number }>();
for (const entry of ordered) {
  const classification = classify(entry);
  if (classification === 'non_cost') continue;
  for (const accountId of touchedIds(entry)) {
    const amount = quantity(entry, accountId);
    if (!amount) continue;
    const key = `${entry.date}\u0000${accountId}`;
    const totals = dayTotals.get(key) ?? { incoming: 0, outgoing: 0 };
    if (entry.debitAccountId === accountId) totals.incoming += amount;
    if (entry.creditAccountId === accountId) totals.outgoing += amount;
    dayTotals.set(key, totals);
  }
}

const balances = new Map<string, number>();
const dayStart = new Map<string, number>();
const deficits: any[] = [];
const movements: any[] = [];
for (const entry of ordered) {
  const classification = classify(entry);
  if (classification === 'non_cost') continue;
  for (const accountId of touchedIds(entry)) {
    const amount = quantity(entry, accountId);
    if (!amount) continue;
    const key = `${entry.date}\u0000${accountId}`;
    if (!dayStart.has(key)) dayStart.set(key, balances.get(accountId) ?? 0);
    const before = balances.get(accountId) ?? 0;
    const incoming = entry.debitAccountId === accountId ? amount : 0;
    const outgoing = entry.creditAccountId === accountId ? amount : 0;
    const after = before + incoming - outgoing;
    balances.set(accountId, after);
    const movement = {
      ...fields(entry),
      operationType: entry.tx,
      classification,
      inventoryAccountId: accountId,
      accountName: accountById.get(accountId)!.displayName,
      assetType: accountById.get(accountId)!.kind,
      debit: entry.debit,
      credit: entry.credit,
      weight: Number(entry.weight || 0),
      e21Weight: Number(entry.arabicWeight || 0),
      count: Number(entry.count || 0),
      karat: entry.karat ?? null,
      multiplier: entry.multiplier ?? null,
      incoming: display(incoming, accountId),
      outgoing: display(outgoing, accountId),
      balanceBefore: display(before, accountId),
      balanceAfter: display(after, accountId),
    };
    movements.push(movement);
    if (outgoing > 0 && before < outgoing) {
      deficits.push({
        ...movement,
        usableAvailable: display(Math.max(0, before), accountId),
        required: display(outgoing, accountId),
        deficit: display(outgoing - Math.max(0, before), accountId),
        mathematicalShortfallAfter: display(Math.max(0, -after), accountId),
      });
    }
  }
}

const endByDay = new Map<string, number>();
for (const movement of movements) {
  endByDay.set(`${movement.date}\u0000${movement.inventoryAccountId}`,
    Math.round(movement.balanceAfter * divisor(movement.inventoryAccountId)));
}
for (const deficit of deficits) {
  const key = `${deficit.date}\u0000${deficit.inventoryAccountId}`;
  const totals = dayTotals.get(key)!;
  const accountId = deficit.inventoryAccountId;
  deficit.startOfDayBalance = display(dayStart.get(key)!, accountId);
  deficit.totalIncomingForDay = display(totals.incoming, accountId);
  deficit.totalOutgoingForDay = display(totals.outgoing, accountId);
  deficit.endOfDayBalance = display(endByDay.get(key)!, accountId);
  deficit.deficitTiming = endByDay.get(key)! >= 0
    ? 'temporary_intraday_deficit'
    : 'final_end_of_day_deficit';
  deficit.classificationCode = endByDay.get(key)! >= 0
    ? 'A_same_day_ordering_ambiguity'
    : dayStart.get(key)! <= 0 && totals.incoming === 0
      ? 'E_missing_opening_balance_suspicion'
      : 'F_missing_historical_transaction_suspicion';
}

const accountDays = [...new Set(deficits.map(item => `${item.date}\u0000${item.inventoryAccountId}`))];
const summary = {
  mode: 'FORENSIC_SIMULATION_NOT_A_VALID_COST_RUN',
  sourceDocumentCount: entries.length,
  orderedDocumentCount: ordered.length,
  movementCount: movements.length,
  deficitOperationCount: deficits.length,
  temporaryIntradayDeficitCount: deficits.filter(item => item.deficitTiming === 'temporary_intraday_deficit').length,
  trueEndOfDayDeficitOperationCount: deficits.filter(item => item.deficitTiming === 'final_end_of_day_deficit').length,
  affectedAccounts: new Set(deficits.map(item => item.inventoryAccountId)).size,
  affectedDays: new Set(deficits.map(item => item.date)).size,
  affectedAccountDays: accountDays.length,
  finalBalances: Object.fromEntries([...balances].map(([accountId, units]) => [accountId, display(units, accountId)])),
};
const knownId = 'csvref-entry-8bac4f51c5f366affbcb8884610f549e';
const known = deficits.find(item => item.stableId === knownId);
const knownAccountId = 'seed-account-d1216eb4076ccdf40e20';
const knownTimeline = movements.filter(item =>
  item.inventoryAccountId === knownAccountId && item.date === '2026-03-04');
const knownHistory = movements.filter(item =>
  item.inventoryAccountId === knownAccountId && item.date <= '2026-03-04');

const output = {
  summary,
  deficits,
  known,
  knownTimeline,
  knownHistory,
  orderedOperationIds: ordered.map(getPhase5OperationId),
};
const outputPath = path.resolve(process.env.TEMP ?? '.', 'phase5-read-only-full-deficit-audit.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify({ outputPath, summary, known }, null, 2));
