import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080a0f] text-[#ddd8cc] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#0e1018] border border-[#1a1e2a] rounded-2xl p-8 shadow-2xl">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">عذراً، حدث خطأ ما</h2>
            <p className="text-sm text-[#5a5548] mb-6">
              {this.state.error?.message || "حدث خطأ غير متوقع في التطبيق."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gradient-to-r from-[#c9a84c] to-[#9a7830] text-[#080a0f] font-bold rounded-xl"
            >
              إعادة تحميل التطبيق
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}
