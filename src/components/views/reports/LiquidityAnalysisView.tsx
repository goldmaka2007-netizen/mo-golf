import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Entry } from '../../../types';

export const LiquidityAnalysisView = React.memo(({ entries }: { entries: Entry[] }) => {
  const data = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = format(d, 'yyyy-MM-dd');
      
      const dayEntries = entries.filter(e => e.date === dateStr);
      const sales = dayEntries.filter(e => (e.tx || '').includes('بيع')).reduce((acc, e) => acc + parseFloat(e.cash || '0'), 0);
      const buys = dayEntries.filter(e => (e.tx || '').includes('شراء')).reduce((acc, e) => acc + parseFloat(e.cash || '0'), 0);
      
      return {
        name: format(d, 'EEE', { locale: ar }),
        fullDate: format(d, 'd MMMM', { locale: ar }),
        'مبيعات': sales,
        'مشتريات': buys
      };
    });
  }, [entries]);

  return (
    <div className="bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-5 space-y-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-[#c9a84c]">تحليل حركة السيولة النقدية</h3>
        <p className="text-xs text-[#5a5548] font-bold uppercase tracking-widest">مقارنة المبيعات والمشتريات (آخر 7 أيام)</p>
      </div>
      
      <div className="h-64 md:h-80 w-full select-none relative overflow-hidden" dir="ltr" style={{ minHeight: '256px', minWidth: '0' }}>
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1e2a" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#5a5548" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <Tooltip 
              cursor={{ fill: '#1a1e2a', opacity: 0.4 }}
              contentStyle={{ 
                backgroundColor: '#0e1018', 
                border: '1px solid #1a1e2a', 
                borderRadius: '12px', 
                textAlign: 'right' 
              }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              labelStyle={{ color: '#5a5548', fontSize: '10px', marginBottom: '4px' }}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '20px' }} iconType="circle" />
            <Bar 
              name="إجمالي مبيعات"
              dataKey="مبيعات" 
              fill="#c9a84c" 
              radius={[4, 4, 0, 0]} 
              barSize={20} 
            />
            <Bar 
              name="إجمالي مشتريات"
              dataKey="مشتريات" 
              fill="#6a9e6a" 
              radius={[4, 4, 0, 0]} 
              barSize={20} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#080a0f] p-4 rounded-xl border border-[#1a1e2a] text-xs text-[#5a5548] leading-relaxed">
        * يوضح هذا الرسم التوضيحي حجم التدفقات النقدية الداخلة (مبيعات) والخارجة (مشتريات) خلال الأسبوع الأخير، مما يساعد في مراقبة مستويات السيولة المطلوبة لتغطية العمليات اليومية.
      </div>
    </div>
  );
});
