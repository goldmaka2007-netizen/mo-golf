import fs from 'node:fs';

const replaceAllExpected = (path, from, to, expected) => {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} matches for ${from}, found ${count}`);
  fs.writeFileSync(path, source.split(from).join(to));
};

replaceAllExpected('src/App.tsx', 'if (!result.ok) {', 'if (result.ok === false) {', 1);
replaceAllExpected('src/components/views/EntryForm.tsx', 'if (!result.ok) {', 'if (result.ok === false) {', 1);
replaceAllExpected('src/components/views/InventoryCheckView.tsx', 'if (!result.ok) {', 'if (result.ok === false) {', 1);
replaceAllExpected(
  'src/lib/centralAccountingWriteService.ts',
  '(before as Record<string, unknown>)[key]',
  '(before as unknown as Record<string, unknown>)[key]',
  1,
);
replaceAllExpected(
  'src/lib/centralAccountingWriteService.ts',
  '(after as Record<string, unknown>)[key]',
  '(after as unknown as Record<string, unknown>)[key]',
  1,
);
console.log('Phase 5B TypeScript-only corrections applied.');
