import type { InventoryCycleReport, InventoryCycleTab } from './inventoryCycleReport';

export interface ExcelSheetData {
  name: string;
  data: any[];
}

const unavailable = 'غير متاح';

export const canExportInventoryCycleReport = (report: InventoryCycleReport) => report.cache.status === 'current';

export const buildInventoryCycleExcelSheets = (report: InventoryCycleReport, tab: InventoryCycleTab): ExcelSheetData[] => {
  const itemRows = report.items.map(item => ({
    'الصنف': item.accountName,
    'رصيد أول المدة': tab === 'gold' ? item.openingEquivalent21 : item.openingPhysical,
    'إجمالي الداخل': item.incoming,
    'إجمالي الخارج': item.outgoing,
    'رصيد آخر المدة': tab === 'gold' ? item.closingEquivalent21 : item.closingPhysical,
    'تكلفة آخر المدة': item.closingCost ?? unavailable,
    'المتوسط المرجح (Weighted Average Cost)': item.closingAverage ?? unavailable,
    ...(tab !== 'accessory' ? { 'القيمة السوقية': item.marketValue ?? unavailable, 'فرق إعادة التقييم': item.revaluation ?? unavailable } : {}),
    'مبيعات الفترة': item.salesRevenue,
    'تكلفة البضاعة المباعة (COGS)': item.cogs ?? unavailable,
    'مجمل الربح': item.grossProfit ?? unavailable,
    'عدد التحذيرات': item.warnings.length,
  }));

  const movementRows = report.items.flatMap(item => item.operations.map(op => ({
    'الصنف': item.accountName,
    'التاريخ': op.date,
    'رقم العملية': op.invoiceNumber || op.id,
    'رقم القيد': op.journalNumber,
    'نوع العملية': op.kind,
    'الاتجاه': op.direction === 'in' ? 'داخل' : op.direction === 'out' ? 'خارج' : 'محايد',
    'الحساب المدين': op.debit,
    'الحساب الدائن': op.credit,
    'العيار': tab === 'gold' ? op.karat || '' : '',
    'الوزن/الكمية الفعلية': op.physicalQuantity,
    'المكافئ عيار 21 (Equivalent-21)': tab === 'gold' ? op.equivalent21 ?? unavailable : '',
    'المبلغ': op.cash,
    'التكلفة المنقولة': op.movedCost ?? unavailable,
    'المتوسط قبل': op.averageBefore ?? unavailable,
    'المتوسط بعد': op.averageAfter ?? unavailable,
    'الرصيد قبل': op.balanceBefore,
    'الرصيد بعد': op.balanceAfter,
    'COGS': op.cogs ?? unavailable,
    'الربح': op.grossProfit ?? unavailable,
    'ملاحظات': op.notes || '',
  })));

  const profitabilityRows = itemRows.map(row => ({
    'الصنف': row['الصنف'],
    'المبيعات': row['مبيعات الفترة'],
    'تكلفة البضاعة المباعة (COGS)': row['تكلفة البضاعة المباعة (COGS)'],
    'مجمل الربح': row['مجمل الربح'],
  }));

  const warningRows = report.warnings.map(w => ({
    'الصنف': w.accountName || '',
    'رقم العملية': w.operationNumber || '',
    'التاريخ': w.date || '',
    'نوع التحذير': w.type,
    'الكود': w.typeCode,
    'المستوى': w.severity,
    'الوصف': w.description,
  }));

  if (tab === 'accessory') {
    return [
      { name: 'الملخص', data: [{ ...report.summary, closingCost: report.summary.closingCost ?? unavailable, cogs: report.summary.cogs ?? unavailable, grossProfit: report.summary.grossProfit ?? unavailable }] },
      { name: 'الأصناف', data: itemRows },
      { name: 'الحركات', data: movementRows },
      { name: 'الربحية', data: profitabilityRows },
      { name: 'التحذيرات', data: warningRows.length ? warningRows : [{ 'الحالة': 'لا توجد تحذيرات' }] },
    ];
  }

  const reviewRows = report.reviewedWarnings.length
    ? report.reviewedWarnings.map(r => ({
      'التحذير': r.typeLabel,
      'المستوى وقت المراجعة': r.severityAtReview,
      'تمت المراجعة في': r.reviewedAt,
      'قبل كما هو': r.acceptedAsIs ? 'نعم' : 'لا',
      'الصنف': r.accountName || '',
      'رقم العملية': r.operationNumber || '',
      'التاريخ': r.date || '',
      'الوصف': r.description,
    }))
    : [{ 'الحالة': 'لا توجد مراجعات محفوظة' }];

  return [
    { name: 'الملخص العام', data: [{ ...report.summary, closingCost: report.summary.closingCost ?? unavailable, cogs: report.summary.cogs ?? unavailable, grossProfit: report.summary.grossProfit ?? unavailable }] },
    { name: 'الأصناف', data: itemRows },
    { name: 'الحركات', data: movementRows },
    { name: 'الربحية', data: profitabilityRows },
    { name: 'التقييم السوقي', data: itemRows.map(row => ({ 'الصنف': row['الصنف'], 'القيمة الدفترية': row['تكلفة آخر المدة'], 'القيمة السوقية': (row as any)['القيمة السوقية'] ?? unavailable, 'فرق إعادة التقييم': (row as any)['فرق إعادة التقييم'] ?? unavailable })) },
    { name: 'التحذيرات النشطة', data: warningRows.length ? warningRows : [{ 'الحالة': 'لا توجد تحذيرات نشطة' }] },
    { name: 'سجل المراجعة', data: reviewRows },
    { name: 'المراجعة والمعادلات', data: [{ 'البند': 'مصدر التكلفة', 'القيمة': 'Moving Weighted Average Cost من المحرك المركزي' }, { 'البند': 'التقييم السوقي', 'القيمة': tab === 'gold' ? 'Closing Equivalent-21 × سعر اليوم عيار 21' : 'Closing Weight × سعر اليوم للفضة' }] },
  ];
};
