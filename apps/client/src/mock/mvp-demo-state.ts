import type { MvpDemoState } from "@/lib/mvp-api";

export function createInitialMvpDemoState(createdAt = new Date().toISOString()): MvpDemoState {
  return {
    users: [
      { id: "usr_pmcm", name: "Ms. Mys", role: "pmcm-admin", email: "mys@pmcm.test", organization: "PMCM Events", approvalStatus: "approved" },
      { id: "usr_client", name: "Ana Reyes", role: "client", email: "ana@ayala.test", organization: "Ayala Corp", approvalStatus: "pending" },
      { id: "usr_coord", name: "Marco Santos", role: "coordinator", email: "marco@pmcm.test", organization: "PMCM Events", approvalStatus: "approved" },
      { id: "usr_supplier", name: "XPERTO Registration", role: "supplier", email: "ops@xperto.test", organization: "XPERTO Registration", approvalStatus: "pending" },
    ],
    inquiries: [
      {
        id: "inq_demo_ayala",
        clientName: "Ana Reyes",
        email: "ana@ayala.test",
        eventName: "Ayala Tech Summit 2026",
        eventDate: "2026-06-18",
        clientType: "Corporate",
        message: "End-to-end planning, registration, staging, and post-event documentation.",
        status: "accepted",
        createdAt,
      },
    ],
    events: [
      {
        id: "evt_demo_ayala",
        inquiryId: "inq_demo_ayala",
        clientName: "Ana Reyes",
        eventName: "Ayala Tech Summit 2026",
        eventDate: "2026-06-18",
        status: "planning",
        clientPortalStatus: "unlocked",
        readiness: "Floorplan approved",
        archived: false,
        floorPlanStatus: "approved",
        floorPlanId: "plan_demo_ayala_main",
        activeFloorPlanDraftId: "fpd_demo_approved",
      },
    ],
    floorPlanDrafts: [
      {
        id: "fpd_demo_approved",
        eventId: "evt_demo_ayala",
        floorPlanId: "plan_demo_ayala_main",
        name: "Approved ballroom layout",
        status: "approved",
        isActive: true,
        sourceType: "preset",
        createdByRole: "pmcm-admin",
        submittedAt: createdAt,
        reviewedAt: createdAt,
        approvedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    documents: [],
    briefings: [],
    supplierQuotes: [],
    coordinatorAssignments: [],
    complianceChecks: [],
    billingStatements: [],
    paymentMilestones: [],
    postEventDocuments: [
      { id: "ped_completion", eventId: "evt_demo_ayala", title: "Completion report", status: "pending" },
      { id: "ped_gallery", eventId: "evt_demo_ayala", title: "Photo and video turnover", status: "pending" },
    ],
    auditLogs: [
      {
        id: "aud_seed",
        eventId: "evt_demo_ayala",
        actor: "PMCM Admin",
        action: "Created demo event workspace",
        createdAt,
      },
    ],
    notificationLogs: [],
  };
}
