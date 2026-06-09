import type { ForecastHour, Vehicle } from "./models";

export type ChargingBucketType = "solar" | "grid";

/**
 * One slice of chargeable energy in a single hour.
 *
 * Instead of always charging at max power and blending solar with grid,
 * each hour is split into two buckets:
 *   - solar: free local production (throttle to available kWh)
 *   - grid:   remaining slot capacity at the risk-adjusted market price
 */
export interface ChargingBucket {
  hour: string;
  type: ChargingBucketType;
  /** Maximum energy available from this bucket in kWh. */
  energy: number;
  /** Cost per kWh used for ranking; lower is better. */
  costPerKwh: number;
}

/**
 * Energy that can be charged from local solar during one slot at zero cost.
 */
export function calculateSolarBucketEnergy(
  forecast: ForecastHour,
  vehicle: Vehicle,
  slotDurationHours = 1,
): number {
  if (forecast.confidence === 0 || vehicle.maxChargingPower <= 0) {
    return 0;
  }

  const maxSlotEnergy = vehicle.maxChargingPower * slotDurationHours;

  return Math.min(forecast.solar, maxSlotEnergy);
}

/**
 * Risk-adjusted grid energy cost for one forecast hour.
 *
 * Dividing by plug-in confidence makes unreliable slots less attractive,
 * e.g. a cheap hour at 10% confidence costs more than a slightly pricier
 * hour at 95% confidence.
 */
export function calculateGridCostPerKwh(forecast: ForecastHour): number {
  if (forecast.confidence === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return forecast.price / forecast.confidence;
}

/**
 * Builds ranked charging opportunities for one hour.
 *
 * Each hour offers free solar energy first, then any remaining slot capacity
 * at the risk-adjusted grid price.
 */
export function buildHourlyChargingBuckets(
  forecast: ForecastHour,
  vehicle: Vehicle,
  slotDurationHours = 1,
): ChargingBucket[] {
  if (forecast.confidence === 0 || vehicle.maxChargingPower <= 0) {
    return [];
  }

  const maxSlotEnergy = vehicle.maxChargingPower * slotDurationHours;
  const solarEnergy = calculateSolarBucketEnergy(
    forecast,
    vehicle,
    slotDurationHours,
  );
  const buckets: ChargingBucket[] = [];

  if (solarEnergy > 0) {
    buckets.push({
      hour: forecast.timestamp,
      type: "solar",
      energy: solarEnergy,
      costPerKwh: 0,
    });
  }

  // Whatever the charger does not cover from solar can still be bought from
  // the grid, up to maxChargingPower for this slot.
  const gridEnergy = maxSlotEnergy - solarEnergy;

  if (gridEnergy > 0) {
    buckets.push({
      hour: forecast.timestamp,
      type: "grid",
      energy: gridEnergy,
      costPerKwh: calculateGridCostPerKwh(forecast),
    });
  }

  return buckets;
}

/**
 * Builds and ranks charging buckets across all forecast hours.
 *
 * The optimizer greedily consumes buckets from cheapest to most expensive.
 * Sort order:
 *   1. lowest cost per kWh (all solar buckets tie at 0)
 *   2. solar before grid when costs tie
 *   3. earlier hours first for predictable schedules
 */
export function buildChargingBuckets(
  forecasts: ForecastHour[],
  vehicle: Vehicle,
  slotDurationHours = 1,
): ChargingBucket[] {
  return forecasts
    .flatMap((forecast) =>
      buildHourlyChargingBuckets(forecast, vehicle, slotDurationHours),
    )
    .sort((a, b) => {
      if (a.costPerKwh !== b.costPerKwh) {
        return a.costPerKwh - b.costPerKwh;
      }

      if (a.type !== b.type) {
        return a.type === "solar" ? -1 : 1;
      }

      return new Date(a.hour).getTime() - new Date(b.hour).getTime();
    });
}
