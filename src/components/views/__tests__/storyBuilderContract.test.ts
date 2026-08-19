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
  });

  it('keeps the approved disclaimer and Facebook QR call-to-action in the generated story', () => {
    expect(storySource).toContain(ORIGINAL_DISCLAIMER);
    expect(storySource).toContain("const FACEBOOK_QR_SRC = '/facebook-page-qr.svg'");
    expect(storySource).toContain("const FACEBOOK_PAGE_NAME = 'مكة للمصوغات والمجوهرات'");
    expect(storySource).not.toContain('@mohamedyasser2400');
  });
});
