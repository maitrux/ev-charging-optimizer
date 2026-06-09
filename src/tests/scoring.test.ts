import { describe, expect, it } from "vitest";
import type { ForecastHour, Vehicle } from "../domain/models";
import {
  buildChargingBuckets,
  buildHourlyChargingBuckets,
  calculateGridCostPerKwh,
  calculateSolarBucketEnergy,
} from "../domain/scoring";

const vehicle: Vehicle = {
  batteryCapacity: 75,
  currentSoc: 20,
  targetSoc: 80,
  targetTime: "2026-06-10T15:00:00Z",
  maxChargingPower: 11,
};

describe("calculateSolarBucketEnergy", () => {
  it("returns 0 when no solar is available", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 0,
      confidence: 1,
    };

    expect(calculateSolarBucketEnergy(forecast, vehicle)).toBe(0);
  });

  it("caps solar energy at the max charging power for one slot", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 100,
      confidence: 1,
    };

    expect(calculateSolarBucketEnergy(forecast, vehicle)).toBe(11);
  });

  it("returns 0 when plug-in confidence is zero", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 5,
      confidence: 0,
    };

    expect(calculateSolarBucketEnergy(forecast, vehicle)).toBe(0);
  });
});

describe("calculateGridCostPerKwh", () => {
  it("returns infinity for zero confidence", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 0,
      confidence: 0,
    };

    expect(calculateGridCostPerKwh(forecast)).toBe(Number.POSITIVE_INFINITY);
  });

  it("penalizes low confidence", () => {
    const highConfidence: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 0,
      confidence: 1,
    };

    const lowConfidence: ForecastHour = {
      timestamp: "2026-06-10T11:00:00Z",
      price: 0.3,
      solar: 0,
      confidence: 0.5,
    };

    expect(calculateGridCostPerKwh(lowConfidence)).toBeGreaterThan(
      calculateGridCostPerKwh(highConfidence),
    );
  });
});

describe("buildHourlyChargingBuckets", () => {
  it("creates separate solar and grid buckets", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T11:00:00Z",
      price: 0.28,
      solar: 3,
      confidence: 0.95,
    };

    const buckets = buildHourlyChargingBuckets(forecast, vehicle);

    expect(buckets).toEqual([
      {
        hour: "2026-06-10T11:00:00Z",
        type: "solar",
        energy: 3,
        costPerKwh: 0,
      },
      {
        hour: "2026-06-10T11:00:00Z",
        type: "grid",
        energy: 8,
        costPerKwh: 0.28 / 0.95,
      },
    ]);
  });
});

describe("buildChargingBuckets", () => {
  it("ranks solar buckets before grid buckets", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.1,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.3,
        solar: 3,
        confidence: 1,
      },
    ];

    const buckets = buildChargingBuckets(forecasts, vehicle);

    expect(buckets[0]).toMatchObject({ type: "solar", costPerKwh: 0 });
    expect(buckets[1]).toMatchObject({
      hour: "2026-06-10T10:00:00Z",
      type: "grid",
      costPerKwh: 0.1,
    });
  });
});
