import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPhase5GoldenDataset } from '../src/test-fixtures/phase5GoldenDataset';
import type { OperationCostResultV2 } from '../src/lib/inventoryCostTypes';

const ACCOUNT_ID = 'seed-account-8bc82f32572189c8e128';
const ACCOUNT_NAME = 'Bullion Bar';
const GRAM_SCALE = 100;

const money = (minor: number): string => (minor / 100).toFixed(2);
const grams = (units: number): string => (units / GRAM_SCALE).toFixed(2);
const avg = (bookCostMinor: number, weightUnits: number): string =>
  weightUnits > 0 ? (bookCostMinor / weightUnits).toFixed(6) : '';

const classificationLabel = (result: OperationCostResultV2): string => {
  const labels: Record<string, string> = {
    opening: '\u0642\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a',
    customer_purchase: '\u0634\u0631\u0627\u0621 \u0630\u0647\u0628',
    merchant_receipt: '\u062a\u0627\u062c\u0631 \u0630\u0647\u0628',
    merchant_delivery: '\u062d\u0633\u0627\u0628 \u062a\u0627\u062c\u0631 \u0630\u0647\u0628',
    sale: '\u0628\u064a\u0639 \u0630\u0647\u0628',
    tafyeet: '\u062a\u064a\u0641\u064a\u062a',
    transfer: '\u062a\u062d\u0648\u064a\u0644',
    shortage: '\u062a\u0633\u0648\u064a\u0629 \u0639\u062c\u0632',
    surplus: '\u062a\u0633\u0648\u064a\u0629 \u0632\u064a\u0627\u062f\u0629',
    quantity_only: '\u062d\u0631\u0643\u0629 \u0643\u0645\u064a\u0629 \u0641\u0642\u0637',
    non_cost: '\u0628\u062f\u0648\u0646 \u062a\u0643\u0644\u0641\u0629',
  };
  return labels[result.classification] ?? result.classification;
};
const movementType = (result: OperationCostResultV2): string => {
  const direction =
    result.destinationInventoryAccountId === ACCOUNT_ID
      ? 'in'
      : result.sourceInventoryAccountId === ACCOUNT_ID
        ? 'out'
        : 'none';
  return `${result.classification}:${direction}`;
};

const { timeline } = runPhase5GoldenDataset();
if (!timeline) throw new Error('No cost timeline was produced.');

let remainingWeightUnits = 0;
let remainingCostMinor = 0;
let openingCostMinor = 0;
let totalInboundCostMinor = 0;
let totalOutboundCogsMinor = 0;
let adjustmentsMinor = 0;

const rows: string[][] = [[
  'operationId',
  'date',
  'operationType',
  'classification',
  'weightInE21g',
  'weightOutE21g',
  'physicalWeightIn24g',
  'physicalWeightOut24g',
  'movementCostEgp',
  'averageBeforeEgpPerE21g',
  'averageAfterEgpPerE21g',
  'remainingWeightE21g',
  'remainingPhysicalWeight24g',
  'remainingBookCostEgp',
  'debitAccountId',
  'creditAccountId',
  'cashAmountEgp',
  'sourceOrder',
]];

for (const result of timeline.results) {
  const touchesAccount =
    result.sourceInventoryAccountId === ACCOUNT_ID
    || result.destinationInventoryAccountId === ACCOUNT_ID
    || result.inventoryAccountId === ACCOUNT_ID;
  if (!touchesAccount) continue;

  const averageBefore = avg(remainingCostMinor, remainingWeightUnits);
  let incomingUnits = 0;
  let outgoingUnits = 0;
  let incomingPhysicalUnits = 0;
  let outgoingPhysicalUnits = 0;
  let movementCostMinor = 0;

  if (result.destinationInventoryAccountId === ACCOUNT_ID) {
    incomingUnits = result.incomingStandardizedQuantityUnits;
    incomingPhysicalUnits = result.incomingActualPhysicalWeightUnits;
    movementCostMinor += result.incomingTotalCostMinor;
    remainingWeightUnits += result.incomingStandardizedQuantityUnits;
    remainingCostMinor += result.incomingTotalCostMinor;
    if (result.classification === 'opening') {
      openingCostMinor += result.incomingTotalCostMinor;
    } else if (result.classification === 'surplus') {
      adjustmentsMinor += result.adjustmentGainMinor;
    } else {
      totalInboundCostMinor += result.incomingTotalCostMinor;
    }
  }

  if (result.sourceInventoryAccountId === ACCOUNT_ID) {
    outgoingUnits = result.outgoingStandardizedQuantityUnits;
    outgoingPhysicalUnits = result.outgoingActualPhysicalWeightUnits;
    movementCostMinor += result.outgoingTotalCostMinor;
    remainingWeightUnits -= result.outgoingStandardizedQuantityUnits;
    remainingCostMinor -= result.outgoingTotalCostMinor;
    if (result.classification === 'shortage') {
      adjustmentsMinor -= result.adjustmentLossMinor;
    } else {
      totalOutboundCogsMinor += result.outgoingTotalCostMinor;
    }
  }

  rows.push([
    result.operationId,
    result.entry.date,
    classificationLabel(result),
    movementType(result),
    grams(incomingUnits),
    grams(outgoingUnits),
    grams(incomingPhysicalUnits),
    grams(outgoingPhysicalUnits),
    money(movementCostMinor),
    averageBefore,
    avg(remainingCostMinor, remainingWeightUnits),
    grams(remainingWeightUnits),
    grams(Math.round(remainingWeightUnits * 21 / 24)),
    money(remainingCostMinor),
    String(result.entry.debitAccountId ?? ''),
    String(result.entry.creditAccountId ?? ''),
    String(result.entry.cash ?? ''),
    String(result.entry.sourceRow ?? ''),
  ]);
}

const expectedBookCostMinor =
  openingCostMinor + totalInboundCostMinor - totalOutboundCogsMinor + adjustmentsMinor;
const finalState = timeline.finalStates[ACCOUNT_ID];
const currentWeightUnits = finalState?.standardizedQuantityUnits ?? remainingWeightUnits;
const finalBookCostMinor = finalState?.remainingTotalCostMinor ?? remainingCostMinor;
const averageCostPerGram = finalBookCostMinor / currentWeightUnits;

const outDir = join(process.cwd(), 'reports');
mkdirSync(outDir, { recursive: true });
const csvPath = join(outDir, 'bullion-cost-audit-trail.csv');
writeFileSync(
  csvPath,
  rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n'),
  'utf8',
);

const mdPath = join(outDir, 'bullion-cost-audit-summary.md');
const trailMdPath = join(outDir, 'bullion-cost-audit-trail.md');
const summary = [
  `# Bullion Cost Audit Trail`,
  ``,
  `Account: ${ACCOUNT_ID} | ${ACCOUNT_NAME}`,
  `Unit basis: gold equivalent 21 grams`,
  `Rows: ${rows.length - 1}`,
  ``,
  `bookCost = openingCost + totalInboundCost - totalOutboundCOGS +/- adjustments`,
  `bookCost = ${money(openingCostMinor)} + ${money(totalInboundCostMinor)} - ${money(totalOutboundCogsMinor)} + ${money(adjustmentsMinor)} = ${money(expectedBookCostMinor)} EGP`,
  ``,
  `currentWeight = ${grams(currentWeightUnits)} g E21`,
  `currentPhysicalWeight = ${grams(Math.round(currentWeightUnits * 21 / 24))} g 24k`,
  `averageCostPerGram = bookCost / currentWeight`,
  `averageCostPerGram = ${money(finalBookCostMinor)} / ${grams(currentWeightUnits)} = ${averageCostPerGram.toFixed(6)} EGP/g E21`,
  ``,
  `Engine final bookCost = ${money(finalBookCostMinor)} EGP`,
  `Engine final average = ${((finalState?.totalWacMinorPerDisplayUnit ?? 0) / 100).toFixed(6)} EGP/g E21`,
  `Reconciliation check: ${expectedBookCostMinor === finalBookCostMinor ? 'PASS' : 'FAIL'}`,
  ``,
  `Full movement-level audit trail is in ${csvPath}`,
  `Full Markdown table is in ${trailMdPath}`,
].join('\n');
writeFileSync(mdPath, summary, 'utf8');

const selectedColumns = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const tableRows = rows.map(row => selectedColumns.map(index => row[index]));
const markdownTable = [
  summary,
  '',
  '| ' + tableRows[0].join(' | ') + ' |',
  '| ' + tableRows[0].map(() => '---').join(' | ') + ' |',
  ...tableRows.slice(1).map(row => '| ' + row.join(' | ') + ' |'),
].join('\n');
writeFileSync(trailMdPath, markdownTable, 'utf8');

console.log(summary);