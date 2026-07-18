import React from 'react';
import { motion } from 'framer-motion';

interface LoadingViewProps {
  authHangError: boolean;
  authStage: string;
  handleHardReset: () => void;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ authHangError, authStage, handleHardReset }) => {
  if (authHangError) {
    return (
      <div className="min-h-screen bg-[#020408] text-[#e0e0e0] flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full text-center glass-card luxury-border p-8 shadow-2xl">
          <svg className="w-12 h-12 text-red-500/80 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h2 className="text-xl font-bold mb-4 text-red-500/90 font-sans tracking-tight">مشكلة في فحص الدخول</h2>
          <p className="text-sm text-white/60 mb-6 leading-relaxed font-light">
            يبدو أن هناك تعارض في البيانات المخزنة من محاولات سابقة. اضغط على الزر أدناه لمسح البيانات وإعادة التشغيل بشكل صحيح.
          </p>
          <button 
            onClick={handleHardReset}
            className="w-full py-4 bg-red-500/80 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg font-sans uppercase tracking-widest text-xs"
          >
            مسح البيانات وإصلاح التطبيق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020408] flex flex-col items-center justify-center space-y-6 p-6 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gold-400/5 blur-[100px] rounded-full" />
      <div className="relative">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-[3px] border-gold-400/20 border-t-gold-400 rounded-full"
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="gold-text text-lg font-bold tracking-[0.2em] uppercase animate-pulse">جاري التحميل</div>
        <div className="text-white/30 text-[10px] font-mono tracking-widest opacity-80">{authStage}</div>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3 }}
        className="flex flex-col items-center gap-4 z-10"
      >
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-2.5 glass-card luxury-border text-gold-300 rounded-full text-[11px] font-medium transition-all"
        >
          تحديث الصفحة (Reload)
        </button>
        <button 
          onClick={handleHardReset}
          className="text-[10px] text-white/30 underline uppercase opacity-70 hover:opacity-100 transition-opacity"
        >
          مسح الذاكرة (Fix)
        </button>
      </motion.div>
    </div>
  );
};
