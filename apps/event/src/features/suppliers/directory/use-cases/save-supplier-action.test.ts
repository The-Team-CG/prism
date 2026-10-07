import { describe, expect, it, vi } from "vitest";
import { saveSupplierAction } from "./save-supplier-action";

describe("saveSupplierAction", () => {
  it("runs a successful command once and reports a failed refresh as saved", async () => {
    const command = vi.fn().mockResolvedValue({ id: "sup-1" });
    const refresh = vi.fn().mockRejectedValue(new Error("refresh failed"));

    await expect(saveSupplierAction(command, refresh)).resolves.toEqual({ saved: true, refreshFailed: true });
    expect(command).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps command failures distinct and does not refresh", async () => {
    const command = vi.fn().mockRejectedValue(new Error("write failed"));
    const refresh = vi.fn();

    await expect(saveSupplierAction(command, refresh)).resolves.toEqual({ saved: false, message: "write failed" });
    expect(command).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});
