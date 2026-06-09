import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";
import { buildChargingBuckets, type ChargingBucket } from "./scoring";

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
 * Takes as much energy as possible from one bucket into the hour's plan.
 *
 * Solar buckets are capped by the forecasted production. Grid buckets can
 * fill whatever slot capacity remains after solar (and earlier allocations)
 * in that hour — this is what allows 3 kW solar-only charging instead of
 * always jumping to maxChargingPower.
 */
function allocateFromBucket(
  bucket: ChargingBucket,
  remainingEnergy: number,
  energyByHour: Map<string, number>,
  maxSlotEnergy: number,
): number {
  const alreadyAllocated = energyByHour.get(bucket.hour) ?? 0;
  const roomInSlot = maxSlotEnergy - alreadyAllocated;

  if (roomInSlot <= 0 || remainingEnergy <= 0) {
    return 0;
  }

  // Solar: use at most the forecasted kWh. Grid: use remaining slot room.
  const availableEnergy =
    bucket.type === "solar" ? Math.min(bucket.energy, roomInSlot) : roomInSlot;

  const energyToTake = Math.min(availableEnergy, remainingEnergy);

  if (energyToTake <= 0) {
    return 0;
  }

  energyByHour.set(bucket.hour, alreadyAllocated + energyToTake);

  return energyToTake;
}

/**
 * Generates an optimized charging schedule.
 *
 * Target SoC is the minimum that must be reachable by target time.
 * When cheap slots remain, the algorithm keeps charging up to 100%.
 *
 * Strategy:
 * 1. Split each hour into free solar energy and risk-adjusted grid energy.
 * 2. Greedily fill the cheapest buckets until the battery plan is satisfied.
 * 3. Convert planned kWh per hour into charging power (kW).
 * 4. Walk the schedule chronologically and clip once the battery is full.
 *
 * Step 2 plans energy by cost, not by time. Step 4 makes the result
 * physically valid: a slot assigned late in the greedy pass is skipped if
 * the battery already reached 100% earlier in the day.
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

  const maxSlotEnergy = vehicle.maxChargingPower * slotDurationHours;
  // Planned kWh per hour before converting to kW and applying time order.
  const energyByHour = new Map<string, number>();
  const rankedBuckets = buildChargingBuckets(
    validForecasts,
    vehicle,
    slotDurationHours,
  );

  for (const bucket of rankedBuckets) {
    if (remainingEnergy <= 0) {
      break;
    }

    remainingEnergy -= allocateFromBucket(
      bucket,
      remainingEnergy,
      energyByHour,
      maxSlotEnergy,
    );
  }

  for (const entry of schedule) {
    const energy = energyByHour.get(entry.hour) ?? 0;
    entry.chargingPower = energy / slotDurationHours;
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
 *
 * Also trims the last slot when only part of the planned energy still fits,
 * e.g. 2.9 kWh into a 3 kWh solar slot on a nearly-full battery.
 */
function enforceBatteryCapacity(
  vehicle: Vehicle,
  schedule: ScheduleEntry[],
  slotDurationHours: number,
): ScheduleEntry[] {
  let currentEnergy = socToEnergy(vehicle.currentSoc, vehicle.batteryCapacity);

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
