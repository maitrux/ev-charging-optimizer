import type { ForecastHour, ScoredForecastHour } from "./models";

function normalizeInRange(value: number, min: number, max: number): number {
  if (max === min) return 1;
  return (value - min) / (max - min);
}

function normalizeSolar(
  solar: number,
  minSolar: number,
  maxSolar: number,
): number {
  return normalizeInRange(solar, minSolar, maxSolar);
}

/** Cheap hours score higher: invert the price curve, then normalize. */
function normalizePrice(
  price: number,
  minPrice: number,
  maxPrice: number,
): number {
  const invertedPrice = minPrice + maxPrice - price;

  return normalizeInRange(invertedPrice, minPrice, maxPrice);
}

export function scoreForecastHours(
  forecasts: ForecastHour[],
): ScoredForecastHour[] {
  const minPrice = Math.min(...forecasts.map((hour) => hour.price));
  const maxPrice = Math.max(...forecasts.map((hour) => hour.price));
  const minSolar = Math.min(...forecasts.map((hour) => hour.solar));
  const maxSolar = Math.max(...forecasts.map((hour) => hour.solar));

  const combinedScores = forecasts.map((hour) => {
    const normalizedSolar = normalizeSolar(hour.solar, minSolar, maxSolar);
    const normalizedPrice = normalizePrice(hour.price, minPrice, maxPrice);

    return normalizedSolar * normalizedPrice;
  });

  const minCombinedScore = Math.min(...combinedScores);
  const maxCombinedScore = Math.max(...combinedScores);

  const withConfidence = forecasts.map((hour, index) => {
    const normalizedSum = normalizeInRange(
      combinedScores[index],
      minCombinedScore,
      maxCombinedScore,
    );

    return normalizedSum * hour.confidence;
  });

  const minWithConfidence = Math.min(...withConfidence);
  const maxWithConfidence = Math.max(...withConfidence);

  return forecasts.map((hour, index) => ({
    ...hour,
    benefit:
      maxWithConfidence === 0
        ? 0
        : normalizeInRange(
            withConfidence[index],
            minWithConfidence,
            maxWithConfidence,
          ),
  }));
}
