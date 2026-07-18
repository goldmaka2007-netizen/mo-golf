import React from 'react';
import { cn } from '../../lib/utils';

export const KPICard = ({ 
  icon, 
  title, 
  value, 
  subValue, 
  status, 
  color 
}: { 
  icon: React.ReactNode, 
  title: string, 
  value: string, 
  subValue?: string, 
  status?: string, 
  color: string 
}) => (
  <div className="bg-[#0e1018] border border-[#c9a84c22] rounded-2xl p-4 flex flex-col gap-2 relative shadow-lg hover:border-[#c9a84c55] transition-all">
    <div className="flex items-center gap-3 mb-1">
      <div className={cn("p-2 rounded-xl bg-opacity-10", color.replace('text-', 'bg-'))}>
        <div className={cn("w-5 h-5", color)}>{icon}</div>
      </div>
      <span className="text-[11px] font-bold text-[#5a5548] uppercase tracking-widest">{title}</span>
    </div>
    <div className={cn("text-lg sm:text-xl md:text-2xl font-bold font-sans leading-tight break-all", color)} dir="ltr">{value}</div>
    {subValue && <div className="text-[10px] text-[#5a5548] font-bold">{subValue}</div>}
    {status && (
      <div className={cn("mt-1 text-[10px] font-bold px-2 py-0.5 rounded-lg w-fit", color.replace('text-', 'bg-'), "bg-opacity-10 border", color.replace('text-', 'border-'), "border-opacity-20")}>
        {status}
      </div>
    )}
  </div>
);
