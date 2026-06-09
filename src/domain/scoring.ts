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

  const rawSums = forecasts.map((forecast) => {
    const normalizedSolarPower = normalize(forecast.solar, minSolar, maxSolar);

    const reversedPrice = minPrice + maxPrice - forecast.price;

    const reversedAndNormalizedPrice = normalize(
      reversedPrice,
      minPrice,
      maxPrice,
    );

    return normalizedSolarPower * reversedAndNormalizedPrice;
  });

  const minSum = Math.min(...rawSums);
  const maxSum = Math.max(...rawSums);

  const rawBenefits = forecasts.map((forecast, index) => {
    const normalizedSum = normalize(rawSums[index], minSum, maxSum);

    return normalizedSum * forecast.confidence;
  });

  const minBenefit = Math.min(...rawBenefits);
  const maxBenefit = Math.max(...rawBenefits);

  return forecasts.map((forecast, index) => {
    const benefit =
      maxBenefit === 0
        ? 0
        : normalize(rawBenefits[index], minBenefit, maxBenefit);

    return {
      ...forecast,
      benefit,
    };
  });
}
