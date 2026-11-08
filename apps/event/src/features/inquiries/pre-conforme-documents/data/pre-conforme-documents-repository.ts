import { eventFileCategoryOf, eventFileLogicalTarget, type PrismStoredObject } from "@prism/types";
import { getStorageObjectDownload, uploadStorageObject } from "@prism/api-client";
import { eventApiRequest, storedEventAccessToken } from "@/lib/prism-api";

export type PreConformeCategory = "nda" | "pre_conforme";

/** FR-54: NDAs and other required files PMCM holds on an inquiry before the conforme, in its locked event record. */
export const preConformeDocumentsRepository = {
  existingWorkspace: (inquiryId: string) => eventApiRequest<{ eventId: string | null }>(`/api/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`),
  workspace: (inquiryId: string) => eventApiRequest<{ eventId: string }>(`/api/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`, { method: "POST" }),
  async list(eventId: string): Promise<PrismStoredObject[]> {
    const objects = await eventApiRequest<PrismStoredObject[]>(`/api/storage/objects/events/${encodeURIComponent(eventId)}`);
    return objects.filter((object) => object.ownerRecordType === "event" && ["nda", "pre_conforme"].includes(eventFileCategoryOf(object.logicalTarget)));
  },
  upload: (file: File, eventId: string, category: PreConformeCategory) => uploadStorageObject(file, {
    eventId, ownerRecordType: "event", ownerRecordId: eventId,
    logicalTarget: eventFileLogicalTarget(eventId, category, crypto.randomUUID()), usage: "event_deliverable",
  }, { authToken: storedEventAccessToken() }),
  download: (objectId: string) => getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() }),
};
