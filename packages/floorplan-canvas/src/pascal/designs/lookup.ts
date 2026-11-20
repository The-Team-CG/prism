/** Whether `key` is one of the object's own keys, narrowing it to that key union. */
export function isKey<T extends object>(source: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(source, key);
}
