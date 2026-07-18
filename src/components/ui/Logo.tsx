import React from 'react';

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
