import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsView } from '../SettingsView';
import { ProfitAnalysisView } from '../ProfitAnalysisView';
import type { Account, Entry } from '../../../types';

const mockStore = vi.hoisted(() => ({ value: {} as any }));

vi.mock('../../../store', () => ({
  useAppStore: () => mockStore.value,
}));

vi.mock('../../../firebase', () => ({
  db: {},
  OperationType: { UPDATE: 'update' },
  handleFirestoreError: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn((...segments: string[]) => segments.join('/')),
  setDoc: vi.fn(),
  writeBatch: vi.fn(() => ({ delete: vi.fn(), update: vi.fn(), commit: vi.fn() })),
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    },
  };
});

const accounts: Account[] = [
  { id: 'cash', name: 'cash', mainType: 'asset', subType: 'cash', balanceNature: 'cash', type: 'cash', is_inventory: false, karat: null, metal: null, userId: 'u1' },
  { id: 'gold21-product', name: 'gold21-product', mainType: 'asset', subType: 'inventory', balanceNature: 'gold', type: 'gold_product', is_inventory: true, karat: '21', metal: 'gold', userId: 'u1' },
  { id: 'equity', name: 'equity', mainType: 'equity', subType: 'opening', balanceNature: 'cash', type: 'other', is_inventory: false, karat: null, metal: null, userId: 'u1' },
];

const entry = (overrides: Partial<Entry>): Entry => ({
  id: 'e1',
  seq: 1,
  tx: 'test',
  operationKind: 'opening',
  date: '2026-01-01',
  debit: 'gold21-product',
  debitAccountId: 'gold21-product',
  credit: 'equity',
  creditAccountId: 'equity',
  cash: '0',
  weight: '1.00',
  count: '0',
  arabicWeight: '0',
  notes: '',
  userId: 'u1',
  ...overrides,
});

describe('MKA-34 UI integration', () => {
  beforeEach(() => {
    mockStore.value = {
      user: { uid: 'u1', email: 'owner@example.com' } as any,
      entries: [],
      accountsDb: accounts,
      openingCostConfig: [],
      goldPrice: 7000,
      silverPrice: 60,
      reportsTab: 'profit-analysis',
      view: 'settings',
      globalError: null,
      customRules: [],
      setView: vi.fn(),
      setOpeningCostConfig: vi.fn(),
      setGlobalError: vi.fn(),
    };
  });

  it('renders the annual opening cost prices path in SettingsView', () => {
    mockStore.value.openingCostConfig = [{ year: 2026, gold21PriceMinorPerGram: 400000, silverPriceMinorPerGram: 6000 }];

    const html = renderToStaticMarkup(<SettingsView />);

    expect(html).toContain('أسعار افتتاح التكلفة');
  });

  it('renders the missing opening cost warning in ProfitAnalysisView before any sale exists', () => {
    mockStore.value.entries = [entry({ id: 'opening-missing' })];
    mockStore.value.openingCostConfig = [];

    const html = renderToStaticMarkup(<ProfitAnalysisView />);

    expect(html).toContain('تكلفة المخزون الافتتاحي غير مكتملة');
  });
});
