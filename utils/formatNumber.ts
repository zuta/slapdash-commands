import approx from "approximate-number";

/**
 * Converts the number into a user-friendly format, e.g. 12345 becomes 12K.
 */
export default function formatNumber(n: number) {
  return approx(n, { capital: true });
}
