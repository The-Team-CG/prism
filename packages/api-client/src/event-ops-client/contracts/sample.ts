import type { PrismSampleState } from "@prism/types";

export interface EventOpsSampleContract {
  /**
   * @deprecated Compatibility-only seed/demo aggregate. New role app work must
   * use scoped clients such as clientWorkspace, supplierWorkspace,
   * pmcmDashboard, events, billing, and inquiries.
   */
  sample: {
    state(): Promise<PrismSampleState>;
    reset(): Promise<PrismSampleState>;
  };
}
