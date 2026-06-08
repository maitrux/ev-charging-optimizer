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
  targetTime: string;
  maxChargingPower: number;
}

export interface ScheduleEntry {
  timestamp: string; // named the attribute 'timestamp' instead of 'hour' since it is a timestamp
  chargingPower: number;
}
