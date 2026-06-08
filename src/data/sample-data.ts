import type { ForecastHour, ScheduleEntry, Vehicle } from "../domain/models";

export const sampleVehicles: Vehicle[] = [
  {
    name: "Tesla Model 3",
    batteryCapacity: 60,
    currentSoc: 40,
    targetSoc: 70,
    maxChargingPower: 11,
    targetTime: "2026-06-10T20:30:00Z",
  },
  {
    name: "Volkswagen ID.3",
    batteryCapacity: 58,
    currentSoc: 25,
    targetSoc: 80,
    maxChargingPower: 7.4,
    targetTime: "2026-06-10T19:00:00Z",
  },
  {
    name: "Renault Zoe",
    batteryCapacity: 52,
    currentSoc: 55,
    targetSoc: 90,
    maxChargingPower: 22,
    targetTime: "2026-06-10T18:00:00Z",
  },
];

export const sampleVehicle = sampleVehicles[0];

export const sampleForecast: ForecastHour[] = [
  {
    timestamp: "2026-06-10T06:00:00Z",
    price: 0.32,
    solar: 0.0,
    confidence: 1.0,
  },
  {
    timestamp: "2026-06-10T07:00:00Z",
    price: 0.28,
    solar: 0.0,
    confidence: 1.0,
  },
  {
    timestamp: "2026-06-10T08:00:00Z",
    price: 0.25,
    solar: 0.2,
    confidence: 0.95,
  },
  {
    timestamp: "2026-06-10T09:00:00Z",
    price: 0.22,
    solar: 0.6,
    confidence: 0.95,
  },
  {
    timestamp: "2026-06-10T10:00:00Z",
    price: 0.18,
    solar: 1.5,
    confidence: 0.9,
  },
  {
    timestamp: "2026-06-10T11:00:00Z",
    price: 0.16,
    solar: 2.8,
    confidence: 0.85,
  },
  {
    timestamp: "2026-06-10T12:00:00Z",
    price: 0.17,
    solar: 4.0,
    confidence: 0.7,
  },
  {
    timestamp: "2026-06-10T13:00:00Z",
    price: 0.21,
    solar: 4.5,
    confidence: 0.6,
  },
  {
    timestamp: "2026-06-10T14:00:00Z",
    price: 0.27,
    solar: 3.2,
    confidence: 0.7,
  },
  {
    timestamp: "2026-06-10T15:00:00Z",
    price: 0.35,
    solar: 1.2,
    confidence: 0.85,
  },
  {
    timestamp: "2026-06-10T16:00:00Z",
    price: 0.42,
    solar: 0.4,
    confidence: 0.95,
  },
  {
    timestamp: "2026-06-10T17:00:00Z",
    price: 0.48,
    solar: 0.1,
    confidence: 0.95,
  },
  {
    timestamp: "2026-06-10T18:00:00Z",
    price: 0.45,
    solar: 0.0,
    confidence: 1.0,
  },
  {
    timestamp: "2026-06-10T19:00:00Z",
    price: 0.38,
    solar: 0.0,
    confidence: 1.0,
  },
  {
    timestamp: "2026-06-10T20:00:00Z",
    price: 0.33,
    solar: 0.0,
    confidence: 1.0,
  },
  {
    timestamp: "2026-06-10T21:00:00Z",
    price: 0.29,
    solar: 0.0,
    confidence: 1.0,
  },
];

export const sampleSchedule: ScheduleEntry[] = [
  { timestamp: "2026-06-10T06:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T07:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T08:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T09:00:00Z", chargingPower: 2.0 },
  { timestamp: "2026-06-10T10:00:00Z", chargingPower: 5.5 },
  { timestamp: "2026-06-10T11:00:00Z", chargingPower: 7.4 },
  { timestamp: "2026-06-10T12:00:00Z", chargingPower: 9.0 },
  { timestamp: "2026-06-10T13:00:00Z", chargingPower: 9.0 },
  { timestamp: "2026-06-10T14:00:00Z", chargingPower: 6.0 },
  { timestamp: "2026-06-10T15:00:00Z", chargingPower: 2.8 },
  { timestamp: "2026-06-10T16:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T17:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T18:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T19:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T20:00:00Z", chargingPower: 0.0 },
  { timestamp: "2026-06-10T21:00:00Z", chargingPower: 0.0 },
];

export const sampleTargetTime = "2026-06-10T20:30:00Z";
