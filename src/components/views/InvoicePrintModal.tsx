import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Printer, LayoutTemplate } from 'lucide-react';
import { useAppStore } from '../../store';
import { formatCashAmount } from '../../lib/accounting';

interface FieldConfig {
  top: number; // in cm
  right: number; // in cm
  show: boolean;
  fontSize?: number; // in px
}

interface InvoicePrintSettings {
  date: FieldConfig;
  accountName: FieldConfig;
  cash: FieldConfig;
  weight: FieldConfig;
  notes: FieldConfig;
  carat: FieldConfig;
}

const DEFAULT_SETTINGS: InvoicePrintSettings = {
  date: { top: 2, right: 2, show: true, fontSize: 14 },
  accountName: { top: 4, right: 5, show: true, fontSize: 16 },
  cash: { top: 6, right: 2, show: true, fontSize: 14 },
  weight: { top: 8, right: 2, show: true, fontSize: 14 },
  notes: { top: 10, right: 2, show: true, fontSize: 14 },
  carat: { top: 8, right: 10, show: true, fontSize: 14 },
};

export const InvoicePrintModal = () => {
  const { printEntry, setPrintEntry } = useAppStore();
  const [settings, setSettings] = useState<InvoicePrintSettings>(() => {
    const saved = localStorage.getItem('invoicePrintSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('invoicePrintSettings', JSON.stringify(settings));
  }, [settings]);

  if (!printEntry) return null;

  const updateField = (field: keyof InvoicePrintSettings, key: keyof FieldConfig, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: { ...prev[field], [key]: value }
    }));
  };

  const FieldEditor = ({ fieldKey, title, maxTop = 14, maxRight = 23 }: { fieldKey: keyof InvoicePrintSettings, title: string, maxTop?: number, maxRight?: number }) => (
    <div className="bg-[#1a1e2a] p-3 rounded-xl border border-[#2a2e3a] space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-bold text-[#ddd8cc] flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={settings[fieldKey].show}
            onChange={(e) => updateField(fieldKey, 'show', e.target.checked)}
            className="accent-[#c9a84c]"
          />
          {title}
        </label>
        <span className="text-[10px] text-[#5a5548] font-mono">
          Y: {settings[fieldKey].top}cm • X: {settings[fieldKey].right}cm
        </span>
      </div>
      
      {settings[fieldKey].show && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-[#8a8578]">من الأعلى (Y - cm)</label>
            <input 
              type="range" 
              min="0" max={maxTop} step="0.1" 
              value={settings[fieldKey].top}
              onChange={(e) => updateField(fieldKey, 'top', parseFloat(e.target.value))}
              className="w-full accent-[#c9a84c]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-[#8a8578]">من اليمين (X - cm)</label>
            <input 
              type="range" 
              min="0" max={maxRight} step="0.1" 
              value={settings[fieldKey].right}
              onChange={(e) => updateField(fieldKey, 'right', parseFloat(e.target.value))}
              className="w-full accent-[#c9a84c]"
            />
          </div>
          <div className="space-y-1 col-span-2">
             <label className="text-[10px] text-[#8a8578]">حجم الخط (px)</label>
             <input 
              type="range" 
              min="8" max="48" step="1" 
              value={settings[fieldKey].fontSize || 14}
              onChange={(e) => updateField(fieldKey, 'fontSize', parseInt(e.target.value))}
              className="w-full accent-[#c9a84c]"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderPrintLayer = (isForScreen: boolean) => {
    // 21.50cm x 16.50cm ratio
    const scale = isForScreen ? 0.8 : 1; 
    
    return (
      <div 
        id={isForScreen ? "preview-area" : "print-area"}
        style={{
          width: '21.50cm',
          height: '16.50cm',
          position: isForScreen ? 'relative' : 'fixed',
          left: isForScreen ? 'auto' : 0,
          top: isForScreen ? 'auto' : 0,
          backgroundColor: isForScreen ? 'white' : 'transparent',
          transform: isForScreen ? `scale(${scale})` : 'none',
          transformOrigin: 'top center',
          boxShadow: isForScreen ? '0 0 20px rgba(0,0,0,0.5)' : 'none',
          color: 'black',
          margin: isForScreen ? '0 auto' : '0',
          overflow: 'hidden',
          zIndex: isForScreen ? 1 : 99999,
          direction: 'rtl'
        }}
        className={isForScreen ? "print-preview-box" : "print-actual-layer"}
      >
        {/* Helper Grid for screen only */}
        {isForScreen && (
          <div className="absolute inset-0 pointer-events-none opacity-10" 
               style={{ backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '1cm 1cm' }} />
        )}

        {settings.date.show && (
          <div style={{ position: 'absolute', top: `${settings.date.top}cm`, right: `${settings.date.right}cm`, fontSize: `${settings.date.fontSize}px`, fontWeight: 'bold' }}>
            {printEntry.date}
          </div>
        )}
        
        {settings.accountName.show && (
          <div style={{ position: 'absolute', top: `${settings.accountName.top}cm`, right: `${settings.accountName.right}cm`, fontSize: `${settings.accountName.fontSize}px`, fontWeight: 'bold' }}>
            {printEntry.credit && printEntry.debit ? `${printEntry.debit} / ${printEntry.credit}` : printEntry.credit || printEntry.debit}
          </div>
        )}

        {settings.cash.show && printEntry.cash && parseFloat(printEntry.cash) > 0 && (
          <div style={{ position: 'absolute', top: `${settings.cash.top}cm`, right: `${settings.cash.right}cm`, fontSize: `${settings.cash.fontSize}px`, fontWeight: 'bold' }}>
            {formatCashAmount(parseFloat(printEntry.cash))} ج.م
          </div>
        )}

        {settings.weight.show && printEntry.weight && parseFloat(printEntry.weight) > 0 && (
          <div style={{ position: 'absolute', top: `${settings.weight.top}cm`, right: `${settings.weight.right}cm`, fontSize: `${settings.weight.fontSize}px`, fontWeight: 'bold' }}>
            {parseFloat(printEntry.weight).toFixed(2)} ج
          </div>
        )}

        {settings.carat.show && printEntry.karat && (
          <div style={{ position: 'absolute', top: `${settings.carat.top}cm`, right: `${settings.carat.right}cm`, fontSize: `${settings.carat.fontSize}px`, fontWeight: 'bold' }}>
            عيار {printEntry.karat}
          </div>
        )}

        {settings.notes.show && printEntry.notes && (
          <div style={{ position: 'absolute', top: `${settings.notes.top}cm`, right: `${settings.notes.right}cm`, fontSize: `${settings.notes.fontSize}px`, fontWeight: 'bold' }}>
            {printEntry.notes}
          </div>
        )}
      </div>
    );
  };

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 hide-on-print">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#0e1018] border border-[#2a2e3a] rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl"
        >
          {/* Settings Sidebar */}
          <div className="w-full md:w-[400px] bg-[#080a0f] border-l border-[#2a2e3a] flex flex-col h-full overflow-hidden shrink-0">
            <div className="p-5 border-b border-[#2a2e3a] flex justify-between items-center bg-[#0e1018] relative z-10">
              <div>
                <h3 className="text-xl font-bold text-[#c9a84c] flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5" />
                  مفعايرة الطباعة (سطامبة)
                </h3>
                <p className="text-[10px] text-[#8a8578] mt-1">مقاس القالب: 21.5سم × 16.5سم</p>
              </div>
              <button 
                onClick={() => setPrintEntry(null)}
                className="p-2 bg-[#1a1e2a] hover:bg-red-500/20 text-[#8a8578] hover:text-red-400 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-right">
              <FieldEditor fieldKey="date" title="التاريخ" />
              <FieldEditor fieldKey="accountName" title="اسم العميل/الحساب" />
              <FieldEditor fieldKey="cash" title="المبلغ (جنيه)" />
              <FieldEditor fieldKey="weight" title="الوزن (جرام)" />
              <FieldEditor fieldKey="carat" title="العيار" />
              <FieldEditor fieldKey="notes" title="البيان/الملاحظات" />
              
              <div className="pt-4 border-t border-[#2a2e3a] flex items-center gap-3">
                <button
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="px-4 py-3 bg-[#1a1e2a] text-[#8a8578] text-xs font-bold rounded-xl hover:bg-[#2a2e3a] transition-all"
                >
                  استعادة الافتراضي
                </button>
              </div>
            </div>

            <div className="p-5 border-t border-[#2a2e3a] bg-[#0e1018]">
              <button
                onClick={handlePrint}
                className="w-full gold-button py-4 flex items-center justify-center gap-2 text-sm font-bold shadow-lg"
              >
                <Printer className="w-5 h-5" />
                طباعة الفاتورة الآن
              </button>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex-1 bg-black/40 overflow-auto p-4 flex flex-col items-center justify-start hide-on-print">
            <div className="w-full max-w-max mx-auto shadow-2xl rounded-sm overflow-hidden bg-white/5 relative">
              <div className="absolute top-2 right-2 z-10 bg-black/80 px-2 py-1 rounded text-white text-[10px]">
                معاينة تقريبية (خلفية الورقة)
              </div>
              {renderPrintLayer(true)}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Actual print layer rendered outside #root via Portal */}
      {createPortal(
        renderPrintLayer(false),
        document.body
      )}
    </>
  );
};
