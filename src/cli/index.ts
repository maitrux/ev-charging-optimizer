import { readFileSync } from "node:fs";

import { generateChargingSchedule } from "../domain/optimizer";
import {
  parseForecastJson,
  parseVehicleJson,
  validateTargetTimeWithinForecast,
} from "../domain/validation";

const [, , forecastPath, vehiclePath] = process.argv;

if (!forecastPath || !vehiclePath) {
  console.error("Usage: npm run cli -- <forecast.json> <vehicle.json>");
  process.exit(1);
}

try {
  const forecasts = parseForecastJson(readFileSync(forecastPath, "utf-8"));
  const vehicle = parseVehicleJson(readFileSync(vehiclePath, "utf-8"));

  validateTargetTimeWithinForecast(vehicle, forecasts);

  const schedule = generateChargingSchedule(vehicle, forecasts);

  console.log(JSON.stringify(schedule, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
