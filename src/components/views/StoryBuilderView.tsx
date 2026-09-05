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
const CUSTOMER_MSG_DEFAULT = 'نتعهد بأن هذه الاسعار الحقيقية للسوق المصري و ليس لنا علاقة بأي اسعار اخري ولا يوجد خصم من سعر الشراء للسبائك و المشغولات تقديرية حسب سياسة الخصم الخاصة بكل مصنع';
const FACEBOOK_PAGE_NAME = 'مكة للمصوغات والمجوهرات';
const CONTACT_ADDRESS = 'مساكن شركة المعمورة، عمارة رقم 4، محل رقم 17، المعمورة البلد';
const CONTACT_WHATSAPP = '+20 15 50326921';
const CONTACT_FACEBOOK_USERNAME = '@makkagoldalex';
const COMPACT_CTA = 'لأحدث أسعار السبائك والجنيهات وقت الطلب ابعتلنا رسالة على واتساب أو فيسبوك';

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
type BrandLogo = Extract<ContactIcon, 'whatsapp' | 'facebook'>;

// Exact CC0 SVG paths from Simple Icons, kept local so Story generation remains offline.
const OFFICIAL_BRAND_LOGO_PATHS: Record<BrandLogo, string> = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
};

const drawOfficialBrandLogo = (
  ctx: CanvasRenderingContext2D,
  logo: BrandLogo,
  centerX: number,
  centerY: number,
  size: number,
) => {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(size / 24, size / 24);
  ctx.translate(-12, -12);
  ctx.fillStyle = '#e6be68';
  ctx.fill(new Path2D(OFFICIAL_BRAND_LOGO_PATHS[logo]));
  ctx.restore();
};

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
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.82, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

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

const drawCtaSocialIcon = (
  ctx: CanvasRenderingContext2D,
  type: BrandLogo,
  centerX: number,
  centerY: number,
) => {
  drawOfficialBrandLogo(ctx, type, centerX, centerY, 54);
};

const drawCompactFooterIcon = (
  ctx: CanvasRenderingContext2D,
  type: ContactIcon,
  centerX: number,
  centerY: number,
  size: number,
) => {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.strokeStyle = '#d8b24f';
  ctx.fillStyle = '#d8b24f';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'location') {
    ctx.beginPath();
    ctx.moveTo(0, size * 0.82);
    ctx.bezierCurveTo(-size * 0.17, size * 0.5, -size * 0.56, size * 0.12, -size * 0.56, -size * 0.19);
    ctx.arc(0, -size * 0.19, size * 0.56, Math.PI, 0);
    ctx.bezierCurveTo(size * 0.56, size * 0.12, size * 0.17, size * 0.5, 0, size * 0.82);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -size * 0.2, size * 0.16, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'whatsapp') {
    ctx.restore();
    drawOfficialBrandLogo(ctx, type, centerX, centerY, 47);
    return;
  } else {
    ctx.restore();
    drawOfficialBrandLogo(ctx, type, centerX, centerY, 47);
    return;
  }
  ctx.restore();
};

const drawSmallStoryCanvas = (ctx: CanvasRenderingContext2D, data: StoryData) => {
  const centerX = STORY_WIDTH / 2;
  const contentX = 56;
  const contentWidth = STORY_WIDTH - (contentX * 2);
  const rtlFont = '"IBM Plex Sans Arabic", "Tajawal", sans-serif';
  const numericFont = '"JetBrains Mono", monospace';
  const C = {
    navy: '#071a2f',
    navyElevated: '#0a223a',
    cream: '#f8f0df',
    ivory: '#fffaf0',
    ink: '#10233b',
    white: '#fbfcff',
    gold: '#e6be68',
    goldMuted: '#b78b35',
    goldBorder: '#d9ad51',
    silver: '#d7dde0',
    silverBorder: '#b9c3c8',
    footerLine: 'rgba(230, 190, 104, 0.54)',
  };
  const generatedAt = new Date();
  const dateStr = generatedAt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = generatedAt.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit', hour12: true });

  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, STORY_WIDTH, COMPACT_STORY_HEIGHT);
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, STORY_WIDTH, 254);
  ctx.strokeStyle = 'rgba(230, 190, 104, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 84); ctx.quadraticCurveTo(70, 170, 178, 182);
  ctx.moveTo(STORY_WIDTH, 84); ctx.quadraticCurveTo(STORY_WIDTH - 70, 170, STORY_WIDTH - 178, 182);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillStyle = C.white;
  ctx.font = `bold 53px ${rtlFont}`;
  ctx.fillText('مكة للذهب والمجوهرات', centerX, 83);
  ctx.fillStyle = C.gold;
  ctx.font = `600 31px ${rtlFont}`;
  ctx.fillText('تأسس منذ 2003', centerX, 132);
  ctx.fillStyle = 'rgba(251, 252, 255, 0.82)';
  ctx.font = `500 24px ${rtlFont}`;
  ctx.fillText(`${dateStr}  •  ${timeStr}`, centerX, 183);
  ctx.strokeStyle = C.goldBorder;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 251); ctx.lineTo(STORY_WIDTH, 251); ctx.stroke();

  const heroY = 287;
  roundedPanel(ctx, contentX, heroY, contentWidth, 514, 30, C.navy, C.goldBorder);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(230, 190, 104, 0.8)';
  ctx.beginPath(); ctx.roundRect(contentX + 4, heroY + 4, contentWidth - 8, 506, 27); ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.font = `bold 58px ${rtlFont}`;
  ctx.fillText('عيار 21', centerX, heroY + 83);
  ctx.strokeStyle = 'rgba(230, 190, 104, 0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(contentX + 100, heroY + 67); ctx.lineTo(contentX + 307, heroY + 67);
  ctx.moveTo(contentX + contentWidth - 100, heroY + 67); ctx.lineTo(contentX + contentWidth - 307, heroY + 67);
  ctx.stroke();

  const drawHeroRow = (y: number, label: string, price: number) => {
    roundedPanel(ctx, contentX + 46, y, contentWidth - 92, 147, 23, C.navyElevated, 'rgba(255,255,255,0.17)');
    ctx.strokeStyle = 'rgba(230, 190, 104, 0.34)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(666, y + 23); ctx.lineTo(666, y + 124); ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.font = `bold 43px ${rtlFont}`;
    ctx.fillText(label, 760, y + 91);
    ctx.fillStyle = C.white;
    ctx.font = `bold 75px ${numericFont}`;
    ctx.direction = 'ltr';
    ctx.fillText(price.toLocaleString(), 394, y + 98);
    ctx.direction = 'rtl';
  };
  drawHeroRow(heroY + 119, 'بيع', data.p21Sell);
  drawHeroRow(heroY + 288, 'شراء', data.p21Buy);

  const cardsY = 832;
  const drawPriceCard = (x: number, width: number, title: string, sell: number, buy: number, accent: string, border: string) => {
    roundedPanel(ctx, x, cardsY, width, 353, 24, C.navy, border);
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 30, cardsY + 88); ctx.lineTo(x + width - 30, cardsY + 88); ctx.stroke();
    ctx.fillStyle = accent; ctx.font = `bold ${width < 250 ? 37 : 40}px ${rtlFont}`; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText(title, x + (width / 2), cardsY + 60);
    const drawPriceLine = (lineY: number, label: string, value: number) => {
      roundedPanel(ctx, x + 20, lineY, width - 40, 108, 18, 'rgba(255,255,255,0.035)', 'rgba(255,255,255,0.1)');
      ctx.fillStyle = accent; ctx.font = `bold 25px ${rtlFont}`; ctx.direction = 'rtl'; ctx.fillText(label, x + (width / 2), lineY + 34);
      ctx.fillStyle = C.white; ctx.font = `bold ${width < 250 ? 40 : 48}px ${numericFont}`; ctx.direction = 'ltr'; ctx.fillText(value.toLocaleString(), x + (width / 2), lineY + 84);
    };
    drawPriceLine(cardsY + 106, 'بيع', sell);
    drawPriceLine(cardsY + 227, 'شراء', buy);
  };
  drawPriceCard(56, 226, 'الفضة', data.silverSwissSell, data.silverSwissBuy, C.silver, C.silverBorder);
  drawPriceCard(300, 356, 'عيار 24', data.p24Sell, data.p24Buy, C.gold, C.goldBorder);
  drawPriceCard(674, 350, 'عيار 18', data.p18Sell, data.p18Buy, C.gold, C.goldBorder);

  const disclaimerY = 1217;
  roundedPanel(ctx, contentX, disclaimerY, contentWidth, 282, 22, C.ivory, C.goldMuted);
  ctx.fillStyle = C.ink;
  ctx.font = `500 33px ${rtlFont}`;
  ctx.direction = 'rtl'; ctx.textAlign = 'center';
  const disclaimerLines = getWrappedTextLines(ctx, data.customerMessage, 835);
  const disclaimerLineHeight = 48;
  const disclaimerStartY = disclaimerY + ((282 - ((disclaimerLines.length - 1) * disclaimerLineHeight)) / 2) + 24;
  wrapCenteredText(ctx, data.customerMessage, centerX, disclaimerStartY, 835, disclaimerLineHeight);

  const ctaY = 1523;
  roundedPanel(ctx, contentX, ctaY, contentWidth, 126, 18, C.navy, C.goldMuted);
  drawCtaSocialIcon(ctx, 'whatsapp', 158, ctaY + 63);
  ctx.strokeStyle = 'rgba(230, 190, 104, 0.65)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(226, ctaY + 30); ctx.lineTo(226, ctaY + 96); ctx.stroke();
  drawCtaSocialIcon(ctx, 'facebook', 280, ctaY + 63);
  ctx.fillStyle = C.gold;
  ctx.font = `bold 27px ${rtlFont}`;
  ctx.direction = 'rtl';
  wrapCenteredText(ctx, COMPACT_CTA, 657, ctaY + 50, 610, 36);

  const footerY = 1674;
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, footerY, STORY_WIDTH, COMPACT_STORY_HEIGHT - footerY);
  const iconX = 960;
  const textRightX = 887;
  const rowStep = 82;
  const rows: Array<{ icon: ContactIcon; label?: string; value: string }> = [
    { icon: 'location', value: CONTACT_ADDRESS },
    { icon: 'whatsapp', label: 'واتساب:', value: CONTACT_WHATSAPP },
    { icon: 'facebook', label: 'فيسبوك:', value: FACEBOOK_PAGE_NAME },
  ];
  rows.forEach((row, index) => {
    const y = footerY + 43 + (index * rowStep);
    if (index > 0) { ctx.strokeStyle = C.footerLine; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(contentX, y - 41); ctx.lineTo(915, y - 41); ctx.stroke(); }
    drawCompactFooterIcon(ctx, row.icon, iconX, y, 25);
    ctx.textAlign = 'right'; ctx.direction = 'rtl'; ctx.font = `600 ${index === 0 ? 23 : 26}px ${rtlFont}`;
    if (!row.label) { ctx.fillStyle = C.white; ctx.fillText(row.value, textRightX, y + 8, 805); return; }
    ctx.fillStyle = C.gold; ctx.fillText(row.label, textRightX, y + 8);
    const valueRightX = textRightX - ctx.measureText(row.label).width - 16;
    if (row.icon === 'whatsapp') {
      ctx.fillStyle = C.white; ctx.direction = 'ltr'; ctx.fillText(row.value, valueRightX, y + 8);
    } else {
      ctx.fillStyle = C.white; ctx.direction = 'rtl'; ctx.fillText(row.value, valueRightX, y + 8);
      const usernameRightX = valueRightX - ctx.measureText(row.value).width - 16;
      ctx.direction = 'ltr'; ctx.fillText(CONTACT_FACEBOOK_USERNAME, usernameRightX, y + 8);
    }
  });
  ctx.direction = 'ltr';
};

const generateStoryCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, data: StoryData, variant: StoryVariant) => {
  if (variant === 'compact') {
    drawSmallStoryCanvas(ctx, data);
    return;
  }
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
  const V = C;

  ctx.fillStyle = V.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  const headerTop = 40;
  const generatedAt = new Date();
  const dateStr = generatedAt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = generatedAt.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit', hour12: true });
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
  ctx.fillStyle = V.secondary; ctx.font = `bold 25px ${rtlFont}`; ctx.fillText('الفضة — شراء / بيع', centerX + 190, silverY + 38);
  ctx.fillStyle = V.primary; ctx.font = `bold 34px ${numericFont}`; ctx.fillText(`${data.silverSwissBuy.toLocaleString()} / ${data.silverSwissSell.toLocaleString()}`, centerX - 190, silverY + 42);

  const disclaimerY = variant === 'full' ? 1432 : 1250;
  const disclaimerHeight = variant === 'full' ? 140 : 260;
  roundedPanel(ctx, contentX, disclaimerY, contentWidth, disclaimerHeight, 18, V.surface, V.border);
  ctx.fillStyle = V.secondary;
  const disclaimerFontSize = 22;
  const disclaimerLineHeight = 31;
  ctx.font = `500 ${disclaimerFontSize}px ${rtlFont}`;
  const disclaimerLines = getWrappedTextLines(ctx, data.customerMessage, 830);
  const disclaimerBlockHeight = Math.max(0, (disclaimerLines.length - 1) * disclaimerLineHeight);
  const disclaimerStartY = disclaimerY + 58;
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
