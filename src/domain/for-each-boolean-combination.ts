/**
 *
 * @param n - The number of boolean values to generate.
 * @param callback - A function that will be called with an array of boolean values.
 *
 * @example
 * forEachBooleanCombination(2, (values) => {
 *   console.log(values);
 * });
 * // [false, false]
 * // [true, false]
 * // [false, true]
 * // [true, true]
 *
 */
export function forEachBooleanCombination(
  n: number,
  callback: (values: boolean[]) => void,
): void {
  const count = 1 << n; // 2^n

  for (let mask = 0; mask < count; mask++) {
    const values: boolean[] = [];

    for (let bit = 0; bit < n; bit++) {
      values.push((mask & (1 << bit)) !== 0);
    }

    callback(values);
  }
}
