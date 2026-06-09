import type { ForecastHour, ScoredForecastHour } from "./models";

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (value - min) / (max - min);
}

export function scoreForecastHours(
  forecasts: ForecastHour[],
): ScoredForecastHour[] {
  const prices = forecasts.map((f) => f.price);
  const solars = forecasts.map((f) => f.solar);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minSolar = Math.min(...solars);
  const maxSolar = Math.max(...solars);

  return forecasts.map((forecast) => {
    const normalizedSolarPower = normalize(forecast.solar, minSolar, maxSolar);

    const reversedPrice = minPrice + maxPrice - forecast.price;

    const reversedAndNormalizedPrice = normalize(
      reversedPrice,
      minPrice,
      maxPrice,
    );

    const normalizedSum =
      normalizedSolarPower * reversedAndNormalizedPrice;

    const benefit = Math.min(
      1,
      Math.max(0, normalizedSum * forecast.confidence),
    );

    return {
      ...forecast,
      benefit,
    };
  });
}
