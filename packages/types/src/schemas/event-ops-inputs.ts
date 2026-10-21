/**
 * Compatibility barrel for the former combined event-ops input schemas.
 * New code should import contracts from the module matching its bounded context.
 */
export * from "./event-lifecycle-inputs.js";
export * from "./commercial-inputs.js";
export * from "./operations-guest-inputs.js";
export * from "./operations-staffing-inputs.js";
export * from "./live-ops-inputs.js";
export * from "./platform-ops-inputs.js";
export * from "./floorplan-inputs.js";
export * from "./read-model-inputs.js";

