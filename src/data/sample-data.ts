import type { ForecastHour, NamedVehicle } from "../domain/models";
import forecastData from "./forcast.json";

export const sampleVehicles: NamedVehicle[] = [
  {
    name: "Tesla Model 3",
    batteryCapacity: 60,
    currentSoc: 40,
    targetSoc: 70,
    maxChargingPower: 11,
    targetTime: "2026-06-10T12:00:00Z",
  },
  {
    name: "Volkswagen ID.3",
    batteryCapacity: 58,
    currentSoc: 25,
    targetSoc: 80,
    maxChargingPower: 7.4,
    targetTime: "2026-06-10T16:00:00Z",
  },
  {
    name: "Renault Zoe",
    batteryCapacity: 52,
    currentSoc: 55,
    targetSoc: 90,
    maxChargingPower: 22,
    targetTime: "2026-06-10T16:00:00Z",
  },
  {
    name: "Example Zählerfreunde Vehicle",
    batteryCapacity: 78,
    currentSoc: 40,
    targetSoc: 70,
    maxChargingPower: 9,
    targetTime: "2026-06-10T18:00:00Z",
  },
];

export const sampleForecast = forecastData as ForecastHour[];
