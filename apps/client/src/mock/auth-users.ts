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

export const MOCK_AUTH_SESSION_KEY = "prism:mock-auth-session";
export const MOCK_AUTH_REQUESTS_KEY = "prism:mock-auth-requests";
