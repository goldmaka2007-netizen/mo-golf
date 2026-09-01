import fs from 'node:fs';

const replaceExact = (path, from, to, label) => {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one malformed marker in ${path}, found ${count}`);
  fs.writeFileSync(path, source.replace(from, to));
};

replaceExact(
  'src/components/views/SettingsView.tsx',
  '  const [importProgress,  const [importProgress,',
  '  const [importProgress,',
  'Settings importProgress duplicate marker',
);
replaceExact(
  'src/components/views/SettingsView.tsx',
  '  const handleExportData =  const handleExportData =',
  '  const handleExportData =',
  'Settings export handler duplicate marker',
);
replaceExact(
  'src/components/views/SettingsView.tsx',
  '  return (  return (',
  '  return (',
  'Settings return duplicate marker',
);

{
  const path = 'src/lib/centralAccountingWriteService.ts';
  let source = fs.readFileSync(path, 'utf8');
  const duplicateComment = '/**\n * Saved accounting Entries are corrected in place only through Central/**\n * Saved accounting Entries are corrected in place only through Central';
  if (source.includes(duplicateComment)) {
    source = source.replace(
      duplicateComment,
      '/**\n * Saved accounting Entries are corrected in place only through Central',
    );
  }
  if (source.endsWith('};\n};')) source = source.slice(0, -3);
  else if (source.endsWith('};\n};\n')) source = source.slice(0, -4) + '\n';
  else throw new Error('Central service duplicate trailing closure not found');
  fs.writeFileSync(path, source);
}

console.log('Phase 5B finalization syntax correction applied.');
