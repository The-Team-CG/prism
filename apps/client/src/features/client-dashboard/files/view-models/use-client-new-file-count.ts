"use client";

import { useMemo, useState } from "react";
import { useResource } from "@prism/portal-query";
import type { PrismDocument } from "@prism/types";
import { clientEventStoredFiles } from "../data/client-file-library-resources";
import { clientFilesLastSeenStore } from "../data/client-files-last-seen-store";
import { buildClientFileLibrary, isNewClientFile } from "../model/client-file-library";

/**
 * How many files PMCM added to an event since the client last opened its files, without recording a visit (opening
 * Files does that). Undefined until the files arrive.
 */
export function useClientNewFileCount(actorId: string | undefined, eventId: string, documents: PrismDocument[]): number | undefined {
  const [lastSeen] = useState(() => (actorId ? clientFilesLastSeenStore.get(actorId, eventId) : null));
  const objects = useResource(clientEventStoredFiles, eventId).data;
  return useMemo(() => {
    if (!objects) return undefined;
    const own = documents.filter((document) => document.eventId === eventId);
    return buildClientFileLibrary(objects, own, []).filter((file) => isNewClientFile(file, lastSeen)).length;
  }, [objects, documents, eventId, lastSeen]);
}
