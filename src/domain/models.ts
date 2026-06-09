export interface ForecastHour {
  timestamp: string;
  price: number;
  solar: number;
  confidence: number;
}

export interface Vehicle {
  /** Maximum battery capacity in kWh. */
  batteryCapacity: number;
  /** Starting state of charge in percent. */
  currentSoc: number;
  /** Minimum required state of charge in percent by target time. Charging may continue beyond this when prices are favorable, up to 100%. */
  targetSoc: number;
  /** Time by which targetSoc must be reached. */
  targetTime: string;
  /** Maximum charging power in kW. */
  maxChargingPower: number;
}

export interface NamedVehicle extends Vehicle {
  name: string;
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
  /** Value between 0 and 1 indicating the benefit of charging in this hour. */
  benefit: number;
}
