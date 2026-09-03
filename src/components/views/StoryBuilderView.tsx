import React, { useEffect, useMemo, useState } from 'react';
import { Download, Image as ImageIcon, Share2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { APPROVED_BULLION_UNIT_WEIGHTS, APPROVED_COIN_UNIT_WEIGHTS, goldDisplayPriceRoundedToFive, workmanshipChargeForDisplay } from '../../lib/goldPricingAssistant';
import { calculateStoryGoldBuyPrices } from '../../lib/storyPricing';

const STORY_WIDTH = 1080;
const FULL_STORY_HEIGHT = 1920;
const COMPACT_STORY_HEIGHT = 1920;

const BULLION_LIST = APPROVED_BULLION_UNIT_WEIGHTS.map(weight => ({ weight, label: `${weight} جم` }));
const COIN_LIST = APPROVED_COIN_UNIT_WEIGHTS.map(weight => ({ weight, label: `جنيه ذهب ${weight} جم` }));
type StoryProductItem = { weight: number; label: string };
const CUSTOMER_MSG_DEFAULT = 'نتعهد بأن هذه الاسعار الحقيقية للسوق المصري و ليس لنا علاقة باي اسعار اخري ولا يوجد خصم من سعر الشراء للسبائك و المشغولات تقديرية حسب سياسة الخصم الخاصة بكل مصنع';
const FACEBOOK_PAGE_NAME = 'مكة للمصوغات والمجوهرات';
const CONTACT_ADDRESS = 'مساكن شركة المعمورة، عمارة رقم 4، محل رقم 17، المعمورة البلد';
const CONTACT_WHATSAPP = '+20 15 50326921';
const CONTACT_FACEBOOK_USERNAME = '@makkagoldalex';
const COMPACT_CTA = 'لأحدث أسعار السبائك والجنيهات وقت الطلب، ابعتلنا رسالة على واتساب أو فيسبوك';

export type StoryVariant = 'compact' | 'full';

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

const formatPrice = goldDisplayPriceRoundedToFive;

const roundedPanel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 24,
  fill = '#151f30',
  stroke = 'rgba(216, 178, 79, 0.32)',
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

const wrapCenteredText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const lines = getWrappedTextLines(ctx, text, maxWidth);

  lines.forEach((value, index) => ctx.fillText(value, centerX, startY + (index * lineHeight)));
  return lines.length;
};

const getWrappedTextLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
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
  return lines;
};

type ContactIcon = 'location' | 'whatsapp' | 'facebook';

const drawContactIcon = (
  ctx: CanvasRenderingContext2D,
  type: ContactIcon,
  centerX: number,
  centerY: number,
  size: number,
) => {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.strokeStyle = '#d8b24f';
  ctx.fillStyle = 'rgba(201, 168, 76, 0.12)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'location') {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.95);
    ctx.bezierCurveTo(-size * 0.18, size * 0.55, -size * 0.62, size * 0.12, -size * 0.62, -size * 0.2);
    ctx.arc(0, -size * 0.2, size * 0.62, Math.PI, 0);
    ctx.bezierCurveTo(size * 0.62, size * 0.12, size * 0.18, size * 0.55, 0, size * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -size * 0.2, size * 0.19, 0, Math.PI * 2);
    ctx.fillStyle = '#d8b24f';
    ctx.fill();
  } else if (type === 'whatsapp') {
    ctx.beginPath();
    ctx.arc(0, -size * 0.08, size * 0.58, 0, Math.PI * 2);
    ctx.moveTo(-size * 0.3, size * 0.38);
    ctx.lineTo(-size * 0.58, size * 0.62);
    ctx.lineTo(-size * 0.06, size * 0.48);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8b24f';
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -size * 0.28);
    ctx.bezierCurveTo(-size * 0.42, -size * 0.12, -size * 0.28, size * 0.2, size * 0.02, size * 0.34);
    ctx.bezierCurveTo(size * 0.2, size * 0.44, size * 0.36, size * 0.34, size * 0.3, size * 0.18);
    ctx.lineTo(size * 0.12, size * 0.02);
    ctx.lineTo(-size * 0.02, size * 0.1);
    ctx.bezierCurveTo(-size * 0.16, size * 0.02, -size * 0.26, -size * 0.1, -size * 0.2, -size * 0.18);
    ctx.lineTo(-size * 0.08, -size * 0.28);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#d8b24f';
    ctx.beginPath();
    ctx.moveTo(-size * 0.27, size * 0.68);
    ctx.lineTo(-size * 0.27, -size * 0.16);
    ctx.lineTo(-size * 0.43, -size * 0.16);
    ctx.lineTo(-size * 0.43, -size * 0.46);
    ctx.lineTo(-size * 0.27, -size * 0.46);
    ctx.lineTo(-size * 0.27, -size * 0.59);
    ctx.bezierCurveTo(-size * 0.27, -size * 0.8, -size * 0.1, -size * 0.9, size * 0.16, -size * 0.84);
    ctx.lineTo(size * 0.36, -size * 0.78);
    ctx.lineTo(size * 0.32, -size * 0.45);
    ctx.bezierCurveTo(size * 0.18, -size * 0.49, size * 0.08, -size * 0.48, size * 0.03, -size * 0.4);
    ctx.lineTo(size * 0.03, -size * 0.27);
    ctx.lineTo(size * 0.32, -size * 0.27);
    ctx.lineTo(size * 0.28, size * 0.06);
    ctx.lineTo(size * 0.03, size * 0.06);
    ctx.lineTo(size * 0.03, size * 0.68);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
};

const generateStoryCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, data: StoryData, variant: StoryVariant) => {
  canvas.dir = 'ltr';
  const centerX = canvas.width / 2;
  const contentX = 64;
  const contentWidth = canvas.width - (contentX * 2);
  const cardPadding = 28;
  const cardInnerX = contentX + cardPadding;
  const cardInnerWidth = contentWidth - (cardPadding * 2);
  const rtlFont = '"IBM Plex Sans Arabic", "Tajawal", sans-serif';
  const numericFont = '"JetBrains Mono", monospace';
  const C = { bg: '#081321', surface: '#0f1c2d', elevated: '#142033', primary: '#f4f7fb', secondary: '#a7b3c3', muted: '#718095', gold: '#c9a84c', goldTint: 'rgba(201, 168, 76, 0.10)', buy: '#47d7a5', sell: '#f07f8a', border: '#26364a', goldBorder: 'rgba(201, 168, 76, 0.42)' };
  const V = variant === 'compact'
    ? { ...C, bg: '#08101e', surface: '#0f1b2d', secondary: '#94a3b8', gold: '#e6be68', border: '#1c2e47', goldBorder: 'rgba(230, 190, 104, 0.42)', buy: '#34d399', sell: '#f87171' }
    : C;

  ctx.fillStyle = V.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  const headerTop = variant === 'full' ? 40 : 48;
  const generatedAt = new Date();
  const dateStr = generatedAt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = generatedAt.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (variant === 'compact') {
    ctx.fillStyle = V.primary;
    ctx.font = `bold 46px ${rtlFont}`;
    ctx.fillText('مكة للذهب والمجوهرات', centerX, headerTop + 50);
    ctx.fillStyle = V.secondary;
    ctx.font = `500 26px ${rtlFont}`;
    ctx.fillText('تأسس منذ 1983', centerX, headerTop + 94);
    ctx.fillStyle = V.gold;
    ctx.font = `bold 32px ${rtlFont}`;
    ctx.fillText('أسعار اليوم', centerX, headerTop + 150);
    ctx.fillStyle = V.secondary;
    ctx.font = `500 26px ${rtlFont}`;
    ctx.fillText(`${dateStr}  •  ${timeStr}`, centerX, headerTop + 190);
  } else {
    ctx.fillStyle = V.gold;
    ctx.font = `bold 60px ${rtlFont}`;
    ctx.fillText('مكة', centerX, headerTop + 62);
    ctx.fillRect(centerX - 35, headerTop + 76, 70, 2);
    ctx.fillStyle = V.primary;
    ctx.font = `bold 42px ${rtlFont}`;
    ctx.fillText('مكة للذهب والمجوهرات', centerX, headerTop + 132);
    ctx.fillStyle = V.secondary;
    ctx.font = `500 24px ${rtlFont}`;
    ctx.fillText('تأسس منذ ٢٠٠٣', centerX, headerTop + 170);
    ctx.fillStyle = V.gold;
    ctx.font = `bold 30px ${rtlFont}`;
    ctx.fillText('أسعار اليوم', centerX, headerTop + 220);
    ctx.fillStyle = V.secondary;
    ctx.font = `500 24px ${rtlFont}`;
    ctx.fillText(dateStr, centerX, headerTop + 256);
  }

  const heroY = variant === 'full' ? 300 : 280;
  const heroHeight = variant === 'full' ? 400 : 490;
  roundedPanel(ctx, contentX, heroY, contentWidth, heroHeight, 24, V.surface, V.border);
  ctx.fillStyle = V.gold;
  ctx.font = `bold 32px ${rtlFont}`;
  ctx.fillText('الجرام — شراء / بيع', centerX, heroY + 54);
  const tableTop = heroY + 76;
  const tableHeight = heroHeight - 104;
  const headerHeight = 54;
  const rowHeight = (tableHeight - headerHeight) / 3;
  const heroColumns = [300, 300, cardInnerWidth - 600];
  const buyX = cardInnerX + heroColumns[0] / 2;
  const sellX = cardInnerX + heroColumns[0] + heroColumns[1] / 2;
  const karatX = cardInnerX + heroColumns[0] + heroColumns[1] + heroColumns[2] / 2;
  ctx.strokeStyle = V.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardInnerX + heroColumns[0], tableTop); ctx.lineTo(cardInnerX + heroColumns[0], tableTop + tableHeight);
  ctx.moveTo(cardInnerX + heroColumns[0] + heroColumns[1], tableTop); ctx.lineTo(cardInnerX + heroColumns[0] + heroColumns[1], tableTop + tableHeight);
  [tableTop + headerHeight, tableTop + headerHeight + rowHeight, tableTop + headerHeight + (rowHeight * 2), tableTop + tableHeight].forEach(y => { ctx.moveTo(cardInnerX, y); ctx.lineTo(cardInnerX + cardInnerWidth, y); });
  ctx.stroke();
  ctx.font = `bold 26px ${rtlFont}`;
  ctx.fillStyle = V.buy; ctx.fillText('شراء', buyX, tableTop + 36);
  ctx.fillStyle = V.sell; ctx.fillText('بيع', sellX, tableTop + 36);
  ctx.fillStyle = V.secondary; ctx.fillText('العيار', karatX, tableTop + 36);

  const karats = [
    { label: 'عيار ٢٤', sell: data.p24Sell, buy: data.p24Buy },
    { label: 'عيار ٢١', sell: data.p21Sell, buy: data.p21Buy },
    { label: 'عيار ١٨', sell: data.p18Sell, buy: data.p18Buy },
  ];
  karats.forEach((karat, index) => {
    const isPrimary = karat.label === 'عيار ٢١';
    const rowTop = tableTop + headerHeight + (index * rowHeight);
    const y = rowTop + (rowHeight * 0.67);
    if (isPrimary) {
      ctx.fillStyle = V.goldTint;
      ctx.fillRect(cardInnerX + 1, rowTop + 1, cardInnerWidth - 2, rowHeight - 2);
      ctx.fillStyle = V.gold;
      ctx.fillRect(cardInnerX + cardInnerWidth - 4, rowTop + 1, 3, rowHeight - 2);
    }
    ctx.fillStyle = V.primary;
    ctx.font = `bold ${isPrimary ? (variant === 'full' ? 58 : 62) : (variant === 'full' ? 48 : 52)}px ${numericFont}`;
    ctx.fillText(karat.buy.toLocaleString(), buyX, y);
    ctx.font = `bold ${isPrimary ? (variant === 'full' ? 64 : 68) : (variant === 'full' ? 52 : 56)}px ${numericFont}`;
    ctx.fillText(karat.sell.toLocaleString(), sellX, y + 1);
    ctx.font = `bold ${isPrimary ? 38 : 34}px ${rtlFont}`;
    ctx.fillStyle = isPrimary ? V.gold : V.primary;
    ctx.fillText(karat.label, karatX, y - 1);
  });

  if (variant === 'full') {
    const drawProductSection = (title: string, items: StoryProductItem[], type: 'bullion' | 'coin', y: number, height: number, columns: number) => {
      roundedPanel(ctx, contentX, y, contentWidth, height, 24, V.surface, V.border);
      ctx.textAlign = 'center'; ctx.fillStyle = V.gold; ctx.font = `bold 30px ${rtlFont}`; ctx.fillText(title, centerX, y + 44); ctx.fillRect(centerX - 36, y + 58, 72, 2);
      const rowHeight = type === 'bullion' ? 48 : 40;
      const listTop = y + (type === 'bullion' ? 70 : 68);
      const listInnerX = contentX + 18;
      const listInnerWidth = contentWidth - 36;
      const colWidth = listInnerWidth / columns;
      ctx.strokeStyle = V.border; ctx.lineWidth = 1; ctx.beginPath();
      for (let column = 1; column < columns; column += 1) { ctx.moveTo(listInnerX + (colWidth * column), listTop); ctx.lineTo(listInnerX + (colWidth * column), y + height - 16); }
      const rows = Math.ceil(items.length / columns);
      for (let row = 0; row <= rows; row += 1) { const dividerY = listTop + (rowHeight * row); if (dividerY <= y + height - 16) { ctx.moveTo(listInnerX, dividerY); ctx.lineTo(listInnerX + listInnerWidth, dividerY); } }
      ctx.stroke();
      items.forEach((item, index) => {
        const row = Math.floor(index / columns); const column = index % columns;
        const left = listInnerX + (column * colWidth); const right = left + colWidth;
        const charges = type === 'bullion' ? data.bullionCharges : data.coinCharges;
        const basePrice = type === 'bullion' ? data.p24Sell : data.p21Sell;
        const finalPrice = formatPrice(item.weight * (basePrice + (charges[item.weight] || 0)));
        const itemY = listTop + 34 + (row * rowHeight);
        ctx.textAlign = 'right'; ctx.fillStyle = V.secondary; ctx.font = `600 ${type === 'bullion' ? 21 : 22}px ${rtlFont}`; ctx.fillText(type === 'bullion' ? `سبيكة ${item.label}` : item.label, right - 14, itemY);
        ctx.textAlign = 'left'; ctx.fillStyle = V.primary; ctx.font = `bold ${type === 'bullion' ? 29 : 30}px ${numericFont}`; ctx.fillText(finalPrice.toLocaleString(), left + 14, itemY + 1);
      });
    };
    drawProductSection('السبائك', BULLION_LIST, 'bullion', 720, 310, 2);
    drawProductSection('الجنيهات', COIN_LIST, 'coin', 1046, 240, 1);
  }

  ctx.textAlign = 'center';
  const silverY = variant === 'full' ? 1310 : 800;
  const silverHeight = variant === 'full' ? 92 : 160;
  roundedPanel(ctx, contentX, silverY, contentWidth, silverHeight, 18, V.surface, V.border);
  if (variant === 'compact') {
    ctx.fillStyle = V.gold; ctx.font = `bold 28px ${rtlFont}`; ctx.fillText('الفضة — شراء / بيع', centerX, silverY + 36);
    const silverTableTop = silverY + 52;
    const silverHeaderHeight = 34;
    const silverTableBottom = silverY + silverHeight - 16;
    const silverRowHeight = silverTableBottom - silverTableTop - silverHeaderHeight;
    const silverColumns = [cardInnerWidth / 2, cardInnerWidth / 2];
    const silverBuyX = cardInnerX + silverColumns[0] / 2;
    const silverSellX = cardInnerX + silverColumns[0] + silverColumns[1] / 2;
    ctx.strokeStyle = V.border; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(cardInnerX + silverColumns[0], silverTableTop); ctx.lineTo(cardInnerX + silverColumns[0], silverTableTop + silverHeaderHeight + silverRowHeight);
    ctx.moveTo(cardInnerX, silverTableTop + silverHeaderHeight); ctx.lineTo(cardInnerX + cardInnerWidth, silverTableTop + silverHeaderHeight);
    ctx.stroke();
    ctx.font = `bold 24px ${rtlFont}`;
    ctx.fillStyle = V.buy; ctx.fillText('شراء', silverBuyX, silverTableTop + 24);
    ctx.fillStyle = V.sell; ctx.fillText('بيع', silverSellX, silverTableTop + 24);
    ctx.font = `bold 52px ${numericFont}`; ctx.fillStyle = V.primary;
    ctx.fillText(data.silverSwissBuy.toLocaleString(), silverBuyX, silverTableTop + silverHeaderHeight + 43);
    ctx.fillText(data.silverSwissSell.toLocaleString(), silverSellX, silverTableTop + silverHeaderHeight + 43);
  } else {
    ctx.fillStyle = V.secondary; ctx.font = `bold 25px ${rtlFont}`; ctx.fillText('الفضة — شراء / بيع', centerX + 190, silverY + 38);
    ctx.fillStyle = V.primary; ctx.font = `bold 34px ${numericFont}`; ctx.fillText(`${data.silverSwissBuy.toLocaleString()} / ${data.silverSwissSell.toLocaleString()}`, centerX - 190, silverY + 42);
  }
  if (variant === 'compact') {
    roundedPanel(ctx, contentX, 990, contentWidth, 230, 20, V.elevated, V.goldBorder);
    ctx.fillStyle = V.gold; ctx.font = `bold 42px ${rtlFont}`; wrapCenteredText(ctx, COMPACT_CTA, centerX, 1050, 820, 56);
  }

  const disclaimerY = variant === 'full' ? 1432 : 1250;
  const disclaimerHeight = variant === 'full' ? 140 : 260;
  roundedPanel(ctx, contentX, disclaimerY, contentWidth, disclaimerHeight, 18, V.surface, V.border);
  ctx.fillStyle = V.secondary;
  const disclaimerFontSize = variant === 'compact' ? 35 : 22;
  const disclaimerLineHeight = variant === 'compact' ? 46 : 31;
  ctx.font = `500 ${disclaimerFontSize}px ${rtlFont}`;
  const disclaimerLines = getWrappedTextLines(ctx, data.customerMessage, 830);
  const disclaimerBlockHeight = Math.max(0, (disclaimerLines.length - 1) * disclaimerLineHeight);
  const disclaimerStartY = variant === 'compact'
    ? disclaimerY + ((disclaimerHeight - disclaimerBlockHeight) / 2) + (disclaimerFontSize * 0.8)
    : disclaimerY + 58;
  wrapCenteredText(ctx, data.customerMessage, centerX, disclaimerStartY, 830, disclaimerLineHeight);
  const footerY = variant === 'full' ? 1590 : 1530;
  const footerHeight = variant === 'full' ? 220 : 300;
  roundedPanel(ctx, contentX, footerY, contentWidth, footerHeight, 20, V.surface, V.border);
  const iconX = contentX + contentWidth - 46;
  const textRightX = iconX - 48;
  const rowStep = footerHeight / 3;
  const rowYs = [footerY + (rowStep * 0.5), footerY + (rowStep * 1.5), footerY + (rowStep * 2.5)];
  const contactRows: ContactIcon[] = ['location', 'whatsapp', 'facebook'];
  ctx.direction = 'rtl';
  contactRows.forEach((icon, index) => {
    const y = rowYs[index];
    if (index > 0) { ctx.strokeStyle = V.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(contentX + 28, y - (rowStep / 2)); ctx.lineTo(contentX + contentWidth - 28, y - (rowStep / 2)); ctx.stroke(); }
    drawContactIcon(ctx, icon, iconX, y, variant === 'full' ? 27 : 32);
    ctx.fillStyle = V.primary; ctx.font = `500 ${variant === 'full' ? 20 : 27}px ${rtlFont}`; ctx.direction = 'rtl'; ctx.textAlign = 'right';
    if (icon === 'location') {
      ctx.fillText(CONTACT_ADDRESS, textRightX, y + 8, textRightX - (contentX + 24));
    } else if (icon === 'whatsapp') {
      const label = 'واتساب:'; ctx.fillStyle = V.gold; ctx.fillText(label, textRightX, y + 8); const numberRightX = textRightX - ctx.measureText(label).width - 16; ctx.fillStyle = V.primary; ctx.direction = 'ltr'; ctx.textAlign = 'right'; ctx.fillText(CONTACT_WHATSAPP, numberRightX, y + 8);
    } else {
      const label = 'فيسبوك:'; ctx.fillStyle = V.gold; ctx.fillText(label, textRightX, y + 8); const nameRightX = textRightX - ctx.measureText(label).width - 14; ctx.fillStyle = V.primary; ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillText(FACEBOOK_PAGE_NAME, nameRightX, y + 8); const usernameRightX = nameRightX - ctx.measureText(FACEBOOK_PAGE_NAME).width - 14; ctx.direction = 'ltr'; ctx.textAlign = 'right'; ctx.fillText(CONTACT_FACEBOOK_USERNAME, usernameRightX, y + 8);
    }
  });
  ctx.direction = 'ltr';
};

const renderStoryBlob = async (data: StoryData, variant: StoryVariant) => {
  if ('fonts' in document) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = variant === 'compact' ? COMPACT_STORY_HEIGHT : FULL_STORY_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  generateStoryCanvas(canvas, ctx, data, variant);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG generation failed')), 'image/png', 1);
  });
  return blob;
};

const storyFilename = (variant: StoryVariant) => {
  const now = new Date();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return variant === 'compact' ? `makka-prices-compact-${localDate}.png` : `makka-prices-${localDate}.png`;
};

export const StoryBuilderView = () => {
  const store = useAppStore();
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState('');
  const [variant, setVariant] = useState<StoryVariant>('compact');

  const p21Sell = store.goldPrice || 3500;
  const p24Sell = Math.round((p21Sell / 21) * 24);
  const p18Sell = Math.round((p21Sell / 21) * 18);
  const { p21Buy, p24Buy, p18Buy } = calculateStoryGoldBuyPrices(p21Sell, store.storyGoldBuySpreadEgp);
  const silverSwissSell = store.silverPrice || 50;
  const silverSwissBuy = store.silverBuyPrice || 48;

  const currentBullionCharges = useMemo(() => Object.fromEntries(
    BULLION_LIST.map(item => [
      item.weight,
      workmanshipChargeForDisplay('bullion', item.weight, store.pricingConfig, store.bullionCharges),
    ]),
  ), [store.pricingConfig.bullionWorkmanshipByWeight, store.bullionCharges]);

  const currentCoinCharges = useMemo(() => Object.fromEntries(
    COIN_LIST.map(item => [
      item.weight,
      workmanshipChargeForDisplay('coin', item.weight, store.pricingConfig, store.coinCharges),
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

    renderStoryBlob(storyData, variant)
      .then(blob => {
        if (!cancelled) setStoryBlob(blob);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setError('تعذر تجهيز صورة الستوري. جرّب إعادة فتح الصفحة.');
      })
      .finally(() => {
        if (!cancelled) setIsProcessing(false);
      });

    return () => { cancelled = true; };
  }, [storyData, variant]);

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
    anchor.download = storyFilename(variant);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShare = async () => {
    if (!storyBlob || isProcessing) return;
    const file = new File([storyBlob], storyFilename(variant), { type: 'image/png' });
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
        title: 'أسعار مكة للذهب والمجوهرات',
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
            <p className="mt-1 text-xs text-[#8a8578]">الصورة بتتجهز تلقائيًا من الأسعار وإعدادات المصنعية الحالية.</p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c9a84c22] bg-[#c9a84c0d]">
            <ImageIcon className="h-5 w-5 text-[#c9a84c]" />
          </div>
        </div>

        <div className="mx-auto mb-5 flex w-full max-w-[430px] rounded-2xl border border-[#c9a84c33] bg-[#07090d] p-1" role="group" aria-label="نوع الستوري">
          {(['compact', 'full'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setVariant(option)}
              aria-pressed={variant === option}
              className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-bold transition ${variant === option ? 'bg-[#c9a84c] text-[#080a0f]' : 'text-[#aaa394] hover:bg-white/5'}`}
            >
              {option === 'compact' ? 'بدون سبائك وجنيهات' : 'كاملة'}
            </button>
          ))}
        </div>

        <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[28px] border border-[#c9a84c22] bg-[#07090d] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div
            className="overflow-hidden rounded-[22px] bg-[#05070a]"
            style={{ aspectRatio: variant === 'compact' ? `${STORY_WIDTH} / ${COMPACT_STORY_HEIGHT}` : `${STORY_WIDTH} / ${FULL_STORY_HEIGHT}` }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="معاينة ستوري أسعار مكة" className="h-full w-full object-contain" />
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
