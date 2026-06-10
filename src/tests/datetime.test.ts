import { describe, expect, it } from "vitest";
import {
  datetimeLocalToUtcIso,
  formatDateTimeDeDe,
  getDefaultTargetTimeUtc,
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
});
