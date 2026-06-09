import type { ForecastHour, ScheduleEntry } from "./models";

export interface ScheduleCostSummary {
  totalCostEur: number;
  totalEnergyKwh: number;
  solarEnergyKwh: number;
  gridEnergyKwh: number;
}

export function calculateScheduleCost(
  schedule: ScheduleEntry[],
  forecasts: ForecastHour[],
): ScheduleCostSummary {
  const forecastByHour = new Map(forecasts.map((forecast) => [forecast.timestamp, forecast]));

  let totalCostEur = 0;
  let totalEnergyKwh = 0;
  let solarEnergyKwh = 0;
  let gridEnergyKwh = 0;

  for (const entry of schedule) {
    const forecast = forecastByHour.get(entry.hour);

    if (!forecast || entry.chargingPower <= 0) {
      continue;
    }

    const solarUsed = Math.min(entry.chargingPower, forecast.solar);
    const gridUsed = entry.chargingPower - solarUsed;

    totalEnergyKwh += entry.chargingPower;
    solarEnergyKwh += solarUsed;
    gridEnergyKwh += gridUsed;
    totalCostEur += gridUsed * forecast.price;
  }

  return {
    totalCostEur,
    totalEnergyKwh,
    solarEnergyKwh,
    gridEnergyKwh,
  };
}
