import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Download, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';

export const DailyJournalDateControls = ({ selectedDate, readableSelectedDate, onDateChange, onExport, onAddEntry }: {
  selectedDate: string;
  readableSelectedDate: string;
  onDateChange: (date: string) => void;
  onExport: () => void;
  onAddEntry: () => void;
}) => {
  const shiftDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    onDateChange(format(date, 'yyyy-MM-dd'));
  };
  return <div className="rounded-2xl border border-[#1a1e2a] bg-[#0e1018] p-3 shadow-lg">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-black text-[#c9a84c]"><Calendar className="h-5 w-5" />{'\u0627\u0644\u064a\u0648\u0645\u064a\u0629 \u0627\u0644\u0639\u0627\u0645\u0629'}</h2>
      <button type="button" onClick={onExport} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c9a84c22] bg-[#c9a84c11] text-[#c9a84c]"><Download className="h-4 w-4" /></button>
    </div>
    <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
      <button type="button" onClick={() => shiftDate(-1)} className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc]"><ChevronRight className="h-5 w-5" /></button>
      <div className="relative h-11"><div className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] px-3 text-center text-sm font-black text-[#ddd8cc]" aria-hidden="true"><bdi dir="rtl">{readableSelectedDate}</bdi></div><input type="date" value={selectedDate} aria-label="\u0627\u062e\u062a\u064a\u0627\u0631 \u062a\u0627\u0631\u064a\u062e \u0627\u0644\u064a\u0648\u0645\u064a\u0629" onChange={event => onDateChange(event.target.value)} className="absolute inset-0 h-11 w-full cursor-pointer opacity-0" /></div>
      <button type="button" onClick={() => shiftDate(1)} className="flex h-11 items-center justify-center rounded-xl border border-[#1a1e2a] bg-[#080a0f] text-[#ddd8cc]"><ChevronLeft className="h-5 w-5" /></button>
    </div>
    <button type="button" onClick={onAddEntry} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-4 py-3 text-sm font-black text-[#080a0f] shadow-lg shadow-[#c9a84c]/10 transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#f5f1e8]"><PlusCircle className="h-4 w-4" />{'\u0625\u0636\u0627\u0641\u0629 \u0639\u0645\u0644\u064a\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645'}</button>
  </div>;
};
