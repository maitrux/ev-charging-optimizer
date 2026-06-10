import type { ForecastHour, Vehicle } from "./models";

const FORECAST_FIELDS = [
  "timestamp",
  "price",
  "solar",
  "confidence",
] as const satisfies readonly (keyof ForecastHour)[];

const VEHICLE_FIELDS = [
  "batteryCapacity",
  "currentSoc",
  "targetSoc",
  "targetTime",
  "maxChargingPower",
] as const satisfies readonly (keyof Vehicle)[];

function parseJson(content: string, fileLabel: string): unknown {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error(`${fileLabel} is empty. Expected valid JSON.`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    const detail =
      error instanceof SyntaxError ? error.message : "could not parse JSON";

    throw new Error(`Invalid JSON in ${fileLabel}: ${detail}`);
  }
}

function validateNumberField(
  record: Record<string, unknown>,
  field: string,
  label: string,
): number {
  const value = record[field];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}: "${field}" must be a finite number.`);
  }

  return value;
}

function validateStringField(
  record: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = record[field];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}: "${field}" must be a non-empty string.`);
  }

  return value;
}

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const MAX_FORECAST_DURATION_MS = 24 * 60 * 60 * 1000;

function validateIsoTimestamp(
  value: string,
  field: string,
  label: string,
): string {
  if (!ISO_TIMESTAMP_PATTERN.test(value)) {
    throw new Error(
      `${label}: "${field}" must be an ISO 8601 timestamp (e.g. 2026-06-10T04:00:00Z).`,
    );
  }

  if (Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label}: "${field}" is not a valid date.`);
  }

  return value;
}

function validateForecastEntry(entry: unknown, index: number): ForecastHour {
  const label = `Forecast entry ${index + 1}`;

  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  const record = entry as Record<string, unknown>;

  for (const field of FORECAST_FIELDS) {
    if (!(field in record)) {
      throw new Error(`${label}: Missing required field "${field}".`);
    }
  }

  const timestamp = validateIsoTimestamp(
    validateStringField(record, "timestamp", label),
    "timestamp",
    label,
  );
  const price = validateNumberField(record, "price", label);
  const solar = validateNumberField(record, "solar", label);
  const confidence = validateNumberField(record, "confidence", label);

  if (price < 0) {
    throw new Error(`${label}: "price" must be greater than or equal to 0.`);
  }

  if (solar < 0) {
    throw new Error(`${label}: "solar" must be greater than or equal to 0.`);
  }

  if (confidence < 0 || confidence > 1) {
    throw new Error(`${label}: "confidence" must be between 0 and 1.`);
  }

  return {
    timestamp,
    price,
    solar,
    confidence,
  };
}

function validateForecastOrdering(forecasts: ForecastHour[]): void {
  const seenTimestamps = new Set<string>();
  let previousTimestamp = Number.NEGATIVE_INFINITY;

  for (const [index, forecast] of forecasts.entries()) {
    const label = `Forecast entry ${index + 1}`;

    if (seenTimestamps.has(forecast.timestamp)) {
      throw new Error(
        `${label}: Duplicate timestamp "${forecast.timestamp}".`,
      );
    }

    seenTimestamps.add(forecast.timestamp);

    const timestamp = new Date(forecast.timestamp).getTime();

    if (timestamp < previousTimestamp) {
      throw new Error(`${label}: Timestamps must be in chronological order.`);
    }

    previousTimestamp = timestamp;
  }
}

function validateForecastDuration(forecasts: ForecastHour[]): void {
  const firstTimestamp = new Date(forecasts[0].timestamp).getTime();
  const lastTimestamp = new Date(
    forecasts[forecasts.length - 1].timestamp,
  ).getTime();
  const durationMs = lastTimestamp - firstTimestamp;

  if (durationMs > MAX_FORECAST_DURATION_MS) {
    throw new Error(
      `Forecast must span at most 24 hours (from ${forecasts[0].timestamp} to ${forecasts[forecasts.length - 1].timestamp}).`,
    );
  }
}

export function validateVehicle(vehicle: Vehicle, label = "Vehicle file"): void {
  if (vehicle.batteryCapacity <= 0) {
    throw new Error(`${label}: "batteryCapacity" must be greater than 0.`);
  }

  if (vehicle.maxChargingPower <= 0) {
    throw new Error(`${label}: "maxChargingPower" must be greater than 0.`);
  }

  if (vehicle.currentSoc < 0 || vehicle.currentSoc > 100) {
    throw new Error(`${label}: "currentSoc" must be between 0 and 100.`);
  }

  if (vehicle.targetSoc < 0 || vehicle.targetSoc > 100) {
    throw new Error(`${label}: "targetSoc" must be between 0 and 100.`);
  }

  if (vehicle.targetSoc < vehicle.currentSoc) {
    throw new Error(
      `${label}: "targetSoc" must be greater than or equal to "currentSoc".`,
    );
  }

  validateIsoTimestamp(vehicle.targetTime, "targetTime", label);
}

function validateVehicleObject(parsed: unknown): Vehicle {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Vehicle file must be a JSON object.");
  }

  const record = parsed as Record<string, unknown>;

  for (const field of VEHICLE_FIELDS) {
    if (!(field in record)) {
      throw new Error(`Vehicle file: Missing required field "${field}".`);
    }
  }

  const vehicle: Vehicle = {
    batteryCapacity: validateNumberField(
      record,
      "batteryCapacity",
      "Vehicle file",
    ),
    currentSoc: validateNumberField(record, "currentSoc", "Vehicle file"),
    targetSoc: validateNumberField(record, "targetSoc", "Vehicle file"),
    targetTime: validateStringField(record, "targetTime", "Vehicle file"),
    maxChargingPower: validateNumberField(
      record,
      "maxChargingPower",
      "Vehicle file",
    ),
  };

  validateVehicle(vehicle);

  return vehicle;
}

export function validateTargetTimeWithinForecast(
  vehicle: Vehicle,
  forecasts: ForecastHour[],
): void {
  if (forecasts.length === 0) {
    throw new Error(
      "Vehicle target time cannot be validated against an empty forecast.",
    );
  }

  const targetTime = new Date(vehicle.targetTime).getTime();

  let forecastStartTimestamp = forecasts[0].timestamp;
  let forecastEndTimestamp = forecasts[0].timestamp;
  let forecastStart = new Date(forecastStartTimestamp).getTime();
  let forecastEnd = forecastStart;

  for (const forecast of forecasts) {
    const timestamp = new Date(forecast.timestamp).getTime();

    if (timestamp < forecastStart) {
      forecastStart = timestamp;
      forecastStartTimestamp = forecast.timestamp;
    }

    if (timestamp > forecastEnd) {
      forecastEnd = timestamp;
      forecastEndTimestamp = forecast.timestamp;
    }
  }

  if (targetTime < forecastStart || targetTime > forecastEnd) {
    throw new Error(
      `Vehicle target time (${vehicle.targetTime}) is outside the forecast timeframe (${forecastStartTimestamp} to ${forecastEndTimestamp}).`,
    );
  }
}

export function parseForecastJson(content: string): ForecastHour[] {
  const parsed = parseJson(content, "Forecast file");

  if (!Array.isArray(parsed)) {
    throw new Error("Forecast file must be a JSON array.");
  }

  const forecasts = parsed.map((entry, index) =>
    validateForecastEntry(entry, index),
  );

  if (forecasts.length > 0) {
    validateForecastOrdering(forecasts);
    validateForecastDuration(forecasts);
  }

  return forecasts;
}

export function parseVehicleJson(content: string): Vehicle {
  const parsed = parseJson(content, "Vehicle file");

  return validateVehicleObject(parsed);
}
