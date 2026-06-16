import { describe, expect, it } from "vitest";
import { forEachBooleanCombination } from "../domain/for-each-boolean-combination";

interface ChargingHour {
  connectionProbability: number;
  chargingPowerKw: number;
}

interface CombinationOutcome {
  connected: boolean[];
  probability: number;
  energyKwh: number;
  sufficient: boolean;
}

function evaluateCombinations(
  hours: ChargingHour[],
  requiredEnergyKwh: number,
): CombinationOutcome[] {
  const outcomes: CombinationOutcome[] = [];

  forEachBooleanCombination(hours.length, (connected) => {
    let probability = 1;
    let energyKwh = 0;

    for (let index = 0; index < hours.length; index++) {
      const hour = hours[index];

      if (connected[index]) {
        probability *= hour.connectionProbability;
        energyKwh += hour.chargingPowerKw;
      } else {
        probability *= 1 - hour.connectionProbability;
      }
    }

    outcomes.push({
      connected,
      probability,
      energyKwh,
      sufficient: energyKwh >= requiredEnergyKwh,
    });
  });

  return outcomes;
}

describe("forEachBooleanCombination", () => {
  it("invokes the callback once with an empty array when n is 0", () => {
    const combinations: boolean[][] = [];

    forEachBooleanCombination(0, (values) => {
      combinations.push(values);
    });

    expect(combinations).toEqual([[]]);
  });

  it("enumerates all 2^n combinations for n hours", () => {
    const combinations: boolean[][] = [];

    forEachBooleanCombination(2, (values) => {
      combinations.push(values);
    });

    expect(combinations).toHaveLength(4);
    expect(combinations).toEqual([
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ]);
  });

  /** Example data:
   * * hour 1: p(1) = 0.7, power = 3 kW
   * * hour 2: p(2) = 0.4, power = 6 kW
   * * Also suppose that the minimum required amount of energy is 5 kWh.
   *
   * The expected outcomes are:
   * * [false, false] - probability = 0.18, energy = 0 kWh, sufficient = false
   * * [true, false] - probability = 0.42, energy = 3 kWh, sufficient = false
   * * [false, true] - probability = 0.12, energy = 6 kWh, sufficient = true
   * * [true, true] - probability = 0.28, energy = 9 kWh, sufficient = true
   *
   */
  it("matches the two-hour worked example", () => {
    const hours: ChargingHour[] = [
      { connectionProbability: 0.7, chargingPowerKw: 3 },
      { connectionProbability: 0.4, chargingPowerKw: 6 },
    ];
    const requiredEnergyKwh = 5;

    const outcomes = evaluateCombinations(hours, requiredEnergyKwh);

    expect(outcomes).toHaveLength(4);

    const yy = outcomes.find(
      (outcome) => outcome.connected[0] && outcome.connected[1],
    );
    const yn = outcomes.find(
      (outcome) => outcome.connected[0] && !outcome.connected[1],
    );
    const ny = outcomes.find(
      (outcome) => !outcome.connected[0] && outcome.connected[1],
    );
    const nn = outcomes.find(
      (outcome) => !outcome.connected[0] && !outcome.connected[1],
    );

    expect(yy?.connected).toEqual([true, true]);
    expect(yy?.probability).toBeCloseTo(0.28, 5);
    expect(yy?.energyKwh).toBe(9);
    expect(yy?.sufficient).toBe(true);

    expect(yn?.connected).toEqual([true, false]);
    expect(yn?.probability).toBeCloseTo(0.42, 5);
    expect(yn?.energyKwh).toBe(3);
    expect(yn?.sufficient).toBe(false);

    expect(ny?.connected).toEqual([false, true]);
    expect(ny?.probability).toBeCloseTo(0.12, 5);
    expect(ny?.energyKwh).toBe(6);
    expect(ny?.sufficient).toBe(true);

    expect(nn?.connected).toEqual([false, false]);
    expect(nn?.probability).toBeCloseTo(0.18, 5);
    expect(nn?.energyKwh).toBe(0);
    expect(nn?.sufficient).toBe(false);
  });

  it("sums all combination probabilities to 1", () => {
    const hours: ChargingHour[] = [
      { connectionProbability: 0.7, chargingPowerKw: 3 },
      { connectionProbability: 0.4, chargingPowerKw: 6 },
    ];

    const outcomes = evaluateCombinations(hours, 5);
    const totalProbability = outcomes.reduce(
      (sum, outcome) => sum + outcome.probability,
      0,
    );

    expect(totalProbability).toBeCloseTo(1, 5);
  });

  it("returns 0.40 as the probability of reaching the required energy", () => {
    const hours: ChargingHour[] = [
      { connectionProbability: 0.7, chargingPowerKw: 3 },
      { connectionProbability: 0.4, chargingPowerKw: 6 },
    ];
    const requiredEnergyKwh = 5;

    const outcomes = evaluateCombinations(hours, requiredEnergyKwh);
    const reachTargetProbability = outcomes
      .filter((outcome) => outcome.sufficient)
      .reduce((sum, outcome) => sum + outcome.probability, 0);

    expect(reachTargetProbability).toBeCloseTo(0.4, 5);
  });
});
