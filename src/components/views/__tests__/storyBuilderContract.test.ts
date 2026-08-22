import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const storySource = readFileSync(new URL('../StoryBuilderView.tsx', import.meta.url), 'utf8');

const ORIGINAL_DISCLAIMER = 'نتعهد بأن هذه الاسعار الحقيقية للسوق المصري و ليس لنا علاقة باي اسعار اخري ولا يوجد خصم من سعر الشراء للسبائك و المشغولات تقديرية حسب سياسة الخصم الخاصة بكل مصنع';

describe('StoryBuilderView contract', () => {
  it('keeps pricingConfig as the primary workmanship source without duplicate Story inputs', () => {
    expect(storySource).toContain('store.pricingConfig.bullionWorkmanshipByWeight');
    expect(storySource).toContain('store.pricingConfig.coinWorkmanshipByWeight');
    expect(storySource).toContain('store.bullionCharges?.[item.weight]');
    expect(storySource).toContain('store.coinCharges?.[item.weight]');
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
    expect(storySource).toContain("const silverY = variant === 'full' ? 1326 : 738");
  });

  it('keeps the full bullion path and adds the exact compact CTA only to compact', () => {
    expect(storySource).toContain("const COMPACT_CTA = 'لأحدث أسعار السبائك والجنيهات وقت الطلب، ابعتلنا رسالة على واتساب أو فيسبوك'");
    expect(storySource).toContain("if (variant === 'compact')");
    expect(storySource).toContain('wrapCenteredText(ctx, COMPACT_CTA');
    expect(storySource).toContain("const allItems = [");
    expect(storySource).toContain("const charges = item.type === 'bullion' ? data.bullionCharges : data.coinCharges;");
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
    expect(storySource).toContain('drawContactIcon(ctx, icon, iconX, y, 30)');
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
  });

  it('avoids RTL-sensitive parentheses in Canvas section headings', () => {
    expect(storySource).toContain("ctx.fillText('الجرام — شراء / بيع'");
    expect(storySource).toContain("ctx.fillText('الفضة — شراء / بيع'");
    expect(storySource).not.toContain("ctx.fillText('الجرام (شراء/بيع)'");
    expect(storySource).not.toContain("ctx.fillText('الفضة (شراء/بيع)'");
  });
});
