import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
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

type FirestoreCall = 'collection' | 'doc' | 'addDoc' | 'setDoc' | 'updateDoc' | 'deleteDoc';

interface EntryWriteAnalysis {
  writes: string[];
  hardDeletes: string[];
}

const FIRESTORE_CALLS = new Set<FirestoreCall>([
  'collection', 'doc', 'addDoc', 'setDoc', 'updateDoc', 'deleteDoc',
]);

const analyzeEntryWrites = (source: string): EntryWriteAnalysis => {
  const sourceFile = ts.createSourceFile('guard-input.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callAliases = new Map<string, FirestoreCall>(
    [...FIRESTORE_CALLS].map(name => [name, name]),
  );
  const firestoreNamespaces = new Set<string>();
  const bindings: Array<{ name: string; value: ts.Expression }> = [];

  const collect = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text === 'firebase/firestore'
      && node.importClause?.namedBindings
      && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const element of node.importClause.namedBindings.elements) {
        const imported = (element.propertyName || element.name).text as FirestoreCall;
        if (FIRESTORE_CALLS.has(imported)) callAliases.set(element.name.text, imported);
      }
    }
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text === 'firebase/firestore'
      && node.importClause?.namedBindings
      && ts.isNamespaceImport(node.importClause.namedBindings)) {
      firestoreNamespaces.add(node.importClause.namedBindings.name.text);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindings.push({ name: node.name.text, value: node.initializer });
    }
    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left)) {
      bindings.push({ name: node.left.text, value: node.right });
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  const unwrap = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (ts.isParenthesizedExpression(current)
      || ts.isAsExpression(current)
      || ts.isTypeAssertionExpression(current)
      || ts.isNonNullExpression(current)
      || ts.isSatisfiesExpression(current)) {
      current = current.expression;
    }
    return current;
  };

  const callKind = (expression: ts.LeftHandSideExpression): FirestoreCall | undefined => {
    const target = unwrap(expression);
    if (ts.isIdentifier(target)) return callAliases.get(target.text);
    if (ts.isPropertyAccessExpression(target)
      && ts.isIdentifier(target.expression)
      && firestoreNamespaces.has(target.expression.text)
      && FIRESTORE_CALLS.has(target.name.text as FirestoreCall)) {
      return target.name.text as FirestoreCall;
    }
    return undefined;
  };

  let aliasesChanged = true;
  while (aliasesChanged) {
    aliasesChanged = false;
    for (const binding of bindings) {
      const value = unwrap(binding.value);
      if (!ts.isIdentifier(value) && !ts.isPropertyAccessExpression(value)) continue;
      const kind = callKind(value);
      if (kind && callAliases.get(binding.name) !== kind) {
        callAliases.set(binding.name, kind);
        aliasesChanged = true;
      }
    }
  }

  const entryCollections = new Set<string>();
  const entryDocuments = new Set<string>();
  const isEntriesLiteral = (expression: ts.Expression): boolean => {
    const value = unwrap(expression);
    return ts.isStringLiteralLike(value) && value.text === 'entries';
  };

  const isEntryCollection = (expression: ts.Expression): boolean => {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) return entryCollections.has(value.text);
    return ts.isCallExpression(value)
      && callKind(value.expression) === 'collection'
      && value.arguments.some(isEntriesLiteral);
  };

  const isEntryDocument = (expression: ts.Expression): boolean => {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) return entryDocuments.has(value.text);
    return ts.isCallExpression(value)
      && callKind(value.expression) === 'doc'
      && (value.arguments.some(isEntriesLiteral)
        || (value.arguments[0] !== undefined && isEntryCollection(value.arguments[0])));
  };

  let refsChanged = true;
  while (refsChanged) {
    refsChanged = false;
    for (const binding of bindings) {
      if (!entryCollections.has(binding.name) && isEntryCollection(binding.value)) {
        entryCollections.add(binding.name);
        refsChanged = true;
      }
      if (!entryDocuments.has(binding.name) && isEntryDocument(binding.value)) {
        entryDocuments.add(binding.name);
        refsChanged = true;
      }
    }
  }

  const analysis: EntryWriteAnalysis = { writes: [], hardDeletes: [] };
  const inspect = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const functionalKind = callKind(node.expression);
      const firstArgument = node.arguments[0];
      const functionalWrite = functionalKind === 'addDoc'
        ? firstArgument !== undefined && isEntryCollection(firstArgument)
        : (functionalKind === 'setDoc' || functionalKind === 'updateDoc' || functionalKind === 'deleteDoc')
          && firstArgument !== undefined && isEntryDocument(firstArgument);

      const target = unwrap(node.expression);
      const method = ts.isPropertyAccessExpression(target) ? target.name.text : '';
      const methodWrite = (method === 'set' || method === 'update' || method === 'delete')
        && firstArgument !== undefined
        && isEntryDocument(firstArgument);

      if (functionalWrite || methodWrite) {
        const description = node.getText(sourceFile);
        analysis.writes.push(description);
        if (functionalKind === 'deleteDoc' || method === 'delete') analysis.hardDeletes.push(description);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(sourceFile);
  return analysis;
};

describe('Central Accounting write architecture guard', () => {
  it('has no runtime accounting Entry writer outside the Central write service', () => {
    const bypasses = sourceFiles()
      .map(full => ({
        path: relative(srcRoot, full).replaceAll('\\', '/'),
        analysis: analyzeEntryWrites(readFileSync(full, 'utf8')),
      }))
      .filter(file => file.path !== allowedWriter && file.analysis.writes.length > 0)
      .map(file => file.path)
      .sort();
    expect(bypasses).toEqual([]);
  });

  it('does not expose a hard-delete path for accounting Entries', () => {
    const hardDeletes = sourceFiles()
      .map(full => ({
        path: relative(srcRoot, full).replaceAll('\\', '/'),
        analysis: analyzeEntryWrites(readFileSync(full, 'utf8')),
      }))
      .filter(file => file.analysis.hardDeletes.length > 0)
      .map(file => file.path)
      .sort();
    expect(hardDeletes).toEqual([]);
  });

  it('detects collection/document aliases and arbitrary transaction or batch names', () => {
    const analysis = analyzeEntryWrites(`
      import { collection as coll, doc as document } from 'firebase/firestore';
      const entriesCol = coll(db, 'entries');
      const aliasedCollection = entriesCol;
      const entryRef = document(aliasedCollection, operationId);
      const aliasedDocument = entryRef;
      tx.set(aliasedDocument, payload);
      customTransaction.update(entryRef, payload);
      anyBatch.delete(entryRef);
    `);
    expect(analysis.writes).toHaveLength(3);
    expect(analysis.hardDeletes).toHaveLength(1);
  });

  it('detects functional writers, nested refs, and imported writer aliases', () => {
    const analysis = analyzeEntryWrites(`
      import { collection, doc, addDoc as add, setDoc as persist, deleteDoc as remove } from 'firebase/firestore';
      const entriesRef = collection(db, 'entries');
      add(entriesRef, payload);
      persist(doc(entriesRef, operationId), payload);
      remove(doc(db, 'entries', operationId));
      import * as firestore from 'firebase/firestore';
      const namespacePersist = firestore.updateDoc;
      namespacePersist(firestore.doc(db, 'entries', operationId), payload);
    `);
    expect(analysis.writes).toHaveLength(4);
    expect(analysis.hardDeletes).toHaveLength(1);
  });

  it('does not mistake read-only Entry collection access for a writer', () => {
    expect(analyzeEntryWrites(`
      const entriesRef = collection(db, 'entries');
      const snapshot = await getDocs(entriesRef);
    `).writes).toEqual([]);
  });
});
