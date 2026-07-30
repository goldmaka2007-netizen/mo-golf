import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Image as ImageIcon, Settings2, Coins, Package, X } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';

// --- Configuration & Constants ---

const BULLION_LIST = [
  { weight: 0.25, label: '0.25 جرام' },
  { weight: 0.5, label: '0.50 جرام' },
  { weight: 1, label: '1 جرام' },
  { weight: 2.5, label: '2.5 جرام' },
  { weight: 5, label: '5 جرام' },
  { weight: 10, label: '10 جرام' },
];

const COIN_LIST = [
  { weight: 8, label: 'جنيه ذهب 8 جرام' },
  { weight: 4, label: 'نصف جنيه 4 جرام' },
  { weight: 2, label: 'ربع جنيه 2 جرام' },
];

const CUSTOMER_MSG_DEFAULT = 'نتعهد بأن هذه الاسعار الحقيقية للسوق المصري و ليس لنا علاقة باي اسعار اخري ولا يوجد خصم من سعر الشراء للسبائك و المشغولات تقديرية حسب سياسة الخصم الخاصة بكل مصنع';

// --- Canvas Drawing Logic ---

interface StoryData {
  p24Sell: number; p24Buy: number;
  p21Sell: number; p21Buy: number;
  p18Sell: number; p18Buy: number;
  silverSwissSell: number; silverSwissBuy: number;
  bullionCharges: Record<number, number>;
  coinCharges: Record<number, number>;
  customerMessage: string;
}

const drawSectionHeader = (ctx: CanvasRenderingContext2D, title: string, y: number, centerX: number) => {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a84c'; // Luxury Gold
  ctx.font = 'bold 44px "Tajawal", sans-serif';
  ctx.fillText(title, centerX, y);
  
  const tw = ctx.measureText(title).width;
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
  ctx.lineWidth = 3;
  
  // Decorative lines
  ctx.beginPath();
  ctx.moveTo(centerX - 100, y + 15);
  ctx.lineTo(centerX + 100, y + 15);
  ctx.stroke();

  // Fine accent lines
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - tw/2 - 150, y - 14); ctx.lineTo(centerX - tw/2 - 50, y - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX + tw/2 + 50, y - 14); ctx.lineTo(centerX + tw/2 + 150, y - 14);
  ctx.stroke();
};

const formatPrice = (num: number) => Math.ceil(num / 5) * 5;

const generateStoryCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, data: StoryData) => {
  canvas.dir = 'ltr'; 

  const centerX = canvas.width / 2;
  let currentY = 180;

  // 1. Background & Frame - Luxury Dark
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#0a0c10');
  bgGrad.addColorStop(1, '#020305');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle luxury texture (radial glow)
  const glow = ctx.createRadialGradient(centerX, 500, 0, centerX, 500, 1200);
  glow.addColorStop(0, 'rgba(201, 168, 76, 0.05)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decorative Border
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
  
  // Outer double line
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.08)';
  ctx.lineWidth = 10;
  ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70);

  // Corner Accents
  const cornerSize = 120;
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 4;
  
  // Top-left
  ctx.beginPath(); ctx.moveTo(50, 50 + cornerSize); ctx.lineTo(50, 50); ctx.lineTo(50 + cornerSize, 50); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(canvas.width - 50, 50 + cornerSize); ctx.lineTo(canvas.width - 50, 50); ctx.lineTo(canvas.width - 50 - cornerSize, 50); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(50, canvas.height - 50 - cornerSize); ctx.lineTo(50, canvas.height - 50); ctx.lineTo(50 + cornerSize, canvas.height - 50); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(canvas.width - 50, canvas.height - 50 - cornerSize); ctx.lineTo(canvas.width - 50, canvas.height - 50); ctx.lineTo(canvas.width - 50 - cornerSize, canvas.height - 50); ctx.stroke();

  // 2. Main Branding
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 90px "Tajawal", sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 15;
  ctx.fillText('مكة للذهب والمجوهرات', centerX, currentY);
  ctx.shadowBlur = 0;

  currentY += 65;
  ctx.fillStyle = '#8a8578';
  ctx.font = '500 32px "Tajawal", sans-serif';
  ctx.fillText('تــأســس مـنــذ ٢٠٠٣', centerX, currentY);

  currentY += 100;
  const dateStr = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillStyle = '#ddd8cc';
  ctx.font = '600 40px "Tajawal", sans-serif';
  ctx.fillText(`أسعار اليوم • ${dateStr}`, centerX, currentY);
  
  // Decorative separator
  currentY += 40;
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 200, currentY); ctx.lineTo(centerX + 200, currentY);
  ctx.stroke();
  
  currentY += 80;

  // 3. Karat Prices Section
  drawSectionHeader(ctx, 'الجرام (شراء/بيع)', currentY, centerX);
  currentY += 75;

  const tableWidth = 920;
  const startX = (canvas.width - tableWidth) / 2;
  
  // Table Header
  ctx.fillStyle = 'rgba(201, 168, 76, 0.05)';
  ctx.fillRect(startX, currentY, tableWidth, 75);
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(startX, currentY, tableWidth, 75);
  
  ctx.beginPath();
  ctx.moveTo(startX + tableWidth/ 2.7, currentY); ctx.lineTo(startX + tableWidth/2.7, currentY + 75);
  ctx.moveTo(startX + 2*tableWidth/2.7, currentY); ctx.lineTo(startX + 2*tableWidth/2.7, currentY + 75);
  ctx.stroke();

  ctx.fillStyle = '#8a8578';
  ctx.font = 'bold 30px "Tajawal", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('شراء', startX + tableWidth/5.4, currentY + 48);
  ctx.fillText('بيـــــع', startX + tableWidth/2 + 20, currentY + 48);
  ctx.fillText('الصنف', startX + 5.5*tableWidth/6, currentY + 48);
  
  currentY += 75;

  const karats = [
    { label: 'عيار ٢٤', sell: data.p24Sell, buy: data.p24Buy },
    { label: 'عيار ٢١', sell: data.p21Sell, buy: data.p21Buy },
    { label: 'عيار ١٨', sell: data.p18Sell, buy: data.p18Buy },
  ];

  karats.forEach((k, i) => {
    const rowHeight = 90;
    ctx.fillStyle = i % 2 === 0 ? 'transparent' : 'rgba(201, 168, 76, 0.03)';
    ctx.fillRect(startX, currentY, tableWidth, rowHeight);
    
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.15)';
    ctx.strokeRect(startX, currentY, tableWidth, rowHeight);

    ctx.beginPath();
    ctx.moveTo(startX + tableWidth/2.7, currentY); ctx.lineTo(startX + tableWidth/2.7, currentY + rowHeight);
    ctx.moveTo(startX + 2*tableWidth/2.7, currentY); ctx.lineTo(startX + 2*tableWidth/2.7, currentY + rowHeight);
    ctx.stroke();

    ctx.textAlign = 'center';
    
    ctx.fillStyle = '#ddd8cc';
    ctx.font = 'bold 42px "JetBrains Mono", sans-serif';
    ctx.fillText(k.buy.toLocaleString(undefined, { maximumFractionDigits: 0 }), startX + tableWidth/5.4, currentY + 58);
    
    ctx.fillStyle = '#c9a84c';
    ctx.font = 'bold 48px "JetBrains Mono", sans-serif';
    ctx.fillText(k.sell.toLocaleString(undefined, { maximumFractionDigits: 0 }), startX + tableWidth/2 + 20, currentY + 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Tajawal", sans-serif';
    ctx.fillText(k.label, startX + 5.5*tableWidth/6, currentY + 56);

    currentY += rowHeight;
  });

  currentY += 60;

  // 4. Bullion Section
  drawSectionHeader(ctx, 'السبائك والجنيهات', currentY, centerX);
  currentY += 70;
  
  const bRowHeight = 70;
  const bTableWidth = 920;
  const bStartX = (canvas.width - bTableWidth) / 2;
  const halfTable = bTableWidth / 2;

  // Combine items to a compact list for 2-column display
  const allItems = [
    ...BULLION_LIST.map(b => ({ label: `سبيكة ${b.label}`, weight: b.weight, type: 'bullion' })),
    ...COIN_LIST.map(c => ({ label: c.label, weight: c.weight, type: 'coin' }))
  ];

  for(let row = 0; row < Math.ceil(allItems.length/2); row++) {
    ctx.fillStyle = row % 2 === 0 ? 'transparent' : 'rgba(201, 168, 76, 0.03)';
    ctx.fillRect(bStartX, currentY, bTableWidth, bRowHeight);
    
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.1)';
    ctx.strokeRect(bStartX, currentY, bTableWidth, bRowHeight);

    ctx.beginPath();
    ctx.moveTo(bStartX + halfTable, currentY); ctx.lineTo(bStartX + halfTable, currentY + bRowHeight);
    ctx.stroke();

    for(let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      if (idx < allItems.length) {
        const item = allItems[idx];
        const charges = item.type === 'bullion' ? data.bullionCharges : data.coinCharges;
        const basePrice = item.type === 'bullion' ? data.p24Sell : data.p21Sell;
        const charge = charges[item.weight] || 0;
        const finalPrice = formatPrice(item.weight * (basePrice + charge));

        const xPos = bStartX + (col === 0 ? halfTable : 0);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#8a8578';
        ctx.font = 'bold 26px "Tajawal", sans-serif';
        ctx.fillText(item.label, xPos + halfTable - 20, currentY + 44);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#c9a84c';
        ctx.font = 'bold 32px "JetBrains Mono", sans-serif';
        ctx.fillText(finalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 }), xPos + 20, currentY + 46);
      }
    }
    currentY += bRowHeight;
  }
  
  currentY += 60;

  // 5. Silver
  ctx.fillStyle = 'rgba(138, 133, 120, 0.05)';
  ctx.fillRect(bStartX, currentY, bTableWidth, 80);
  ctx.strokeStyle = 'rgba(106, 138, 158, 0.3)';
  ctx.strokeRect(bStartX, currentY, bTableWidth, 80);
  
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6a8a9e';
  ctx.font = 'bold 30px "Tajawal", sans-serif';
  ctx.fillText('الفضة (ش/ب): ', bStartX + bTableWidth - 150, currentY + 50);
  
  ctx.fillStyle = '#ddd8cc';
  ctx.font = 'bold 36px "JetBrains Mono", sans-serif';
  ctx.fillText(`${data.silverSwissBuy.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${data.silverSwissSell.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, bStartX + 250, currentY + 50);

  currentY += 120;

  // 6. Message Box
  if (data.customerMessage) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a8578';
    ctx.font = 'italic 500 28px "Tajawal", sans-serif';
    
    const words = data.customerMessage.split(' ');
    let line = '';
    let yPos = currentY;
    const maxWidth = 800;
    const lineHeight = 42;
    
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, centerX, yPos);
        line = words[n] + ' ';
        yPos += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, centerX, yPos);
    currentY = yPos + 60;
  }

  // 7. Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9a84c';
  ctx.font = 'bold 34px "Tajawal", sans-serif';
  ctx.fillText('مكة للذهب والمجوهرات', centerX, canvas.height - 180);
  
  ctx.fillStyle = '#5a5548';
  ctx.font = 'bold 22px "Tajawal", sans-serif';
  ctx.fillText('الأسعار استرشادية وتتحدد بدقة عند التنفيذ الفعلي', centerX, canvas.height - 135);
};

// --- Main Component ---

export const StoryBuilderView = () => {
  const store = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [customerMessage, setCustomerMessage] = useState(CUSTOMER_MSG_DEFAULT);
  const storyRef = useRef<HTMLDivElement>(null);

  // Derived Prices
  const p21Sell = store.goldPrice || 3500;
  const p24Sell = Math.round((p21Sell / 21) * 24);
  const p18Sell = Math.round((p21Sell / 21) * 18);

  const p21Buy = store.goldBuyPrice || (p21Sell - 20);
  const p24Buy = Math.round((p21Buy / 21) * 24);
  const p18Buy = Math.round((p21Buy / 21) * 18);

  const silverSwissSell = store.silverPrice || 50;
  const silverSwissBuy = store.silverBuyPrice || 48;

  const currentBullionCharges = store.bullionCharges || {};
  const currentCoinCharges = store.coinCharges || {};

  const handleManualCapture = async () => {
    setIsProcessing(true);
    setCapturedImage(null);

    // Create virtual canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      try {
        const storyData: StoryData = {
          p24Sell, p24Buy, p21Sell, p21Buy, p18Sell, p18Buy,
          silverSwissSell, silverSwissBuy,
          bullionCharges: currentBullionCharges,
          coinCharges: currentCoinCharges,
          customerMessage
        };
        
        generateStoryCanvas(canvas, ctx, storyData);
        setCapturedImage(canvas.toDataURL('image/png', 1.0));
      } catch (err) {
        console.error(err);
        alert('حدث خطأ فني أثناء إنشاء الصورة، يرجى المحاولة مرة أخرى.');
      }
    }
    setIsProcessing(false);
  };

  const updateBullionCharge = (weight: number, val: string) => {
    const newCharges = { ...currentBullionCharges };
    newCharges[weight] = parseFloat(val) || 0;
    store.setBullionCharges(newCharges);
  };

  const updateCoinCharge = (weight: number, val: string) => {
    const newCharges = { ...currentCoinCharges };
    newCharges[weight] = parseFloat(val) || 0;
    store.setCoinCharges(newCharges);
  };

  // --- Quick Components for Clean Render ---
  const PriceDisplayCard = ({ title, sell, buy, ringColor }: { title: string, sell: number, buy: number, ringColor: string }) => (
    <div className={`bg-[#1a1e2a] rounded-xl p-3 text-center border ${ringColor}`}>
      <div className="text-[10px] text-[#8a8578] font-bold mb-1">{title}</div>
      <div className="text-xs font-bold text-[#6a9e6a] mb-1">ش: {buy.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
      <div className="text-sm font-bold text-[#c9a84c] font-mono">{sell.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Captured Image Modal */}
      <AnimatePresence>
        {capturedImage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 flex-col gap-4 overflow-y-auto"
          >
            <div className="w-full max-w-sm text-center space-y-4 font-sans" style={{ direction: 'rtl' }}>
              <div className="p-4 bg-[#1a1e2a] rounded-3xl border border-[#c9a84c33] shadow-2xl relative">
                <button onClick={() => setCapturedImage(null)} className="absolute top-4 right-4 p-2 rounded-full bg-[#c9a84c11] text-[#c9a84c] hover:bg-[#c9a84c22] transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <div className="w-14 h-14 bg-[#c9a84c11] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#c9a84c22]">
                  <ImageIcon className="w-7 h-7 text-[#c9a84c]" />
                </div>
                <h3 className="text-xl font-bold text-[#c9a84c] mb-1">جاهز للمشاركة</h3>
                <p className="text-xs text-[#8a8578] mb-6 leading-relaxed">
                  <span className="text-[#ddd8cc] font-bold">لمستخدمي الايفون:</span> اضغط مطولاً على الصورة ثم اختر <span className="text-[#c9a84c]">"حفظ في الصور"</span>.
                </p>
                <img src={capturedImage} alt="Story Result" className="rounded-2xl shadow-2xl border border-[#ffffff11] w-full object-contain mb-6 pointer-events-auto ring-1 ring-white/10" />
                <button onClick={() => setCapturedImage(null)} className="w-full py-4 bg-[#c9a84c] text-[#080a0f] rounded-2xl font-bold shadow-[0_4px_20px_rgba(201,168,76,0.3)] flex items-center justify-center gap-2 hover:bg-[#e5d08f] transition-all">
                  إغلاق
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Left Side: Settings Panel */}
        <div className="flex-1 space-y-6">
          <div className="bg-[#0e1018] rounded-3xl p-6 border border-[#1a1e2a] shadow-2xl">
            <h3 className="text-xl font-bold text-[#ddd8cc] mb-6 flex items-center gap-3">
              <div className="p-2 bg-[#c9a84c11] rounded-xl">
                <Settings2 className="w-6 h-6 text-[#c9a84c]" />
              </div>
              تخصيص البيانات
            </h3>
            
            <div className="grid grid-cols-3 gap-3 mb-8">
              <PriceDisplayCard title="ع 18" sell={p18Sell} buy={p18Buy} ringColor="border-[#1a1e2a]" />
              <PriceDisplayCard title="ع 21" sell={p21Sell} buy={p21Buy} ringColor="border-[#c9a84c22]" />
              <PriceDisplayCard title="ع 24" sell={p24Sell} buy={p24Buy} ringColor="border-[#6a8a9e22]" />
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-[#8a8578] mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Package className="w-4 h-4 text-[#c9a84c]" /> مصنعية الســــبائك (جم / ع 24)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {BULLION_LIST.map((b, idx) => (
                    <div key={idx} className="bg-[#1a1e2a]/30 border border-[#1a1e2a] rounded-xl p-2 flex items-center gap-2">
                       <span className="text-[10px] font-bold text-[#5a5548] min-w-[35px] text-center border-l border-[#1a1e2a] pl-2">{b.weight}ج</span>
                       <input
                        type="number"
                        value={currentBullionCharges[b.weight] || ''}
                        onChange={(e) => updateBullionCharge(b.weight, e.target.value)}
                        className="w-full bg-transparent text-xs text-[#ddd8cc] font-mono outline-none placeholder:text-[#3a3530]"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#8a8578] mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Coins className="w-4 h-4 text-[#c9a84c]" /> الجنيــــهات (جم / ع 21)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {COIN_LIST.map((c, idx) => (
                    <div key={idx} className="bg-[#1a1e2a]/30 border border-[#1a1e2a] rounded-xl p-2 flex items-center gap-2">
                       <span className="text-[10px] font-bold text-[#5a5548] min-w-[100px] text-right border-l border-[#1a1e2a] pl-2">{c.label}</span>
                       <input
                        type="number"
                        value={currentCoinCharges[c.weight] || ''}
                        onChange={(e) => updateCoinCharge(c.weight, e.target.value)}
                        className="w-full bg-transparent text-xs text-[#ddd8cc] font-mono outline-none placeholder:text-[#3a3530]"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#8a8578] mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Share2 className="w-4 h-4 text-[#c9a84c]" /> رسالة العميل
                </h4>
                <textarea
                  value={customerMessage}
                  onChange={(e) => setCustomerMessage(e.target.value)}
                  className="w-full bg-[#1a1e2a]/30 border border-[#1a1e2a] rounded-2xl p-4 text-xs text-[#ddd8cc] outline-none focus:border-[#c9a84c33] h-28 resize-none transition-all leading-relaxed"
                  placeholder="اكتب هنا ملاحظات إضافية تظهر أسفل الصورة..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Preview & Export Panel */}
        <div className="flex-1 flex flex-col items-center gap-6">
          <div className="bg-[#0a0c10] p-2 rounded-[32px] border border-[#1a1e2a] shadow-2xl w-full max-w-[380px] ring-1 ring-white/5">
            <div ref={storyRef} className="relative w-full aspect-[9/16] bg-[#0a0c10] rounded-[26px] overflow-hidden flex flex-col p-6 shadow-inner" style={{ direction: 'rtl', fontFamily: '"Tajawal", sans-serif' }}>
              
              {/* Background Glow */}
              <div className="absolute inset-0 bg-radial from-[#c9a84c11] to-transparent opacity-50" />
              
              {/* Luxury Frame Corner Accents */}
              <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-[#c9a84c] rounded-tl-lg pointer-events-none" />
              <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-[#c9a84c] rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-[#c9a84c] rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-[#c9a84c] rounded-br-lg pointer-events-none" />

              <div className="text-center z-10 mb-8 mt-4">
                <h2 className="text-3xl font-extrabold text-[#c9a84c] mb-1 tracking-tight drop-shadow-[0_2px_10px_rgba(201,168,76,0.3)]">مكة للذهب والمجوهرات</h2>
                <div className="text-[11px] text-[#8a8578] font-bold tracking-widest mb-4">تأسس منذ ٢٠٠٣</div>
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#c9a84c]/5 border border-[#c9a84c15] text-[#ddd8cc] text-[11px] font-bold shadow-lg shadow-black/40">
                   أسعار اليوم • {new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className="space-y-4 z-10 flex-1 overflow-hidden">
                <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-[#c9a84c11] p-4 shadow-xl">
                  <div className="grid grid-cols-3 text-[10px] text-[#8a8578] font-bold mb-3 text-center pb-2 border-b border-[#c9a84c11]">
                    <span>شراء</span><span>بيــــع</span><span>الصنف</span>
                  </div>
                  {[
                    { label: 'عيار ٢٤', sell: p24Sell, buy: p24Buy },
                    { label: 'عيار ٢١', sell: p21Sell, buy: p21Buy },
                    { label: 'عيار ١٨', sell: p18Sell, buy: p18Buy },
                  ].map((k, idx) => (
                    <div key={idx} className="grid grid-cols-3 text-center py-2.5 border-b border-white/5 last:border-0 items-center">
                      <span className="text-[#ddd8cc] font-bold font-mono text-sm">{k.buy.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="font-bold font-mono text-lg text-[#c9a84c]">{k.sell.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-[#ffffff] text-[13px] font-bold">{k.label}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-[#c9a84c11] p-4 shadow-xl">
                  <h3 className="text-center text-[10px] font-bold text-[#c9a84c] mb-3 flex items-center justify-center gap-2 tracking-widest uppercase pb-1 border-b border-[#c9a84c11]">
                    السبائك والجنيهات
                  </h3>
                  <div className="grid grid-cols-1 gap-2 text-right overflow-hidden max-h-[320px]">
                    {[
                      ...BULLION_LIST.map(b => ({ label: `سبيكة ${b.label}`, weight: b.weight, type: 'bullion' })),
                      ...COIN_LIST.map(c => ({ label: c.label, weight: c.weight, type: 'coin' }))
                    ].slice(0, 9).map((item, i) => {
                      const charges = item.type === 'bullion' ? currentBullionCharges : currentCoinCharges;
                      const basePrice = item.type === 'bullion' ? p24Sell : p21Sell;
                      const charge = charges[item.weight] || 0;
                      const finalPrice = formatPrice(item.weight * (basePrice + charge));
                      return (
                        <div key={i} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-1">
                          <span className="text-[#8a8578] font-bold">{item.label}</span>
                          <span className="font-mono text-[#c9a84c] font-bold">{finalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} ج</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-[#6a8a9e22] p-4 shadow-xl flex justify-between items-center ring-1 ring-[#6a8a9e11]">
                   <span className="text-xs font-bold text-[#6a8a9e]">سعر جرام الفضة:</span>
                   <span className="text-[13px] font-mono font-bold text-[#ddd8cc]">{silverSwissBuy.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {silverSwissSell.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>

                {customerMessage && (
                  <div className="mt-2 p-3 bg-[#c9a84c]/5 border border-[#c9a84c11] rounded-xl text-center">
                    <p className="text-[10px] text-[#8a8578] font-medium leading-relaxed italic">{customerMessage}</p>
                  </div>
                )}
              </div>
              
              <div className="z-10 mt-auto text-center pt-6 border-t border-[#c9a84c11]">
                <p className="text-[10px] text-[#5a5548] mb-1 font-bold underline decoration-[#c9a84c33]">الأسعار استرشادية وتتحدد بدقة وقت التنفيــــذ</p>
                <div className="text-sm text-[#c9a84c] font-black tracking-[0.2em] uppercase">Makkah Jewelry</div>
              </div>
            </div>
          </div>

          <button 
            onClick={handleManualCapture}
            disabled={isProcessing}
            className={cn(
              "flex items-center justify-center gap-3 bg-gradient-to-r from-[#c9a84c] to-[#9a7830] text-[#0f172a] px-10 py-5 rounded-2xl text-xl font-bold transition-all shadow-[0_10px_30px_rgba(201,168,76,0.25)] w-full max-w-[380px] hover:-translate-y-1 active:scale-95",
              isProcessing ? "opacity-50 cursor-not-allowed hover:translate-y-0" : ""
            )}
          >
            {isProcessing ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-[#0f172a] border-t-transparent rounded-full" />
                جاري التجهيز...
              </>
            ) : (
              <>
                <ImageIcon className="w-6 h-6" />
                حفظ الصورة للواتساب
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
