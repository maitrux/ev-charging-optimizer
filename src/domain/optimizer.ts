import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";
import { scoreForecastHours } from "./scoring";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function getAvailableCapacityKwh(vehicle: Vehicle): number {
  const currentEnergy = vehicle.batteryCapacity * (vehicle.currentSoc / 100);

  return Math.max(0, vehicle.batteryCapacity - currentEnergy);
}

function totalScheduledPower(scheduleByHour: Map<string, number>): number {
  let total = 0;

  for (const power of scheduleByHour.values()) {
    total += power;
  }

  return total;
}

function bucketPower(
  vehicle: Vehicle,
  benefit: number,
): number {
  return clamp(vehicle.maxChargingPower * benefit, 0, vehicle.maxChargingPower);
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

  const sortedByBenefit = [...scoredHours].sort(
    (a, b) => b.benefit - a.benefit,
  );

  const scheduleByHour = new Map(
    scoredHours.map((hour) => [
      hour.timestamp,
      bucketPower(vehicle, hour.benefit),
    ]),
  );

  for (const hour of sortedByBenefit) {
    let power = scheduleByHour.get(hour.timestamp) ?? 0;
    let room = vehicle.maxChargingPower - power;

    for (const donor of [...sortedByBenefit].reverse()) {
      if (room <= 0) {
        break;
      }

      if (donor.benefit >= hour.benefit) {
        continue;
      }

      const donorPower = scheduleByHour.get(donor.timestamp) ?? 0;
      const move = Math.min(donorPower, room);

      scheduleByHour.set(donor.timestamp, donorPower - move);
      power += move;
      room -= move;
    }

    scheduleByHour.set(hour.timestamp, power);
  }

  let shortfall = availableCapacity - totalScheduledPower(scheduleByHour);

  for (const hour of sortedByBenefit) {
    if (shortfall <= 0) {
      break;
    }

    const current = scheduleByHour.get(hour.timestamp) ?? 0;
    const add = Math.min(vehicle.maxChargingPower - current, shortfall);

    scheduleByHour.set(hour.timestamp, current + add);
    shortfall -= add;
  }

  let overflow = totalScheduledPower(scheduleByHour) - availableCapacity;

  for (const hour of [...sortedByBenefit].reverse()) {
    if (overflow <= 0) {
      break;
    }

    const current = scheduleByHour.get(hour.timestamp) ?? 0;
    const remove = Math.min(current, overflow);

    scheduleByHour.set(hour.timestamp, current - remove);
    overflow -= remove;
  }

  return scoredHours
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .map((hour) => ({
      hour: hour.timestamp,
      chargingPower: round(scheduleByHour.get(hour.timestamp) ?? 0),
    }));
}
