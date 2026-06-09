import { describe, expect, it } from "vitest";
import type { ForecastHour, Vehicle } from "../domain/models";
import {
  calculateEffectiveCost,
  calculateSolarCoverageRatio,
} from "../domain/scoring";

const vehicle: Vehicle = {
  batteryCapacity: 75,
  currentSoc: 20,
  targetSoc: 80,
  targetTime: "2026-06-10T15:00:00Z",
  maxChargingPower: 11,
};

describe("calculateSolarCoverageRatio", () => {
  it("returns 0 when no solar is available", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 0,
      confidence: 1,
    };

    expect(calculateSolarCoverageRatio(forecast, vehicle)).toBe(0);
  });

  it("caps solar coverage at 1", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 100,
      confidence: 1,
    };

    expect(calculateSolarCoverageRatio(forecast, vehicle)).toBe(1);
  });
});

describe("calculateEffectiveCost", () => {
  it("returns infinity for zero confidence", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 0,
      confidence: 0,
    };

    expect(calculateEffectiveCost(forecast, vehicle)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("reduces cost when solar is available", () => {
    const withoutSolar: ForecastHour = {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.3,
      solar: 0,
      confidence: 1,
    };

    const withSolar: ForecastHour = {
      timestamp: "2026-06-10T11:00:00Z",
      price: 0.3,
      solar: 5.5,
      confidence: 1,
    };

    expect(calculateEffectiveCost(withSolar, vehicle)).toBeLessThan(
      calculateEffectiveCost(withoutSolar, vehicle),
    );
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

    expect(calculateEffectiveCost(lowConfidence, vehicle)).toBeGreaterThan(
      calculateEffectiveCost(highConfidence, vehicle),
    );
  });
});
