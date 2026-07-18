import React from 'react';
import { cn } from '../../lib/utils';

export interface AccountOption {
  c: string;
  k?: number | null;
  m?: number;
}

interface Props {
  label: string;
  theme: 'debit' | 'credit';
  value: string;
  options: string[] | AccountOption[]; 
  onSelect: (name: string, karat?: number | null, multiplier?: number) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const AccountSearchSelect = ({ label, theme, value, options, onSelect, inputRef }: Props) => {
  const [search, setSearch] = React.useState('');
  
  const isDebit = theme === 'debit';
  const themeColors = isDebit ? {
    bg: 'bg-[#6a9e6af1a]',
    borderActive: 'border-[#6a9e6a22]',
    textTitle: 'text-[#6a9e6a]',
    focusBorder: 'focus:border-[#6a9e6a55]',
    hoverBg: 'hover:bg-[#6a9e6a11]',
    hoverText: 'hover:text-[#6a9e6a]'
  } : {
    bg: 'bg-[#9e6a6a1a]',
    borderActive: 'border-[#9e6a6a22]',
    textTitle: 'text-[#9e6a6a]',
    focusBorder: 'focus:border-[#9e6a6a55]',
    hoverBg: 'hover:bg-[#9e6a6a11]',
    hoverText: 'hover:text-[#9e6a6a]'
  };

  return (
    <div className={cn(
      "p-3 rounded-2xl border-2 min-h-[100px] flex flex-col justify-between transition-all", 
      value ? `${themeColors.bg} ${themeColors.borderActive}` : "bg-[#080a0f] border-[#1a1e2a]"
    )}>
      <div className={cn("text-[8px] font-black uppercase", themeColors.textTitle)}>{label}</div>
      <div className="text-sm font-bold text-[#ddd8cc] text-right truncate" title={value || ""}>
        {value || "اختر..."}
      </div>
      {options.length > 1 && (
        <div className="relative mt-2">
          <input 
            ref={inputRef} 
            type="text" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="بحث..." 
            className={cn("w-full bg-[#11141d] rounded-lg p-1.5 text-[9px] text-[#ddd8cc] outline-none border border-[#1a1e2a] transition-all", themeColors.focusBorder)}
          />
          {search && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-32 overflow-y-auto bg-[#0e1018] border border-[#1a1e2a] rounded-xl shadow-2xl custom-scrollbar">
              {options.filter(o => typeof o === 'string' ? o.includes(search) : o.c.includes(search)).map(opt => {
                const itemName = typeof opt === 'string' ? opt : opt.c;
                const itemKarat = typeof opt === 'string' ? undefined : opt.k;
                const itemMult = typeof opt === 'string' ? undefined : opt.m;
                return (
                  <button 
                    key={itemName} 
                    type="button"
                    onClick={() => { 
                      onSelect(itemName, itemKarat, itemMult);
                      setSearch(''); 
                    }} 
                    className={cn("w-full p-2 text-right text-[10px] text-[#ddd8cc] block border-b border-[#1a1e2a] last:border-0 transition-all", themeColors.hoverBg, themeColors.hoverText)}
                  >
                    {itemName}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
