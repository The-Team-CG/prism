/** Practice module for coverage training (expand real tests over time). */
export function sum(a, b) {
  return a + b;
}

export function clamp(n, min, max) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}