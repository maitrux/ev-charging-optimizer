import { getChargingSlotDurationHours } from "./datetime";
import type {
  ForecastHour,
  ScheduleEntry,
  ScoredForecastHour,
  Vehicle,
} from "./models";
import { scoreForecastHours } from "./scoring";
import { minimumRequiredEnergyKwh } from "./target-soc-probability";

const MAX_BOOST_ITERATIONS = 10;

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function remainingBatteryCapacityKwh(vehicle: Vehicle): number {
  const currentEnergyKwh = vehicle.batteryCapacity * (vehicle.currentSoc / 100);
  return Math.max(0, vehicle.batteryCapacity - currentEnergyKwh);
}

interface ChargingSlot {
  hour: string;

  /** Probability that the vehicle is connected during this slot. */
  confidence: number;

  /** Charging power during this slot, in kW. */
  chargingPowerKw: number;

  /** Slot duration, in hours. Usually 1, but may be shorter if the target time is in the middle of the slot. */
  durationHours: number;
}

function sum(values: number[]): number {
  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total;
}

function getSlotEnergyKwh(slot: ChargingSlot): number {
  return slot.chargingPowerKw * slot.durationHours;
}

function getTotalScheduledEnergyKwh(slots: ChargingSlot[]): number {
  return sum(slots.map(getSlotEnergyKwh));
}

/**
 * Expected delivered energy multiplied by plug-in confidence.
 */
function getExpectedEnergyKwh(slots: ChargingSlot[]): number {
  return sum(slots.map((slot) => getSlotEnergyKwh(slot) * slot.confidence));
}

function createInitialChargingSlots(
  vehicle: Vehicle,
  scoredHours: ScoredForecastHour[],
  remainingCapacityKwh: number,
): ChargingSlot[] {
  const slotsWithDurationHours = scoredHours.map((hour) => {
    const durationHours = getChargingSlotDurationHours(
      hour.timestamp,
      vehicle.targetTime,
    );

    return {
      hour: hour.timestamp,
      confidence: hour.confidence,
      chargingPowerKw: vehicle.maxChargingPower * hour.benefit,
      durationHours,
    };
  });

  const requestedEnergyKwh = getTotalScheduledEnergyKwh(slotsWithDurationHours);

  const capacityScale =
    requestedEnergyKwh > 0
      ? Math.min(1, remainingCapacityKwh / requestedEnergyKwh)
      : 1;

  return slotsWithDurationHours.map((slot) => ({
    ...slot,
    chargingPowerKw:
      slot.durationHours === 0 ? 0 : slot.chargingPowerKw * capacityScale,
  }));
}

/**
 * Increases charging power while respecting the max charging power.
 */
function boostChargingPower(
  slots: ChargingSlot[],
  boostRatio: number,
  maxChargingPowerKw: number,
): ChargingSlot[] {
  return slots.map((slot) => ({
    ...slot,
    chargingPowerKw: Math.max(
      0,
      Math.min(slot.chargingPowerKw * boostRatio, maxChargingPowerKw),
    ),
  }));
}

/**
 * Tries to increase the schedule until the expected energy
 * reaches the required energy.
 */
function increasePowerToReachTarget(
  slots: ChargingSlot[],
  requiredEnergyKwh: number,
  maxChargingPowerKw: number,
  remainingCapacityKwh: number,
): ChargingSlot[] {
  let adjustedSlots = slots;

  for (let i = 0; i < MAX_BOOST_ITERATIONS; i++) {
    const expectedEnergyKwh = getExpectedEnergyKwh(adjustedSlots);

    if (expectedEnergyKwh >= requiredEnergyKwh || expectedEnergyKwh <= 0) {
      break;
    }

    const boostRatio = requiredEnergyKwh / expectedEnergyKwh;

    const boostedSlots = boostChargingPower(
      adjustedSlots,
      boostRatio,
      maxChargingPowerKw,
    );

    if (getTotalScheduledEnergyKwh(boostedSlots) > remainingCapacityKwh) {
      break;
    }

    adjustedSlots = boostedSlots;
  }

  return adjustedSlots;
}

/**
 * Generates a charging schedule that:
 * - scores forecast hours by benefit (how attractive the hour is to charge the vehicle)
 * - iterates to increase the charging power until the expected energy reaches the required energy,
 * - never exceeds the vehicle's maximum charging power,
 * - never schedules more energy than the battery capacity allows.
 */
export function generateChargingSchedule(
  vehicle: Vehicle,
  forecasts: ForecastHour[],
): ScheduleEntry[] {
  const targetTimeMs = new Date(vehicle.targetTime).getTime();

  const forecastsBeforeTarget = forecasts.filter(
    (forecast) => new Date(forecast.timestamp).getTime() <= targetTimeMs,
  );

  const scoredHours = scoreForecastHours(forecastsBeforeTarget);

  const remainingCapacityKwh = remainingBatteryCapacityKwh(vehicle);

  if (remainingCapacityKwh <= 0) {
    return [];
  }

  const requiredEnergyKwh = Math.min(
    minimumRequiredEnergyKwh(vehicle),
    remainingCapacityKwh,
  );

  const initialSlots = createInitialChargingSlots(
    vehicle,
    scoredHours,
    remainingCapacityKwh,
  );

  const boostedSlots = increasePowerToReachTarget(
    initialSlots,
    requiredEnergyKwh,
    vehicle.maxChargingPower,
    remainingCapacityKwh,
  );

  return boostedSlots.map((slot) => ({
    hour: slot.hour,
    chargingPower: round(slot.chargingPowerKw),
  }));
}
