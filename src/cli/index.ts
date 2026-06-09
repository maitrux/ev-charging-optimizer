import { readFileSync } from "node:fs";

import type { ForecastHour, Vehicle } from "../domain/models";
import { generateChargingSchedule } from "../domain/optimizer";

const [, , forecastPath, vehiclePath] = process.argv;

if (!forecastPath || !vehiclePath) {
  console.error("Usage: npm run cli -- <forecast.json> <vehicle.json>");
  process.exit(1);
}

const forecasts = JSON.parse(
  readFileSync(forecastPath, "utf-8"),
) as ForecastHour[];

const vehicle = JSON.parse(readFileSync(vehiclePath, "utf-8")) as Vehicle;

const schedule = generateChargingSchedule(vehicle, forecasts);

console.log(JSON.stringify(schedule, null, 2));
