import { PRISM_LEGACY_SESSION_STORAGE_KEYS } from "@prism/types";

export type MockUserRole = "admin" | "planner" | "client";
export type MockApprovalStatus = "approved" | "pending";

export type MockAuthUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: MockUserRole;
  organization: string;
  approvalStatus: MockApprovalStatus;
};

export const MOCK_AUTH_USERS: MockAuthUser[] = [
  {
    id: "auth_pmcm_admin",
    name: "Ms. Mys",
    email: "mys@pmcm.test",
    password: "prism-admin",
    role: "admin",
    organization: "P.R.I.S.M Command",
    approvalStatus: "approved",
  },
  {
    id: "auth_planner",
    name: "Event Planner",
    email: "planner@prism.test",
    password: "prism-planner",
    role: "planner",
    organization: "P.R.I.S.M Operations",
    approvalStatus: "pending",
  },
  {
    id: "auth_client",
    name: "Ana Reyes",
    email: "ana@ayala.test",
    password: "prism-client",
    role: "client",
    organization: "Ayala Events",
    approvalStatus: "pending",
  },
];

/** @deprecated Use PRISM_SESSION_STORAGE_KEYS.client for new client portal session work. */
export const MOCK_AUTH_SESSION_KEY = PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth;
/** @deprecated Approval requests should move to API-backed auth operations. */
export const MOCK_AUTH_REQUESTS_KEY = PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuthRequests;
