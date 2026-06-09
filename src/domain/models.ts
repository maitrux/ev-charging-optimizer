export interface ForecastHour {
  timestamp: string;
  price: number;
  solar: number;
  confidence: number;
}

export interface Vehicle {
  name?: string | null;
  batteryCapacity: number;
  currentSoc: number;
  targetSoc: number;
  targetTime: string;
  maxChargingPower: number;
}

export interface ScheduleEntry {
  /**
   * Start time of the charging slot as an ISO timestamp.
   * 'hour' would be a better name for this property.
   */
  hour: string;
  chargingPower: number;
}

export interface ScoredForecastHour extends ForecastHour {
  /**
   * Effective charging cost used to rank charging opportunities.
   * Lower values are better.
   */
  effectiveCost: number;
}
