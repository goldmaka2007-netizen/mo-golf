export interface PeriodLegSplit<T extends { date: string; isOpening?: boolean }> {
  openingLegs: T[];
  periodLegs: T[];
}

/** Splits posted legs once so opening entries seed the balance and never repeat as period movement. */
export const splitLegsByPeriod = <T extends { date: string; isOpening?: boolean }>(legs: T[], startDate: string, endDate: string): PeriodLegSplit<T> => ({
  openingLegs: legs.filter(leg => leg.date < startDate || (leg.isOpening && leg.date <= endDate)),
  periodLegs: legs.filter(leg => !leg.isOpening && leg.date >= startDate && leg.date <= endDate),
});
