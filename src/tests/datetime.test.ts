import { describe, expect, it } from "vitest";
import {
  datetimeLocalToUtcIso,
  formatChartAxisLabels,
  formatDateTimeDeDe,
  getDefaultTargetTimeUtc,
  getTargetTimeChartAxisPosition,
  utcIsoToDatetimeLocal,
} from "../domain/datetime";

describe("datetime helpers", () => {
  it("round-trips UTC ISO through datetime-local values", () => {
    const isoUtc = "2026-06-10T14:30:00.000Z";
    const localValue = utcIsoToDatetimeLocal(isoUtc);

    expect(datetimeLocalToUtcIso(localValue)).toBe(isoUtc);
  });

  it("formats timestamps using de-DE locale", () => {
    const formatted = formatDateTimeDeDe("2026-06-10T14:30:00.000Z");

    expect(formatted).toMatch(/\d{1,2}\.\d{1,2}\.\d{2,4}/);
  });

  it("returns 0 when no forecast timestamps are available", () => {
    expect(getTargetTimeChartAxisPosition([], "2026-06-10T13:30:00Z")).toBe(
      0,
    );
  });

  it("falls back to the last forecast index for unmapped target times", () => {
    const forecasts = [
      "2026-06-10T12:00:00Z",
      "2026-06-10T13:00:00Z",
      "2026-06-10T14:00:00Z",
    ];

    expect(getTargetTimeChartAxisPosition(forecasts, "not-a-date")).toBe(2);
  });

  it("places sub-hour target times proportionally on the chart axis", () => {
    const forecasts = [
      "2026-06-10T12:00:00Z",
      "2026-06-10T13:00:00Z",
      "2026-06-10T14:00:00Z",
    ];

    expect(
      getTargetTimeChartAxisPosition(forecasts, "2026-06-10T13:30:00Z"),
    ).toBe(1.5);
    expect(
      getTargetTimeChartAxisPosition(forecasts, "2026-06-10T13:00:00Z"),
    ).toBe(1);
    expect(
      getTargetTimeChartAxisPosition(forecasts, "2026-06-10T11:00:00Z"),
    ).toBe(0);
    expect(
      getTargetTimeChartAxisPosition(forecasts, "2026-06-10T15:00:00Z"),
    ).toBe(2);
  });

  it("returns a UTC ISO timestamp roughly 24 hours in the future", () => {
    const before = Date.now();
    const targetTime = getDefaultTargetTimeUtc();
    const after = Date.now();

    const targetMs = new Date(targetTime).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    expect(targetTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(targetMs).toBeGreaterThanOrEqual(before + oneDayMs);
    expect(targetMs).toBeLessThanOrEqual(after + oneDayMs);
  });

  it("shows chart axis dates only when the day changes", () => {
    const labels = formatChartAxisLabels([
      "2026-06-10T12:00:00Z",
      "2026-06-10T13:00:00Z",
      "2026-06-11T12:00:00Z",
      "2026-06-11T13:00:00Z",
    ]);

    expect(labels[0]).toContain("\n");
    expect(labels[1]).not.toContain("\n");
    expect(labels[2]).toContain("\n");
    expect(labels[3]).not.toContain("\n");
  });
});
