import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const violations: string[] = [];
const read = (file: string) => readFileSync(resolve(file), 'utf8');
const balanceBearingFiles = [
  'src/components/views/HomeView.tsx',
  'src/components/views/reports/TrialBalanceView.tsx',
  'src/components/views/reports/BalanceSheetView.tsx',
  'src/components/views/reports/IncomeStatementView.tsx',
  'src/components/views/reports/EquityStatementView.tsx',
  'src/components/views/reports/FinalReportView.tsx',
  'src/lib/monthlyReportService.ts',
  'src/lib/trialBalanceReport.ts',
  'src/lib/financialPositionReport.ts',
  'src/lib/incomeStatementReport.ts',
  'src/lib/equityStatementReport.ts',
];
for (const file of balanceBearingFiles) {
  const source = read(file);
  if (!file.endsWith('monthlyReportService.ts') && /entries\s*\.\s*reduce\s*\(/.test(source)) violations.push(`${file}: entries.reduce is forbidden for balances`);
  if (/\.(?:cashBalance|goldActualBalance|goldE21Balance|silverBalance|quantityBalance)\s*[+\-*/]?=/.test(source)) violations.push(`${file}: manual balance mutation is forbidden`);
}

const pureReports = [
  'src/lib/trialBalanceReport.ts',
  'src/lib/financialPositionReport.ts',
  'src/lib/incomeStatementReport.ts',
  'src/lib/equityStatementReport.ts',
];
for (const file of pureReports) {
  const source = read(file);
  if (/import\s+type\s+\{[^}]*\bEntry\b/.test(source)) violations.push(`${file}: pure report must consume AccountBalancesResult, not Entry[]`);
  if (!/AccountBalancesResult|ComputeAccountBalancesResult|PeriodAccountBalancesResult/.test(source)) violations.push(`${file}: missing central balance result contract`);
}

const finalReport = read('src/components/views/reports/FinalReportView.tsx');
if (!/computeAccountBalances\s*\(/.test(finalReport)) violations.push('Final Report must call computeAccountBalances');
if (/getMetricValue|getAccountTypeDetails|belongsToMetric|calculateFinancials|calculatePosition/.test(finalReport)) violations.push('Final Report contains a legacy manual projection');

const incomeView = read('src/components/views/reports/IncomeStatementView.tsx');
if (!/computeAccountBalances\s*\(/.test(incomeView)) violations.push('Income Statement must call computeAccountBalances');
const equityView = read('src/components/views/reports/EquityStatementView.tsx');
if (!/computeAccountBalances\s*\(/.test(equityView)) violations.push('Equity Statement must call computeAccountBalances');
const homeView = read('src/components/views/HomeView.tsx');
if (!/computeAccountBalances\s*\(/.test(homeView) || /calculateGoldOwnershipPosition\s*\(|buildOperationalProjection\s*\(/.test(homeView)) violations.push('Home balances must use computeAccountBalances');
const monthlyReport = read('src/lib/monthlyReportService.ts');
if (/processInventory\s*\(/.test(monthlyReport)) violations.push('Monthly Report must not use legacy processInventory');

const operationalProjection = read('src/lib/operationalProjection.ts');
if (/processInventory\s*\(/.test(operationalProjection) || !/computeAccountBalances\s*\(/.test(operationalProjection)) violations.push('Operational/Dashboard balances must use computeAccountBalances');

const reportDirectory = resolve('src/components/views/reports');
const reportFiles = readdirSync(reportDirectory, { recursive: true })
  .filter(name => typeof name === 'string' && /\.tsx?$/.test(name))
  .map(name => resolve(reportDirectory, String(name)));
for (const file of reportFiles) {
  const source = readFileSync(file, 'utf8');
  if (/\.toFixed\s*\(|Math\.round\s*\(|\bround\s*\(/.test(source)) violations.push(`${file}: use centralized formatting utilities`);
}

const inventorySource = read('src/lib/inventoryCycleReport.ts');
if (/processInventory\s*\(/.test(inventorySource) || !/computeAccountBalances\s*\(/.test(inventorySource)) violations.push('Inventory Report must use computeAccountBalances');
if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('Balance engine contract guard passed.');