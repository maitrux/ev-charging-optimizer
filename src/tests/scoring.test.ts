import { describe, expect, it } from "vitest";
import type { ForecastHour } from "../domain/models";
import { scoreForecastHours } from "../domain/scoring";

function benefitFor(forecasts: ForecastHour[], timestamp: string): number {
  const scored = scoreForecastHours(forecasts);
  const hour = scored.find((entry) => entry.timestamp === timestamp);

  if (!hour) {
    throw new Error(`Missing scored hour for ${timestamp}`);
  }

  return hour.benefit;
}

describe("scoreForecastHours", () => {
  it("returns 0 benefit when plug-in confidence is zero", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.3,
        solar: 5,
        confidence: 0,
      },
    ];

    expect(benefitFor(forecasts, "2026-06-10T10:00:00Z")).toBe(0);
  });

  it("scales benefit linearly with confidence", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.3,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.3,
        solar: 0,
        confidence: 0.5,
      },
    ];

    const highConfidence = benefitFor(forecasts, "2026-06-10T10:00:00Z");
    const lowConfidence = benefitFor(forecasts, "2026-06-10T11:00:00Z");

    expect(lowConfidence).toBeCloseTo(highConfidence / 2, 5);
  });

  it("prefers lower prices when solar is equal", () => {
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

    expect(
      benefitFor(forecasts, "2026-06-10T11:00:00Z"),
    ).toBeGreaterThan(benefitFor(forecasts, "2026-06-10T10:00:00Z"));
  });

  it("prefers higher solar when price is equal", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.2,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.2,
        solar: 11,
        confidence: 1,
      },
    ];

    expect(
      benefitFor(forecasts, "2026-06-10T11:00:00Z"),
    ).toBeGreaterThan(benefitFor(forecasts, "2026-06-10T10:00:00Z"));
  });

  it("assigns the highest benefit to the cheapest solar-rich hour", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.5,
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

    const scored = scoreForecastHours(forecasts);

    expect(scored[1].benefit).toBeGreaterThan(scored[0].benefit);
    expect(scored[1]).toMatchObject({
      timestamp: "2026-06-10T11:00:00Z",
      price: 0.3,
      solar: 3,
      confidence: 1,
    });
  });

  it("returns benefit between 0 and 1 inclusive", () => {
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
        solar: 11,
        confidence: 0.95,
      },
    ];

    for (const hour of scoreForecastHours(forecasts)) {
      expect(hour.benefit).toBeGreaterThanOrEqual(0);
      expect(hour.benefit).toBeLessThanOrEqual(1);
    }
  });

  it("combines solar and price with multiplication before applying confidence", () => {
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
        solar: 11,
        confidence: 1,
      },
    ];

    const expensiveHour = benefitFor(forecasts, "2026-06-10T10:00:00Z");
    const cheapSolarHour = benefitFor(forecasts, "2026-06-10T11:00:00Z");

    expect(cheapSolarHour).toBe(1);
    expect(expensiveHour).toBe(0);
  });

  it("preserves the original forecast fields on each scored hour", () => {
    const forecast: ForecastHour = {
      timestamp: "2026-06-10T11:00:00Z",
      price: 0.28,
      solar: 3,
      confidence: 0.95,
    };

    const [scored] = scoreForecastHours([forecast]);

    expect(scored).toMatchObject({
      timestamp: forecast.timestamp,
      price: forecast.price,
      solar: forecast.solar,
      confidence: forecast.confidence,
    });
    expect(scored.benefit).toBeGreaterThan(0);
  });
});
