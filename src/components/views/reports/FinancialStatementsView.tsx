import React, { useState } from 'react';
import { Briefcase, TrendingUp } from 'lucide-react';
import type { Entry } from '../../../types';
import { cn } from '../../../lib/utils';
import { IncomeStatementView as EgpIncomeStatementView } from './EgpIncomeStatementView';
import { BalanceSheetView as EgpBalanceSheetView } from './EgpBalanceSheetView';

type FinancialStatementTab = 'income' | 'balance';

export const FinancialStatementsView = React.memo(({
  incomeEntries,
  balanceEntries,
  onOpenLedger,
}: {
  incomeEntries: Entry[];
  balanceEntries: Entry[];
  onOpenLedger?: (accountId: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<FinancialStatementTab>('income');

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-2">
        <button
          type="button"
          onClick={() => setActiveTab('income')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition-colors',
            activeTab === 'income' ? 'bg-[#c9a84c] text-[#080a0f]' : 'text-[#8a8172]',
          )}
        >
          <TrendingUp className="h-4 w-4" />
          قائمة الدخل (EGP)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('balance')}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition-colors',
            activeTab === 'balance' ? 'bg-[#c9a84c] text-[#080a0f]' : 'text-[#8a8172]',
          )}
        >
          <Briefcase className="h-4 w-4" />
          المركز المالي (EGP)
        </button>
      </div>

      {activeTab === 'income' && <EgpIncomeStatementView entries={incomeEntries} onOpenLedger={onOpenLedger} />}
      {activeTab === 'balance' && <EgpBalanceSheetView entries={balanceEntries} onOpenLedger={onOpenLedger} />}
    </div>
  );
});
