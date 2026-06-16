import { describe, expect, it, vi } from "vitest";
import type { ForecastHour, Vehicle } from "../domain/models";
import {
  parseForecastJson,
  parseVehicleJson,
  validateTargetTimeWithinForecast,
  validateVehicle,
} from "../domain/validation";

const validForecast = `[
  {
    "timestamp": "2026-06-10T10:00:00Z",
    "price": 0.2,
    "solar": 1.5,
    "confidence": 0.8
  },
  {
    "timestamp": "2026-06-10T11:00:00Z",
    "price": 0.25,
    "solar": 1.0,
    "confidence": 0.9
  }
]`;

const validVehicle = `{
  "batteryCapacity": 75,
  "currentSoc": 30,
  "targetSoc": 80,
  "targetTime": "2026-06-10T16:00:00Z",
  "maxChargingPower": 11
}`;

describe("parseForecastJson", () => {
  it("accepts an empty array", () => {
    expect(parseForecastJson("[]")).toEqual([]);
  });

  it("parses a valid forecast file", () => {
    expect(parseForecastJson(validForecast)).toEqual([
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.2,
        solar: 1.5,
        confidence: 0.8,
      },
      {
        timestamp: "2026-06-10T11:00:00Z",
        price: 0.25,
        solar: 1.0,
        confidence: 0.9,
      },
    ]);
  });

  it("rejects empty file content", () => {
    expect(() => parseForecastJson("")).toThrow(
      "Forecast file is empty. Expected valid JSON.",
    );
  });

  it("rejects invalid JSON", () => {
    expect(() => parseForecastJson("{not json")).toThrow(
      "Invalid JSON in Forecast file:",
    );
  });

  it("reports generic parse failures that are not syntax errors", () => {
    const parseSpy = vi.spyOn(JSON, "parse").mockImplementation(() => {
      throw new TypeError("unexpected token");
    });

    expect(() => parseForecastJson("[]")).toThrow(
      "Invalid JSON in Forecast file: could not parse JSON",
    );

    parseSpy.mockRestore();
  });

  it("rejects non-array JSON", () => {
    expect(() =>
      parseForecastJson('{"timestamp":"2026-06-10T10:00:00Z"}'),
    ).toThrow("Forecast file must be a JSON array.");
  });

  it("reports missing forecast fields with entry index", () => {
    expect(() =>
      parseForecastJson('[{"timestamp":"2026-06-10T10:00:00Z","price":0.2}]'),
    ).toThrow('Forecast entry 1: Missing required field "solar".');
  });

  it("rejects a forecast timestamp with the wrong type", () => {
    expect(() =>
      parseForecastJson(
        '[{"timestamp":123,"price":0.2,"solar":1,"confidence":0.5}]',
      ),
    ).toThrow('Forecast entry 1: "timestamp" must be a non-empty string.');
  });

  it("rejects non-object forecast entries", () => {
    expect(() => parseForecastJson("[null]")).toThrow(
      "Forecast entry 1 must be a JSON object.",
    );

    expect(() => parseForecastJson('["not-an-object"]')).toThrow(
      "Forecast entry 1 must be a JSON object.",
    );
  });

  it("rejects timestamps that match the ISO pattern but are not valid dates", () => {
    expect(() =>
      parseForecastJson(
        '[{"timestamp":"2026-06-10T00:00:00+99:99","price":0.2,"solar":1,"confidence":0.5}]',
      ),
    ).toThrow('Forecast entry 1: "timestamp" is not a valid date.');
  });

  it("rejects invalid forecast timestamps", () => {
    expect(() =>
      parseForecastJson(
        '[{"timestamp":"not-a-date","price":0.2,"solar":1,"confidence":0.5}]',
      ),
    ).toThrow('Forecast entry 1: "timestamp" must be an ISO 8601 timestamp');

    expect(() =>
      parseForecastJson(
        '[{"timestamp":"2026","price":0.32,"solar":0,"confidence":1}]',
      ),
    ).toThrow('Forecast entry 1: "timestamp" must be an ISO 8601 timestamp');

    expect(() =>
      parseForecastJson(
        '[{"timestamp":"2026-06-10","price":0.32,"solar":0,"confidence":1}]',
      ),
    ).toThrow('Forecast entry 1: "timestamp" must be an ISO 8601 timestamp');
  });

  it("rejects negative price and solar values", () => {
    expect(() =>
      parseForecastJson(
        '[{"timestamp":"2026-06-10T10:00:00Z","price":-0.1,"solar":1,"confidence":0.5}]',
      ),
    ).toThrow('Forecast entry 1: "price" must be greater than or equal to 0.');

    expect(() =>
      parseForecastJson(
        '[{"timestamp":"2026-06-10T10:00:00Z","price":0.2,"solar":-1,"confidence":0.5}]',
      ),
    ).toThrow('Forecast entry 1: "solar" must be greater than or equal to 0.');
  });

  it("rejects confidence outside 0 and 1", () => {
    expect(() =>
      parseForecastJson(
        '[{"timestamp":"2026-06-10T10:00:00Z","price":0.2,"solar":1,"confidence":1.5}]',
      ),
    ).toThrow('Forecast entry 1: "confidence" must be between 0 and 1.');
  });

  it("rejects non-finite numbers", () => {
    expect(() =>
      parseForecastJson(
        '[{"timestamp":"2026-06-10T10:00:00Z","price":null,"solar":1,"confidence":0.5}]',
      ),
    ).toThrow('Forecast entry 1: "price" must be a finite number.');
  });

  it("rejects duplicate timestamps", () => {
    expect(() =>
      parseForecastJson(`[
        {"timestamp":"2026-06-10T10:00:00Z","price":0.2,"solar":1,"confidence":0.5},
        {"timestamp":"2026-06-10T10:00:00Z","price":0.3,"solar":1,"confidence":0.5}
      ]`),
    ).toThrow('Forecast entry 2: Duplicate timestamp "2026-06-10T10:00:00Z".');
  });

  it("rejects out-of-order timestamps", () => {
    expect(() =>
      parseForecastJson(`[
        {"timestamp":"2026-06-10T12:00:00Z","price":0.2,"solar":1,"confidence":0.5},
        {"timestamp":"2026-06-10T11:00:00Z","price":0.3,"solar":1,"confidence":0.5}
      ]`),
    ).toThrow("Forecast entry 2: Timestamps must be in chronological order.");
  });

  it("accepts a forecast spanning exactly 24 hours", () => {
    expect(() =>
      parseForecastJson(`[
        {"timestamp":"2026-06-10T00:00:00Z","price":0.2,"solar":1,"confidence":0.5},
        {"timestamp":"2026-06-11T00:00:00Z","price":0.3,"solar":1,"confidence":0.5}
      ]`),
    ).not.toThrow();
  });

  it("accepts a forecast that crosses midnight within 24 hours", () => {
    expect(() =>
      parseForecastJson(`[
        {"timestamp":"2026-06-10T20:00:00Z","price":0.2,"solar":1,"confidence":0.5},
        {"timestamp":"2026-06-11T19:00:00Z","price":0.3,"solar":1,"confidence":0.5}
      ]`),
    ).not.toThrow();
  });

  it("rejects a forecast spanning more than 24 hours", () => {
    expect(() =>
      parseForecastJson(`[
        {"timestamp":"2026-06-10T00:00:00Z","price":0.2,"solar":1,"confidence":0.5},
        {"timestamp":"2026-06-11T01:00:00Z","price":0.3,"solar":1,"confidence":0.5}
      ]`),
    ).toThrow("Forecast must span at most 24 hours");
  });
});

describe("parseVehicleJson", () => {
  it("parses a valid vehicle file", () => {
    expect(parseVehicleJson(validVehicle)).toEqual({
      batteryCapacity: 75,
      currentSoc: 30,
      targetSoc: 80,
      targetTime: "2026-06-10T16:00:00Z",
      maxChargingPower: 11,
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseVehicleJson("[")).toThrow(
      "Invalid JSON in Vehicle file:",
    );
  });

  it("rejects arrays", () => {
    expect(() => parseVehicleJson("[]")).toThrow(
      "Vehicle file must be a JSON object.",
    );
  });

  it("reports missing vehicle fields", () => {
    expect(() =>
      parseVehicleJson('{"batteryCapacity":75,"currentSoc":30}'),
    ).toThrow('Vehicle file: Missing required field "targetSoc".');
  });

  it("rejects a vehicle battery capacity with the wrong type", () => {
    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":"75","currentSoc":30,"targetSoc":80,"targetTime":"2026-06-10T16:00:00Z","maxChargingPower":11}',
      ),
    ).toThrow('Vehicle file: "batteryCapacity" must be a finite number.');
  });

  it("rejects invalid target time timestamps", () => {
    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":75,"currentSoc":30,"targetSoc":80,"targetTime":"not-a-date","maxChargingPower":11}',
      ),
    ).toThrow('Vehicle file: "targetTime" must be an ISO 8601 timestamp');

    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":75,"currentSoc":30,"targetSoc":80,"targetTime":"2026","maxChargingPower":11}',
      ),
    ).toThrow('Vehicle file: "targetTime" must be an ISO 8601 timestamp');
  });

  it("rejects non-positive battery capacity and charging power", () => {
    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":0,"currentSoc":30,"targetSoc":80,"targetTime":"2026-06-10T16:00:00Z","maxChargingPower":11}',
      ),
    ).toThrow('Vehicle file: "batteryCapacity" must be greater than 0.');

    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":75,"currentSoc":30,"targetSoc":80,"targetTime":"2026-06-10T16:00:00Z","maxChargingPower":0}',
      ),
    ).toThrow('Vehicle file: "maxChargingPower" must be greater than 0.');
  });

  it("rejects SoC values outside 0 and 100", () => {
    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":75,"currentSoc":-1,"targetSoc":80,"targetTime":"2026-06-10T16:00:00Z","maxChargingPower":11}',
      ),
    ).toThrow('Vehicle file: "currentSoc" must be between 0 and 100.');

    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":75,"currentSoc":30,"targetSoc":101,"targetTime":"2026-06-10T16:00:00Z","maxChargingPower":11}',
      ),
    ).toThrow('Vehicle file: "targetSoc" must be between 0 and 100.');
  });

  it("rejects target SoC below current SoC", () => {
    expect(() =>
      parseVehicleJson(
        '{"batteryCapacity":75,"currentSoc":80,"targetSoc":70,"targetTime":"2026-06-10T16:00:00Z","maxChargingPower":11}',
      ),
    ).toThrow(
      'Vehicle file: "targetSoc" must be greater than or equal to "currentSoc".',
    );
  });
});

describe("validateVehicle", () => {
  const vehicle: Vehicle = {
    batteryCapacity: 75,
    currentSoc: 30,
    targetSoc: 80,
    targetTime: "2026-06-10T16:00:00Z",
    maxChargingPower: 11,
  };

  it("accepts a valid vehicle", () => {
    expect(() => validateVehicle(vehicle, "Vehicle")).not.toThrow();
  });
});

describe("validateTargetTimeWithinForecast", () => {
  const vehicle: Vehicle = {
    batteryCapacity: 75,
    currentSoc: 30,
    targetSoc: 80,
    targetTime: "2026-06-10T12:00:00Z",
    maxChargingPower: 11,
  };

  const forecasts: ForecastHour[] = [
    {
      timestamp: "2026-06-10T10:00:00Z",
      price: 0.2,
      solar: 1.5,
      confidence: 0.8,
    },
    {
      timestamp: "2026-06-10T14:00:00Z",
      price: 0.3,
      solar: 0.5,
      confidence: 0.9,
    },
  ];

  it("accepts a target time within the forecast range", () => {
    expect(() =>
      validateTargetTimeWithinForecast(vehicle, forecasts),
    ).not.toThrow();
  });

  it("accepts a target time within the forecast range even when entries are unsorted", () => {
    const unsortedForecasts: ForecastHour[] = [
      {
        timestamp: "2026-06-10T14:00:00Z",
        price: 0.3,
        solar: 0.5,
        confidence: 0.9,
      },
      {
        timestamp: "2026-06-10T10:00:00Z",
        price: 0.2,
        solar: 1.5,
        confidence: 0.8,
      },
    ];

    expect(() =>
      validateTargetTimeWithinForecast(
        { ...vehicle, targetTime: "2026-06-10T12:00:00Z" },
        unsortedForecasts,
      ),
    ).not.toThrow();
  });

  it("accepts a target time on the forecast boundaries", () => {
    expect(() =>
      validateTargetTimeWithinForecast(
        { ...vehicle, targetTime: "2026-06-10T10:00:00Z" },
        forecasts,
      ),
    ).not.toThrow();

    expect(() =>
      validateTargetTimeWithinForecast(
        { ...vehicle, targetTime: "2026-06-10T14:00:00Z" },
        forecasts,
      ),
    ).not.toThrow();
  });

  it("rejects an empty forecast", () => {
    expect(() => validateTargetTimeWithinForecast(vehicle, [])).toThrow(
      "Vehicle target time cannot be validated against an empty forecast.",
    );
  });

  it("rejects a target time before the forecast", () => {
    expect(() =>
      validateTargetTimeWithinForecast(
        { ...vehicle, targetTime: "2026-06-10T08:00:00Z" },
        forecasts,
      ),
    ).toThrow("is outside the forecast timeframe");
  });

  it("rejects a target time after the forecast", () => {
    expect(() =>
      validateTargetTimeWithinForecast(
        { ...vehicle, targetTime: "2026-06-10T18:00:00Z" },
        forecasts,
      ),
    ).toThrow(
      "Vehicle target time (2026-06-10T18:00:00Z) is outside the forecast timeframe (2026-06-10T10:00:00Z to 2026-06-10T14:00:00Z).",
    );
  });
});
