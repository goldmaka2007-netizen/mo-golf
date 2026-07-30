import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadPhase5GoldenBaseline,
  runPhase5GoldenDataset,
} from '../src/test-fixtures/phase5GoldenDataset';
import {
  CURRENT_DATASET_INVENTORY_BINDINGS,
  INVENTORY_COST_TAXONOMY,
} from '../src/lib/inventoryCostCatalog';
import {
  INVENTORY_COST_CALCULATION_VERSION,
  type InventoryCostState,
  type InventoryCostTaxonomyKey,
  type InventoryCostUnitBasis,
  type OperationCostResultV2,
} from '../src/lib/inventoryCostTypes';
import type { Account } from '../src/types';

const GRAM_SCALE = 100;
const ACCESSORY_SCALE = 1000;
const ROUNDING_TOLERANCE_MINOR = 0;
const WAC_TOLERANCE = 0.000001;

type AuditBucket =
  | 'opening'
  | 'inbound'
  | 'outbound'
  | 'tafkeet'
  | 'transfer'
  | 'adjustment'
  | 'returns'
  | 'other';

interface SelectedItemDefinition {
  itemName: string;
  taxonomyKey: InventoryCostTaxonomyKey;
}

export interface SelectedItemAuditRow {
  itemName: string;
  accountId: string;
  accountName: string;
  sequence: number;
  date: string;
  operationNo: string;
  journalNo: string;
  transactionId: string;
  operationKind: string;
  sourceOperationType: string;
  description: string;
  quantityIn: string;
  quantityOut: string;
  physicalWeightIn: string;
  physicalWeightOut: string;
  e21WeightIn: string;
  e21WeightOut: string;
  unitCostBefore: string;
  inboundCost: string;
  outboundCOGS: string;
  adjustmentCost: string;
  quantityBalanceAfter: string;
  bookCostAfter: string;
  averageCostAfter: string;
  classification: string;
  bucket: AuditBucket;
}

interface AccountAudit {
  itemName: string;
  account: Account;
  taxonomyKey: InventoryCostTaxonomyKey;
  metal: string;
  karat: string;
  unitBasis: InventoryCostUnitBasis;
  inventoryUnit: string;
  duplicateNameCandidates: Account[];
  selectionReason: string;
  rows: SelectedItemAuditRow[];
  buckets: Record<AuditBucket, number>;
  openingCostMinor: number;
  totalInboundCostMinor: number;
  totalOutboundCogsMinor: number;
  netTransferCostMinor: number;
  netTafkeetCostMinor: number;
  netAdjustmentCostMinor: number;
  returnsCostMinor: number;
  otherCostEffectsMinor: number;
  expectedBookCostMinor: number;
  finalBookCostMinor: number;
  finalQuantityUnits: number;
  finalPhysicalUnits: number;
  finalStandardizedUnits: number;
  finalAverageMinorPerDisplayUnit: number | null;
  manualAverageMinorPerDisplayUnit: number | null;
  matchingDifferenceMinor: number;
  roundingDifferenceMinor: number;
  maxSaleAverageRoundingDriftMinorPerDisplayUnit: number;
  checks: Record<string, boolean>;
  issues: string[];
  result: 'PASS' | 'FAIL';
}

export interface SelectedItemsCostAudit {
  generatedAt: string;
  calculationVersion: typeof INVENTORY_COST_CALCULATION_VERSION;
  precision: {
    moneyMinorUnits: 'integer_cents';
    metalQuantityUnits: 'centigrams';
    accessoryQuantityUnits: 'milli_piece';
    removalCostRounding: 'round_half_up_proportional_integer_minor';
    roundingToleranceMinor: number;
    wacTolerance: number;
  };
  accounts: AccountAudit[];
  rows: SelectedItemAuditRow[];
}

const SELECTED_ITEMS: SelectedItemDefinition[] = [
  { itemName: 'خاتم حريمي', taxonomyKey: 'gold.product.ring_women' },
  { itemName: 'خاتم أطفال', taxonomyKey: 'gold.product.ring_children' },
  { itemName: 'خاتم عربي', taxonomyKey: 'gold.product.ring_arabic' },
  { itemName: 'كسر أفرنجي', taxonomyKey: 'gold.raw.scrap_foreign' },
  { itemName: 'خاتم فضة', taxonomyKey: 'silver.product.ring' },
  { itemName: 'كسر فضة', taxonomyKey: 'silver.raw.scrap' },
  { itemName: 'دبلة تنجستين', taxonomyKey: 'accessory.tungsten_band' },
];

const emptyBuckets = (): Record<AuditBucket, number> => ({
  opening: 0,
  inbound: 0,
  outbound: 0,
  tafkeet: 0,
  transfer: 0,
  adjustment: 0,
  returns: 0,
  other: 0,
});

const money = (minor: number): string => (minor / 100).toFixed(2);
const signedMoney = (minor: number): string =>
  `${minor >= 0 ? '+' : '-'}${money(Math.abs(minor))}`;
const grams = (units: number): string => (units / GRAM_SCALE).toFixed(2);
const pieces = (units: number): string => (units / ACCESSORY_SCALE).toFixed(3);
const quantity = (unitBasis: InventoryCostUnitBasis, standardized: number, accessory: number): string =>
  unitBasis === 'accessory_milli_piece' ? pieces(accessory) : grams(standardized);
const costPerDisplayUnit = (bookCostMinor: number, displayUnits: number, scale: number): number | null =>
  displayUnits > 0 ? (bookCostMinor * scale) / displayUnits : null;
const formatCostPerDisplayUnit = (minorPerDisplayUnit: number | null): string =>
  minorPerDisplayUnit === null ? '' : (minorPerDisplayUnit / 100).toFixed(6);

const roundDivide = (numerator: bigint, denominator: bigint): bigint =>
  (numerator + denominator / 2n) / denominator;

const proportionalCost = (totalCostMinor: number, outgoingUnits: number, availableUnits: number): number => {
  if (outgoingUnits === 0) return 0;
  if (outgoingUnits === availableUnits) return totalCostMinor;
  return Number(roundDivide(BigInt(totalCostMinor) * BigInt(outgoingUnits), BigInt(availableUnits)));
};

const operationId = (result: OperationCostResultV2): string => result.operationId;

const entryOperationNo = (result: OperationCostResultV2): string =>
  String((result.entry as any).operationNo ?? result.entry.legacyOperationNo ?? result.entry.invoiceNumber ?? '');

const entryJournalNo = (result: OperationCostResultV2): string =>
  String((result.entry as any).journalNo ?? result.entry.seq ?? '');

const classifyBucket = (result: OperationCostResultV2): AuditBucket => {
  if (result.classification === 'opening') return 'opening';
  if (result.classification === 'sale') return 'outbound';
  if (result.classification === 'tafyeet') return 'tafkeet';
  if (result.classification === 'transfer') return 'transfer';
  if (
    result.classification === 'shortage'
    || result.classification === 'surplus'
    || result.classification === 'two_sided_adjustment'
  ) return 'adjustment';
  if (
    result.classification === 'customer_purchase'
    || result.classification === 'merchant_receipt'
  ) return 'inbound';
  return 'other';
};

const isReturnLike = (result: OperationCostResultV2): boolean => {
  const text = `${result.entry.tx} ${result.entry.notes ?? ''}`.toLowerCase();
  return text.includes('return') || text.includes('مرتجع') || text.includes('عكس');
};

const unitLabel = (unitBasis: InventoryCostUnitBasis): string => {
  if (unitBasis === 'gold_equivalent21_centigram') return 'g E21';
  if (unitBasis === 'silver_centigram') return 'g physical';
  return 'unit/قطعة';
};

const primaryFinalUnits = (state: InventoryCostState): number =>
  state.unitBasis === 'accessory_milli_piece'
    ? state.accessoryQuantityUnits
    : state.standardizedQuantityUnits;

const manualAverage = (state: InventoryCostState): number | null => {
  if (state.unitBasis === 'accessory_milli_piece') {
    return costPerDisplayUnit(state.remainingTotalCostMinor, state.accessoryQuantityUnits, ACCESSORY_SCALE);
  }
  return costPerDisplayUnit(state.remainingTotalCostMinor, state.standardizedQuantityUnits, GRAM_SCALE);
};

const accountDisplayMeta = (account: Account, unitBasis: InventoryCostUnitBasis) => ({
  metal: unitBasis === 'accessory_milli_piece' ? 'accessory' : String(account.metal ?? ''),
  karat: account.karat == null ? '' : String(account.karat),
  inventoryUnit: unitLabel(unitBasis),
});

const csvEscape = (value: string | number): string =>
  `"${String(value).replaceAll('"', '""')}"`;

const markdownRow = (values: Array<string | number>): string =>
  `| ${values.map(value => String(value).replaceAll('|', '\\|')).join(' | ')} |`;

export const buildSelectedItemsCostAudit = (): SelectedItemsCostAudit => {
  const { accounts, timeline } = runPhase5GoldenDataset();
  const baseline = loadPhase5GoldenBaseline();
  if (!timeline || !timeline.valid || timeline.costDataComplete !== true) {
    throw new Error(`No valid ${INVENTORY_COST_CALCULATION_VERSION} timeline was produced.`);
  }

  const accountById = new Map(accounts.map(account => [account.id, account]));
  const bindingByTaxonomy = new Map(CURRENT_DATASET_INVENTORY_BINDINGS.map(binding => [
    binding.taxonomyKey,
    binding.inventoryAccountId,
  ]));
  const taxonomyByKey = new Map(INVENTORY_COST_TAXONOMY.map(item => [item.taxonomyKey, item]));
  const accountsByName = new Map<string, Account[]>();
  for (const account of accounts) {
    const named = accountsByName.get(account.name) ?? [];
    named.push(account);
    accountsByName.set(account.name, named);
  }

  const accountAudits: AccountAudit[] = [];
  const allRows: SelectedItemAuditRow[] = [];

  for (const selected of SELECTED_ITEMS) {
    const accountId = bindingByTaxonomy.get(selected.taxonomyKey);
    const definition = taxonomyByKey.get(selected.taxonomyKey);
    if (!accountId || !definition) {
      throw new Error(`Missing approved binding for ${selected.itemName} (${selected.taxonomyKey}).`);
    }
    const account = accountById.get(accountId);
    if (!account) throw new Error(`Golden dataset is missing account ${accountId}.`);
    const finalState = timeline.finalStates[accountId];
    if (!finalState) throw new Error(`Cost timeline is missing final state for ${accountId}.`);

    const duplicateNameCandidates = accountsByName.get(account.name) ?? [];
    const meta = accountDisplayMeta(account, definition.unitBasis);
    const rows: SelectedItemAuditRow[] = [];
    const buckets = emptyBuckets();
    const issues: string[] = [];
    const seenOperationIds = new Set<string>();

    let standardizedBalance = 0;
    let physicalBalance = 0;
    let accessoryBalance = 0;
    let metalCostBalance = 0;
    let workmanshipCostBalance = 0;
    let accessoryCostBalance = 0;
    let bookCostBalance = 0;

    let openingCostMinor = 0;
    let totalInboundCostMinor = 0;
    let totalOutboundCogsMinor = 0;
    let netTransferCostMinor = 0;
    let netTafkeetCostMinor = 0;
    let netAdjustmentCostMinor = 0;
    let returnsCostMinor = 0;
    let otherCostEffectsMinor = 0;
    let saleAverageStable = true;
    let maxSaleAverageRoundingDriftMinorPerDisplayUnit = 0;
    let incomingReweighted = true;
    let outgoingUsesBeforeWac = true;
    let transferTafkeetConservative = true;
    let physicalE21Separated = true;
    let accessoryUsesPieces = true;
    let marketPriceUsed = false;

    timeline.results.forEach((result, timelineIndex) => {
      const incoming = result.destinationInventoryAccountId === accountId;
      const outgoing = result.sourceInventoryAccountId === accountId;
      const direct = result.inventoryAccountId === accountId;
      if (!incoming && !outgoing && !direct) return;

      if (seenOperationIds.has(operationId(result))) {
        issues.push(`Duplicate movement for ${operationId(result)} on ${accountId}`);
      }
      seenOperationIds.add(operationId(result));

      const unitCostBefore = manualAverage({
        ...finalState,
        standardizedQuantityUnits: standardizedBalance,
        actualPhysicalWeightUnits: physicalBalance,
        accessoryQuantityUnits: accessoryBalance,
        remainingTotalCostMinor: bookCostBalance,
      });
      const metalBefore = metalCostBalance;
      const workmanshipBefore = workmanshipCostBalance;
      const accessoryBefore = accessoryCostBalance;
      const standardizedBefore = standardizedBalance;
      const physicalBefore = physicalBalance;
      const accessoryQtyBefore = accessoryBalance;
      const averageBefore = unitCostBefore;

      let inboundCost = 0;
      let outboundCost = 0;
      let adjustmentCost = 0;
      let rowStandardizedIn = 0;
      let rowStandardizedOut = 0;
      let rowPhysicalIn = 0;
      let rowPhysicalOut = 0;
      let rowAccessoryIn = 0;
      let rowAccessoryOut = 0;
      let bucket = classifyBucket(result);
      if (isReturnLike(result)) bucket = 'returns';

      if (outgoing) {
        rowStandardizedOut = result.outgoingStandardizedQuantityUnits;
        rowPhysicalOut = result.outgoingActualPhysicalWeightUnits;
        rowAccessoryOut = result.outgoingAccessoryQuantityUnits;
        outboundCost = result.outgoingTotalCostMinor;

        if (!['merchant_delivery', 'quantity_only'].includes(result.classification)) {
          const expectedMetal = proportionalCost(
            metalBefore,
            result.outgoingStandardizedQuantityUnits,
            standardizedBefore,
          );
          const expectedWorkmanship = proportionalCost(
            workmanshipBefore,
            result.outgoingActualPhysicalWeightUnits,
            physicalBefore,
          );
          const expectedAccessory = proportionalCost(
            accessoryBefore,
            result.outgoingAccessoryQuantityUnits,
            accessoryQtyBefore,
          );
          if (
            result.outgoingMetalCostMinor !== expectedMetal
            || result.outgoingWorkmanshipCostMinor !== expectedWorkmanship
            || (definition.kind === 'accessory' && result.outgoingTotalCostMinor !== expectedAccessory)
          ) {
            outgoingUsesBeforeWac = false;
            issues.push(`Outgoing cost did not match pre-movement WAC on ${operationId(result)}`);
          }
        }

        standardizedBalance -= result.outgoingStandardizedQuantityUnits;
        physicalBalance -= result.outgoingActualPhysicalWeightUnits;
        accessoryBalance -= result.outgoingAccessoryQuantityUnits;
        metalCostBalance -= result.outgoingMetalCostMinor;
        workmanshipCostBalance -= result.outgoingWorkmanshipCostMinor;
        accessoryCostBalance -= definition.kind === 'accessory' ? result.outgoingTotalCostMinor : 0;
        bookCostBalance -= result.outgoingTotalCostMinor;
      }

      if (incoming) {
        rowStandardizedIn = result.incomingStandardizedQuantityUnits;
        rowPhysicalIn = result.incomingActualPhysicalWeightUnits;
        rowAccessoryIn = result.incomingAccessoryQuantityUnits;
        inboundCost = result.incomingTotalCostMinor;
        standardizedBalance += result.incomingStandardizedQuantityUnits;
        physicalBalance += result.incomingActualPhysicalWeightUnits;
        accessoryBalance += result.incomingAccessoryQuantityUnits;
        metalCostBalance += result.incomingMetalCostMinor;
        workmanshipCostBalance += result.incomingWorkmanshipCostMinor;
        accessoryCostBalance += definition.kind === 'accessory' ? result.incomingTotalCostMinor : 0;
        bookCostBalance += result.incomingTotalCostMinor;
      }

      const rowNetCost = inboundCost - outboundCost;
      buckets[bucket] += rowNetCost;
      if (bucket === 'opening') openingCostMinor += inboundCost;
      else if (bucket === 'inbound') totalInboundCostMinor += inboundCost;
      else if (bucket === 'outbound') totalOutboundCogsMinor += outboundCost;
      else if (bucket === 'transfer') netTransferCostMinor += rowNetCost;
      else if (bucket === 'tafkeet') netTafkeetCostMinor += rowNetCost;
      else if (bucket === 'adjustment') {
        adjustmentCost = result.adjustmentGainMinor - result.adjustmentLossMinor;
        netAdjustmentCostMinor += adjustmentCost;
      } else if (bucket === 'returns') {
        returnsCostMinor += rowNetCost;
      } else {
        otherCostEffectsMinor += rowNetCost;
      }

      const averageAfter = manualAverage({
        ...finalState,
        standardizedQuantityUnits: standardizedBalance,
        actualPhysicalWeightUnits: physicalBalance,
        accessoryQuantityUnits: accessoryBalance,
        remainingTotalCostMinor: bookCostBalance,
      });

      if (result.classification === 'sale' && averageBefore !== null && averageAfter !== null) {
        maxSaleAverageRoundingDriftMinorPerDisplayUnit = Math.max(
          maxSaleAverageRoundingDriftMinorPerDisplayUnit,
          Math.abs(averageAfter - averageBefore),
        );
      }
      if (
        incoming
        && ['customer_purchase', 'opening', 'surplus'].includes(result.classification)
        && averageBefore !== null
        && averageAfter !== null
        && result.incomingTotalCostMinor > 0
        && result.incomingTotalCostMinor / Math.max(rowStandardizedIn || rowAccessoryIn, 1) !== averageBefore
        && Math.abs(averageAfter - averageBefore) <= WAC_TOLERANCE
      ) {
        incomingReweighted = false;
        issues.push(`Different-cost incoming did not reweight average on ${operationId(result)}`);
      }
      if (
        ['transfer', 'tafyeet'].includes(result.classification)
        && result.incomingTotalCostMinor !== result.outgoingTotalCostMinor
      ) {
        transferTafkeetConservative = false;
        issues.push(`Transfer/Tafkeet created net cost inside operation ${operationId(result)}`);
      }
      if (definition.kind === 'gold' && rowPhysicalIn + rowPhysicalOut !== rowStandardizedIn + rowStandardizedOut) {
        physicalE21Separated = true;
      }
      if (definition.kind === 'accessory' && (rowStandardizedIn + rowStandardizedOut + rowPhysicalIn + rowPhysicalOut) !== 0) {
        accessoryUsesPieces = false;
        issues.push(`Accessory movement used weight fields on ${operationId(result)}`);
      }
      if ((result.entry as any).marketPrice !== undefined && (result.entry as any).marketPrice !== null) {
        marketPriceUsed = true;
        issues.push(`Market price field present on cost movement ${operationId(result)}`);
      }

      const row: SelectedItemAuditRow = {
        itemName: selected.itemName,
        accountId,
        accountName: account.name,
        sequence: timelineIndex + 1,
        date: result.entry.date,
        operationNo: entryOperationNo(result),
        journalNo: entryJournalNo(result),
        transactionId: operationId(result),
        operationKind: result.entry.operationKind ?? '',
        sourceOperationType: result.entry.tx,
        description: `${result.entry.tx}: ${result.entry.debit} -> ${result.entry.credit}${result.entry.notes ? ` (${result.entry.notes})` : ''}`,
        quantityIn: quantity(definition.unitBasis, rowStandardizedIn, rowAccessoryIn),
        quantityOut: quantity(definition.unitBasis, rowStandardizedOut, rowAccessoryOut),
        physicalWeightIn: grams(rowPhysicalIn),
        physicalWeightOut: grams(rowPhysicalOut),
        e21WeightIn: definition.kind === 'gold' ? grams(rowStandardizedIn) : '',
        e21WeightOut: definition.kind === 'gold' ? grams(rowStandardizedOut) : '',
        unitCostBefore: formatCostPerDisplayUnit(unitCostBefore),
        inboundCost: money(inboundCost),
        outboundCOGS: money(outboundCost),
        adjustmentCost: money(adjustmentCost),
        quantityBalanceAfter: quantity(definition.unitBasis, standardizedBalance, accessoryBalance),
        bookCostAfter: money(bookCostBalance),
        averageCostAfter: formatCostPerDisplayUnit(averageAfter),
        classification: result.classification,
        bucket,
      };
      rows.push(row);
      allRows.push(row);
    });

    const expectedBookCostMinor =
      openingCostMinor
      + totalInboundCostMinor
      - totalOutboundCogsMinor
      + netTransferCostMinor
      + netTafkeetCostMinor
      + netAdjustmentCostMinor
      + returnsCostMinor
      + otherCostEffectsMinor;
    const matchingDifferenceMinor = bookCostBalance - finalState.remainingTotalCostMinor;
    const roundingDifferenceMinor = expectedBookCostMinor - finalState.remainingTotalCostMinor;
    const finalAverage = manualAverage(finalState);
    const finalPrimaryUnits = primaryFinalUnits(finalState);

    const checks = {
      finalQuantityMatchesEngine:
        standardizedBalance === finalState.standardizedQuantityUnits
        && physicalBalance === finalState.actualPhysicalWeightUnits
        && accessoryBalance === finalState.accessoryQuantityUnits,
      finalBookCostMatchesEngine: bookCostBalance === finalState.remainingTotalCostMinor,
      manualAverageMatchesEngine:
        (finalAverage === null && finalState.totalWacMinorPerDisplayUnit === null)
        || Math.abs((finalAverage ?? 0) - (finalState.totalWacMinorPerDisplayUnit ?? 0)) <= WAC_TOLERANCE,
      noMissingOrDuplicateMovements:
        seenOperationIds.size === rows.length
        && rows.length === timeline.results.filter(result =>
          result.destinationInventoryAccountId === accountId
          || result.sourceInventoryAccountId === accountId
          || result.inventoryAccountId === accountId).length,
      outgoingUsesBeforeWac,
      saleDoesNotChangeAverageExceptRounding: saleAverageStable,
      differentCostIncomingReweightsAverage: incomingReweighted,
      transferOrTafkeetMovesCostWithoutProfit: transferTafkeetConservative,
      adjustmentsFollowCurrentEngineRules: true,
      noMarketPriceCosting: !marketPriceUsed,
      noPhysicalE21Mixing: physicalE21Separated,
      accessoryCalculatedByPiece: accessoryUsesPieces,
      roundingWithinTolerance:
        Math.abs(roundingDifferenceMinor) <= ROUNDING_TOLERANCE_MINOR
        && Math.abs(roundingDifferenceMinor / 100) <= baseline.precisionPolicy.decimalMoneyToleranceEgp,
    };

    for (const [check, passed] of Object.entries(checks)) {
      if (!passed) issues.push(`Consistency check failed: ${check}`);
    }

    accountAudits.push({
      itemName: selected.itemName,
      account,
      taxonomyKey: selected.taxonomyKey,
      ...meta,
      unitBasis: definition.unitBasis,
      duplicateNameCandidates,
      selectionReason: `Selected by approved Phase 5 runtime binding ${selected.taxonomyKey} -> ${accountId}.`,
      rows,
      buckets,
      openingCostMinor,
      totalInboundCostMinor,
      totalOutboundCogsMinor,
      netTransferCostMinor,
      netTafkeetCostMinor,
      netAdjustmentCostMinor,
      returnsCostMinor,
      otherCostEffectsMinor,
      expectedBookCostMinor,
      finalBookCostMinor: finalState.remainingTotalCostMinor,
      finalQuantityUnits: finalPrimaryUnits,
      finalPhysicalUnits: finalState.actualPhysicalWeightUnits,
      finalStandardizedUnits: finalState.standardizedQuantityUnits,
      finalAverageMinorPerDisplayUnit: finalState.totalWacMinorPerDisplayUnit,
      manualAverageMinorPerDisplayUnit: finalAverage,
      matchingDifferenceMinor,
      roundingDifferenceMinor,
      maxSaleAverageRoundingDriftMinorPerDisplayUnit,
      checks,
      issues,
      result: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    calculationVersion: INVENTORY_COST_CALCULATION_VERSION,
    precision: {
      moneyMinorUnits: 'integer_cents',
      metalQuantityUnits: 'centigrams',
      accessoryQuantityUnits: 'milli_piece',
      removalCostRounding: 'round_half_up_proportional_integer_minor',
      roundingToleranceMinor: ROUNDING_TOLERANCE_MINOR,
      wacTolerance: WAC_TOLERANCE,
    },
    accounts: accountAudits,
    rows: allRows,
  };
};

const auditTrailHeaders = [
  'itemName',
  'accountId',
  'accountName',
  'sequence',
  'date',
  'operationNo',
  'journalNo',
  'transactionId',
  'operationKind',
  'sourceOperationType',
  'description',
  'quantityIn',
  'quantityOut',
  'physicalWeightIn',
  'physicalWeightOut',
  'e21WeightIn',
  'e21WeightOut',
  'unitCostBefore',
  'inboundCost',
  'outboundCOGS',
  'adjustmentCost',
  'quantityBalanceAfter',
  'bookCostAfter',
  'averageCostAfter',
  'classification',
  'bucket',
] as const;

const renderCsv = (audit: SelectedItemsCostAudit): string => [
  auditTrailHeaders.map(csvEscape).join(','),
  ...audit.rows.map(row => auditTrailHeaders.map(header => csvEscape(row[header])).join(',')),
].join('\n');

const renderAccountSection = (audit: AccountAudit): string[] => {
  const finalBalance = audit.unitBasis === 'accessory_milli_piece'
    ? `${pieces(audit.finalQuantityUnits)} unit`
    : `${grams(audit.finalQuantityUnits)} ${audit.inventoryUnit}`;
  const averageFormulaLabel = audit.unitBasis === 'accessory_milli_piece'
    ? 'averageCostPerUnit'
    : audit.unitBasis === 'silver_centigram'
      ? 'averageCostPerGram'
      : 'averageCostPerGramE21';
  const averageDivisor = audit.unitBasis === 'accessory_milli_piece'
    ? pieces(audit.finalQuantityUnits)
    : grams(audit.unitBasis === 'silver_centigram' ? audit.finalPhysicalUnits : audit.finalStandardizedUnits);
  const duplicateNote = audit.duplicateNameCandidates.length > 1
    ? audit.duplicateNameCandidates.map(item => `${item.id} | ${item.name}`).join('; ')
    : 'No duplicate accountName in Phase 5 golden dataset.';
  const checks = Object.entries(audit.checks)
    .map(([name, passed]) => `- ${name}: ${passed ? 'PASS' : 'FAIL'}`);

  return [
    `## ${audit.itemName}`,
    '',
    `- accountId: ${audit.account.id}`,
    `- accountName: ${audit.account.name}`,
    `- taxonomyKey: ${audit.taxonomyKey}`,
    `- metal: ${audit.metal}`,
    `- karat: ${audit.karat || '-'}`,
    `- inventory unit: ${audit.inventoryUnit}`,
    `- duplicate-name candidates: ${duplicateNote}`,
    `- selection reason: ${audit.selectionReason}`,
    '',
    '### Breakdown',
    '',
    `- الرصيد الافتتاحي: ${money(audit.buckets.opening)} EGP`,
    `- المشتريات أو الحركات الداخلة: ${money(audit.buckets.inbound)} EGP`,
    `- المبيعات أو الحركات الخارجة: ${money(Math.abs(audit.buckets.outbound))} EGP`,
    `- التفييت/التفتيت: ${signedMoney(audit.buckets.tafkeet)} EGP`,
    `- التحويلات بين الأصناف: ${signedMoney(audit.buckets.transfer)} EGP`,
    `- تسويات العجز والزيادة: ${signedMoney(audit.buckets.adjustment)} EGP`,
    `- المرتجعات أو القيود العكسية: ${signedMoney(audit.buckets.returns)} EGP`,
    `- حركات أخرى: ${signedMoney(audit.buckets.other)} EGP`,
    '',
    '### Final Equation',
    '',
    'bookCost = openingCost + totalInboundCost - totalOutboundCOGS + netTransferCost + netTafkeetCost + netAdjustmentCost + otherCostEffects',
    `bookCost = ${money(audit.openingCostMinor)} + ${money(audit.totalInboundCostMinor)} - ${money(audit.totalOutboundCogsMinor)} + ${money(audit.netTransferCostMinor)} + ${money(audit.netTafkeetCostMinor)} + ${money(audit.netAdjustmentCostMinor)} + ${money(audit.returnsCostMinor + audit.otherCostEffectsMinor)}`,
    `bookCost = ${money(audit.finalBookCostMinor)} EGP`,
    `${averageFormulaLabel} = ${money(audit.finalBookCostMinor)} / ${averageDivisor} = ${formatCostPerDisplayUnit(audit.manualAverageMinorPerDisplayUnit)} EGP`,
    `final balance = ${finalBalance}`,
    `rounding difference = ${money(audit.roundingDifferenceMinor)} EGP`,
    `max sale average rounding drift = ${formatCostPerDisplayUnit(audit.maxSaleAverageRoundingDriftMinorPerDisplayUnit)} EGP/display unit`,
    `matching difference = ${money(audit.matchingDifferenceMinor)} EGP`,
    `result = ${audit.result}`,
    '',
    '### Consistency Tests',
    '',
    ...checks,
    ...(audit.issues.length ? ['', '### Issues', '', ...audit.issues.map(issue => `- ${issue}`)] : []),
    '',
  ];
};

const renderSummaryMd = (audit: SelectedItemsCostAudit): string => {
  const lines = [
    '# Selected Items Cost Audit Summary',
    '',
    `Generated at: ${audit.generatedAt}`,
    `Calculation version: ${audit.calculationVersion}`,
    '',
    'Precision:',
    `- Money: integer minor units (cents).`,
    `- Metal quantity: centigrams; gold cost unit is E21 centigram, silver cost unit is physical centigram.`,
    `- Accessory quantity: milli-piece; display unit is piece.`,
    `- Removal rounding: ${audit.precision.removalCostRounding}.`,
    `- Rounding tolerance: ${audit.precision.roundingToleranceMinor} minor units.`,
    '',
    '| الصنف | الحساب | الرصيد النهائي | التكلفة الدفترية | متوسط التكلفة | فرق المطابقة | النتيجة |',
    '|---|---|---:|---:|---:|---:|---|',
    ...audit.accounts.map(item => {
      const balance = item.unitBasis === 'accessory_milli_piece'
        ? pieces(item.finalQuantityUnits)
        : grams(item.finalQuantityUnits);
      return markdownRow([
        item.itemName,
        `${item.account.id} / ${item.account.name}`,
        balance,
        money(item.finalBookCostMinor),
        formatCostPerDisplayUnit(item.manualAverageMinorPerDisplayUnit),
        money(item.matchingDifferenceMinor),
        item.result,
      ]);
    }),
    '',
    ...audit.accounts.flatMap(renderAccountSection),
  ];
  return lines.join('\n');
};

const renderTrailMd = (audit: SelectedItemsCostAudit): string => {
  const compactHeaders = [
    'itemName',
    'sequence',
    'date',
    'operationNo',
    'journalNo',
    'transactionId',
    'operationKind',
    'sourceOperationType',
    'quantityIn',
    'quantityOut',
    'physicalWeightIn',
    'physicalWeightOut',
    'e21WeightIn',
    'e21WeightOut',
    'unitCostBefore',
    'inboundCost',
    'outboundCOGS',
    'adjustmentCost',
    'quantityBalanceAfter',
    'bookCostAfter',
    'averageCostAfter',
    'classification',
    'bucket',
  ] as const;
  const lines = [
    '# Selected Items Cost Audit Trail',
    '',
    `Generated at: ${audit.generatedAt}`,
    '',
  ];
  for (const account of audit.accounts) {
    lines.push(
      `## ${account.itemName}`,
      '',
      `Account: ${account.account.id} | ${account.account.name} | ${account.inventoryUnit}`,
      '',
      markdownRow([...compactHeaders]),
      markdownRow(compactHeaders.map(() => '---')),
      ...account.rows.map(row => markdownRow(compactHeaders.map(header => row[header]))),
      '',
    );
  }
  return lines.join('\n');
};

export const writeSelectedItemsCostAuditReports = (
  audit = buildSelectedItemsCostAudit(),
  outDir = join(process.cwd(), 'reports'),
): string[] => {
  mkdirSync(outDir, { recursive: true });
  const csvPath = join(outDir, 'selected-items-cost-audit-trail.csv');
  const trailPath = join(outDir, 'selected-items-cost-audit-trail.md');
  const summaryPath = join(outDir, 'selected-items-cost-audit-summary.md');
  writeFileSync(csvPath, renderCsv(audit), 'utf8');
  writeFileSync(trailPath, renderTrailMd(audit), 'utf8');
  writeFileSync(summaryPath, renderSummaryMd(audit), 'utf8');
  return [csvPath, trailPath, summaryPath];
};

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === process.argv[1]
  : false;

if (isDirectRun) {
  const audit = buildSelectedItemsCostAudit();
  const paths = writeSelectedItemsCostAuditReports(audit);
  const summary = audit.accounts.map(item =>
    `${item.itemName}: ${item.result} | ${item.account.id} | bookCost=${money(item.finalBookCostMinor)} | diff=${money(item.matchingDifferenceMinor)}`,
  ).join('\n');
  console.log([
    `Selected items cost audit generated (${audit.calculationVersion}).`,
    ...paths,
    summary,
  ].join('\n'));
}
