import type { ForecastHour, ScoredForecastHour, Vehicle } from "./models";

/**
 * Calculates the ratio of charging demand that can be covered by local solar
 * production during one forecast slot.
 *
 * @param forecast Forecast data for one time slot.
 * @param vehicle Vehicle charging constraints.
 * @returns Solar coverage ratio between 0 and 1.
 */
export function calculateSolarCoverageRatio(
  forecast: ForecastHour,
  vehicle: Vehicle,
): number {
  if (vehicle.maxChargingPower <= 0) {
    return 0;
  }

  return Math.min(forecast.solar / vehicle.maxChargingPower, 1);
}

/**
 * Calculates the effective charging cost for one forecast hour.
 *
 * Lower values are better.
 *
 * The formula:
 * - starts with the electricity price
 * - reduces the price when local solar production is available
 * - penalizes hours with low plug-in confidence
 *
 * @param forecast Forecast data for one time slot.
 * @param vehicle Vehicle charging constraints.
 * @returns Effective cost used for ranking forecast hours.
 */
export function calculateEffectiveCost(
  forecast: ForecastHour,
  vehicle: Vehicle,
): number {
  if (forecast.confidence === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const solarCoverageRatio = calculateSolarCoverageRatio(forecast, vehicle);
  const effectiveGridPrice = forecast.price * (1 - solarCoverageRatio);

  return effectiveGridPrice / forecast.confidence;
}

/**
 * Adds effective cost to every forecast hour.
 *
 * @param forecasts Forecast data for the planning horizon.
 * @param vehicle Vehicle charging constraints.
 * @returns Forecast hours enriched with effective cost.
 */
export function scoreForecasts(
  forecasts: ForecastHour[],
  vehicle: Vehicle,
): ScoredForecastHour[] {
  return forecasts.map((forecast) => ({
    ...forecast,
    effectiveCost: calculateEffectiveCost(forecast, vehicle),
  }));
}
