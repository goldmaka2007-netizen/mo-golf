import fs from 'node:fs';

const path = 'src/lib/__tests__/inventoryCheckSettlement.test.ts';
const source = fs.readFileSync(path, 'utf8');
const oldText = "expect(shortage).toMatchObject({ tx: 'تسوية', operationKind: 'adjustment'";
const newText = "expect(shortage).toMatchObject({ tx: 'تسوية عجز', operationKind: 'adjustment'";
const count = source.split(oldText).length - 1;
if (count !== 1) throw new Error(`Expected one legacy shortage assertion, found ${count}`);
fs.writeFileSync(path, source.replace(oldText, newText));
console.log('Inventory adjustment regression expectation updated for Phase 5B.');
