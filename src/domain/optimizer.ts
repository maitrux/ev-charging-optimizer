import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";
import { scoreForecastHours } from "./scoring";

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getAvailableCapacityKwh(vehicle: Vehicle): number {
  const currentEnergy = vehicle.batteryCapacity * (vehicle.currentSoc / 100);

  return Math.max(0, vehicle.batteryCapacity - currentEnergy);
}

export function generateChargingSchedule(
  vehicle: Vehicle,
  forecasts: ForecastHour[],
): ScheduleEntry[] {
  const targetTime = new Date(vehicle.targetTime).getTime();

  const usableForecasts = forecasts.filter(
    (forecast) => new Date(forecast.timestamp).getTime() <= targetTime,
  );

  const scoredHours = scoreForecastHours(usableForecasts);
  const availableCapacity = getAvailableCapacityKwh(vehicle);

  if (availableCapacity <= 0) {
    return [];
  }

  const chronological = [...scoredHours].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const rawTotal = scoredHours.reduce(
    (sum, hour) => sum + vehicle.maxChargingPower * hour.benefit,
    0,
  );

  const scale =
    rawTotal > availableCapacity ? availableCapacity / rawTotal : 1;

  return chronological.map((hour) => {
    const chargingPower = Math.min(
      vehicle.maxChargingPower * hour.benefit * scale,
      vehicle.maxChargingPower,
    );

    return {
      hour: hour.timestamp,
      chargingPower: round(chargingPower),
    };
  });
}
