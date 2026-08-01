import { describe, expect, it } from 'vitest';
import { Account } from '../../types';
import { buildOperationalAccountOptions } from '../operationalAccounts';

const account = (id: string, name: string): Account => ({
  id, name, userId: 'u', mainType: 'اصول', subType: '', balanceNature: 'قطعة',
});

describe('operational account dropdown source', () => {
  it('contains only accounts documents and cannot expose a canonical-only definition', () => {
    const options = buildOperationalAccountOptions([account('legacy-cash', 'الخزنة')]);
    expect(options).toEqual([{ id: 'legacy-cash', c: 'الخزنة' }]);
    expect(options.map(option => option.c)).not.toContain('Canonical only');
  });

  it('shows a published account when its new legacy document enters the accounts snapshot', () => {
    expect(buildOperationalAccountOptions([])).toEqual([]);
    expect(buildOperationalAccountOptions([account('legacy-qafl', 'قفل بار')]))
      .toContainEqual({ id: 'legacy-qafl', c: 'قفل بار' });
  });
});