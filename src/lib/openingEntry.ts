import type { Entry } from '../types';

export const isOpeningEntry = (entry: Entry): boolean =>
  entry.operationKind === 'opening'
  || entry.tx === 'قيد افتتاحي'
  || entry.subTx?.startsWith('رصيد افتتاحي') === true;
