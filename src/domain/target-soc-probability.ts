import { getChargingSlotDurationHours } from "./datetime";
import { forEachBooleanCombination } from "./for-each-boolean-combination";
import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";

export interface ChargingHour {
  /** p(i): probability of a successful connection at this hour. */
  connectionProbability: number;
  /** Energy delivered in this slot when connected, in kWh. */
  energy: number;
}

export interface TargetSocProbabilityResult {
  /** Minimum energy required to reach targetSoc, in kWh. */
  requiredEnergyKwh: number;
  /** Probability that enough energy is delivered across all connection outcomes. */
  probability: number;
}

export function minimumRequiredEnergyKwh(vehicle: Vehicle): number {
  const currentEnergyKwh = vehicle.batteryCapacity * (vehicle.currentSoc / 100);
  const targetEnergyKwh = vehicle.batteryCapacity * (vehicle.targetSoc / 100);

  return targetEnergyKwh - currentEnergyKwh;
}

/**
 * Probability of reaching the required energy by enumerating all connection
 * outcomes. Each hour succeeds with p(i) and delivers its scheduled power,
 * or fails with 1 - p(i) and delivers nothing.
 */
export function calculateTargetSocProbability(
  hours: ChargingHour[],
  requiredEnergyKwh: number,
): number {
  if (requiredEnergyKwh <= 0) {
    return 1;
  }

  const activeHours = hours.filter((hour) => hour.energy > 0);

  if (activeHours.length === 0) {
    return 0;
  }

  let reachTargetProbability = 0;

  forEachBooleanCombination(activeHours.length, (connected) => {
    let probability = 1;
    let energyKwh = 0;

    for (let index = 0; index < activeHours.length; index++) {
      const hour = activeHours[index];

      if (connected[index]) {
        probability *= hour.connectionProbability;
        energyKwh += hour.energy;
      } else {
        probability *= 1 - hour.connectionProbability;
      }
    }

    if (energyKwh >= requiredEnergyKwh) {
      reachTargetProbability += probability;
    }
  });

  return reachTargetProbability;
}

export function calculateTargetSocReachProbability(
  vehicle: Vehicle,
  schedule: ScheduleEntry[],
  forecasts: ForecastHour[],
): TargetSocProbabilityResult {
  const forecastByHour = new Map(
    forecasts.map((forecast) => [forecast.timestamp, forecast]),
  );

  const hours = schedule.map((entry) => ({
    connectionProbability: forecastByHour.get(entry.hour)?.confidence ?? 0,
    energy:
      entry.chargingPower *
      getChargingSlotDurationHours(entry.hour, vehicle.targetTime),
  }));

  const requiredEnergyKwh = minimumRequiredEnergyKwh(vehicle);

  return {
    requiredEnergyKwh,
    probability: calculateTargetSocProbability(hours, requiredEnergyKwh),
  };
}
