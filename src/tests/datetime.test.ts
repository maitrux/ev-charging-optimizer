import { describe, expect, it } from "vitest";
import {
  datetimeLocalToUtcIso,
  formatDateTimeDeDe,
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
});
