export interface ForecastHour {
  timestamp: string;
  price: number;
  solar: number;
  confidence: number;
}

export interface Vehicle {
  batteryCapacity: number;
  currentSoc: number;
  targetSoc: number;
  maxChargingPower: number;
}

export interface ScheduleEntry {
  timestamp: string;
  chargingPower: number;
}
