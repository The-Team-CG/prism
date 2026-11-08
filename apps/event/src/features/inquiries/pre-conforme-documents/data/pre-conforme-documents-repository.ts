import { eventFileCategoryOf, eventFileLogicalTarget, type PrismStoredObject } from "@prism/types";
import { getStorageObjectDownload, uploadStorageObject } from "@prism/api-client";
import { eventApiRequest, storedEventAccessToken } from "@/lib/prism-api";

/** FR-43 adds the bid's TOR and submitted proposal to the FR-54 pre-conforme documents. */
export const PRE_CONFORME_CATEGORIES = ["nda", "bid_tor", "bid_proposal", "pre_conforme"] as const;
export type PreConformeCategory = (typeof PRE_CONFORME_CATEGORIES)[number];

/** FR-54: NDAs and other required files PMCM holds on an inquiry before the conforme, in its locked event record. */
export const preConformeDocumentsRepository = {
  existingWorkspace: (inquiryId: string) => eventApiRequest<{ eventId: string | null }>(`/api/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`),
  workspace: (inquiryId: string) => eventApiRequest<{ eventId: string }>(`/api/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`, { method: "POST" }),
  async list(eventId: string): Promise<PrismStoredObject[]> {
    const objects = await eventApiRequest<PrismStoredObject[]>(`/api/storage/objects/events/${encodeURIComponent(eventId)}`);
    return objects.filter((object) => object.ownerRecordType === "event" && (PRE_CONFORME_CATEGORIES as readonly string[]).includes(eventFileCategoryOf(object.logicalTarget)));
  },
  upload: (file: File, eventId: string, category: PreConformeCategory) => uploadStorageObject(file, {
    eventId, ownerRecordType: "event", ownerRecordId: eventId,
    logicalTarget: eventFileLogicalTarget(eventId, category, crypto.randomUUID()), usage: "event_deliverable",
  }, { authToken: storedEventAccessToken() }),
  download: (objectId: string) => getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() }),
};
