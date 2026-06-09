import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";
import { scoreForecasts } from "./scoring";

/**
 * Converts a state of charge percentage into stored battery energy.
 */
function socToEnergy(soc: number, batteryCapacity: number): number {
  return (soc / 100) * batteryCapacity;
}

/**
 * How much more energy can fit in the battery (up to 100% SoC).
 */
function calculateAvailableChargeEnergy(vehicle: Vehicle): number {
  const currentEnergy = socToEnergy(
    vehicle.currentSoc,
    vehicle.batteryCapacity,
  );

  return Math.max(vehicle.batteryCapacity - currentEnergy, 0);
}

function isBeforeTargetTime(forecast: ForecastHour, vehicle: Vehicle): boolean {
  return (
    new Date(forecast.timestamp).getTime() <=
    new Date(vehicle.targetTime).getTime()
  );
}

/**
 * Generates an optimized charging schedule.
 *
 * Target SoC is the minimum that must be reachable by target time.
 * When cheap slots remain, the algorithm keeps charging up to 100%.
 *
 * Strategy:
 * 1. Rank hours before target time by effective cost.
 * 2. Greedily fill the cheapest slots until the battery is full or slots run out.
 * 3. Apply the result in time order without exceeding battery capacity.
 */
export function generateChargingSchedule(
  vehicle: Vehicle,
  forecasts: ForecastHour[],
  slotDurationHours = 1,
): ScheduleEntry[] {
  let remainingEnergy = calculateAvailableChargeEnergy(vehicle);

  const validForecasts = forecasts.filter((forecast) =>
    isBeforeTargetTime(forecast, vehicle),
  );

  const schedule: ScheduleEntry[] = validForecasts.map((forecast) => ({
    hour: forecast.timestamp,
    chargingPower: 0,
  }));

  if (remainingEnergy <= 0) {
    return schedule;
  }

  const rankedForecasts = scoreForecasts(validForecasts, vehicle).sort(
    (a, b) => a.effectiveCost - b.effectiveCost,
  );

  for (const forecast of rankedForecasts) {
    if (remainingEnergy <= 0) {
      break;
    }

    const maxEnergyThisSlot = vehicle.maxChargingPower * slotDurationHours;
    const energyToCharge = Math.min(maxEnergyThisSlot, remainingEnergy);

    const scheduleEntry = schedule.find(
      (entry) => entry.hour === forecast.timestamp,
    );

    if (scheduleEntry) {
      scheduleEntry.chargingPower = energyToCharge / slotDurationHours;
    }

    remainingEnergy -= energyToCharge;
  }

  const chronologicalSchedule = schedule.sort(
    (a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime(),
  );

  return enforceBatteryCapacity(
    vehicle,
    chronologicalSchedule,
    slotDurationHours,
  );
}

/**
 * Applies charging in time order and stops once the battery is full.
 */
function enforceBatteryCapacity(
  vehicle: Vehicle,
  schedule: ScheduleEntry[],
  slotDurationHours: number,
): ScheduleEntry[] {
  let currentEnergy = socToEnergy(
    vehicle.currentSoc,
    vehicle.batteryCapacity,
  );

  return schedule.map((entry) => {
    if (currentEnergy >= vehicle.batteryCapacity) {
      return { ...entry, chargingPower: 0 };
    }

    const remainingEnergy = vehicle.batteryCapacity - currentEnergy;
    const maxEnergyThisSlot = entry.chargingPower * slotDurationHours;
    const energyToApply = Math.min(maxEnergyThisSlot, remainingEnergy);
    const chargingPower = energyToApply / slotDurationHours;

    currentEnergy += energyToApply;

    return { ...entry, chargingPower };
  });
}
