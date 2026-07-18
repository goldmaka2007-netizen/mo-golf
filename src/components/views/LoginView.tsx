import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, LogIn, ShieldCheck, Mail, Lock } from 'lucide-react';
import { Logo } from '../ui/Logo';

interface LoginViewProps {
  authError: string | null;
  isSigningIn: boolean;
  isStandalone: boolean;
  handleSignIn: (email: string, password: string) => void;
  handleHardReset: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  authError,
  isSigningIn,
  handleSignIn,
  handleHardReset
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      handleSignIn(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-[#020408] text-[#e0e0e0] flex items-center justify-center p-6 relative overflow-hidden" dir="rtl">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-500/5 rounded-full blur-[120px]" />
      
      <div className="max-w-md w-full relative z-10 flex flex-col items-center">
        <div className="mb-12 transform hover:scale-105 transition-transform duration-500">
          <Logo className="w-24 h-24 drop-shadow-[0_0_30px_rgba(191,155,48,0.3)]" />
        </div>

        <div className="glass-card luxury-border p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden w-full text-center">
          <form onSubmit={onSubmit} className="space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-b from-white via-white to-gold-400 bg-clip-text text-transparent">نظام يـاسر جـولد</h1>
              <p className="text-sm text-white/40 leading-relaxed font-light">لإدارة حسابات ومخازن الذهب والفضة</p>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold">تسجيل الدخول</h2>
                <p className="text-[11px] text-white/30 uppercase tracking-[0.2em] font-medium">أدخل بيانات الاعتماد للوصول للنظام</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-4 text-right">
                  <div className="relative group">
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-gold-400 transition-colors" />
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="البريد الإلكتروني"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-sm focus:outline-none focus:border-gold-500/50 focus:bg-white/[0.08] transition-all"
                    />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-gold-400 transition-colors" />
                    <input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pr-12 pl-4 text-sm focus:outline-none focus:border-gold-500/50 focus:bg-white/[0.08] transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSigningIn || !email || !password}
                  className="gold-button w-full flex items-center justify-center gap-4 py-5 text-sm font-bold tracking-wider rounded-2xl relative overflow-hidden group shadow-[0_0_40px_rgba(191,155,48,0.15)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-all duration-1000" />
                  {isSigningIn ? (
                    <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <LogIn className="w-6 h-6 shrink-0" />
                  )}
                  <span>دخول للنظام</span>
                </button>
              </div>
            </div>
          </form>

          <AnimatePresence>
            {authError && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-8 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white/60 text-right overflow-hidden shadow-xl"
              >
                <div className="flex items-center gap-2 mb-2 text-gold-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-bold uppercase tracking-wide">تنبيه</span>
                </div>
                <div className="opacity-80 leading-relaxed pr-6">
                  {authError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-white/5">
            <button 
              onClick={handleHardReset}
              className="text-[9px] text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest font-bold"
            >
              تحديث الجلسة (Hard Reset)
            </button>
          </div>
        </div>

        <div className="mt-12 opacity-30 text-[10px] tracking-[0.5em] uppercase font-bold text-white/50 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold-500" />
            <span>Secure Enterprise Login</span>
          </div>
          <div className="h-px w-12 bg-gold-400/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};
