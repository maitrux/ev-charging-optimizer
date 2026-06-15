import { describe, expect, it } from "vitest";
import type { Vehicle } from "../domain/models";
import {
  calculateTargetSocProbability,
  calculateTargetSocReachProbability,
  minimumRequiredEnergyKwh,
} from "../domain/target-soc-probability";

describe("minimumRequiredEnergyKwh", () => {
  it("returns the gap between current and target energy", () => {
    const vehicle: Vehicle = {
      batteryCapacity: 100,
      currentSoc: 50,
      targetSoc: 72,
      targetTime: "2026-06-10T13:00:00Z",
      maxChargingPower: 11,
    };

    expect(minimumRequiredEnergyKwh(vehicle)).toBe(22);
  });
});

describe("calculateTargetSocProbability", () => {
  it("matches the two-hour example from the specification", () => {
    const probability = calculateTargetSocProbability(
      [
        { connectionProbability: 0.7, energy: 3 },
        { connectionProbability: 0.4, energy: 6 },
      ],
      5,
    );

    expect(probability).toBeCloseTo(0.4, 5);
  });

  it("returns 1 when no additional energy is required", () => {
    const probability = calculateTargetSocProbability(
      [{ connectionProbability: 0.5, energy: 5 }],
      0,
    );

    expect(probability).toBe(1);
  });

  it("returns 0 when there are no charging slots", () => {
    const probability = calculateTargetSocProbability([], 10);

    expect(probability).toBe(0);
  });

  it("returns the connection probability for a single sufficient slot", () => {
    const probability = calculateTargetSocProbability(
      [{ connectionProbability: 0.65, energy: 8 }],
      5,
    );

    expect(probability).toBeCloseTo(0.65, 5);
  });

  it("ignores zero-power slots", () => {
    const withZeroPower = calculateTargetSocProbability(
      [
        { connectionProbability: 0.7, energy: 3 },
        { connectionProbability: 0.5, energy: 0 },
        { connectionProbability: 0.4, energy: 6 },
      ],
      5,
    );

    const withoutZeroPower = calculateTargetSocProbability(
      [
        { connectionProbability: 0.7, energy: 3 },
        { connectionProbability: 0.4, energy: 6 },
      ],
      5,
    );

    expect(withZeroPower).toBeCloseTo(withoutZeroPower, 5);
  });
});

describe("calculateTargetSocReachProbability", () => {
  it("uses schedule power and forecast confidence per hour", () => {
    const vehicle: Vehicle = {
      batteryCapacity: 100,
      currentSoc: 50,
      targetSoc: 55,
      targetTime: "2026-06-10T12:00:00Z",
      maxChargingPower: 10,
    };

    const result = calculateTargetSocReachProbability(
      vehicle,
      [
        { hour: "2026-06-10T10:00:00Z", chargingPower: 3 },
        { hour: "2026-06-10T11:00:00Z", chargingPower: 6 },
      ],
      [
        {
          timestamp: "2026-06-10T10:00:00Z",
          price: 0.2,
          solar: 0,
          confidence: 0.7,
        },
        {
          timestamp: "2026-06-10T11:00:00Z",
          price: 0.2,
          solar: 0,
          confidence: 0.4,
        },
      ],
    );

    expect(result.requiredEnergyKwh).toBeCloseTo(5, 5);
    expect(result.probability).toBeCloseTo(0.4, 5);
  });

  it("defaults connection probability to 0 when a schedule hour has no forecast", () => {
    const vehicle: Vehicle = {
      batteryCapacity: 100,
      currentSoc: 50,
      targetSoc: 55,
      targetTime: "2026-06-10T12:00:00Z",
      maxChargingPower: 10,
    };

    const schedule = [
      { hour: "2026-06-10T10:00:00Z", chargingPower: 3 },
      { hour: "2026-06-10T11:00:00Z", chargingPower: 6 },
    ];

    const result = calculateTargetSocReachProbability(vehicle, schedule, [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.2,
        solar: 0,
        confidence: 0.7,
      },
    ]);

    const expected = calculateTargetSocProbability(
      [
        { connectionProbability: 0.7, energy: 3 },
        { connectionProbability: 0, energy: 6 },
      ],
      minimumRequiredEnergyKwh(vehicle),
    );

    // Missing forecast for hour 2 falls back to connectionProbability = 0.
    expect(result.probability).toBeCloseTo(expected, 5);
  });
});
