import { getChargingSlotDurationHours } from "./datetime";
import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";
import { scoreForecastHours } from "./scoring";

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function remainingBatteryCapacityKwh(vehicle: Vehicle): number {
  const storedEnergy = vehicle.batteryCapacity * (vehicle.currentSoc / 100);

  return Math.max(0, vehicle.batteryCapacity - storedEnergy);
}

export function generateChargingSchedule(
  vehicle: Vehicle,
  forecasts: ForecastHour[],
): ScheduleEntry[] {
  const targetTime = new Date(vehicle.targetTime).getTime();

  const forecastsInWindow = forecasts.filter(
    (forecast) => new Date(forecast.timestamp).getTime() <= targetTime,
  );

  const scoredHours = scoreForecastHours(forecastsInWindow);
  const batteryCapacity = remainingBatteryCapacityKwh(vehicle);

  if (batteryCapacity <= 0) {
    return [];
  }

  const hoursByTime = [...scoredHours].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const requestedEnergy = scoredHours.reduce((total, hour) => {
    const slotDurationHours = getChargingSlotDurationHours(
      hour.timestamp,
      vehicle.targetTime,
    );

    return (
      total +
      vehicle.maxChargingPower * hour.benefit * slotDurationHours
    );
  }, 0);

  const scale =
    requestedEnergy > batteryCapacity ? batteryCapacity / requestedEnergy : 1;

  return hoursByTime.map((hour) => {
    const slotDurationHours = getChargingSlotDurationHours(
      hour.timestamp,
      vehicle.targetTime,
    );
    const chargingPower =
      Math.min(
        vehicle.maxChargingPower * hour.benefit * scale,
        vehicle.maxChargingPower,
      ) * slotDurationHours;

    return {
      hour: hour.timestamp,
      chargingPower: round(chargingPower),
    };
  });
}
