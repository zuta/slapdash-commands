/**
 * Filters out false-y elements from an array in a type aware way.
 */
export default function compact<T>(a: Array<T | null | undefined>): T[] {
  return a.filter((a) => !!a);
}
