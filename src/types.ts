import { User as FirebaseUser } from 'firebase/auth';
import type { GoldEquivalent21LegacyComparison, GoldEquivalent21Snapshot } from './lib/goldEquivalent';

export type { FirebaseUser };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export enum AccountNature {
  UNKNOWN = 0,
  CASH = 1,
  GOLD = 2,
  SILVER = 3,
  MIXED_GOLD = 4,
  MIXED_SILVER = 5,
  ACC = 6
}

export interface Entry {
  id?: string;
  seq: number;
  tx: string;
  operationKind?: AccountingOperationKind;
  subTx?: string;
  debit: string;
  credit: string;
  debitAccountId?: string;
  creditAccountId?: string;
  date: string;
  cash: string;
  weight: string;
  count: string;
  arabicWeight: string;
  karat?: number;
  multiplier?: number;
  notes: string;
  invoiceNumber?: string;
  clientName?: string;
  clientPhone?: string;
  marketPrice?: number;
  goldEquivalent21Snapshot?: GoldEquivalent21Snapshot;
  goldEquivalent21LegacyComparison?: GoldEquivalent21LegacyComparison;
  userId: string;
  createdAt?: any;
  isSettled?: boolean;
}

export type AccountingOperationKind =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'transfer'
  | 'tifeet'
  | 'adjustment'
  | 'merchant_settlement'
  | 'personal_withdrawal'
  | 'expense'
  | 'other';

export interface CustomRule {
  id?: string;
  t: string;
  d: string;
  c: string;
  k?: number;
  m: number;
  userId: string;
}

export interface TransactionType {
  t: string;
  d: string;
  c: string;
  k: number | null;
  m: number;
}

export interface AccountCategories {
  assets: Record<string, string[]>;
  liabilities: Record<string, string[]>;
  equity: Record<string, string[]>;
  revenue: Record<string, string[]>;
  expenses: Record<string, string[]>;
}

export type AccountType =
  | 'gold_raw'
  | 'gold_product'
  | 'gold_direct'
  | 'silver'
  | 'accessory'
  | 'cash'
  | 'merchant'
  | 'other';

export interface OperationRule {
  affectsInventory: boolean;
  isPurchase: boolean;
  isSale?: boolean;
  hasCash: boolean;
  cashAlwaysZero: boolean;
  isOpening?: boolean;
}

export interface Account {
  id?: string;
  name: string;
  mainType: string;
  subType: string;
  balanceNature: string;
  userId: string;
  type?: AccountType;
  karat?: '18' | '21' | '24' | 'silver' | null;
  metal?: 'gold' | 'silver' | null;
  is_inventory?: boolean;
}

export interface TransactionRule {
  id?: string;
  tx: string;
  debit: string;
  credit: string;
  debitAccountId?: string;
  creditAccountId?: string;
  karat?: number | null;
  multiplier?: number;
  category: string;
  userId: string;
}

export interface InventoryCheck {
  id?: string;
  accountId: string;
  date: string;
  systemWeight: number;
  actualWeight: number;
  systemCount: number;
  actualCount: number;
  notes: string;
  userId: string;
  createdAt?: any;
  isResolved?: boolean;
}

export interface Category {
  cat: string;
  items: string[];
}



