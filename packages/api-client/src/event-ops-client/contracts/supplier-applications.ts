import type {
  CreateSupplierApplicationInput,
  PrismAccountInvitationOutcome,
  SupplierApplicationStatusQuery,
  ReviewSupplierApplicationInput,
  PrismSupplierApplication,
  PrismSupplierApplicationStatusResult,
} from "@prism/types";
import type { PrismRequestInit } from "../../http";

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
    listInbox(): Promise<PrismSupplierApplication[]>;
    review(
      applicationId: string,
      input: ReviewSupplierApplicationInput,
    ): Promise<PrismSupplierApplication>;
    resendAccountInvitation(applicationId: string): Promise<PrismAccountInvitationOutcome>;
  };
}
