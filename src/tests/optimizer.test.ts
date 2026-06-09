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
  it("returns empty charging schedule when target SoC is already reached", () => {
    const satisfiedVehicle: Vehicle = {
      ...vehicle,
      currentSoc: 80,
      targetSoc: 80,
    };

    const result = generateChargingSchedule(satisfiedVehicle, []);

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

  it("allocates enough energy to reach the target", () => {
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

    expect(totalEnergy).toBe(22);
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

  it("prefers a more reliable charging opportunity", () => {
    const oneSlotVehicle: Vehicle = {
      ...vehicle,
      currentSoc: 50,
      targetSoc: 61, // 11 kWh needed for a 100 kWh battery
    };

    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.1,
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
