import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const storySource = readFileSync(new URL('../StoryBuilderView.tsx', import.meta.url), 'utf8');

const ORIGINAL_DISCLAIMER = 'نتعهد بأن هذه الاسعار الحقيقية للسوق المصري و ليس لنا علاقة باي اسعار اخري ولا يوجد خصم من سعر الشراء للسبائك و المشغولات تقديرية حسب سياسة الخصم الخاصة بكل مصنع';

describe('StoryBuilderView contract', () => {
  it('keeps pricingConfig as the primary workmanship source without duplicate Story inputs', () => {
    expect(storySource).toContain('store.pricingConfig.bullionWorkmanshipByWeight');
    expect(storySource).toContain('store.pricingConfig.coinWorkmanshipByWeight');
    expect(storySource).toContain("workmanshipChargeForDisplay('bullion', item.weight, store.pricingConfig, store.bullionCharges)");
    expect(storySource).toContain("workmanshipChargeForDisplay('coin', item.weight, store.pricingConfig, store.coinCharges)");
    expect(storySource).not.toContain('مصنعية الســــبائك');
    expect(storySource).not.toContain('الجنيــــهات (جم / ع 21)');
    expect(storySource).not.toContain('<textarea');
  });

  it('prepares a PNG and uses native file sharing with a save fallback', () => {
    expect(storySource).toContain('canvas.toBlob');
    expect(storySource).toContain('new File([storyBlob]');
    expect(storySource).toContain('navigator.canShare');
    expect(storySource).toContain('navigator.share');
    expect(storySource).toContain('saveStoryImage();');
    expect(storySource).toContain("`makka-prices-compact-${localDate}.png`");
    expect(storySource).toContain("`makka-prices-${localDate}.png`");
  });

  it('supports compact and full variants with compact selected by default', () => {
    expect(storySource).toContain("export type StoryVariant = 'compact' | 'full'");
    expect(storySource).toContain("useState<StoryVariant>('compact')");
    expect(storySource).toContain("'بدون سبائك وجنيهات'");
    expect(storySource).toContain("'كاملة'");
    expect(storySource).toContain("if (variant === 'full')");
    expect(storySource).toContain("const silverY = variant === 'full' ? 1310 : 800");
    expect(storySource).toContain('const COMPACT_STORY_HEIGHT = 1920');
    expect(storySource).toContain('canvas.height = variant === \'compact\' ? COMPACT_STORY_HEIGHT : FULL_STORY_HEIGHT');
    expect(storySource).toContain('aspectRatio: variant === \'compact\'');
    expect(storySource).toContain('object-contain');
  });

  it('keeps the approved compact CTA and separates full bullion and coin layouts', () => {
    expect(storySource).toContain("const COMPACT_CTA = 'لأحدث أسعار السبائك والجنيهات وقت الطلب، ابعتلنا رسالة على واتساب أو فيسبوك'");
    expect(storySource).toContain("if (variant === 'compact')");
    expect(storySource).toContain('wrapCenteredText(ctx, COMPACT_CTA');
    expect(storySource).toContain("drawProductSection('السبائك', BULLION_LIST, 'bullion', 720, 310, 2)");
    expect(storySource).toContain("drawProductSection('الجنيهات', COIN_LIST, 'coin', 1046, 240, 1)");
    expect(storySource).toContain('const cardInnerWidth = contentWidth - (cardPadding * 2);');
    expect(storySource).toContain('const colWidth = listInnerWidth / columns;');
    expect(storySource).toContain("if (variant === 'compact') {\n    roundedPanel(ctx, contentX, 990, contentWidth, 230");
    expect(storySource).not.toContain("if (variant === 'full') {\n    roundedPanel(ctx, contentX, 1000");
  });

  it('uses the isolated Story spread for both variants without the official buy price', () => {
    expect(storySource).toContain('calculateStoryGoldBuyPrices');
    expect(storySource).toContain('store.storyGoldBuySpreadEgp');
    expect(storySource).not.toContain('store.goldBuyPrice');
    expect(storySource).toContain('canvas.width = STORY_WIDTH');
    expect(storySource).toContain('canvas.height = variant === \'compact\' ? COMPACT_STORY_HEIGHT : FULL_STORY_HEIGHT');
  });

  it('keeps the approved Arabic copy and renders the current contact footer without QR code', () => {
    expect(storySource).toContain(ORIGINAL_DISCLAIMER);
    expect(storySource).toContain("ctx.fillText('مكة للذهب والمجوهرات'");
    expect(storySource).toContain("title: 'أسعار مكة للذهب والمجوهرات'");
    expect(storySource).toContain('الصورة بتتجهز تلقائيًا من الأسعار وإعدادات المصنعية الحالية.');
    expect(storySource).toContain('تعذر تجهيز صورة الستوري. جرّب إعادة فتح الصفحة.');
    expect(storySource).toContain("const FACEBOOK_PAGE_NAME = 'مكة للمصوغات والمجوهرات'");
    expect(storySource).toContain("const CONTACT_ADDRESS = 'مساكن شركة المعمورة، عمارة رقم 4، محل رقم 17، المعمورة البلد'");
    expect(storySource).toContain("const CONTACT_WHATSAPP = '+20 15 50326921'");
    expect(storySource).toContain("const CONTACT_FACEBOOK_USERNAME = '@makkagoldalex'");
    expect(storySource).toContain('const drawContactIcon = (');
    expect(storySource).toContain("type ContactIcon = 'location' | 'whatsapp' | 'facebook'");
    expect(storySource).toContain('drawContactIcon(ctx, icon, iconX, y, variant === \'full\' ? 27 : 32)');
    expect(storySource).toContain('ctx.bezierCurveTo');
    expect(storySource).not.toContain('fillText("F"');
    expect(storySource).toContain("ctx.direction = 'ltr'");
    expect(storySource).toContain("ctx.fillText(CONTACT_WHATSAPP, numberRightX, y + 8)");
    expect(storySource).toContain("ctx.fillText(CONTACT_FACEBOOK_USERNAME, usernameRightX, y + 8)");
    expect(storySource).not.toContain('FACEBOOK_QR_SRC');
    expect(storySource).not.toContain('loadImage');
    expect(storySource).not.toContain('drawImage');
    expect(storySource).not.toContain('نلتزم بالشفافية والثقة');
    expect(storySource).not.toContain('@mohamedyasser2400');
    expect(storySource).not.toContain('الأسعار استرشادية وتتحدد بدقة عند التنفيذ الفعلي');
  });

  it('avoids RTL-sensitive parentheses in Canvas section headings', () => {
    expect(storySource).toContain("sectionRibbon('الجرام — شراء / بيع'");
    expect(storySource).toContain("sectionRibbon('الفضة — شراء / بيع'");
    expect(storySource).not.toContain("'Ag'");
    expect(storySource).not.toContain('drawSilverIcon');
    expect(storySource).not.toContain("ctx.fillText('الجرام (شراء/بيع)'");
    expect(storySource).not.toContain("ctx.fillText('الفضة (شراء/بيع)'");
  });

  it('uses the luxury jewelry visual layer without simulated device or heavy decoration', () => {
    expect(storySource).toContain("bg: '#f6ecd8'");
    expect(storySource).toContain("navy: '#0d1c2d'");
    expect(storySource).toContain("gold: '#bd8b2f'");
    expect(storySource).toContain("roundedPanel(ctx, contentX, heroY, contentWidth, heroHeight");
    expect(storySource).not.toContain('createRadialGradient');
    expect(storySource).not.toContain('strokeRect');
    expect(storySource).not.toContain('story progress');
    expect(storySource).not.toContain('iPhone');
    expect(storySource).not.toContain('BTC');
    expect(storySource).not.toContain('أونصة');
  });

  it('keeps the lower-text readability refinement scoped to Compact', () => {
    expect(storySource).toContain("variant === 'compact' ? 35 : 22");
    expect(storySource).toContain("variant === 'compact' ? 50 : 34");
    expect(storySource).toContain('const disclaimerLines = getWrappedTextLines(ctx, data.customerMessage, 800);');
    expect(storySource).toContain("variant === 'full' ? 21 : 28");
    expect(storySource).toContain('const timeStr = generatedAt.toLocaleTimeString');
    expect(storySource).toContain('ctx.fillText(`${dateStr}  •  ${timeStr}`');
    expect(storySource).toContain("ctx.fillText('تأسس منذ 2003'");
    expect(storySource).toContain('ctx.fillRect(0, 0, canvas.width, 250)');
    expect(storySource).toContain('const heroY = 282');
    expect(storySource).toContain('const silverTableTop = silverY + 52');
    expect(storySource).toContain('const silverTableBottom = silverY + silverHeight - 16');
    expect(storySource).toContain('ctx.font = `bold 52px ${numericFont}`');
    expect(storySource).toContain("ctx.fillStyle = '#5f564b'");
  });

  it('uses the premium shared header for both variants', () => {
    expect(storySource).toContain("ctx.fillText('مكة للذهب والمجوهرات'");
    expect(storySource).toContain("ctx.fillText('تأسس منذ 2003'");
    expect(storySource).toContain("ctx.fillText('مكة', centerX, 94)");
    expect(storySource).toContain("ctx.font = `bold ${variant === 'full' ? 74 : 68}px ${rtlFont}`");
    expect(storySource).toContain("ctx.fillText('تأسس منذ 2003', centerX, 184)");
    expect(storySource).toContain('ctx.fillText(`${dateStr}  •  ${timeStr}`, centerX, 218)');
    expect(storySource).toContain('const drawGoldFlourish =');
    expect(storySource).not.toContain('تأسس منذ 1983');
  });
});
