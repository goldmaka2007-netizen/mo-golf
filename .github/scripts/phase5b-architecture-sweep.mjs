import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const allowedWriter = path.normalize('src/lib/centralAccountingWriteService.ts');
const sourceFiles = [];

const walk = dir => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === '__tests__' || name === 'test-fixtures') continue;
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
    sourceFiles.push(full);
  }
};
walk(root);

const directEntryWriterPatterns = [
  /addDoc\s*\(\s*collection\([^\n)]*['"]entries['"]/s,
  /setDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s,
  /updateDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s,
  /deleteDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s,
  /doc\s*\(\s*collection\([^\n)]*['"]entries['"][\s\S]{0,2000}?(?:batch|transaction)\.(?:set|update|delete)\s*\(/s,
];

const writerBypasses = [];
const hardDeletes = [];
const yearCloseEvidence = [];
const operationIdEvidence = [];
const yearPattern = /(year.?close|close.?year|closed.?year|fiscal.?close|closed.?period|period.?lock|lock.?period|إغلاق.{0,20}سنة|اغلاق.{0,20}سنة|سنة.{0,20}مقفول)/i;
const opIdPattern = /(operationId|idempotenc)/i;

for (const full of sourceFiles) {
  const rel = path.normalize(path.relative(process.cwd(), full));
  const text = fs.readFileSync(full, 'utf8');
  if (rel !== allowedWriter && directEntryWriterPatterns.some(pattern => pattern.test(text))) {
    writerBypasses.push(rel);
  }
  if (/deleteDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s.test(text)) hardDeletes.push(rel);

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (yearPattern.test(line)) yearCloseEvidence.push(`${rel}:${index + 1}:${line.trim()}`);
    if (opIdPattern.test(line)) operationIdEvidence.push(`${rel}:${index + 1}:${line.trim()}`);
  });
}

console.log('PHASE5B_WRITER_BYPASSES=' + JSON.stringify([...new Set(writerBypasses)]));
console.log('PHASE5B_ENTRY_HARD_DELETES=' + JSON.stringify([...new Set(hardDeletes)]));
console.log('PHASE5B_YEAR_CLOSE_EVIDENCE=' + JSON.stringify(yearCloseEvidence.slice(0, 100)));
console.log('PHASE5B_OPERATION_ID_EVIDENCE=' + JSON.stringify(operationIdEvidence.slice(0, 100)));

if (writerBypasses.length > 0 || hardDeletes.length > 0) {
  console.error('Phase 5B architecture sweep failed: direct accounting Entry writer bypass or hard delete remains.');
  process.exit(2);
}
