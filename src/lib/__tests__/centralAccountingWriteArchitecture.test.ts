import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(currentDir, '../..');
const allowedWriter = 'lib/centralAccountingWriteService.ts';

const sourceFiles = (): string[] => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = resolve(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (name === '__tests__' || name === 'test-fixtures') continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
      files.push(full);
    }
  };
  walk(srcRoot);
  return files;
};

const directEntryWriterPatterns = [
  /addDoc\s*\(\s*collection\([^\n)]*['"]entries['"]/s,
  /setDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s,
  /updateDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s,
  /deleteDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s,
  /(?:batch|transaction)\.(?:delete|update|set)\s*\(\s*doc\([^\n)]*['"]entries['"]/s,
  /doc\s*\(\s*collection\([^\n)]*['"]entries['"][\s\S]{0,2000}?(?:batch|transaction)\.(?:set|update|delete)\s*\(/s,
];

const entryDocumentRefNames = (source: string): string[] => {
  const names = new Set<string>();
  const patterns = [
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*doc\s*\(\s*db\s*,\s*['"]entries['"]/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*doc\s*\(\s*collection\([^\n)]*['"]entries['"][^)]*\)\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1]);
  }
  return [...names];
};

const escapedRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const writesThroughEntryRef = (source: string, methods: string): boolean => (
  entryDocumentRefNames(source).some(refName => {
    const ref = escapedRegex(refName);
    return new RegExp(`(?:setDoc|updateDoc|deleteDoc)\\s*\\(\\s*${ref}\\b`).test(source)
      || new RegExp(`(?:batch|transaction)\\.${methods}\\s*\\(\\s*${ref}\\b`).test(source);
  })
);

describe('Central Accounting write architecture guard', () => {
  it('has no runtime accounting Entry writer outside the Central write service', () => {
    const bypasses = sourceFiles()
      .map(full => ({
        path: relative(srcRoot, full).replaceAll('\\', '/'),
        source: readFileSync(full, 'utf8'),
      }))
      .filter(file => file.path !== allowedWriter)
      .filter(file => directEntryWriterPatterns.some(pattern => pattern.test(file.source))
        || writesThroughEntryRef(file.source, '(?:set|update|delete)'))
      .map(file => file.path)
      .sort();

    expect(bypasses).toEqual([]);
  });

  it('does not expose a hard-delete path for accounting Entries', () => {
    const hardDeletes = sourceFiles()
      .map(full => ({
        path: relative(srcRoot, full).replaceAll('\\', '/'),
        source: readFileSync(full, 'utf8'),
      }))
      .filter(file => /deleteDoc\s*\(\s*doc\([^\n)]*['"]entries['"]/s.test(file.source)
        || /(?:batch|transaction)\.delete\s*\(\s*doc\([^\n)]*['"]entries['"]/s.test(file.source)
        || writesThroughEntryRef(file.source, 'delete'))
      .map(file => file.path)
      .sort();

    expect(hardDeletes).toEqual([]);
  });
});
