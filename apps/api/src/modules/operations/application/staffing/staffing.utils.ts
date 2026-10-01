export function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function timestamp(value: Date) {
  return value.toISOString();
}

export function sameText(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}
