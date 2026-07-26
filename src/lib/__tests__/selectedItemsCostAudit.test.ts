import { describe, expect, it } from 'vitest';
import { buildSelectedItemsCostAudit } from '../../../scripts/audit-selected-items-cost';

const byName = (audit: ReturnType<typeof buildSelectedItemsCostAudit>, name: string) => {
  const item = audit.accounts.find(account => account.itemName === name);
  expect(item, `Missing selected audit item ${name}`).toBeDefined();
  return item!;
};

describe('selected items cost audit trail', () => {
  it('covers gold, silver, scrap, and accessory accounts with the approved cost units', () => {
    const audit = buildSelectedItemsCostAudit();

    expect(byName(audit, 'خاتم عربي')).toMatchObject({
      taxonomyKey: 'gold.product.ring_arabic',
      metal: 'gold',
      karat: '21',
      inventoryUnit: 'g E21',
    });
    expect(byName(audit, 'خاتم حريمي')).toMatchObject({
      taxonomyKey: 'gold.product.ring_women',
      metal: 'gold',
      karat: '18',
      inventoryUnit: 'g E21',
    });
    expect(byName(audit, 'كسر أفرنجي')).toMatchObject({
      taxonomyKey: 'gold.raw.scrap_foreign',
      metal: 'gold',
      karat: '18',
      inventoryUnit: 'g E21',
    });
    expect(byName(audit, 'خاتم فضة')).toMatchObject({
      taxonomyKey: 'silver.product.ring',
      metal: 'silver',
      inventoryUnit: 'g physical',
    });
    expect(byName(audit, 'كسر فضة')).toMatchObject({
      taxonomyKey: 'silver.raw.scrap',
      metal: 'silver',
      inventoryUnit: 'g physical',
    });
    expect(byName(audit, 'دبلة تنجستين')).toMatchObject({
      taxonomyKey: 'accessory.tungsten_band',
      metal: 'accessory',
      inventoryUnit: 'unit/قطعة',
    });
  });

  it('contains the required movement categories without using market price costing', () => {
    const audit = buildSelectedItemsCostAudit();
    const allRows = audit.rows;

    expect(allRows.some(row => row.bucket === 'inbound')).toBe(true);
    expect(allRows.some(row => row.bucket === 'outbound')).toBe(true);
    expect(allRows.some(row => row.bucket === 'transfer' || row.bucket === 'tafkeet')).toBe(true);
    expect(allRows.some(row => row.bucket === 'adjustment')).toBe(true);
    expect(allRows.some(row => row.itemName === 'كسر فضة' && row.classification === 'merchant_delivery')).toBe(true);
    expect(audit.accounts.every(account => account.checks.noMarketPriceCosting)).toBe(true);
    expect(audit.accounts.every(account => account.checks.accessoryCalculatedByPiece)).toBe(true);
  });

  it('reconciles every selected audit trail to the phase5-wac-v1 final state', () => {
    const audit = buildSelectedItemsCostAudit();

    for (const account of audit.accounts) {
      expect(account.checks.finalQuantityMatchesEngine, account.itemName).toBe(true);
      expect(account.checks.finalBookCostMatchesEngine, account.itemName).toBe(true);
      expect(account.checks.manualAverageMatchesEngine, account.itemName).toBe(true);
      expect(account.checks.noMissingOrDuplicateMovements, account.itemName).toBe(true);
      expect(account.checks.outgoingUsesBeforeWac, account.itemName).toBe(true);
      expect(account.checks.saleDoesNotChangeAverageExceptRounding, account.itemName).toBe(true);
      expect(account.checks.differentCostIncomingReweightsAverage, account.itemName).toBe(true);
      expect(account.checks.transferOrTafkeetMovesCostWithoutProfit, account.itemName).toBe(true);
      expect(account.checks.roundingWithinTolerance, account.itemName).toBe(true);
      expect(account.matchingDifferenceMinor, account.itemName).toBe(0);
      expect(account.roundingDifferenceMinor, account.itemName).toBe(0);
      expect(account.result, account.itemName).toBe('PASS');
    }
  });
});
