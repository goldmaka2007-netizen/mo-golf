import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  CheckCircle2, 
  ClipboardPaste,
  Wallet,
  Scale,
  Database,
  BookOpen,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { Entry } from '../types';

export const KPICard = ({ icon, title, value, subValue, status, color }: { icon: React.ReactNode, title: string, value: string, subValue?: string, status?: string, color: string }) => (
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

export const StatsCard = ({ value, label, color, icon }: { value: number | string, label: string, color: string, icon?: React.ReactNode }) => {
  return (
    <div className="bg-[#0e1018] border border-[#c9a84c22] rounded-2xl p-6 text-center shadow-xl relative overflow-hidden group hover:border-[#c9a84c55] transition-all">
      <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {icon}
      </div>
      <div className={cn("text-3xl md:text-4xl font-bold mb-2 font-mono", color)}>{value}</div>
      <div className="text-[11px] text-[#5a5548] font-bold uppercase tracking-widest">{label}</div>
    </div>
  );
}

export function ActionButton({ onClick, icon, title, sub, variant }: { onClick: () => void, icon: string, title: string, sub: string, variant: string }) {
  const variants: any = {
    primary: "bg-gradient-to-br from-[#1a1206] to-[#0e0c06] border-[#c9a84c33] text-[#c9a84c]",
    journal: "bg-gradient-to-br from-[#1a1a0a] to-[#080a0f] border-[#3a3a1a] text-[#c9a84c]",
    db: "bg-gradient-to-br from-[#0a0e1a] to-[#080a0f] border-[#1a2a3a] text-[#6a8a9e]",
    report: "bg-gradient-to-br from-[#0a1a0e] to-[#080a0f] border-[#1a3a1a] text-[#6a9e6a]"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full p-5 rounded-2xl border flex items-center gap-5 text-right transition-all active:scale-[0.98]",
        variants[variant]
      )}
    >
      <div className="text-2xl w-12 h-12 flex items-center justify-center bg-black/20 rounded-xl">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-bold mb-1">{title}</div>
        <div className="text-[10px] text-[#3a3530]">{sub}</div>
      </div>
      <ChevronLeft className="w-5 h-5 opacity-30" />
    </button>
  );
}

export const Logo = () => (
  <div className="flex flex-col items-center gap-1 mb-6">
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(201,168,76,0.4)]">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8c96a" />
            <stop offset="50%" stopColor="#c9a84c" />
            <stop offset="100%" stopColor="#8a6820" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#goldGrad)" strokeWidth="2" />
        <path d="M30 50 L50 30 L70 50 L50 70 Z" fill="url(#goldGrad)" />
        <circle cx="50" cy="50" r="5" fill="#080a0f" />
      </svg>
    </div>
    <h1 className="font-['Amiri'] text-2xl font-bold text-[#c9a84c] tracking-wider">محل مكة للذهب</h1>
    <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#c9a84c55] to-transparent" />
    <p className="text-[10px] text-[#3a3530] font-medium">نظام القيود المحاسبية</p>
  </div>
);

export const EntryRow = React.memo(({ e, setEditingEntry }: { e: Entry, setEditingEntry: (e: Entry) => void }) => {
  const [copied, setCopied] = useState(false);
  const isSilver = e.tx.includes('فضة') || e.debit.includes('فضة') || e.credit.includes('فضة');
  const isAcc = e.tx.includes('ملحقات') || e.debit.includes('ملحقات') || e.credit.includes('ملحقات');
  const unit = isSilver ? "جرام فضة" : isAcc ? "قطعة" : "جرام";

  let displaySide = `${e.debit} ← ${e.credit}`;
  if (e.debit === 'الخزنة') displaySide = e.credit;
  else if (e.credit === 'الخزنة') displaySide = e.debit;
  else if (e.tx === 'تيفيت') {
    if (e.debit === 'كسر عربي' || e.debit === 'كسر افرنجي') displaySide = e.credit;
    else if (e.credit === 'كسر عربي' || e.credit === 'كسر افرنجي') displaySide = e.debit;
  }

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation();
    const text = `${e.tx}: ${displaySide} | ${e.cash ? e.cash + ' ج' : ''} ${e.weight ? e.weight + ' ' + unit : ''} ${e.notes ? '(' + e.notes + ')' : ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={() => setEditingEntry(e)}
      className="w-full bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-5 text-right hover:border-[#c9a84c33] transition-all active:scale-[0.99] relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-1 h-full bg-[#c9a84c00] group-hover:bg-[#c9a84c] transition-all" />
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-[#c9a84c]">{e.tx}</div>
          <button 
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-[#1a1e2a] text-[#5a5548] hover:text-[#c9a84c] transition-all opacity-0 group-hover:opacity-100"
          >
            {copied ? <CheckCircle2 className="w-3 h-3 text-[#6a9e6a]" /> : <ClipboardPaste className="w-3 h-3" />}
          </button>
        </div>
        <div className="text-[10px] text-[#3a3530] font-bold">
          {(() => {
            if (!e.date) return 'بدون تاريخ';
            try {
              const parts = e.date.split('-');
              const y = parseInt(parts[0]) || 2026;
              const m = parseInt(parts[1]) || 1;
              const d = parseInt(parts[2]) || 1;
              return format(new Date(y, m - 1, d), 'dd MMMM yyyy', { locale: ar });
            } catch {
              return e.date;
            }
          })()}
        </div>
      </div>
      <div className="text-xs font-bold text-[#ddd8cc] mb-3">
        {displaySide}
      </div>
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          {e.cash && e.tx !== 'تيفيت' && (
            <div className="text-base font-bold text-[#c9a84c] font-mono">
              {Math.round(parseFloat(e.cash)).toLocaleString()} <span className="text-[10px] font-sans">ج</span>
            </div>
          )}
          {e.notes && <div className="text-[9px] text-[#5a5548] italic bg-[#080a0f] px-2 py-0.5 rounded w-fit">{e.notes}</div>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {e.weight && (
            <div className="text-[11px] text-[#ddd8cc] font-bold bg-[#1a1e2a] px-2 py-0.5 rounded-lg">
              {parseFloat(e.weight).toFixed(2)} <span className="text-[9px] opacity-60">{unit}</span>
              {e.karat ? <span className="mr-1 text-[#c9a84c]">(عيار {e.karat})</span> : ''}
            </div>
          )}
          {e.arabicWeight && (
            <div className="text-[9px] text-[#c9a84c88] font-bold border border-[#c9a84c22] px-1.5 rounded">
              {parseFloat(e.arabicWeight).toFixed(2)} جرام عربي
            </div>
          )}
        </div>
      </div>
    </button>
  );
});
