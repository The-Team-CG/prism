/** Pure supplier directory rules. */

export function normalizeSupplierName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isSupplierCreateDraftValid(input: {
  name: string;
  categoryId?: string;
}): boolean {
  return normalizeSupplierName(input.name).length > 0;
}

export function toggleSupplierSelection(
  selected: string[],
  supplierId: string,
): string[] {
  return selected.includes(supplierId)
    ? selected.filter((id) => id !== supplierId)
    : [...selected, supplierId];
}

export function isQuoteRequestReady(input: {
  supplierIds: string[];
  scope?: string;
}): boolean {
  return input.supplierIds.length > 0;
}
