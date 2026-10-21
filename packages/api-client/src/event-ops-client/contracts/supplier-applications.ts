import type {
  CreateSupplierApplicationInput,
  SupplierApplicationStatusQuery,
  ReviewSupplierApplicationInput,
  PrismSupplierApplication,
  PrismSupplierApplicationStatusResult,
} from "@prism/types";
import type { PrismRequestInit } from "../../http";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsSupplierApplicationsContract {
  supplierApplications: {
    create(
      input: CreateSupplierApplicationInput,
    ): Promise<PrismSupplierApplication>;
    getStatus(
      input: SupplierApplicationStatusQuery,
      init?: Pick<PrismRequestInit, "signal">,
    ): Promise<PrismSupplierApplicationStatusResult>;
    listCategories(): Promise<{ id: string; name: string }[]>;
    listInbox(actor?: EventOpsActorQuery): Promise<PrismSupplierApplication[]>;
    review(
      applicationId: string,
      input: ReviewSupplierApplicationInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismSupplierApplication>;
  };
}
