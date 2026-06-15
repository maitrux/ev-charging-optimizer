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
  return (
    vehicle.batteryCapacity * ((vehicle.targetSoc - vehicle.currentSoc) / 100)
  );
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
  if (requiredEnergyKwh <= 0) return 1;

  const chargingHours = hours.filter((hour) => hour.energy > 0);

  if (chargingHours.length === 0) return 0;

  let probabilityOfReachingTarget = 0;

  forEachBooleanCombination(chargingHours.length, (isConnected) => {
    let outcomeProbability = 1;
    let deliveredEnergyKwh = 0;

    chargingHours.forEach((hour, index) => {
      if (isConnected[index]) {
        outcomeProbability *= hour.connectionProbability;
        deliveredEnergyKwh += hour.energy;
      } else {
        outcomeProbability *= 1 - hour.connectionProbability;
      }
    });

    if (deliveredEnergyKwh >= requiredEnergyKwh) {
      probabilityOfReachingTarget += outcomeProbability;
    }
  });

  return probabilityOfReachingTarget;
}

/**
 *
 * @param vehicle - The vehicle to calculate the target SoC reach probability for.
 * @param schedule - The schedule to calculate the target SoC reach probability for.
 * @param forecasts - The forecasts to calculate the target SoC reach probability for.
 * @returns number - The target SoC reach probability.
 */
export function calculateTargetSocReachProbability(
  vehicle: Vehicle,
  schedule: ScheduleEntry[],
  forecasts: ForecastHour[],
): number {
  const forecastByHour = new Map(
    forecasts.map((forecast) => [forecast.timestamp, forecast]),
  );

  const hours: ChargingHour[] = schedule.map((entry) => {
    const durationHours = getChargingSlotDurationHours(
      entry.hour,
      vehicle.targetTime,
    );

    return {
      connectionProbability: forecastByHour.get(entry.hour)?.confidence ?? 0,
      energy: entry.chargingPower * durationHours,
    };
  });

  const requiredEnergyKwh = minimumRequiredEnergyKwh(vehicle);

  return calculateTargetSocProbability(hours, requiredEnergyKwh);
}
