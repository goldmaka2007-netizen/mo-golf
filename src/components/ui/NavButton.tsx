import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function NavButton({
  active,
  onClick,
  icon,
  label,
  variant = 'normal'
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'normal' | 'primary';
  key?: React.Key;
}) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95",
        isPrimary ? "-mt-8" : "h-14",
        !isPrimary && (active ? "text-[#c9a84c]" : "text-[#8a8172] hover:text-[#f5f1e8]")
      )}
      aria-current={active ? 'page' : undefined}
    >
      <div
        className={cn(
          "relative flex items-center justify-center transition-all duration-200",
          isPrimary
            ? "h-16 w-16 rounded-3xl bg-[#c9a84c] text-[#05070b] shadow-[0_14px_34px_rgba(201,168,76,0.32)] ring-4 ring-[#05070b]"
            : "h-10 w-10 rounded-2xl",
          !isPrimary && active && "bg-[#c9a84c1a] shadow-[0_0_18px_rgba(201,168,76,0.12)]",
          !isPrimary && !active && "bg-transparent"
        )}
      >
        {icon}
        {!isPrimary && active && (
          <motion.div
            layoutId="nav-active-dot"
            className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#c9a84c]"
          />
        )}
      </div>
      <span
        className={cn(
          "max-w-full truncate text-[10px] font-black leading-none",
          isPrimary ? "text-[#c9a84c]" : active ? "text-[#c9a84c]" : "text-[#8a8172]"
        )}
      >
        {label}
      </span>
    </button>
  );
}

