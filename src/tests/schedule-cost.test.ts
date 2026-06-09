import { describe, expect, it } from "vitest";
import type { ForecastHour } from "../domain/models";
import { calculateScheduleCost } from "../domain/schedule-cost";

describe("calculateScheduleCost", () => {
  it("charges only for grid energy above available solar", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.2,
        solar: 3,
        confidence: 1,
      },
    ];

    const summary = calculateScheduleCost(
      [{ hour: "2026-06-10T11:00:00Z", chargingPower: 7 }],
      forecasts,
    );

    expect(summary.totalEnergyKwh).toBe(7);
    expect(summary.solarEnergyKwh).toBe(3);
    expect(summary.gridEnergyKwh).toBe(4);
    expect(summary.totalCostEur).toBeCloseTo(0.8, 5);
  });

  it("treats solar-only charging as free", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.3,
        solar: 5,
        confidence: 1,
      },
    ];

    const summary = calculateScheduleCost(
      [{ hour: "2026-06-10T12:00:00Z", chargingPower: 3 }],
      forecasts,
    );

    expect(summary.totalCostEur).toBe(0);
    expect(summary.solarEnergyKwh).toBe(3);
    expect(summary.gridEnergyKwh).toBe(0);
  });
});
