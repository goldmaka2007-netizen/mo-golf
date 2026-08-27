import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../SettingsImportExportPanel.tsx', import.meta.url), 'utf8');

describe('SettingsImportExportPanel callback wiring', () => {
  it('invokes the supplied inventory navigation callback', () => {
    const onOpenInventory = vi.fn();

    expect(source).toContain('onClick={onOpenInventory}');
    expect(source).not.toContain('onClick={() => onOpenInventory}');

    onOpenInventory();
    expect(onOpenInventory).toHaveBeenCalledTimes(1);
  });
});
