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
 * Calculates expected delivered energy by weighting each slot's energy
 * with the probability that the vehicle is connected.
 */
function getExpectedEnergyKwh(slots: ChargingSlot[]): number {
  return sum(slots.map((slot) => getSlotEnergyKwh(slot) * slot.confidence));
}

/**
 * Ensures the schedule never charges more energy than the battery can still accept.
 *
 * If the total scheduled energy exceeds the remaining battery capacity,
 * all charging powers are scaled down proportionally while preserving the
 * relative distribution between charging slots.
 */
function scaleToBatteryCapacity(
  slots: ChargingSlot[],
  remainingCapacityKwh: number,
): ChargingSlot[] {
  const totalEnergyKwh = getTotalScheduledEnergyKwh(slots);

  if (totalEnergyKwh <= remainingCapacityKwh) {
    return slots;
  }

  const capacityScale = remainingCapacityKwh / totalEnergyKwh;

  return slots.map((slot) => ({
    ...slot,
    chargingPowerKw: slot.chargingPowerKw * capacityScale,
  }));
}

function createInitialChargingSlots(
  vehicle: Vehicle,
  scoredHours: ScoredForecastHour[],
  remainingCapacityKwh: number,
): ChargingSlot[] {
  const slots = scoredHours.map((hour) => {
    const durationHours = getChargingSlotDurationHours(
      hour.timestamp,
      vehicle.targetTime,
    );

    let chargingPowerKw = 0;

    if (durationHours > 0) {
      chargingPowerKw = vehicle.maxChargingPower * hour.benefit;
    }

    return {
      hour: hour.timestamp,
      confidence: hour.confidence,
      chargingPowerKw,
      durationHours,
    };
  });

  return scaleToBatteryCapacity(slots, remainingCapacityKwh);
}

/**
 * Increases charging power while respecting the max charging power.
 */
function boostChargingPower(
  slots: ChargingSlot[],
  boostRatio: number,
  maxChargingPowerKw: number,
): ChargingSlot[] {
  return slots.map((slot) => {
    let chargingPowerKw = slot.chargingPowerKw * boostRatio;

    if (chargingPowerKw > maxChargingPowerKw) {
      chargingPowerKw = maxChargingPowerKw;
    }

    return {
      ...slot,
      chargingPowerKw,
    };
  });
}

function increasePowerToReachTarget(
  slots: ChargingSlot[],
  requiredEnergyKwh: number,
  maxChargingPowerKw: number,
  remainingCapacityKwh: number,
): ChargingSlot[] {
  let adjustedSlots = slots;

  for (let i = 0; i < MAX_BOOST_ITERATIONS; i++) {
    const expectedEnergyKwh = getExpectedEnergyKwh(adjustedSlots);

    // Stop once the expected energy is sufficient or no further progress
    // can be made.
    if (expectedEnergyKwh >= requiredEnergyKwh || expectedEnergyKwh <= 0) {
      break;
    }

    const boostRatio = requiredEnergyKwh / expectedEnergyKwh;

    const boostedSlots = boostChargingPower(
      adjustedSlots,
      boostRatio,
      maxChargingPowerKw,
    );

    // Boosting can increase the total scheduled energy beyond the remaining
    // battery capacity. Scale the entire schedule down proportionally so
    // that the battery capacity constraint is still respected.
    adjustedSlots = scaleToBatteryCapacity(boostedSlots, remainingCapacityKwh);

    // If the battery is already fully allocated, further iterations can only
    // redistribute energy and will not increase the total scheduled energy.
    if (getTotalScheduledEnergyKwh(adjustedSlots) >= remainingCapacityKwh) {
      break;
    }
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

  let requiredEnergyKwh = minimumRequiredEnergyKwh(vehicle);

  if (requiredEnergyKwh > remainingCapacityKwh) {
    requiredEnergyKwh = remainingCapacityKwh;
  }

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
