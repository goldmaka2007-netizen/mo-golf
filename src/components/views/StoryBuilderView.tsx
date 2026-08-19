import React, { useEffect, useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Share2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { APPROVED_BULLION_UNIT_WEIGHTS, APPROVED_COIN_UNIT_WEIGHTS, workmanshipForUnitWeight } from '../../lib/goldPricingAssistant';

const BULLION_LIST = APPROVED_BULLION_UNIT_WEIGHTS.map(weight => ({ weight, label: `${weight} جم` }));
const COIN_LIST = APPROVED_COIN_UNIT_WEIGHTS.map(weight => ({ weight, label: `جنيه ذهب ${weight} جم` }));
const CUSTOMER_MSG_DEFAULT = 'نتعهد بأن هذه الاسعار الحقيقية للسوق المصري و ليس لنا علاقة باي اسعار اخري ولا يوجد خصم من سعر الشراء للسبائك و المشغولات تقديرية حسب سياسة الخصم الخاصة بكل مصنع';
const FACEBOOK_PAGE_NAME = 'مكة للمصوغات والمجوهرات';
const FACEBOOK_QR_SRC = '/facebook-page-qr.png';

interface StoryData {
  p24Sell: number;
  p24Buy: number;
  p21Sell: number;
  p21Buy: number;
  p18Sell: number;
  p18Buy: number;
  silverSwissSell: number;
  silverSwissBuy: number;
  bullionCharges: Record<number, number>;
  coinCharges: Record<number, number>;
  customerMessage: string;
}

const formatPrice = (num: number) => Math.ceil(num / 5) * 5;

const roundedPanel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 24,
  fill = 'rgba(8, 10, 15, 0.84)',
  stroke = 'rgba(201, 168, 76, 0.45)',
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Unable to load story asset: ${src}`));
  image.src = src;
});

const wrapCenteredText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  lines.forEach((value, index) => ctx.fillText(value, centerX, startY + (index * lineHeight)));
  return lines.length;
};

const generateStoryCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  data: StoryData,
  facebookQr: HTMLImageElement,
) => {
  canvas.dir = 'ltr';
  const centerX = canvas.width / 2;
  const contentX = 64;
  const contentWidth = canvas.width - (contentX * 2);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#0b0d12');
  bg.addColorStop(0.58, '#05070a');
  bg.addColorStop(1, '#020304');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const topGlow = ctx.createRadialGradient(centerX, 240, 20, centerX, 240, 900);
  topGlow.addColorStop(0, 'rgba(201, 168, 76, 0.12)');
  topGlow.addColorStop(1, 'rgba(201, 168, 76, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, 900);

  ctx.strokeStyle = 'rgba(201, 168, 76, 0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(42, 42, canvas.width - 84, canvas.height - 84);
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.1)';
  ctx.lineWidth = 10;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

  const corner = 112;
  ctx.strokeStyle = '#d5ae4e';
  ctx.lineWidth = 5;
  [[42, 42, 1, 1], [canvas.width - 42, 42, -1, 1], [42, canvas.height - 42, 1, -1], [canvas.width - 42, canvas.height - 42, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + (dy * corner));
    ctx.lineTo(x, y);
    ctx.lineTo(x + (dx * corner), y);
    ctx.stroke();
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8b24f';
  ctx.font = 'bold 78px "Tajawal", sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 18;
  ctx.fillText('مكة للذهب والمجوهرات', centerX, 148);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#a69d8d';
  ctx.font = '600 28px "Tajawal", sans-serif';
  ctx.fillText('تأسس منذ ٢٠٠٣', centerX, 202);

  const dateStr = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  roundedPanel(ctx, 245, 228, 590, 62, 31, 'rgba(201, 168, 76, 0.045)', 'rgba(201, 168, 76, 0.35)');
  ctx.fillStyle = '#ddd8cc';
  ctx.font = '600 30px "Tajawal", sans-serif';
  ctx.fillText(`أسعار اليوم  •  ${dateStr}`, centerX, 269);

  roundedPanel(ctx, contentX, 316, contentWidth, 400, 28);
  ctx.fillStyle = '#d8b24f';
  ctx.font = 'bold 38px "Tajawal", sans-serif';
  ctx.fillText('الجرام (شراء/بيع)', centerX, 365);

  const tableTop = 390;
  const tableHeight = 300;
  const colWidth = contentWidth / 3;
  ctx.strokeStyle = 'rgba(201, 168, 76, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(contentX + colWidth, tableTop); ctx.lineTo(contentX + colWidth, tableTop + tableHeight);
  ctx.moveTo(contentX + (colWidth * 2), tableTop); ctx.lineTo(contentX + (colWidth * 2), tableTop + tableHeight);
  [tableTop + 58, tableTop + 139, tableTop + 220, tableTop + 300].forEach(y => {
    ctx.moveTo(contentX, y); ctx.lineTo(contentX + contentWidth, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#a69d8d';
  ctx.font = 'bold 26px "Tajawal", sans-serif';
  ctx.fillText('شراء', contentX + (colWidth * 0.5), tableTop + 39);
  ctx.fillText('بيع', contentX + (colWidth * 1.5), tableTop + 39);
  ctx.fillText('العيار', contentX + (colWidth * 2.5), tableTop + 39);

  const karats = [
    { label: 'عيار ٢٤', sell: data.p24Sell, buy: data.p24Buy },
    { label: 'عيار ٢١', sell: data.p21Sell, buy: data.p21Buy },
    { label: 'عيار ١٨', sell: data.p18Sell, buy: data.p18Buy },
  ];
  karats.forEach((karat, index) => {
    const y = tableTop + 111 + (index * 81);
    ctx.font = 'bold 38px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f0eee9';
    ctx.fillText(karat.buy.toLocaleString(), contentX + (colWidth * 0.5), y);
    ctx.fillStyle = '#d8b24f';
    ctx.font = 'bold 44px "JetBrains Mono", monospace';
    ctx.fillText(karat.sell.toLocaleString(), contentX + (colWidth * 1.5), y + 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 31px "Tajawal", sans-serif';
    ctx.fillText(karat.label, contentX + (colWidth * 2.5), y - 1);
  });

  roundedPanel(ctx, contentX, 738, contentWidth, 570, 28);
  ctx.fillStyle = '#d8b24f';
  ctx.font = 'bold 38px "Tajawal", sans-serif';
  ctx.fillText('السبائك والجنيهات', centerX, 790);

  const allItems = [
    ...BULLION_LIST.map(item => ({ label: `سبيكة ${item.label}`, weight: item.weight, type: 'bullion' as const })),
    ...COIN_LIST.map(item => ({ label: item.label, weight: item.weight, type: 'coin' as const })),
  ];
  const halfWidth = contentWidth / 2;
  const listTop = 818;
  const rowHeight = 76;

  ctx.strokeStyle = 'rgba(201, 168, 76, 0.18)';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(centerX, listTop); ctx.lineTo(centerX, listTop + (rowHeight * 6));
  for (let row = 0; row <= 6; row += 1) {
    ctx.moveTo(contentX, listTop + (rowHeight * row));
    ctx.lineTo(contentX + contentWidth, listTop + (rowHeight * row));
  }
  ctx.stroke();

  allItems.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const isRight = index % 2 === 0;
    const left = isRight ? centerX : contentX;
    const right = left + halfWidth;
    const charges = item.type === 'bullion' ? data.bullionCharges : data.coinCharges;
    const basePrice = item.type === 'bullion' ? data.p24Sell : data.p21Sell;
    const charge = charges[item.weight] || 0;
    const finalPrice = formatPrice(item.weight * (basePrice + charge));
    const y = listTop + 49 + (row * rowHeight);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ddd8cc';
    ctx.font = '600 25px "Tajawal", sans-serif';
    ctx.fillText(item.label, right - 24, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8b24f';
    ctx.font = 'bold 31px "JetBrains Mono", monospace';
    ctx.fillText(finalPrice.toLocaleString(), left + 24, y + 1);
  });

  ctx.textAlign = 'center';
  roundedPanel(ctx, contentX, 1326, contentWidth, 100, 24, 'rgba(9, 12, 16, 0.92)', 'rgba(106, 138, 158, 0.45)');
  ctx.fillStyle = '#8ea8b8';
  ctx.font = 'bold 29px "Tajawal", sans-serif';
  ctx.fillText('الفضة (شراء/بيع)', centerX + 210, 1367);
  ctx.fillStyle = '#f0eee9';
  ctx.font = 'bold 38px "JetBrains Mono", monospace';
  ctx.fillText(`${data.silverSwissBuy.toLocaleString()} / ${data.silverSwissSell.toLocaleString()}`, centerX - 170, 1371);

  roundedPanel(ctx, contentX, 1448, contentWidth, 202, 26, 'rgba(201, 168, 76, 0.035)', 'rgba(201, 168, 76, 0.42)');
  ctx.fillStyle = '#d8b24f';
  ctx.font = 'bold 31px "Tajawal", sans-serif';
  ctx.fillText('نلتزم بالشفافية والثقة', centerX, 1490);
  ctx.fillStyle = '#ddd8cc';
  ctx.font = '500 23px "Tajawal", sans-serif';
  const disclaimerLines = wrapCenteredText(ctx, data.customerMessage, centerX, 1528, 820, 33);
  const noteY = Math.min(1636, 1528 + (disclaimerLines * 33) + 12);
  ctx.fillStyle = '#b99847';
  ctx.font = 'bold 21px "Tajawal", sans-serif';
  ctx.fillText('الأسعار استرادية وتتصدٯ بدقه عند التنفيذال القعلي', centerX, noteY);

  roundedPanel(ctx, contentX, 1670, contentWidth, 200, 26, 'rgba(7, 9, 13, 0.94)', 'rgba(201, 168, 76, 0.55)');

  ctx.beginPath();
  ctx.arc(contentX + 78, 1770, 48, 0, Math.PI * 2);
  const fbGlow = ctx.createLinearGradient(contentX + 30, 1722, contentX + 126, 1818);
  fbGlow.addColorStop(0, '#f0cc6b');
  fbGlow.addColorStop(1, '#a77b24');
  ctx.fillStyle = fbGlow;
  ctx.fill();
  ctx.fillStyle = '#0b0d12';
  ctx.font = 'bold 66px Arial, sans-serif';
  ctx.fillText('f', contentX + 78, 1794);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#d8b24f';
  ctx.font = 'bold 29px "Tajawal", sans-serif';
  ctx.fillText('تابع صفحتنا على فيسبوك', 700, 1728);
  ctx.fillStyle = '#ddd8cc';
  ctx.font = '500 21px "Tajawal", sans-serif';
  ctx.fillText('اعمل لايك وتابعنا ليصلك كل جديد', 700, 1773);
  ctx.fillStyle = '#d8b24f';
  ctx.font = 'bold 24px "Tajawal", sans-serif';
  ctx.fillText(FACEBOOK_PAGE_NAME, 700, 1822);

  const qrSize = 190;
  const qrX = 790;
  const qrY = 1675;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 14);
  ctx.fill();
  ctx.drawImage(facebookQr, qrX, qrY, qrSize, qrSize);
};

const renderStoryBlob = async (data: StoryData) => {
  if ('fonts' in document) await document.fonts.ready;
  const facebookQr = await loadImage(FACEBOOK_QR_SRC);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  generateStoryCanvas(canvas, ctx, data, facebookQr);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG generation failed')), 'image/png', 1);
  });
  return blob;
};

const storyFilename = () => {
  const now = new Date();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `makk-prices-${localDate}.png`;
};

export const StoryBuilderView = () => {
  const store = useAppStore();
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState('');

  const p21Sell = store.goldPrice || 3500;
  const p24Sell = Math.round((p21Sell / 21) * 24);
  const p18Sell = Math.round((p21Sell / 21) * 18);
  const p21Buy = store.goldBuyPrice || (p21Sell - 20);
  const p24Buy = Math.round((p21Buy / 21) * 24);
  const p18Buy = Math.round((p21Buy / 21) * 18);
  const silverSwissSell = store.silverPrice || 50;
  const silverSwissBuy = store.silverBuyPrice || 48;

  const currentBullionCharges = useMemo(() => Object.fromEntries(
    BULLION_LIST.map(item => [
      item.weight,
      workmanshipForUnitWeight(store.pricingConfig.bullionWorkmanshipByWeight[String(item.weight)], item.weight)?.perGram
        ?? store.bullionCharges?.[item.weight]
        ?? 0,
    ]),
  ), [store.pricingConfig.bullionWorkmanshipByWeight, store.bullionCharges]);

  const currentCoinCharges = useMemo(() => Object.fromEntries(
    COIN_LIST.map(item => [
      item.weight,
      workmanshipForUnitWeight(store.pricingConfig.coinWorkmanshipByWeight[String(item.weight)], item.weight)?.perGram
        ?? store.coinCharges?.[item.weight]
        ?? 0,
    ]),
  ), [store.pricingConfig.coinWorkmanshipByWeight, store.coinCharges]);

  const storyData = useMemo<StoryData>(() => ({
    p24Sell,
    p24Buy,
    p21Sell,
    p21Buy,
    p18Sell,
    p18Buy,
    silverSwissSell,
    silverSwissBuy,
    bullionCharges: currentBullionCharges,
    coinCharges: currentCoinCharges,
    customerMessage: CUSTOMER_MSG_DEFAULT,
  }), [
    p24Sell,
    p24Buy,
    p21Sell,
    p21Buy,
    p18Sell,
    p18Buy,
    silverSwissSell,
    silverSwissBuy,
    currentBullionCharges,
    currentCoinCharges,
  ]);

  useEffect(() => {
    let cancelled = false;
    setIsProcessing(true);
    setError('');
    setStoryBlob(null);

    renderStoryBlob(storyData)
      .then(blob => {
        if (!cancelled) setStoryBlob(blob);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setError('تعذر تجهيز صورة الستوري. جرّب إعادة فقح الصفحة.');
      })
      .finally(() => {
        if (!cancelled) setIsProcessing(false);
      });

    return () => { cancelled = true; };
  }, [storyData]);

  useEffect(() => {
    if (!storyBlob) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(storyBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [storyBlob]);

  const saveStoryImage = () => {
    if (!storyBlob) return;
    const url = URL.createObjectURL(storyBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = storyFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShare = async () => {
    if (!storyBlob || isProcessing) return;
    const file = new File([storyBlob], storyFilename(), { type: 'image/png' });
    let canNativeShare = typeof navigator.share === 'function';
    if (canNativeShare && typeof navigator.canShare === 'function') {
      try {
        canNativeShare = navigator.canShare({ files: [file] });
      } catch {
        canNativeShare = false;
      }
    }

    if (!canNativeShare) {
      saveStoryImage();
      return;
    }

    try {
      await navigator.share({
        files: [file],
        title: 'أسعار مكة للٰهب والمجوهرائ',
      });
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      console.error(shareError);
      saveStoryImage();
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 pb-24" dir="rtl">
      <div className="w-full rounded-3xl border border-[#1a1e2a] bg-[#0e1018] p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#ddd8cc]">حالة واتساب</h3>
            <p className="mt-1 text-xs text-[#8a8578]">الحورة بتتجهيز بلقائيًا من الأسعار وإعدادات المصنعية الحالية.</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c22] bg-[#c9a84c0d]">
            <ImageIcon className="h-5 w-5 text-[#c9a84c]" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[28px] border border-[#c9a84c22] bg-[#07090d] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className="aspect-[9/16] overflow-hidden rounded-[22px] bg-[#05070a]">
            {previewUrl ? (
              <img src={previewUrl} alt="معاينة ستوري أسعار مكة" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[#8a8578]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c9a84c] border-t-transparent" />
                <span className="text-xs font-bold">جاري تجهيز الستوري...</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-auto mt-4 max-w-[430px] rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-center text-xs font-bold text-red-300">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleShare}
          disabled={!storyBlob || isProcessing || !!error}
          className="mx-auto mt-5 flex min-h-14 w-full max-w-[430px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d9b557] to-[#a47b2b] px-6 text-lg font-black text-[#080a0f] shadow-[0_12px_32px_rgba(201,168,76,0.25)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Share2 className="h-5 w-5" />
          {isProcessing ? 'جاري تجهيز الصورة...' : 'مشاركة الصورة'}
        </button>

        {storyBlob && !isProcessing && (
          <button
            type="button"
            onClick={saveStoryImage}
            className="mx-auto mt-2 flex min-h-10 w-full max-w-[430px] items-center justify-center gap-2 rounded-xl text-xs font-bold text-[#8a8578] transition hover:bg-white/5 hover:text-[#ddd8cc]"
          >
            <Download className="h-4 w-4" />
            حفظ نسخة من الصورة
          </button>
        )}
      </div>
    </div>
  );
};
