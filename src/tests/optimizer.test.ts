import { describe, expect, it } from "vitest";
import type { ForecastHour, Vehicle } from "../domain/models";
import { generateChargingSchedule } from "../domain/optimizer";

const vehicle: Vehicle = {
  batteryCapacity: 100,
  currentSoc: 50,
  targetSoc: 72,
  targetTime: "2026-06-10T13:00:00Z",
  maxChargingPower: 11,
};

describe("generateChargingSchedule", () => {
  it("returns empty charging schedule when the battery is already full", () => {
    const fullBattery: Vehicle = {
      ...vehicle,
      currentSoc: 100,
      targetSoc: 80,
    };

    const result = generateChargingSchedule(fullBattery, []);

    expect(result).toEqual([]);
  });

  it("never exceeds max charging power", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
    ];

    const schedule = generateChargingSchedule(vehicle, forecasts);

    expect(schedule[0].chargingPower).toBeLessThanOrEqual(
      vehicle.maxChargingPower,
    );
  });

  it("prefers lower effective cost hours", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.5,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
    ];

    const schedule = generateChargingSchedule(vehicle, forecasts);

    const cheapHour = schedule.find(
      (entry) => entry.hour === "2026-06-10T11:00:00Z",
    );

    expect(cheapHour?.chargingPower).toBeGreaterThan(0);
  });

  it("includes the hour bucket that contains a sub-hour target time", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T13:00:00Z",
        price: 0.2,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T14:00:00Z",
        price: 0.3,
        solar: 0,
        confidence: 1,
      },
    ];

    const schedule = generateChargingSchedule(
      { ...vehicle, targetTime: "2026-06-10T13:30:00Z" },
      forecasts,
    );

    expect(schedule.map((entry) => entry.hour)).toEqual([
      "2026-06-10T12:00:00Z",
      "2026-06-10T13:00:00Z",
    ]);
  });

  it("excludes hours after target time from the schedule", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T13:00:00Z",
        price: 0.2,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T18:00:00Z",
        price: 0.01,
        solar: 10,
        confidence: 1,
      },
    ];

    const schedule = generateChargingSchedule(vehicle, forecasts);

    expect(schedule).toHaveLength(2);

    expect(schedule.map((entry) => entry.hour)).toEqual([
      "2026-06-10T12:00:00Z",
      "2026-06-10T13:00:00Z",
    ]);

    expect(
      schedule.some((entry) => entry.hour === "2026-06-10T18:00:00Z"),
    ).toBe(false);
  });

  it("allocates at least enough energy to reach the minimum target SoC", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
    ];

    const schedule = generateChargingSchedule(vehicle, forecasts);

    const totalEnergy = schedule.reduce(
      (sum, entry) => sum + entry.chargingPower,
      0,
    );
    const requiredEnergy =
      ((vehicle.targetSoc - vehicle.currentSoc) / 100) * vehicle.batteryCapacity;

    expect(totalEnergy).toBeGreaterThanOrEqual(requiredEnergy);
  });

  it("prefers a solar-rich charging opportunity", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.2,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.25,
        solar: 11,
        confidence: 1,
      },
    ];

    const schedule = generateChargingSchedule(vehicle, forecasts);

    const solarHour = schedule.find(
      (entry) => entry.hour === "2026-06-10T11:00:00Z",
    );

    expect(solarHour?.chargingPower).toBeGreaterThan(0);
  });

  it("scales charging power proportionally to benefit", () => {
    const partialSolarVehicle: Vehicle = {
      batteryCapacity: 58,
      currentSoc: 95,
      targetSoc: 80,
      maxChargingPower: 7.4,
      targetTime: "2026-06-10T13:00:00Z",
    };

    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.28,
        solar: 3,
        confidence: 0.95,
      },
    ];

    const schedule = generateChargingSchedule(partialSolarVehicle, forecasts);
    const solarHour = schedule.find(
      (entry) => entry.hour === "2026-06-10T11:00:00Z",
    );

    expect(solarHour!.chargingPower).toBeGreaterThan(0);
    expect(solarHour!.chargingPower).toBeLessThanOrEqual(
      partialSolarVehicle.maxChargingPower,
    );
  });

  it("assigns higher charging power to higher-benefit hours", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T02:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.28,
        solar: 3,
        confidence: 0.95,
      },
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.22,
        solar: 5,
        confidence: 0.9,
      },
    ];

    const id3: Vehicle = {
      batteryCapacity: 58,
      currentSoc: 25,
      targetSoc: 80,
      maxChargingPower: 7.4,
      targetTime: "2026-06-10T16:00:00Z",
    };

    const schedule = generateChargingSchedule(id3, forecasts);

    const cheapNight = schedule.find(
      (entry) => entry.hour === "2026-06-10T02:00:00Z",
    );
    const solarMorning = schedule.find(
      (entry) => entry.hour === "2026-06-10T11:00:00Z",
    );
    const solarMidday = schedule.find(
      (entry) => entry.hour === "2026-06-10T12:00:00Z",
    );

    expect(solarMidday!.chargingPower).toBeGreaterThan(
      solarMorning!.chargingPower,
    );
    expect(solarMidday!.chargingPower).toBeGreaterThan(
      cheapNight!.chargingPower,
    );
  });

  it("keeps charging past the minimum target when cheap slots remain", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.16,
        solar: 2.8,
        confidence: 0.85,
      },
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.17,
        solar: 4,
        confidence: 0.7,
      },
      {
        timestamp: "2026-06-10T13:00:00Z",
        price: 0.21,
        solar: 4.5,
        confidence: 0.6,
      },
      {
        timestamp: "2026-06-10T14:00:00Z",
        price: 0.27,
        solar: 3.2,
        confidence: 0.7,
      },
    ];

    const tesla: Vehicle = {
      batteryCapacity: 60,
      currentSoc: 40,
      targetSoc: 70,
      maxChargingPower: 11,
      targetTime: "2026-06-10T20:30:00Z",
    };

    const schedule = generateChargingSchedule(tesla, forecasts);
    const totalEnergy = schedule.reduce(
      (sum, entry) => sum + entry.chargingPower,
      0,
    );
    const minimumEnergy =
      ((tesla.targetSoc - tesla.currentSoc) / 100) * tesla.batteryCapacity;

    expect(totalEnergy).toBeGreaterThan(minimumEnergy);
  });

  it("keeps charging power proportional to benefit when total energy is capped", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T06:00:00Z",
        price: 0.32,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.18,
        solar: 1.5,
        confidence: 0.9,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.16,
        solar: 2.8,
        confidence: 0.85,
      },
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.17,
        solar: 4,
        confidence: 0.7,
      },
    ];

    const zoe: Vehicle = {
      batteryCapacity: 52,
      currentSoc: 55,
      targetSoc: 90,
      maxChargingPower: 22,
      targetTime: "2026-06-10T16:00:00Z",
    };

    const schedule = generateChargingSchedule(zoe, forecasts);
    const peakHour = schedule.find(
      (entry) => entry.hour === "2026-06-10T12:00:00Z",
    );
    const earlyHour = schedule.find(
      (entry) => entry.hour === "2026-06-10T06:00:00Z",
    );

    expect(peakHour!.chargingPower).toBeGreaterThan(earlyHour!.chargingPower);
  });

  it("does not charge after the battery is full chronologically", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
    ];

    const smallBatteryVehicle: Vehicle = {
      batteryCapacity: 20,
      currentSoc: 50,
      targetSoc: 70,
      maxChargingPower: 10,
      targetTime: "2026-06-10T13:00:00Z",
    };

    const schedule = generateChargingSchedule(smallBatteryVehicle, forecasts);
    let currentEnergy =
      (smallBatteryVehicle.currentSoc / 100) *
      smallBatteryVehicle.batteryCapacity;
    let batteryFull = false;

    for (const entry of schedule) {
      if (batteryFull) {
        expect(entry.chargingPower).toBe(0);
        continue;
      }

      currentEnergy += entry.chargingPower;

      if (currentEnergy >= smallBatteryVehicle.batteryCapacity) {
        batteryFull = true;
      }
    }
  });

  it("prefers a more reliable charging opportunity", () => {
    const oneSlotVehicle: Vehicle = {
      ...vehicle,
      currentSoc: 89, // only 11 kWh of room left to reach 100%
      targetSoc: 80,
    };

    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.15,
        solar: 0,
        confidence: 0.1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.15,
        solar: 0,
        confidence: 1.0,
      },
    ];

    const schedule = generateChargingSchedule(oneSlotVehicle, forecasts);

    const unreliableHour = schedule.find(
      (entry) => entry.hour === "2026-06-10T10:00:00Z",
    );

    const reliableHour = schedule.find(
      (entry) => entry.hour === "2026-06-10T11:00:00Z",
    );

    expect(reliableHour?.chargingPower).toBe(11);
    expect(unreliableHour?.chargingPower).toBe(0);
  });
});
