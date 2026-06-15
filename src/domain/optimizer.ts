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
 * Expected delivered energy, weighted by plug-in confidence.
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
    requestedEnergyKwh > remainingCapacityKwh
      ? remainingCapacityKwh / requestedEnergyKwh
      : 1;

  return slotsWithDurationHours.map((slot) => ({
    ...slot,
    chargingPowerKw: slot.chargingPowerKw * capacityScale,
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
    chargingPowerKw: Math.min(
      slot.chargingPowerKw * boostRatio,
      maxChargingPowerKw,
    ),
  }));
}

/**
 * Tries to increase the schedule until the confidence-weighted expected energy
 * reaches the required energy.
 */
function increasePowerToReachTarget(
  slots: ChargingSlot[],
  requiredEnergyKwh: number,
  maxChargingPowerKw: number,
): ChargingSlot[] {
  let adjustedSlots = slots;

  for (let i = 0; i < MAX_BOOST_ITERATIONS; i++) {
    const expectedEnergyKwh = getExpectedEnergyKwh(adjustedSlots);

    if (expectedEnergyKwh >= requiredEnergyKwh || expectedEnergyKwh <= 0) {
      break;
    }

    adjustedSlots = boostChargingPower(
      adjustedSlots,
      requiredEnergyKwh / expectedEnergyKwh,
      maxChargingPowerKw,
    );
  }

  return adjustedSlots;
}

/**
 * Ensures the schedule does not charge more energy than the battery can accept.
 * Keeps the relative charging distribution between slots unchanged.
 */
function capScheduleToBatteryCapacity(
  slots: ChargingSlot[],
  remainingCapacityKwh: number,
): ChargingSlot[] {
  const totalEnergyKwh = getTotalScheduledEnergyKwh(slots);

  if (totalEnergyKwh <= remainingCapacityKwh) {
    return slots;
  }

  const scale = remainingCapacityKwh / totalEnergyKwh;

  return slots.map((slot) => ({
    ...slot,
    chargingPowerKw: slot.chargingPowerKw * scale,
  }));
}

/**
 * Generates a charging schedule that:
 * - prefers cheap, solar-rich, and reliable hours,
 * - tries to reach the target SoC with high confidence,
 * - never exceeds the vehicle's max charging power,
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

  // Until here, OK
  const scoredHours = scoreForecastHours(forecastsBeforeTarget);

  const remainingCapacityKwh = remainingBatteryCapacityKwh(vehicle);

  if (remainingCapacityKwh <= 0) {
    return [];
  }

  const requiredEnergyKwh = Math.min(
    minimumRequiredEnergyKwh(vehicle),
    remainingCapacityKwh,
  );

  console.log("requiredEnergyKwh", requiredEnergyKwh);

  const initialSlots = createInitialChargingSlots(
    vehicle,
    scoredHours,
    remainingCapacityKwh,
  );

  const boostedSlots = increasePowerToReachTarget(
    initialSlots,
    requiredEnergyKwh,
    vehicle.maxChargingPower,
  );

  const finalSlots = capScheduleToBatteryCapacity(
    boostedSlots,
    remainingCapacityKwh,
  );

  const slotsByHour = new Map(finalSlots.map((slot) => [slot.hour, slot]));

  return [...scoredHours]
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .map((hour) => {
      const slot = slotsByHour.get(hour.timestamp);

      return {
        hour: hour.timestamp,
        chargingPower: round(slot?.chargingPowerKw ?? 0),
      };
    });
}
