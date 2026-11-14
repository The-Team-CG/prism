"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrismAuthenticatedSession, PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import { buildSupplierFileRequirementRows } from "../model/supplier-workspace-rules";
import type { SupplierWorkspace } from "../model/supplier-workspace-types";
import {
  buildSupplierFileLibrary,
  buildSupplierNeededFiles,
  countSupplierFiles,
  filterSupplierFiles,
  type SupplierFileFilter,
  type SupplierLibraryFile,
} from "../model/supplier-file-library";
import { loadSupplierStoredFile } from "../use-cases/supplier-workspace-actions";
import { useSupplierFileRequirementsViewModel } from "./use-supplier-file-requirements-view-model";

export type SupplierFilePreview =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; url: string; kind: "pdf" | "image" }
  | { status: "error"; message: string };

export function supplierFileHasPreview(file: Pick<SupplierLibraryFile, "objectId" | "kind">) {
  return Boolean(file.objectId) && (file.kind === "pdf" || file.kind === "image");
}

/**
 * Loads a previewable file into a local object URL, re-typed from its stored kind so it is only ever shown as the PDF
 * or image it is, and released when the preview changes.
 */
export function useSupplierFilePreview(session: PrismAuthenticatedSession, file: SupplierLibraryFile | null): SupplierFilePreview {
  const [preview, setPreview] = useState<SupplierFilePreview>({ status: "none" });
  const objectId = file && supplierFileHasPreview(file) ? file.objectId! : null;
  const kind = file?.kind === "pdf" ? "pdf" : "image";
  const imageType = file?.contentType?.startsWith("image/") ? file.contentType : "image/png";

  useEffect(() => {
    if (!objectId) {
      setPreview({ status: "none" });
      return;
    }
    let active = true;
    let url: string | null = null;
    setPreview({ status: "loading" });
    loadSupplierStoredFile(session, objectId)
      .then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(new Blob([blob], { type: kind === "pdf" ? "application/pdf" : imageType }));
        setPreview({ status: "ready", url, kind });
      })
      .catch((reason) => {
        if (active) setPreview({ status: "error", message: reason instanceof Error ? reason.message : "This file couldn't be loaded." });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [session, objectId, kind, imageType]);

  return preview;
}

/** The supplier's Files page: what PMCM still needs, then every file the supplier has with PMCM. */
export function useSupplierFileLibraryViewModel(input: {
  workspace: SupplierWorkspace;
  session: PrismAuthenticatedSession;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  readinessBoard: PrismSupplierReadinessBoard | null;
}) {
  const requirements = useSupplierFileRequirementsViewModel(input.workspace, input.session);
  const [filter, setFilter] = useState<SupplierFileFilter>("all");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const eventNames = useMemo(() => new Map((input.readinessBoard?.items ?? []).flatMap((item) => (item.eventName ? [[item.eventId, item.eventName] as const] : []))), [input.readinessBoard]);
  const rows = useMemo(() => buildSupplierFileRequirementRows(input.workspace, requirements.matrices), [input.workspace, requirements.matrices]);
  const files = useMemo(() => buildSupplierFileLibrary({
    rows,
    contracts: input.workflowWorkspace?.contracts ?? [],
    certifications: input.workspace.supplier.certifications,
    eventNames,
  }), [rows, input.workflowWorkspace, input.workspace.supplier.certifications, eventNames]);
  const needed = useMemo(() => buildSupplierNeededFiles(rows, eventNames), [rows, eventNames]);

  return {
    status: requirements.status,
    error: requirements.error,
    uploading: requirements.uploading,
    upload: requirements.upload,
    needed,
    files: useMemo(() => filterSupplierFiles(files, filter, query), [files, filter, query]),
    counts: countSupplierFiles(files),
    filter, setFilter,
    query, setQuery,
    preview: files.find((file) => file.id === previewId) ?? null,
    openPreview: setPreviewId,
    closePreview: () => setPreviewId(null),
  };
}

export type SupplierFileLibraryViewModel = ReturnType<typeof useSupplierFileLibraryViewModel>;
