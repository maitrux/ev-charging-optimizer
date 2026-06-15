import type { ForecastHour, ScoredForecastHour } from "./models";

/**
 *
 * @param forecasts
 * @returns array of hourly benefits
 */
export function calculateBenefits(forecasts: ForecastHour[]): number[] {
  const minPrice = Math.min(...forecasts.map((hour) => hour.price));
  const maxPrice = Math.max(...forecasts.map((hour) => hour.price));

  const maxSolar = Math.max(...forecasts.map((hour) => hour.solar));

  const combinedScores = forecasts.map((hour) => {
    let normalizedSolar = 0;
    if (maxSolar === 0) {
      normalizedSolar = 0;
    } else {
      normalizedSolar = hour.solar / maxSolar;
    }

    let normalizedPrice = 0;
    if (maxPrice === 0) {
      normalizedPrice = 0;
    } else {
      let invertedPrice = minPrice + maxPrice - hour.price;
      normalizedPrice = invertedPrice / maxPrice;
    }

    return normalizedSolar * normalizedPrice * hour.confidence;
  });

  const maxCombinedScore = Math.max(...combinedScores);

  return combinedScores.map((score) => {
    if (maxCombinedScore === 0) {
      return 0;
    } else {
      return score / maxCombinedScore;
    }
  });
}

/**
 * Compute benefit score for each forecast hour:
 * - normalizedSolar = normalize solar
 * - normalizedPrice = invert price, then normalize
 * - combinedScores = normalizedSolar × normalizedPrice × plug-in confidence
 * - benefit = normalize combinedScores
 */
export function scoreForecastHours(
  forecasts: ForecastHour[],
): ScoredForecastHour[] {
  const normalizedCombinedScore = calculateBenefits(forecasts);

  return forecasts.map((hour, index) => ({
    ...hour,
    benefit: normalizedCombinedScore[index],
  }));
}
