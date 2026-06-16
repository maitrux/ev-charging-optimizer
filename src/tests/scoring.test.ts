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

  it("ranks higher confidence above lower when solar and price are equal", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.3,
        solar: 5,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.3,
        solar: 5,
        confidence: 0.5,
      },
    ];

    const highConfidence = benefitFor(forecasts, "2026-06-10T10:00:00Z");
    const lowConfidence = benefitFor(forecasts, "2026-06-10T11:00:00Z");

    expect(highConfidence).toBe(1);
    expect(lowConfidence).toBeLessThan(highConfidence);
  });

  it("prefers lower prices when solar is equal", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.5,
        solar: 5,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.1,
        solar: 5,
        confidence: 1,
      },
    ];

    expect(benefitFor(forecasts, "2026-06-10T11:00:00Z")).toBeGreaterThan(
      benefitFor(forecasts, "2026-06-10T10:00:00Z"),
    );
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

    expect(benefitFor(forecasts, "2026-06-10T11:00:00Z")).toBeGreaterThan(
      benefitFor(forecasts, "2026-06-10T10:00:00Z"),
    );
  });

  it("assigns benefit 1 to the best hour in the horizon", () => {
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
        confidence: 0.7,
      },
    ];

    const scored = scoreForecastHours(forecasts);

    expect(scored[1].benefit).toBe(1);
    expect(scored[0].benefit).toBe(0);
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

  it("normalizes the solar x price product across the horizon", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.5,
        solar: 0,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.2,
        solar: 22 / 3,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T12:00:00Z",
        price: 0.1,
        solar: 11,
        confidence: 1,
      },
    ];

    const worst = benefitFor(forecasts, "2026-06-10T10:00:00Z");
    const middle = benefitFor(forecasts, "2026-06-10T11:00:00Z");
    const best = benefitFor(forecasts, "2026-06-10T12:00:00Z");

    expect(worst).toBe(0);
    expect(best).toBe(1);
    expect(middle).toBeCloseTo(8 / 15, 5);
    expect(middle).toBeGreaterThan(worst);
    expect(middle).toBeLessThan(best);
  });

  it("returns 0 benefit when all prices are zero", () => {
    const forecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0,
        solar: 5,
        confidence: 1,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0,
        solar: 10,
        confidence: 1,
      },
    ];

    for (const hour of scoreForecastHours(forecasts)) {
      expect(hour.benefit).toBe(0);
    }
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
