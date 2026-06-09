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

  // targetSoc is the minimum that must be reachable; keep allocating by benefit up to 100%.
  let remainingEnergy = availableCapacity;

  const scheduleByHour = new Map<string, number>();

  for (const hour of scoredHours) {
    const suggestedPower = vehicle.maxChargingPower * hour.benefit;

    scheduleByHour.set(
      hour.timestamp,
      clamp(suggestedPower, 0, vehicle.maxChargingPower),
    );
  }

  const sortedByBenefit = [...scoredHours].sort(
    (a, b) => b.benefit - a.benefit,
  );

  for (const hour of sortedByBenefit) {
    if (remainingEnergy <= 0) {
      scheduleByHour.set(hour.timestamp, 0);
      continue;
    }

    const bucketPower = scheduleByHour.get(hour.timestamp) ?? 0;

    const chargingPower = clamp(
      Math.min(bucketPower, remainingEnergy),
      0,
      vehicle.maxChargingPower,
    );

    scheduleByHour.set(hour.timestamp, chargingPower);

    remainingEnergy -= chargingPower;
  }

  let shortfall = availableCapacity - totalScheduledPower(scheduleByHour);

  for (const hour of sortedByBenefit) {
    let current = scheduleByHour.get(hour.timestamp) ?? 0;
    let room = vehicle.maxChargingPower - current;

    if (room <= 0) {
      continue;
    }

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
      current += move;
      room -= move;
    }

    scheduleByHour.set(hour.timestamp, current);
  }

  shortfall = availableCapacity - totalScheduledPower(scheduleByHour);

  for (const hour of sortedByBenefit) {
    if (shortfall <= 0) {
      break;
    }

    const current = scheduleByHour.get(hour.timestamp) ?? 0;
    const room = vehicle.maxChargingPower - current;

    if (room <= 0) {
      continue;
    }

    const add = Math.min(room, shortfall);

    scheduleByHour.set(hour.timestamp, current + add);
    shortfall -= add;
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
