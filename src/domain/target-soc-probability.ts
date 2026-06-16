import { getChargingSlotDurationHours } from "./datetime";
import { forEachBooleanCombination } from "./for-each-boolean-combination";
import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";

export interface ChargingSlot {
  /** Probability of a successful connection during this slot. */
  connectionProbability: number;

  /** Energy delivered during this slot when connected, in kWh. */
  energyKwh: number;
}

/**
 * Calculates the minimum amount of energy required to reach the target SoC.
 *
 * @param vehicle - Vehicle configuration and current charging state.
 * @returns Required energy in kWh.
 */
export function minimumRequiredEnergyKwh(vehicle: Vehicle): number {
  return (
    vehicle.batteryCapacity * ((vehicle.targetSoc - vehicle.currentSoc) / 100)
  );
}

/**
 * Calculates the probability of delivering at least the required amount of
 * energy by evaluating all possible connection outcomes.
 *
 * For each charging slot:
 * - A successful connection occurs with probability p(i) and delivers the
 *   slot's scheduled energy.
 * - A failed connection occurs with probability 1 - p(i) and delivers no
 *   energy.
 *
 * The probability of every outcome that delivers at least the required
 * amount of energy is summed to produce the final result.
 *
 * @param chargingSlots - Charging slots with connection probabilities and
 * scheduled energy delivery.
 * @param requiredEnergyKwh - Minimum energy that must be delivered to reach the target SoC.
 * @returns Probability of delivering at least the required energy,
 * between 0 and 1.
 */
export function calculateEnergyDeliveryProbability(
  chargingSlots: ChargingSlot[],
  requiredEnergyKwh: number,
): number {
  if (requiredEnergyKwh <= 0) {
    return 1;
  }

  const activeChargingSlots = chargingSlots.filter(
    (slot) => slot.energyKwh > 0,
  );

  if (activeChargingSlots.length === 0) {
    return 0;
  }

  let probabilityOfReachingTarget = 0;

  forEachBooleanCombination(
    activeChargingSlots.length,
    (connectionOutcomes) => {
      let outcomeProbability = 1;
      let deliveredEnergyKwh = 0;

      activeChargingSlots.forEach((slot, index) => {
        if (connectionOutcomes[index]) {
          outcomeProbability *= slot.connectionProbability;
          deliveredEnergyKwh += slot.energyKwh;
        } else {
          outcomeProbability *= 1 - slot.connectionProbability;
        }
      });

      if (deliveredEnergyKwh >= requiredEnergyKwh) {
        probabilityOfReachingTarget += outcomeProbability;
      }
    },
  );

  return probabilityOfReachingTarget;
}

/**
 * Calculates the probability of reaching the vehicle's target SoC.
 *
 * The charging schedule and forecast data are converted into charging slots,
 * each containing:
 * - The probability of a successful connection.
 * - The amount of energy delivered if the connection succeeds.
 *
 * The required energy to reach the target SoC is then calculated and passed
 * to the energy delivery probability calculation.
 *
 * @param vehicle - Vehicle configuration and charging target.
 * @param schedule - Planned charging schedule.
 * @param forecasts - Connection probability forecasts for each time slot.
 * @returns Probability of reaching the target SoC, between 0 and 1.
 */
export function calculateTargetSocReachProbability(
  vehicle: Vehicle,
  schedule: ScheduleEntry[],
  forecasts: ForecastHour[],
): number {
  const forecastByHour = new Map(
    forecasts.map((forecast) => [forecast.timestamp, forecast]),
  );

  const chargingSlots: ChargingSlot[] = schedule.map((scheduleEntry) => {
    const forecast = forecastByHour.get(scheduleEntry.hour);
    const connectionProbability = forecast?.confidence ?? 0;

    const durationHours = getChargingSlotDurationHours(
      scheduleEntry.hour,
      vehicle.targetTime,
    );

    const energyKwh = scheduleEntry.chargingPower * durationHours;

    return {
      connectionProbability,
      energyKwh,
    };
  });

  const requiredEnergyKwh = minimumRequiredEnergyKwh(vehicle);

  return calculateEnergyDeliveryProbability(chargingSlots, requiredEnergyKwh);
}
