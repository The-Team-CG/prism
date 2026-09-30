import type {
  PrismSupplierApplication,
  PrismSupplierApplicationStatusResult,
} from "@prism/types";
import { prismRequest, toQueryString } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, actorPath } from "./shared";

export function createSupplierApplicationsClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "supplierApplications"> {
  return {
    supplierApplications: {
      create: (input) =>
        prismRequest<PrismSupplierApplication>(
          "/supplier-applications",
          withBase(options, { method: "POST", body: input }),
        ),
      getStatus: (input, init = {}) =>
        prismRequest<PrismSupplierApplicationStatusResult>(
          `/supplier-applications/status?${toQueryString(input)}`,
          withBase(options, { ...init, cache: "no-store" }),
        ),
      listCategories: () =>
        prismRequest<{ id: string; name: string }[]>(
          "/supplier-applications/categories",
          withBase(options),
        ),
      listInbox: (actor = {}) =>
        prismRequest<PrismSupplierApplication[]>(
          actorPath("/supplier-applications/inbox", actor),
          withBase(options),
        ),
      review: (applicationId, input, actor = {}) =>
        prismRequest<PrismSupplierApplication>(
          actorPath(`/supplier-applications/${applicationId}/review`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
    },
  };
}
