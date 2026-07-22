export interface PeriodLegSplit<T extends { date: string }> {
  openingLegs: T[];
  periodLegs: T[];
}

/** Splits posted legs by their persisted business date. Operation kind never overrides the date boundary. */
export const splitLegsByPeriod = <T extends { date: string }>(legs: T[], startDate: string, endDate: string): PeriodLegSplit<T> => ({
  openingLegs: legs.filter(leg => leg.date < startDate),
  periodLegs: legs.filter(leg => leg.date >= startDate && leg.date <= endDate),
});
