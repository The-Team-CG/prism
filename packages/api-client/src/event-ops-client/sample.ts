import type { PrismSampleState } from "@prism/types";
import { prismRequest } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts.js";
import { withBase } from "./shared.js";

export function createSampleClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "sample"> {
  return {
    sample: {
      state: () =>
        prismRequest<PrismSampleState>("/sample/state", withBase(options)),
      reset: () =>
        prismRequest<PrismSampleState>(
          "/sample/reset",
          withBase(options, { method: "POST" }),
        ),
    },
  };
}
