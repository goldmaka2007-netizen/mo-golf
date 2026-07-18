import React from 'react';
import { AlertCircle } from 'lucide-react';

interface GlobalErrorViewProps {
  globalError: string;
  setGlobalError: (error: string | null) => void;
}

export const GlobalErrorView: React.FC<GlobalErrorViewProps> = ({ globalError, setGlobalError }) => {
  const isInIframe = window.self !== window.top;
  return (
    <div className="min-h-screen bg-[#020408] text-[#e0e0e0] flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full text-center glass-card luxury-border p-8 shadow-2xl">
        <AlertCircle className="w-12 h-12 text-red-500/80 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4 text-red-500/90 font-sans tracking-tight">عذراً، حدث خطأ</h2>
        <p className="text-sm text-white/60 mb-6 leading-relaxed font-light">{globalError}</p>
        
        {isInIframe && (
          <div className="mb-8 p-4 bg-gold-400/5 border border-gold-400/20 rounded-xl text-gold-300 text-xs">
            إذا كنت تستخدم الموبايل، يرجى فتح البرنامج في متصفح خارجي (مثل Chrome أو Safari) لضمان عمل كافة الخصائص.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => setGlobalError(null)}
            className="w-full py-4 bg-red-500/10 text-red-400 font-bold rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all font-sans tracking-wide"
          >
            تغاضى عن الخطأ والمتابعة
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-white/5 text-white/90 font-bold rounded-xl hover:bg-white/10 border border-white/5 transition-all font-sans tracking-wide"
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      </div>
    </div>
  );
};
