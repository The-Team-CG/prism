export type SupplierActionResult =
  | { saved: true; refreshFailed: boolean }
  | { saved: false; message: string };

export async function saveSupplierAction(
  command: () => Promise<unknown>,
  refresh: () => Promise<void>,
): Promise<SupplierActionResult> {
  try {
    await command();
  } catch (error) {
    return { saved: false, message: error instanceof Error ? error.message : "Unable to save supplier changes." };
  }

  try {
    await refresh();
    return { saved: true, refreshFailed: false };
  } catch {
    return { saved: true, refreshFailed: true };
  }
}
