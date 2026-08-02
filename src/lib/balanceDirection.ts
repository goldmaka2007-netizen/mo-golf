import type { Account } from '../types';

export type BalanceDirection = 'debit' | 'credit' | 'settled';
export type NormalBalanceSide = Exclude<BalanceDirection, 'settled'>;

export interface BalanceDirectionInput {
  signedBalance: number;
  account?: Pick<Account, 'canonicalMainType' | 'mainType'>;
  mainType?: string;
  normalBalance?: NormalBalanceSide;
  tolerance?: number;
}

const creditMainTypes = new Set([
  'liability', 'liabilities', 'equity', 'revenue', 'revenues',
  'خصوم', 'الخصوم', 'حقوق ملكية',
  'حقوق الملكية', 'إيرادات', 'ايرادات',
  'الإيرادات', 'الايرادات',
]);

export const resolveNormalBalance = (
  input: Pick<BalanceDirectionInput, 'account' | 'mainType' | 'normalBalance'>,
): NormalBalanceSide => {
  if (input.normalBalance) return input.normalBalance;
  const mainType = input.mainType ?? input.account?.canonicalMainType ?? input.account?.mainType ?? '';
  return creditMainTypes.has(mainType) ? 'credit' : 'debit';
};

/** A positive engine balance means the account's normal side. */
export const resolveBalanceDirection = (input: BalanceDirectionInput): BalanceDirection => {
  const tolerance = input.tolerance ?? 1e-12;
  if (Math.abs(input.signedBalance) <= tolerance) return 'settled';
  const normalBalance = resolveNormalBalance(input);
  if (input.signedBalance > 0) return normalBalance;
  return normalBalance === 'debit' ? 'credit' : 'debit';
};

export const balanceDirectionLabel = (direction: BalanceDirection): string =>
  direction === 'debit' ? 'مدين' : direction === 'credit' ? 'دائن' : 'مسدد';

export const splitBalanceByDirection = (
  input: BalanceDirectionInput,
): { debit: number; credit: number; direction: BalanceDirection } => {
  const direction = resolveBalanceDirection(input);
  const magnitude = input.signedBalance < 0 ? -input.signedBalance : input.signedBalance;
  return {
    debit: direction === 'debit' ? magnitude : 0,
    credit: direction === 'credit' ? magnitude : 0,
    direction,
  };
};
