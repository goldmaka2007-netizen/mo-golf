import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HomeView secondary navigation actions', () => {
  const source = readFileSync(new URL('../HomeView.tsx', import.meta.url), 'utf8');
  const sectionStart = source.indexOf('{/* Secondary quick actions */}');
  const sectionEnd = source.indexOf('{/* Quick report shortcuts */}', sectionStart);
  const section = source.slice(sectionStart, sectionEnd);

  const getButtonContaining = (needle: string) => {
    const needleIndex = section.indexOf(needle);
    expect(needleIndex).toBeGreaterThanOrEqual(0);
    const buttonStart = section.lastIndexOf('<button', needleIndex);
    const buttonEnd = section.indexOf('</button>', needleIndex) + '</button>'.length;
    expect(buttonStart).toBeGreaterThanOrEqual(0);
    expect(buttonEnd).toBeGreaterThan(buttonStart);
    return section.slice(buttonStart, buttonEnd);
  };

  it('routes the journal and inventory buttons to different views', () => {
    const journalButton = getButtonContaining('<Calendar className="w-6 h-6 text-[#c9a84c]" />');
    const inventoryButton = getButtonContaining('<Database className="w-6 h-6 text-[#6a9e6a]" />');

    expect(journalButton).toContain("setView('journal')");
    expect(journalButton).toContain('\u062f\u0641\u062a\u0631 \u0627\u0644\u064a\u0648\u0645\u064a\u0629');
    expect(inventoryButton).toContain("setView('database')");
    expect(inventoryButton).toContain('\u0627\u0644\u0645\u062e\u0632\u0648\u0646');
    expect(inventoryButton).not.toContain("setView('journal')");
    expect(inventoryButton).not.toContain('\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a');
  });
});

describe('Operational Home quick actions', () => {
  const source = readFileSync(new URL('../OperationalHomeView.tsx', import.meta.url), 'utf8');

  it('opens the existing Story Builder from the WhatsApp Status action', () => {
    expect(source).toContain('onClick={() => setView(\'story\')}');
    expect(source).toContain('فتح حالة واتساب');
  });

  it('routes the three operational shortcuts to existing flows', () => {
    expect(source).toContain('label="مساعد البيع"');
    expect(source).toContain("openAssistant('sale')");
    expect(source).toContain('label="مساعد الشراء"');
    expect(source).toContain("openAssistant('purchase')");
    expect(source).toContain('label="جرد الأصناف"');
    expect(source).toContain("setView('database')");
  });

  it('opens Financial Position from the existing Home gold projection', () => {
    expect(source).toContain("setReportsTab('balance')");
    expect(source).toContain("setView('reports')");
    expect(source).toContain('operational.goldOwnership?.goldAssetWeight');
    expect(source).not.toContain('computeAccountBalances');
  });

  it('keeps the gold summary as three two-decimal single-line values', () => {
    expect(source).toContain("money(value as number, 2)");
    expect(source).toContain('grid-cols-3');
    expect(source).toContain('whitespace-nowrap font-mono');
    expect(source).toContain('الأصول');
    expect(source).toContain('الخصوم');
    expect(source).toContain('حقوق الملكية');
    expect(source).not.toContain('آخر العمليات');
    expect(source).toContain('grid grid-cols-3 gap-2');
  });
});
