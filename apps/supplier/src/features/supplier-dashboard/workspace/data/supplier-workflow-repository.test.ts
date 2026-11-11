import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismAuthenticatedSession, PrismSupplier } from "@prism/types";

const { upload, bind } = vi.hoisted(() => ({ upload: vi.fn(), bind: vi.fn() }));
vi.mock("@prism/api-client", () => ({ uploadStorageObject: upload, getStorageObjectDownload: vi.fn() }));
vi.mock("@/lib/prism-api", () => ({ eventOpsClient: { events: { bindFileRequirementUpload: bind } } }));
import { supplierWorkflowRepository } from "./supplier-workflow-repository";

describe("supplier file requirement upload", () => {
  beforeEach(() => { upload.mockReset(); bind.mockReset(); });

  it("reuses the stored upload on a binding retry and binds only the verified object to the requested requirement", async () => {
    const session = { accessToken: "token" } as PrismAuthenticatedSession;
    const supplier = { id: "sup_1" } as PrismSupplier;
    const file = new File(["supplier document"], "insurance.pdf", { type: "application/pdf" });
    upload.mockResolvedValue({ id: "obj_1" });
    bind.mockRejectedValueOnce(new Error("network error")).mockResolvedValueOnce({ key: "insurance" });
    await expect(supplierWorkflowRepository.uploadRequirement(session, supplier, "evt_1", "insurance", file)).rejects.toThrow("network error");
    await expect(supplierWorkflowRepository.uploadRequirement(session, supplier, "evt_1", "insurance", file)).resolves.toEqual({ key: "insurance" });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][1]).toEqual(upload.mock.calls[1][1]);
    expect(upload.mock.calls[0][1]).toMatchObject({ eventId: "evt_1", ownerRecordId: "sup_1", usage: "supplier_document" });
    expect(bind).toHaveBeenCalledWith("evt_1", "insurance", { objectId: "obj_1" });
  });
});
