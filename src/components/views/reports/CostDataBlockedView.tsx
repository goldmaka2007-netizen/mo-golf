import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { InventoryCostTimeline } from '../../../lib/inventoryCostTypes';

export const CostDataBlockedView = ({ timeline }: { timeline?: InventoryCostTimeline }) => (
  <div className="space-y-3 rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-50" dir="rtl">
    <div className="flex items-start gap-2 font-black"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" /><span>لا يمكن احتساب التكلفة والربح بدقة قبل استكمال بيانات التكلفة المطلوبة.</span></div>
    <p className="text-xs text-red-100/80">القوائم المالية المحاسبية وCOGS والربح الرسمي محجوبة. التقارير التشغيلية القديمة تظل متاحة مع التحذير الخاص بها.</p>
    {!!timeline?.diagnostics.length && <div className="space-y-2">{timeline.diagnostics.map((item, index) => <div key={`${item.operationId}-${index}`} className="rounded-xl bg-black/20 p-3"><div className="font-bold">العملية: {item.operationId || 'غير محددة'}</div><div className="mt-1 text-xs">السبب: {item.message}</div><div className="mt-1 text-xs">الحساب: {item.inventoryAccountId || 'غير محدد'}</div></div>)}</div>}
    {!!timeline?.unresolvedCostData.length && <div className="space-y-2">{timeline.unresolvedCostData.map(item => <div key={`${item.operationId}-${item.code}`} className="rounded-xl bg-black/20 p-3"><div className="font-bold">العملية: {item.operationId}</div><div className="mt-1 text-xs">السبب: {item.message}</div><div className="mt-1 text-xs">التصحيح المطلوب: {item.requiredCorrection}</div><div className="mt-1 text-xs">التقارير المحجوبة: قائمة الدخل، المركز المالي، التغير في حقوق الملكية، COGS والربح.</div></div>)}</div>}
  </div>
);