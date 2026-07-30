import React, { useState } from 'react';
import { Briefcase, Landmark, TrendingUp } from 'lucide-react';
import type { Entry } from '../../../types';
import { cn } from '../../../lib/utils';
import { IncomeStatementView as EgpIncomeStatementView } from './EgpIncomeStatementView';
import { BalanceSheetView as EgpBalanceSheetView } from './EgpBalanceSheetView';
import { EquityStatementView as EgpEquityStatementView } from './EgpEquityStatementView';

type FinancialStatementTab = 'income' | 'balance' | 'equity';

export const FinancialStatementsView = React.memo(({
  incomeEntries,
  balanceEntries,
}: {
  incomeEntries: Entry[];
  balanceEntries: Entry[];
}) => {
  const [activeTab, setActiveTab] = useState<FinancialStatementTab>('income');
  const tabClass = (tab: FinancialStatementTab) => cn(
    'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition-colors',
    activeTab === tab ? 'bg-[#c9a84c] text-[#080a0f]' : 'text-[#8a8172]',
  );

  return <div className="space-y-4" dir="rtl">
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-2">
      <button type="button" onClick={() => setActiveTab('income')} className={tabClass('income')}><TrendingUp className="h-4 w-4" />قائمة الدخل</button>
      <button type="button" onClick={() => setActiveTab('balance')} className={tabClass('balance')}><Briefcase className="h-4 w-4" />المركز المالي</button>
      <button type="button" onClick={() => setActiveTab('equity')} className={tabClass('equity')}><Landmark className="h-4 w-4" />حقوق الملكية</button>
    </div>
    {activeTab === 'income' && <EgpIncomeStatementView entries={incomeEntries} />}
    {activeTab === 'balance' && <EgpBalanceSheetView entries={balanceEntries} />}
    {activeTab === 'equity' && <EgpEquityStatementView entries={balanceEntries} />}
  </div>;
});