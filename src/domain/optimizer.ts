import type { ForecastHour, ScheduleEntry, Vehicle } from "./models";
import { scoreForecasts } from "./scoring";

/**
 * Converts a state of charge percentage into stored battery energy.
 *
 * @param soc State of charge in percent.
 * @param batteryCapacity Battery capacity in kWh.
 * @returns Stored battery energy in kWh.
 */
function socToEnergy(soc: number, batteryCapacity: number): number {
  return (soc / 100) * batteryCapacity;
}

/**
 * Calculates how much additional energy is required to reach the target SoC.
 *
 * @param vehicle Vehicle data.
 * @returns Required charging energy in kWh.
 */
function calculateRequiredEnergy(vehicle: Vehicle): number {
  const currentEnergy = socToEnergy(
    vehicle.currentSoc,
    vehicle.batteryCapacity,
  );
  const targetEnergy = socToEnergy(vehicle.targetSoc, vehicle.batteryCapacity);

  return Math.max(targetEnergy - currentEnergy, 0);
}

/**
 * Checks whether a forecast hour can be used for charging.
 *
 * @param forecast Forecast data for one time slot.
 * @param vehicle Vehicle data.
 * @returns True if the forecast is before or equal to the target time.
 */
function isBeforeTargetTime(forecast: ForecastHour, vehicle: Vehicle): boolean {
  return (
    new Date(forecast.timestamp).getTime() <=
    new Date(vehicle.targetTime).getTime()
  );
}

/**
 * Generates an optimized charging schedule.
 *
 * Strategy:
 * 1. Calculate the energy required to reach the target SoC.
 * 2. Calculate an effective cost for each forecast hour.
 * 3. Rank hours by effective cost.
 * 4. Allocate charging greedily until the required energy is scheduled.
 *
 * Effective cost combines:
 * - electricity price
 * - local solar production
 * - plug-in confidence
 *
 * Lower effective cost means a more attractive charging opportunity.
 *
 * @param vehicle Vehicle data and charging target.
 * @param forecasts Forecast data for the planning horizon.
 * @param slotDurationHours Duration of one forecast slot in hours.
 * @returns Optimized charging schedule.
 */
export function generateChargingSchedule(
  vehicle: Vehicle,
  forecasts: ForecastHour[],
  slotDurationHours = 1,
): ScheduleEntry[] {
  let remainingEnergy = calculateRequiredEnergy(vehicle);

  const schedule: ScheduleEntry[] = forecasts.map((forecast) => ({
    hour: forecast.timestamp,
    chargingPower: 0,
  }));

  if (remainingEnergy <= 0) {
    return schedule;
  }

  const rankedForecasts = scoreForecasts(forecasts, vehicle)
    .filter((forecast) => isBeforeTargetTime(forecast, vehicle))
    .sort((a, b) => a.effectiveCost - b.effectiveCost);

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

  return schedule.sort(
    (a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime(),
  );
}
