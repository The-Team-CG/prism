import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), "..");
const CAPTURE_DATE = process.env.PRISM_CAPTURE_DATE ?? new Date().toISOString().slice(0, 10);
const OUTPUT_ROOT = path.join(ROOT, "docs", "prism-v4", "page-screenshots", CAPTURE_DATE);
const SCREENSHOT_DIR = path.join(OUTPUT_ROOT, "screenshots");
const CATALOG_PATH = path.join(ROOT, "docs", "prism-v4", "01-complete-feature-catalog.md");
const INDEX_PATH = path.join(OUTPUT_ROOT, "index.md");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");

const BASE_URLS = {
  client: "http://localhost:3001",
  supplier: "http://localhost:3002",
  guest: "http://localhost:3003",
  event: "http://localhost:3004",
  api: "http://localhost:4000",
};

const VIEWPORT = { width: 1440, height: 1100 };
const MAX_CAPTURE_HEIGHT = Number(process.env.PRISM_MAX_CAPTURE_HEIGHT ?? 3200);
const READY_TIMEOUT_MS = Number(process.env.PRISM_READY_TIMEOUT_MS ?? 45_000);
const POLL_MS = 400;

const PAGE_DEFINITIONS = [
  {
    id: "client-public-landing",
    title: "Client Public Landing",
    app: "apps/client",
    url: `${BASE_URLS.client}/`,
    markers: ["Start an inquiry", "Guided from inquiry to closure"],
    featureRefs: ["FR-42", "FR-46", "FR-26"],
    purpose: "Public entry point and lifecycle boundary before any dashboard access.",
  },
  {
    id: "client-public-inquiry",
    title: "Public Inquiry Form",
    app: "apps/client",
    url: `${BASE_URLS.client}/inquiry`,
    markers: ["Tell us about your event", "Client Type"],
    featureRefs: ["FR-46", "FR-47", "FR-48", "FR-50", "FR-51"],
    purpose: "Public inquiry intake and client type capture.",
  },
  {
    id: "client-sign-in",
    title: "Client Sign-In Gate",
    app: "apps/client",
    url: `${BASE_URLS.client}/sign-in`,
    markers: ["Welcome Back", "Approved clients only"],
    featureRefs: ["FR-26", "New-SEC1"],
    purpose: "Signed-conforme client portal gate.",
  },
  {
    id: "client-dashboard-overview",
    title: "Client Dashboard Overview",
    app: "apps/client",
    url: `${BASE_URLS.client}/dashboard`,
    auth: "client",
    markers: ["Client Portal", "Ayala Tech Summit"],
    featureRefs: ["FR-26", "FR-27", "FR-34", "New-CL1", "New-CL2"],
    purpose: "Client confirmed-event overview, milestones, notifications, and visible actions.",
  },
  {
    id: "client-event-floorplan",
    title: "Client Event Floorplan",
    app: "apps/client",
    urlTemplate: ({ eventId }) => `${BASE_URLS.client}/dashboard/events/${eventId}/floor-plan`,
    auth: "client",
    markers: ["Floor plan", "Official layout"],
    featureRefs: ["FR-08", "FR-28", "FR-29", "FR-83"],
    purpose: "Client layout preference and read-only official layout review boundary.",
  },
  {
    id: "client-event-proposal",
    title: "Client Proposal Review",
    app: "apps/client",
    urlTemplate: ({ eventId }) => `${BASE_URLS.client}/dashboard/events/${eventId}/proposal`,
    auth: "client",
    markers: ["Proposal", "Proposal package"],
    featureRefs: ["FR-58", "FR-60", "FR-AI-09"],
    purpose: "Client-facing proposal review summary without internal cost exposure.",
  },
  {
    id: "client-event-billing-documents",
    title: "Client Billing And Documents",
    app: "apps/client",
    urlTemplate: ({ eventId }) => `${BASE_URLS.client}/dashboard/events/${eventId}/billing`,
    auth: "client",
    markers: ["Billing", "Payment milestones"],
    featureRefs: ["FR-32", "FR-33", "FR-34", "FR-92"],
    purpose: "Client-accessible billing milestones and document context.",
  },
  {
    id: "pmcm-command-dashboard",
    title: "PMCM Command Dashboard",
    app: "apps/event",
    url: `${BASE_URLS.event}/dashboard`,
    auth: "pmcm",
    markers: ["PMCM Event Command", "Ayala Tech Summit"],
    featureRefs: ["FR-04", "FR-05", "FR-06", "FR-25", "FR-56", "FR-AI-05", "FR-AI-07", "FR-AI-ZDR", "New-SY3"],
    purpose: "PMCM command home for active events, readiness, alerts, and system boundaries.",
  },
  {
    id: "pmcm-inquiry-onboarding",
    title: "PMCM Inquiry And Onboarding",
    app: "apps/event",
    url: `${BASE_URLS.event}/dashboard/inquiries`,
    auth: "pmcm",
    markers: ["Inquiry Intake", "Client onboarding"],
    featureRefs: ["FR-01", "FR-02", "FR-03", "FR-44", "FR-45", "FR-52", "FR-53", "FR-54", "FR-AI-01"],
    purpose: "PMCM intake, conforme, and portal activation evidence.",
  },
  {
    id: "pmcm-event-overview",
    title: "PMCM Event Workspace Overview",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/overview`,
    auth: "pmcm",
    markers: ["Ayala Tech Summit", "Event workspace"],
    featureRefs: ["FR-04", "FR-05", "FR-06", "FR-58", "FR-60"],
    purpose: "Selected-event workspace overview after accepted inquiry and signed conforme.",
  },
  {
    id: "pmcm-event-briefing",
    title: "PMCM Briefing And Proposal",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/briefing`,
    auth: "pmcm",
    markers: ["Briefing", "Submit briefing"],
    featureRefs: ["FR-19", "FR-58", "FR-59", "FR-60", "FR-61", "FR-62", "FR-AI-03", "FR-AI-09"],
    purpose: "PMCM briefing, proposal, and CE-related planning surface.",
  },
  {
    id: "pmcm-event-floorplans",
    title: "PMCM Floorplans",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/floorplans`,
    auth: "pmcm",
    markers: ["Floor", "Official"],
    featureRefs: ["FR-08", "FR-80", "FR-81", "FR-82", "FR-83", "FR-84"],
    purpose: "PMCM-owned official floorplan management.",
  },
  {
    id: "pmcm-event-suppliers-pare",
    title: "PMCM Suppliers And PARE",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/suppliers`,
    auth: "pmcm",
    markers: ["Supplier", "PARE"],
    featureRefs: [
      "FR-14",
      "FR-15",
      "FR-16",
      "FR-17",
      "FR-18",
      "FR-49",
      "FR-63",
      "FR-64",
      "FR-75",
      "FR-76",
      "FR-AI-04",
      "FR-AI-04b",
      "FR-AI-06",
      "New-S5",
    ],
    purpose: "Supplier comparison, assignment, gap handling, and PARE human-approval boundary.",
  },
  {
    id: "pmcm-event-coordinators",
    title: "PMCM Coordinator Desk",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/coordinators`,
    auth: "pmcm",
    markers: ["Coordinator", "Marco"],
    featureRefs: ["FR-13", "FR-88", "FR-89", "FR-90", "New-C1", "New-C2", "New-C3", "New-C4"],
    purpose: "Coordinator assignment, acknowledgment, and replacement evidence.",
  },
  {
    id: "pmcm-event-live-ops",
    title: "PMCM Live Operations",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/live-ops`,
    auth: "pmcm",
    markers: ["Live", "Attendance"],
    featureRefs: ["FR-39", "FR-78", "FR-79", "FR-95", "FR-AI-07", "New-C3", "New-C4", "New-SUP1"],
    purpose: "Event-day operations, supplier status, coordinator attendance, and urgent issues.",
  },
  {
    id: "pmcm-event-billing",
    title: "PMCM Billing And Finance",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/billing`,
    auth: "pmcm",
    markers: ["Billing", "Payment"],
    featureRefs: ["FR-20", "FR-21", "FR-69", "FR-92", "New-P5"],
    purpose: "Billing statement generation and manual payment tracking.",
  },
  {
    id: "pmcm-event-closure-archive",
    title: "PMCM Closure And Archive",
    app: "apps/event",
    urlTemplate: ({ eventId }) => `${BASE_URLS.event}/dashboard/events/${eventId}/closure`,
    auth: "pmcm",
    markers: ["Closure", "insight"],
    featureRefs: ["FR-22", "FR-23", "New-P1", "New-P2", "New-P3", "New-P5", "FR-AI-08", "New-SY1", "New-SY2"],
    purpose: "Close gates, post-event documents, insights, and archive readiness.",
  },
  {
    id: "pmcm-audit-settings",
    title: "PMCM Audit And Security",
    app: "apps/event",
    url: `${BASE_URLS.event}/dashboard/audit`,
    auth: "pmcm",
    markers: ["Audit", "activity"],
    featureRefs: ["New-SEC1", "New-SEC2", "New-SEC3", "New-SEC4", "FR-56", "FR-AI-ZDR"],
    purpose: "Audit trail, privacy, and security readiness evidence.",
  },
  {
    id: "supplier-dashboard-overview",
    title: "Supplier Dashboard",
    app: "apps/supplier",
    url: `${BASE_URLS.supplier}/dashboard`,
    auth: "supplier",
    markers: ["Supplier Portal", "Quotes to submit"],
    featureRefs: ["FR-35", "FR-36", "FR-37", "FR-38", "FR-49", "FR-64", "New-SUP1", "New-SUP2", "New-SUP3", "New-SUP4", "FR-AI-04b"],
    purpose: "Supplier-scoped quote, booking, readiness, event-day, and profile surface.",
  },
  {
    id: "supplier-quote-requests",
    title: "Supplier Quote Requests",
    app: "apps/supplier",
    url: `${BASE_URLS.supplier}/dashboard`,
    auth: "supplier",
    actions: [{ type: "clickText", text: "Requests" }],
    markers: ["Quote requests", "deadline"],
    featureRefs: ["FR-36", "FR-49", "FR-64"],
    purpose: "Supplier quote submission and confidential request surface.",
  },
  {
    id: "coordinator-dashboard",
    title: "Coordinator Dashboard",
    app: "apps/event",
    url: `${BASE_URLS.event}/dashboard`,
    auth: "coordinator",
    markers: ["Coordinator Portal", "Role: Floor Director"],
    featureRefs: ["New-CO1", "New-CO2", "New-CO3", "New-CO4", "New-CO5", "New-CO6", "FR-90"],
    purpose: "Role-safe coordinator portal view.",
  },
  {
    id: "guest-open-code",
    title: "Guest Code Gate",
    app: "apps/guest",
    url: `${BASE_URLS.guest}/open`,
    markers: ["Open your event pass", "Demo event code"],
    featureRefs: ["FR-39", "FR-95"],
    purpose: "Guest event-code gate before dashboard access.",
  },
  {
    id: "guest-dashboard",
    title: "Guest Dashboard",
    app: "apps/guest",
    url: `${BASE_URLS.guest}/dashboard`,
    auth: "guest",
    markers: ["Hello, Sofia", "Registration check-in"],
    featureRefs: ["FR-39", "FR-40", "FR-41", "FR-95", "New-GU1", "New-EX2"],
    purpose: "Guest pass, check-in, walk-in flagging, and moderated feedback evidence.",
  },
];

const SECTION_DEFAULT_PAGE_IDS = {
  "AI Feature Architecture": ["pmcm-command-dashboard", "pmcm-event-suppliers-pare", "pmcm-audit-settings"],
  "Inquiry and Client Management": ["pmcm-inquiry-onboarding"],
  "Event Planning and Operations": ["pmcm-event-overview", "pmcm-event-briefing", "pmcm-event-live-ops"],
  "Proposal and Cost Estimation": ["pmcm-event-briefing", "client-event-proposal"],
  "Contract and Document Management": ["pmcm-event-billing", "client-event-billing-documents"],
  "Supplier Management": ["pmcm-event-suppliers-pare", "supplier-dashboard-overview"],
  "Event-Day Operations": ["pmcm-event-live-ops", "coordinator-dashboard", "guest-dashboard"],
  "Post-Event and Archive": ["pmcm-event-closure-archive"],
  "System Configuration and Event Lifecycle": ["pmcm-command-dashboard", "pmcm-event-closure-archive", "pmcm-audit-settings"],
  "Security - Cross-Cutting All Personas and All Phases": ["pmcm-audit-settings", "client-sign-in"],
  "Client Features": ["client-dashboard-overview", "client-event-floorplan", "client-event-billing-documents"],
  "Supplier Features": ["supplier-dashboard-overview", "supplier-quote-requests"],
  "Coordinator Features": ["coordinator-dashboard"],
  "Guest Features": ["guest-dashboard", "guest-open-code"],
  "External and Public Features": ["client-public-landing", "client-public-inquiry", "guest-open-code"],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function markdownEscape(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function slugFile(id) {
  return `${id}.png`;
}

function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function parsePipeRow(line) {
  if (!line.trim().startsWith("|")) return null;
  const raw = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return raw.split("|").map((cell) => stripMarkdown(cell.trim()));
}

async function readText(filePath) {
  const { readFile } = await import("node:fs/promises");
  return readFile(filePath, "utf8");
}

async function parseCatalog() {
  const text = await readText(CATALOG_PATH);
  const lines = text.split(/\r?\n/);
  const features = [];
  let section = "";

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1].trim();
      continue;
    }

    const cells = parsePipeRow(line);
    if (!cells || cells.length < 3) continue;

    const ref = cells[0];
    if (!/^(FR|New)-[A-Z0-9+]+/i.test(ref)) continue;
    if (/^FR\s*#$/i.test(ref) || /^FR$/i.test(ref)) continue;

    const isAiArchitecture = section === "AI Feature Architecture";
    features.push({
      ref,
      feature: cells[1],
      scope: cells[2],
      section,
      description: isAiArchitecture ? cells[6] ?? cells.at(-1) ?? "" : cells[3] ?? "",
    });
  }

  return features;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (!port) reject(new Error("Unable to allocate a debugging port."));
        else resolve(port);
      });
    });
  });
}

function edgePathCandidates() {
  const candidates = [];
  if (process.env.EDGE_PATH) candidates.push(process.env.EDGE_PATH);
  candidates.push(
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  );
  return candidates;
}

function findEdgePath() {
  const candidate = edgePathCandidates().find((item) => existsSync(item));
  if (!candidate) {
    throw new Error("Microsoft Edge was not found. Set EDGE_PATH to a Chromium-compatible browser executable.");
  }
  return candidate;
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const remaining = Math.max(1, timeoutMs - (Date.now() - started));
      const controller = new AbortController();
      const attemptTimeout = setTimeout(() => controller.abort(), Math.min(5_000, remaining));
      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(attemptTimeout);
      }
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError ?? new Error(`${url} did not become ready.`);
}

async function readJson(url, timeoutMs = 30_000) {
  const response = await waitForHttp(url, timeoutMs);
  const body = await response.json();
  return body.data ?? body;
}

function createFallbackState(createdAt = "2026-05-07T06:00:00.000Z") {
  const event = {
    id: "evt_demo_ayala",
    inquiryId: "inq_demo_ayala",
    clientName: "Ana Reyes",
    eventName: "Ayala Tech Summit 2026",
    eventDate: "2026-06-18",
    status: "planning",
    clientPortalStatus: "unlocked",
    readiness: "Event-day walkthrough ready",
    archived: false,
    floorPlanStatus: "approved",
    floorPlanId: "plan_demo_ayala_main",
    guestAccessCode: "AYALA-TECH-YALA",
    activeFloorPlanDraftId: "fpd_demo_review",
  };
  const supplierCategory = {
    id: "cat_registration",
    slug: "registration",
    name: "Registration",
    sortOrder: 1,
    active: true,
    acceptableMin: 90000,
    acceptableMax: 150000,
  };
  const supplier = {
    id: "sup_xperto",
    name: "XPERTO Registration",
    categoryId: supplierCategory.id,
    categoryName: supplierCategory.name,
    categorySlug: supplierCategory.slug,
    tier: "tier_1",
    bniMember: true,
    autoTrust: true,
    contactName: "Rina Cruz",
    email: "ops@xperto.test",
    phone: "+63 917 555 0144",
    serviceInclusions: "QR registration, badge printing, onsite help desk, and attendance export.",
    performanceNotes: "Preferred supplier for high-volume guest ingress.",
    applicationDate: "2026-04-15",
    aggregateRating: 4.8,
    lastEventDate: "2026-04-28",
    pastEvents: [{ id: "pe_xperto", eventName: "BGC Product Forum", clientName: "PMCM", eventDate: "2026-04-28" }],
    reviews: [{
      id: "rev_xperto",
      rating: 5,
      notes: "Fast queue management and clean handoff.",
      reviewedBy: "Ms. Mys",
      eventId: event.id,
      eventName: event.eventName,
      createdAt,
    }],
    reliabilityNotes: [{ id: "rel_xperto", note: "Confirmed backup tablets and badge stock.", eventId: event.id, eventName: event.eventName, createdAt }],
    certifications: [{ id: "cert_xperto", fileName: "xperto-data-privacy.pdf", documentType: "Privacy", issuer: "XPERTO", expiresAt: null, status: "verified", notes: "Valid for registration processing.", uploadedAt: createdAt }],
  };
  const quoteRequest = {
    id: "qr_xperto_registration",
    eventId: event.id,
    supplierId: supplier.id,
    categoryId: supplierCategory.id,
    supplierName: supplier.name,
    category: supplierCategory.name,
    message: "Please quote registration desk staffing, QR scanning, badge printing, and attendance export.",
    dueDate: "2026-05-20",
    accessToken: "quote_xperto_demo",
    confidentialBid: true,
    status: "selected",
    assignmentStatus: "confirmed",
    assignmentConfirmedAt: createdAt,
    readinessStatus: "confirmed",
    readinessConfirmedAt: createdAt,
    readinessNotes: "Team lead and equipment checklist confirmed.",
    eventDayStatus: "ready",
    eventDayStatusAt: createdAt,
    eventDayNotes: "Registration kits staged.",
    eventDayVerificationStatus: "verified",
    eventDayVerifiedAt: createdAt,
    eventDayVerifiedBy: "Ms. Mys",
    eventDayVerificationNotes: "Ready for guest arrival.",
    verificationStatus: "verified",
    verifiedAt: createdAt,
    verifiedBy: "Ms. Mys",
    verificationNotes: "Supplier status verified for event day.",
    statusPhotoFileName: "registration-desk-ready.jpg",
    contractDocumentId: "doc_xperto_contract",
    createdAt,
  };
  const quote = {
    id: "quote_xperto_registration",
    eventId: event.id,
    requestId: quoteRequest.id,
    supplierId: supplier.id,
    categoryId: supplierCategory.id,
    supplierName: supplier.name,
    category: supplierCategory.name,
    amount: 128000,
    inclusions: ["QR scanning stations", "Badge printing", "Attendance export"],
    paymentTerms: "50% reservation, 50% after event",
    notes: "Includes four registration staff and backup equipment.",
    acceptableMin: supplierCategory.acceptableMin,
    acceptableMax: supplierCategory.acceptableMax,
    outsideAcceptableRange: false,
    status: "selected",
    revisionNumber: 1,
    selectedAt: createdAt,
    lockedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
  const coordinator = {
    id: "coord_marco",
    userId: "usr_coord",
    name: "Marco Santos",
    email: "marco@pmcm.test",
    photoUrl: null,
    roleTags: ["Floor Director", "Registration Lead"],
    roles: ["Floor Director", "Registration Lead"],
    skillsTags: ["show calling", "supplier coordination", "guest flow"],
    active: true,
    createdAt,
  };
  const assignment = {
    id: "coord_asg_marco",
    eventId: event.id,
    coordinatorId: coordinator.id,
    coordinatorName: coordinator.name,
    role: "Floor Director",
    status: "acknowledged",
    attendanceStatus: "checked_in",
    attendanceMarkedAt: createdAt,
    attendanceNotes: "Onsite for registration and stage cueing.",
    doubleBookingWarning: false,
    eventDate: event.eventDate,
    conflictEventId: null,
    conflictEventName: null,
    acknowledgedAt: createdAt,
    createdAt,
  };
  const paymentSchedule = [
    { label: "Reservation fee", percentage: 30, amount: 156000, dueDate: "2026-05-10" },
    { label: "Final balance", percentage: 70, amount: 364000, dueDate: "2026-06-10" },
  ];
  const paymentMethods = [{ label: "Bank transfer", details: "PMCM operating account" }];
  const billingSource = {
    id: "bsrc_demo",
    eventId: event.id,
    sourceType: "proposal",
    sourceLabel: "Approved proposal package",
    sourceDocumentId: "doc_proposal",
    lineItems: [{ label: "Event operations package", amount: 392000 }, { label: "Registration supplier", amount: 128000 }],
    paymentSchedule,
    paymentMethods,
    totalAmount: 520000,
    status: "approved",
    approvedAt: createdAt,
    approvedBy: "Ms. Mys",
    approvalNotes: "Approved for billing statement.",
    createdAt,
    updatedAt: createdAt,
  };
  const billingStatement = {
    id: "bill_demo_ayala",
    eventId: event.id,
    sourceId: billingSource.id,
    number: "BS-2026-0001",
    clientName: event.clientName,
    clientContact: "ana@ayala.test",
    eventName: event.eventName,
    eventDate: event.eventDate,
    lineItems: billingSource.lineItems,
    paymentSchedule,
    paymentMethods,
    totalAmount: 520000,
    documentId: "doc_billing",
    pdfUrl: "/mock/billing/BS-2026-0001.pdf",
    storageKey: "events/evt_demo_ayala/billing/BS-2026-0001.pdf",
    status: "sent",
    sentAt: createdAt,
    generatedAt: createdAt,
    updatedAt: createdAt,
  };
  const paymentMilestones = [
    {
      id: "pay_reservation",
      eventId: event.id,
      label: "Reservation fee",
      percentage: 30,
      amount: 156000,
      amountPaid: 156000,
      remainingBalance: 0,
      dueDate: "2026-05-10",
      status: "paid",
      createdAt,
      history: [{ id: "payrec_reservation", milestoneId: "pay_reservation", eventId: event.id, amount: 156000, method: "Bank transfer", referenceNumber: "BT-AYALA-001", receivedAt: createdAt, recordedBy: "Ms. Mys", notes: "Reservation fee received." }],
    },
    {
      id: "pay_balance",
      eventId: event.id,
      label: "Final balance",
      percentage: 70,
      amount: 364000,
      amountPaid: 0,
      remainingBalance: 364000,
      dueDate: "2026-06-10",
      status: "pending",
      createdAt,
      history: [],
    },
  ];
  const guestCheckIns = [{
    id: "gci_sofia",
    eventId: event.id,
    guestName: "Sofia Lim",
    checkInMode: "name_search",
    status: "checked_in",
    walkIn: false,
    verificationStatus: "verified",
    checkedInAt: createdAt,
  }];
  return {
    users: [
      { id: "usr_pmcm", name: "Ms. Mys", role: "pmcm-admin", email: "mys@pmcm.test", organization: "PMCM Events", approvalStatus: "approved", lastLoginAt: createdAt, lockedUntil: null, permanentLockout: false },
      { id: "usr_client", name: "Ana Reyes", role: "client", email: "ana@ayala.test", organization: "Ayala Corp", approvalStatus: "approved", lastLoginAt: createdAt, lockedUntil: null, permanentLockout: false },
      { id: "usr_coord", name: coordinator.name, role: "coordinator", email: coordinator.email, organization: "PMCM Events", approvalStatus: "approved", lastLoginAt: createdAt, lockedUntil: null, permanentLockout: false },
      { id: "usr_supplier", name: supplier.name, role: "supplier", email: supplier.email, organization: supplier.name, approvalStatus: "approved", lastLoginAt: createdAt, lockedUntil: null, permanentLockout: false },
    ],
    inquiries: [{
      id: event.inquiryId,
      clientName: event.clientName,
      companyName: "Ayala Corp",
      email: "ana@ayala.test",
      eventName: event.eventName,
      eventType: "Corporate Summit",
      eventDate: event.eventDate,
      clientType: "Corporate",
      source: "Website",
      message: "End-to-end planning, registration, staging, and post-event documentation.",
      status: "accepted",
      declineReason: null,
      acceptedAt: createdAt,
      pendingAt: null,
      declinedAt: null,
      conformeSentAt: createdAt,
      conformeSignedAt: createdAt,
      portalActivatedAt: createdAt,
      portalInvitationStatus: "opened",
      portalInvitationSentAt: createdAt,
      portalInvitationOpenedAt: createdAt,
      portalInvitationExpiresAt: "2026-06-01T00:00:00.000Z",
      privacyConsentAccepted: true,
      privacyNoticeVersion: "2026-05-01",
      marketingConsentAccepted: false,
      createdAt,
    }],
    events: [{ ...event, floorPlanDrafts: [] }],
    documents: [
      { id: "doc_signed_conforme", eventId: event.id, type: "signed_conforme", fileName: "signed-conforme-ayala-tech-summit.pdf", status: "approved", uploadedAt: createdAt },
      { id: "doc_proposal", eventId: event.id, type: "proposal", fileName: "proposal-ayala-tech-summit.pdf", status: "approved", uploadedAt: createdAt },
      { id: "doc_xperto_contract", eventId: event.id, type: "supplier_contract", fileName: "xperto-registration-contract.pdf", status: "approved", uploadedAt: createdAt },
      { id: "doc_billing", eventId: event.id, type: "billing_statement", fileName: "BS-2026-0001.pdf", status: "sent", uploadedAt: createdAt },
    ],
    briefings: [{
      eventId: event.id,
      venue: "Shangri-La Grand Ballroom",
      guestCount: 240,
      budgetRange: "PHP 450,000 - 520,000",
      serviceRequirements: ["Digital registration", "Stage and technicals", "Documentation", "Supplier coordination"],
      notes: "Client prefers a polished technology summit setup with clear ingress flow, visible sponsor wall, and quiet VIP holding area.",
      submittedAt: createdAt,
    }],
    supplierQuoteRequests: [quoteRequest],
    supplierQuotes: [quote],
    coordinators: [coordinator],
    coordinatorRoleRequirements: [{ role: "Floor Director", required: 1 }, { role: "Registration Lead", required: 1 }],
    coordinatorAssignments: [assignment],
    complianceRules: [{ id: "rule_contract", eventId: null, eventType: "Corporate Summit", phase: "planning", severity: "must_fix", layer: "Must-Fix", conditionKey: "supplier_contracts", title: "Supplier contracts ready", note: "Selected suppliers must have contracts before event day.", active: true, createdAt, updatedAt: createdAt }],
    complianceChecks: [{ id: "chk_contract", eventId: event.id, ruleId: "rule_contract", layer: "Must-Fix", severity: "must_fix", phase: "planning", conditionKey: "supplier_contracts", title: "Supplier contracts ready", status: "resolved", note: "XPERTO contract uploaded and approved.", resolvedAt: createdAt, resolvedBy: "Ms. Mys" }],
    billingSources: [billingSource],
    billingStatements: [billingStatement],
    paymentMilestones,
    paymentRecords: [{ id: "payrec_reservation", milestoneId: "pay_reservation", eventId: event.id, amount: 156000, method: "Bank transfer", referenceNumber: "BT-AYALA-001", receivedAt: createdAt, recordedBy: "Ms. Mys", notes: "Reservation fee received." }],
    postEventDocuments: [
      { id: "ped_completion", eventId: event.id, title: "Completion report", status: "pending" },
      { id: "ped_gallery", eventId: event.id, title: "Photo and video turnover", status: "pending" },
    ],
    eventInsights: [{
      id: "insight_demo",
      eventId: event.id,
      summary: "Readiness is strong; final balance and post-event closure items remain open.",
      highlights: ["Supplier and coordinator assignments are confirmed.", "Guest check-in workflow is ready."],
      risks: [{ title: "Final balance pending", severity: "medium", status: "open" }],
      supplierNotes: [{ supplierId: supplier.id, rating: 5, notes: "Registration partner ready.", reviewedBy: "Ms. Mys" }],
      financialSummary: { billingCount: 1, totalBilled: 520000, amountPaid: 156000, outstandingAmount: 364000 },
      documentSummary: { total: 4, submitted: 4, pendingPostEventDocuments: 2 },
      feedbackSummary: { feedbackDocuments: 0, supplierReviews: 1, clientFeedbackSubmitted: false },
      privateNotes: "Monitor balance reminder and closure handoff.",
      generatedAt: createdAt,
      updatedAt: createdAt,
    }],
    floorPlanDrafts: [{
      id: event.activeFloorPlanDraftId,
      eventId: event.id,
      floorPlanId: event.floorPlanId,
      name: "Ayala Tech Summit official layout",
      status: "approved",
      isActive: true,
      sourceType: "template",
      createdByRole: "pmcm-admin",
      submittedAt: createdAt,
      reviewedAt: createdAt,
      approvedAt: createdAt,
      submittedSnapshotAt: createdAt,
      approvedSnapshotAt: createdAt,
      revisionComment: "Approved official layout for client review.",
      createdAt,
      updatedAt: createdAt,
    }],
    supplierCategories: [supplierCategory],
    suppliers: [supplier],
    auditLogs: [{
      id: "aud_seed",
      eventId: event.id,
      actor: "Ms. Mys",
      actorRole: "pmcm-admin",
      actorEmail: "mys@pmcm.test",
      action: "Prepared screenshot demo state",
      actionType: "create",
      category: "demo",
      affectedType: "event",
      affectedId: event.id,
      affectedLabel: event.eventName,
      metadata: { source: "capture script fallback" },
      ipAddress: "127.0.0.1",
      device: "Codex capture",
      severity: "info",
      immutableHash: "mock-hash-001",
      previousHash: null,
      createdAt,
    }],
    notificationLogs: [
      { id: "notif_layout_review", eventId: event.id, channel: "email", recipient: "ana@ayala.test", message: "Official layout is ready for client review", status: "queued", createdAt },
      { id: "notif_supplier_ready", eventId: event.id, channel: "viber", recipient: supplier.contactName, message: "Registration readiness confirmed", status: "sent", createdAt },
    ],
    approvalRequests: [{ id: "appr_supplier", userId: "usr_supplier", email: supplier.email, status: "approved", requestedAt: createdAt, reviewedAt: createdAt, reviewedBy: "Ms. Mys", privacyConsentAccepted: true, privacyNoticeVersion: "2026-05-01", marketingConsentAccepted: false }],
    guestCheckIns,
    eventDayTasks: [{ id: "task_registration", eventId: event.id, title: "Registration desk dry run", assignedRole: "Registration Lead", ownerName: coordinator.name, priority: "high", status: "in_progress", notes: "Verify scanners and badge printer.", dueAt: "2026-06-18T07:30:00.000Z", slaDueAt: "2026-06-18T07:30:00.000Z", slaStatus: "on_track", escalationLevel: "none", completedAt: null, createdAt, updatedAt: createdAt }],
    urgentIssues: [{ id: "urg_vip_holding", eventId: event.id, title: "VIP holding signage pending", description: "Confirm printed directional signage before ingress.", severity: "medium", status: "assigned", ownerRole: "Floor Director", ownerName: coordinator.name, resolution: "", openedBy: "Ms. Mys", slaDueAt: "2026-06-18T08:00:00.000Z", slaStatus: "due_soon", escalationLevel: "role_lead", createdAt, updatedAt: createdAt }],
    eventDayLogs: [{ id: "log_registration", eventId: event.id, actionType: "status", actor: coordinator.name, actorRole: "coordinator", message: "Registration dry run started.", relatedType: "task", relatedId: "task_registration", metadata: {}, createdAt }],
    privacyRequests: [{ id: "priv_export", eventId: event.id, subjectType: "guest", subjectEmail: "sofia@example.test", subjectName: "Sofia Lim", requestType: "export", status: "submitted", requestNotes: "Guest requested attendance data export.", reviewReason: "", executionNotes: "", createdBy: "Ms. Mys", reviewedBy: null, reviewedAt: null, executedBy: null, executedAt: null, createdAt, updatedAt: createdAt }],
    privacyRetentionPolicies: [{ surface: "Guest check-ins", dataCategories: ["attendance", "consent"], retentionPeriod: "1 year after event closure", deletionBehavior: "Archive then purge on schedule" }],
    securityAlerts: [{ id: "sec_demo", eventId: event.id, type: "lockout", title: "Demo security review", description: "Audit integrity check completed for demo state.", severity: "low", status: "resolved", triggeredBy: "system", metadata: {}, createdAt, resolvedAt: createdAt }],
  };
}

function normalizeState(state) {
  const fallback = createFallbackState();
  if (!state || typeof state !== "object") return fallback;
  const next = { ...fallback, ...state };
  for (const [key, fallbackValue] of Object.entries(fallback)) {
    if (Array.isArray(fallbackValue) && (!Array.isArray(next[key]) || next[key].length === 0)) {
      next[key] = fallbackValue;
    }
  }
  next.events = (next.events.length ? next.events : fallback.events).map((event, index) => ({
    ...fallback.events[0],
    ...event,
    guestAccessCode: event.guestAccessCode ?? fallback.events[index]?.guestAccessCode ?? fallback.events[0].guestAccessCode,
    activeFloorPlanDraftId: event.activeFloorPlanDraftId ?? fallback.events[0].activeFloorPlanDraftId,
    floorPlanId: event.floorPlanId ?? fallback.events[0].floorPlanId,
  }));
  return next;
}

function sessionByEmail(state, email) {
  const user = state.users.find((item) => item.email === email);
  if (!user) throw new Error(`Demo user not found: ${email}`);
  return { ...user, signedInAt: new Date().toISOString() };
}

function buildGuestSession(state, event) {
  return {
    id: event.id,
    eventName: event.eventName,
    eventDate: event.eventDate,
    clientName: event.clientName,
    readiness: event.readiness,
    floorPlanStatus: event.floorPlanStatus,
    activeFloorPlanDraftId: event.activeFloorPlanDraftId,
    guestAccessCode: event.guestAccessCode,
    attendanceCount: state.guestCheckIns.filter((item) => item.eventId === event.id).length,
    guestName: "Sofia Lim",
    openedAt: new Date().toISOString(),
  };
}

function localStorageItemsForAuth(auth, context) {
  if (!auth) return [];
  if (auth === "client") return [["prism:mock-auth-session", JSON.stringify(context.sessions.client)]];
  if (auth === "pmcm") return [["prism:event-command-session", JSON.stringify(context.sessions.pmcm)]];
  if (auth === "coordinator") return [["prism:event-command-session", JSON.stringify(context.sessions.coordinator)]];
  if (auth === "supplier") return [["prism:supplier-session", JSON.stringify(context.sessions.supplier)]];
  if (auth === "guest") return [["prism:guest-session", JSON.stringify(context.sessions.guest)]];
  throw new Error(`Unknown auth profile: ${auth}`);
}

function preloadScriptFor(items) {
  return `
(() => {
  const items = ${JSON.stringify(items)};
  try {
    for (const [key, value] of items) {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    console.warn("PRISM screenshot session seed failed", error);
  }
})();
`;
}

function mockFloorPlan(context) {
  return {
    id: context.event.floorPlanId ?? "plan_demo_ayala_main",
    name: "Ayala Tech Summit official layout",
    venue: "Shangri-La Grand Ballroom",
    width: 32,
    height: 24,
    gridSize: 1,
    pax: 240,
    objects: [],
    guests: [],
    suppliers: [],
    seats: [],
    seatCategories: [],
    includeGuests: false,
    includeSuppliers: false,
    status: "approved",
    createdAt: "2026-05-07T06:00:00.000Z",
    updatedAt: "2026-05-07T06:00:00.000Z",
  };
}

function mockTemplates(context) {
  const plan = mockFloorPlan(context);
  return [{
    id: "tpl_ballroom_summit",
    name: "Corporate summit ballroom",
    description: "Registration, sponsor wall, main stage, and VIP seating zones.",
    venue: plan.venue,
    width: plan.width,
    height: plan.height,
    gridSize: plan.gridSize,
    pax: plan.pax,
    objects: [],
    includeGuests: false,
    includeSuppliers: false,
    guests: [],
    suppliers: [],
    createdAt: plan.createdAt,
  }];
}

function mockDefenseReadiness(context) {
  const state = context.state;
  const event = context.event;
  return {
    eventId: event.id,
    eventName: event.eventName,
    overallStatus: "attention",
    lifecycleStage: "planning",
    score: 86,
    summary: {
      briefingSubmitted: true,
      officialFloorplanApproved: true,
      quoteRequests: state.supplierQuoteRequests.length,
      selectedSuppliers: state.supplierQuotes.filter((quote) => quote.status === "selected").length,
      coordinatorAssignments: state.coordinatorAssignments.length,
      pendingCoordinatorAcknowledgments: state.coordinatorAssignments.filter((item) => !item.acknowledgedAt).length,
      openLiveOpsItems: state.eventDayTasks.filter((item) => item.status !== "done").length + state.urgentIssues.filter((item) => item.status !== "resolved").length,
      billingStatements: state.billingStatements.length,
      unpaidMilestones: state.paymentMilestones.filter((item) => item.status !== "paid").length,
      guestAttendanceCount: state.guestCheckIns.length,
      pendingFeedbackModeration: 0,
      closureReady: false,
    },
    nextActions: [
      { key: "balance", label: "Collect final balance", detail: "Final balance is scheduled before event day.", status: "attention", targetTab: "billing" },
      { key: "closure", label: "Prepare closure packet", detail: "Post-event documents remain pending.", status: "blocked", targetTab: "closure" },
    ],
    liveAiBlocked: false,
    deferredScope: ["Payment gateway settlement remains manual for Prism."],
    generatedAt: "2026-05-07T06:00:00.000Z",
  };
}

function mockLiveOps(context) {
  const state = context.state;
  return {
    event: context.event,
    tasks: state.eventDayTasks,
    urgentIssues: state.urgentIssues,
    supplierStatuses: state.supplierQuoteRequests,
    coordinatorAssignments: state.coordinatorAssignments,
    guestAttendanceCount: state.guestCheckIns.length,
    guestCheckIns: state.guestCheckIns,
    eventDayLogs: state.eventDayLogs,
  };
}

function mockStatusFeed(context) {
  const liveOps = mockLiveOps(context);
  return {
    event: context.event,
    items: [
      ...liveOps.tasks.map((task) => ({ id: task.id, type: "task", title: task.title, status: task.status, role: task.assignedRole, slaStatus: task.slaStatus, escalationLevel: task.escalationLevel })),
      ...liveOps.urgentIssues.map((issue) => ({ id: issue.id, type: "urgent_issue", title: issue.title, status: issue.status, role: issue.ownerRole, slaStatus: issue.slaStatus, escalationLevel: issue.escalationLevel })),
      ...liveOps.supplierStatuses.map((request) => ({ id: request.id, type: "supplier_status", title: request.supplierName, status: request.eventDayStatus ?? request.status, role: "Supplier", verificationStatus: request.eventDayVerificationStatus ?? request.verificationStatus })),
    ],
    coordinatorAssignments: liveOps.coordinatorAssignments,
    eventDayLogs: liveOps.eventDayLogs,
    guestAttendanceCount: liveOps.guestAttendanceCount,
    guestCheckIns: liveOps.guestCheckIns,
  };
}

function mockCloseGates(context) {
  return {
    eventId: context.event.id,
    ready: false,
    missingKeys: ["final_balance", "post_event_documents"],
    gates: [
      { key: "billing", label: "Billing statement sent", ready: true, detail: "BS-2026-0001 is sent." },
      { key: "payment", label: "Final balance collected", ready: false, detail: "Final balance remains pending." },
      { key: "documents", label: "Post-event documents complete", ready: false, detail: "Completion report and gallery handoff pending." },
    ],
  };
}

function mockSupplierWorkspace(context) {
  const supplier = context.state.suppliers.find((item) => item.email === context.sessions.supplier.email) ?? context.state.suppliers[0];
  const quoteRequests = context.state.supplierQuoteRequests.filter((request) => !supplier || request.supplierId === supplier.id || request.supplierName === supplier.name);
  const supplierQuotes = context.state.supplierQuotes.filter((quote) => !supplier || quote.supplierId === supplier.id || quote.supplierName === supplier.name);
  return { supplier, quoteRequests, supplierQuotes };
}

function mockCoordinatorWorkspace(context) {
  const coordinator = context.state.coordinators.find((item) => item.email === context.sessions.coordinator.email) ?? context.state.coordinators[0];
  const assignments = context.state.coordinatorAssignments.filter((item) => !coordinator || item.coordinatorId === coordinator.id || item.coordinatorName === coordinator.name);
  return { coordinator, assignments, events: context.state.events };
}

function mockCoordinatorRoleView(context) {
  const workspace = mockCoordinatorWorkspace(context);
  const liveOps = mockLiveOps(context);
  return {
    ...liveOps,
    role: workspace.assignments[0]?.role ?? "Floor Director",
    assignment: workspace.assignments[0],
  };
}

function mockGuestEvent(context) {
  return {
    id: context.event.id,
    eventName: context.event.eventName,
    eventDate: context.event.eventDate,
    clientName: context.event.clientName,
    readiness: context.event.readiness,
    floorPlanStatus: context.event.floorPlanStatus,
    activeFloorPlanDraftId: context.event.activeFloorPlanDraftId,
    guestAccessCode: context.event.guestAccessCode,
    attendanceCount: context.state.guestCheckIns.length,
  };
}

function mockPrivacyInventory(context) {
  return {
    generatedAt: "2026-05-07T06:00:00.000Z",
    events: [{
      eventId: context.event.id,
      eventName: context.event.eventName,
      dataCategories: ["client contact", "guest attendance", "supplier documents"],
      recordCount: 18,
      retentionNotes: "Prism demo retention follows event archive lifecycle.",
      surfaces: [{
        surface: "Guest check-ins",
        recordCount: context.state.guestCheckIns.length,
        dataCategories: ["attendance", "consent"],
        consentAcceptedCount: context.state.guestCheckIns.length,
        missingConsentCount: 0,
        privacyNoticeVersions: ["2026-05-01"],
      }],
    }],
    globalSurfaces: [{
      surface: "Auth audit",
      recordCount: context.state.auditLogs.length,
      dataCategories: ["login", "role", "activity"],
      consentAcceptedCount: context.state.users.length,
      missingConsentCount: 0,
      privacyNoticeVersions: ["2026-05-01"],
    }],
    retentionNotes: ["Archive event records after closure review.", "Keep audit logs immutable for PMCM review."],
  };
}

function mockApiData(url, method, context) {
  const parsed = new URL(url);
  const pathName = parsed.pathname;
  const state = context.state;
  const event = context.event;

  if (method === "OPTIONS") return { status: 204, body: null };
  if (pathName === "/health" || pathName === "/api/health") return { body: { status: "ok", service: "p.r.i.s.m api mock" } };
  if (pathName === "/api/demo/state" || pathName === "/api/demo/reset" || pathName === "/api/demo/seed") return { body: state };
  if (pathName === "/api/client/workspace") return { body: state };
  if (pathName === "/api/onboarding") return { body: { inquiries: state.inquiries, documents: state.documents } };
  if (pathName === "/api/events") return { body: state.events };
  if (pathName === `/api/events/${event.id}`) return { body: event };
  if (/^\/api\/events\/[^/]+\/defense-readiness$/.test(pathName)) return { body: mockDefenseReadiness(context) };
  if (/^\/api\/events\/[^/]+\/live-ops$/.test(pathName)) return { body: mockLiveOps(context) };
  if (/^\/api\/events\/[^/]+\/event-day\/status-feed$/.test(pathName)) return { body: mockStatusFeed(context) };
  if (/^\/api\/events\/[^/]+\/close-gates$/.test(pathName)) return { body: mockCloseGates(context) };
  if (/^\/api\/events\/[^/]+\/insights$/.test(pathName)) return { body: state.eventInsights };
  if (/^\/api\/events\/[^/]+\/floorplans\/[^/]+\/snapshot$/.test(pathName)) return { body: mockFloorPlan(context) };
  if (/^\/api\/plans\/[^/]+$/.test(pathName)) return { body: mockFloorPlan(context) };
  if (pathName === "/api/templates") return { body: mockTemplates(context) };
  if (pathName === "/api/suppliers/categories") return { body: state.supplierCategories };
  if (pathName === "/api/suppliers") return { body: state.suppliers };
  if (pathName === "/api/billing") {
    return { body: { billingSources: state.billingSources, billingStatements: state.billingStatements, paymentMilestones: state.paymentMilestones, paymentRecords: state.paymentRecords } };
  }
  if (pathName === "/api/auth/login") return { body: context.sessions[method === "POST" ? "pmcm" : "pmcm"] };
  if (pathName === "/api/auth/approval-requests") return { body: state.approvalRequests };
  if (/^\/api\/auth\/users\/[^/]+\/login-history$/.test(pathName)) return { body: [] };
  if (pathName === "/api/audit/logs") return { body: state.auditLogs };
  if (pathName === "/api/audit/alerts") return { body: state.securityAlerts };
  if (pathName === "/api/audit/integrity") return { body: { valid: true, checkedCount: state.auditLogs.length, firstBrokenLogId: null, lastVerifiedHash: state.auditLogs.at(-1)?.immutableHash ?? null, checkedAt: "2026-05-07T06:00:00.000Z" } };
  if (pathName === "/api/privacy/inventory") return { body: mockPrivacyInventory(context) };
  if (pathName === "/api/privacy/retention-policies") return { body: state.privacyRetentionPolicies };
  if (pathName === "/api/privacy/requests") return { body: state.privacyRequests };
  if (pathName === "/api/coordinators") return { body: state.coordinators };
  if (pathName === "/api/coordinator/workspace") return { body: mockCoordinatorWorkspace(context) };
  if (/^\/api\/coordinator\/events\/[^/]+\/role-view$/.test(pathName)) return { body: mockCoordinatorRoleView(context) };
  if (pathName === "/api/supplier/workspace") return { body: mockSupplierWorkspace(context) };
  if (/^\/api\/quote-requests\/[^/]+$/.test(pathName)) return { body: { request: state.supplierQuoteRequests[0], quote: state.supplierQuotes[0] ?? null, eventId: event.id, eventName: event.eventName, clientName: event.clientName, eventDate: event.eventDate } };
  if (/^\/api\/guest\/events\/[^/]+$/.test(pathName)) return { body: mockGuestEvent(context) };
  if (pathName === "/api/ai/pare/pending") return { body: [] };
  if (pathName === "/api/compliance/rules") return { body: state.complianceRules };

  return { body: {} };
}

async function installMockApi(cdp, sessionId, context) {
  await cdp.send("Fetch.enable", {
    patterns: [
      { urlPattern: "http://localhost:4000/*", requestStage: "Request" },
      { urlPattern: "http://127.0.0.1:4000/*", requestStage: "Request" },
    ],
  }, sessionId);

  cdp.on("Fetch.requestPaused", async (params, pausedSessionId) => {
    if (pausedSessionId !== sessionId) return;
    const response = mockApiData(params.request.url, params.request.method, context);
    const body = response.status === 204 ? "" : JSON.stringify({ data: response.body });
    await cdp.send("Fetch.fulfillRequest", {
      requestId: params.requestId,
      responseCode: response.status ?? 200,
      responseHeaders: [
        { name: "Access-Control-Allow-Origin", value: "*" },
        { name: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
        { name: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        { name: "Content-Type", value: "application/json; charset=utf-8" },
        { name: "Cache-Control", value: "no-store" },
      ],
      body: Buffer.from(body, "utf8").toString("base64"),
    }, sessionId).catch((error) => {
      console.warn(`Mock API fulfill failed for ${params.request.url}: ${error.message}`);
    });
  });
}

class CdpConnection {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ws = new WebSocket(webSocketUrl);
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out connecting to Edge CDP.")), 10_000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(new Error(`Edge CDP websocket failed: ${event.message ?? "unknown error"}`));
      }, { once: true });
    });

    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) {
        const listeners = this.listeners.get(message.method) ?? [];
        for (const listener of listeners) {
          Promise.resolve(listener(message.params ?? {}, message.sessionId)).catch((error) => {
            console.warn(`CDP event handler failed for ${message.method}: ${error.message}`);
          });
        }
        return;
      }
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(`${request.method} failed: ${message.error.message}`));
      } else {
        request.resolve(message.result ?? {});
      }
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.ws.send(JSON.stringify(message));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out.`));
        }
      }, 30_000).unref?.();
    });
  }

  close() {
    this.ws.close();
  }
}

async function startEdge() {
  const edgePath = findEdgePath();
  const port = await getFreePort();
  const profileDir = path.join("C:\\tmp", `prism-feature-capture-${Date.now()}`);
  await mkdir(profileDir, { recursive: true });

  const edge = spawn(edgePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  edge.unref();

  const version = await waitForHttp(`http://127.0.0.1:${port}/json/version`, 20_000).then((response) => response.json());
  const cdp = new CdpConnection(version.webSocketDebuggerUrl);
  await cdp.open();

  return {
    cdp,
    async close() {
      try {
        cdp.close();
      } catch {
      }
      try {
        edge.kill();
      } catch {
      }
      await sleep(500);
      await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

async function createPage(cdp, preloadScript) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: 1,
    mobile: false,
  }, sessionId);
  if (preloadScript) {
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: preloadScript }, sessionId);
  }
  return { targetId, sessionId };
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
  }
  return result.result?.value;
}

async function waitForReady(cdp, sessionId, page) {
  const markers = page.markers ?? [];
  const started = Date.now();
  let lastStatus = null;

  while (Date.now() - started < READY_TIMEOUT_MS) {
    lastStatus = await evaluate(cdp, sessionId, `
(() => {
  const text = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const markers = ${JSON.stringify(markers.map((marker) => marker.toLowerCase()))};
  const markerResults = markers.map((marker) => ({ marker, found: lower.includes(marker) }));
  const pulseCount = document.querySelectorAll(".animate-pulse").length;
  const readyState = document.readyState;
  const loadingText = /loading (your|the|pmcm|coordinator|visible|role-safe|readiness|close-gate|layout|prism)|signing in|opening/i.test(text);
  const markerReady = markerResults.every((item) => item.found);
  return {
    ready: readyState === "complete" && markerReady && pulseCount === 0 && !loadingText && text.length > 120,
    readyState,
    markerResults,
    pulseCount,
    loadingText,
    textLength: text.length,
    sample: text.slice(0, 240),
  };
})();
`);

    if (lastStatus?.ready) {
      await evaluate(cdp, sessionId, "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true");
      return lastStatus;
    }
    await sleep(POLL_MS);
  }

  const missing = (lastStatus?.markerResults ?? [])
    .filter((item) => !item.found)
    .map((item) => item.marker)
    .join(", ");
  throw new Error(
    `${page.title} was not ready before screenshot. Missing markers: ${missing || "none"}. ` +
    `pulseCount=${lastStatus?.pulseCount ?? "n/a"} loadingText=${lastStatus?.loadingText ?? "n/a"} sample="${lastStatus?.sample ?? ""}"`,
  );
}

async function runActions(cdp, sessionId, page) {
  for (const action of page.actions ?? []) {
    if (action.type === "clickText") {
      const clicked = await evaluate(cdp, sessionId, `
(() => {
  const needle = ${JSON.stringify(action.text.toLowerCase())};
  const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
  const match = candidates.find((item) => (item.textContent || "").toLowerCase().includes(needle));
  if (!match) return false;
  match.click();
  return true;
})();
`);
      if (!clicked) throw new Error(`Could not click "${action.text}" on ${page.title}.`);
      await sleep(800);
    }
  }
}

async function capturePage(browser, page, context) {
  const url = page.urlTemplate ? page.urlTemplate(context) : page.url;
  const items = localStorageItemsForAuth(page.auth, context);
  const { targetId, sessionId } = await createPage(browser.cdp, preloadScriptFor(items));
  await installMockApi(browser.cdp, sessionId, context);

  try {
    await browser.cdp.send("Page.navigate", { url }, sessionId);
    await waitForReady(browser.cdp, sessionId, page);
    await runActions(browser.cdp, sessionId, page);
    await waitForReady(browser.cdp, sessionId, page);

    const metrics = await browser.cdp.send("Page.getLayoutMetrics", {}, sessionId);
    const contentSize = metrics.cssContentSize ?? metrics.contentSize ?? {};
    const height = Math.max(VIEWPORT.height, Math.min(MAX_CAPTURE_HEIGHT, Math.ceil(contentSize.height ?? VIEWPORT.height)));
    const screenshot = await browser.cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: VIEWPORT.width,
        height,
        scale: 1,
      },
    }, sessionId);

    const filename = slugFile(page.id);
    const filePath = path.join(SCREENSHOT_DIR, filename);
    await writeFile(filePath, Buffer.from(screenshot.data, "base64"));
    return {
      ...page,
      url,
      screenshot: `screenshots/${filename}`,
      status: "captured",
      captureHeight: height,
    };
  } finally {
    await browser.cdp.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

function directPagesForRef(ref, capturedPages) {
  return capturedPages.filter((page) => page.featureRefs.includes(ref));
}

function defaultPagesForSection(section, capturedPages) {
  const ids = SECTION_DEFAULT_PAGE_IDS[section] ?? [];
  return ids.map((id) => capturedPages.find((page) => page.id === id)).filter(Boolean);
}

function buildIndex(features, capturedPages, context) {
  const lines = [];
  const pageById = new Map(capturedPages.map((page) => [page.id, page]));
  const allDirectRefs = new Set(capturedPages.flatMap((page) => page.featureRefs));
  const uniqueCatalogRefs = new Set(features.map((feature) => feature.ref));
  const directCatalogRefs = [...uniqueCatalogRefs].filter((ref) => allDirectRefs.has(ref));

  lines.push("# P.R.I.S.M V4 Feature Screenshot Index");
  lines.push("");
  lines.push(`Generated: ${CAPTURE_DATE}`);
  lines.push("");
  lines.push(`Source catalog: \`docs/prism-v4/01-complete-feature-catalog.md\``);
  lines.push("");
  lines.push("## Skeleton Capture Guard");
  lines.push("");
  lines.push("The capture pass uses a content-readiness guard instead of a fixed delay:");
  lines.push("");
  lines.push("- Seeds the correct demo session into `localStorage` before each route hydrates.");
  lines.push("- Waits for API health, route-specific text markers, `document.readyState === \"complete\"`, and loaded fonts.");
  lines.push("- Rejects screenshots while `.animate-pulse` skeleton elements or loading copy are still present.");
  lines.push("- Captures with Microsoft Edge headless through the Chrome DevTools Protocol, so no Playwright install is required.");
  lines.push("");
  lines.push("This is the safer idea for this repo because skeleton-only screenshots are a timing/auth/data-readiness problem. Waiting for real page markers makes the screenshot fail loudly instead of silently saving a loading state.");
  lines.push("");
  lines.push("## Demo Context");
  lines.push("");
  lines.push(`- Event: \`${context.event.eventName}\` (\`${context.eventId}\`)`);
  lines.push(`- Guest code: \`${context.event.guestAccessCode}\``);
  lines.push(`- Viewport: \`${VIEWPORT.width}x${VIEWPORT.height}\`, max capture height \`${MAX_CAPTURE_HEIGHT}px\``);
  lines.push("");
  lines.push("## Pages");
  lines.push("");
  lines.push("| Page | App | URL | Screenshot | Direct feature refs |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const page of capturedPages) {
    lines.push(`| ${markdownEscape(page.title)} | \`${page.app}\` | \`${page.url}\` | [${page.screenshot}](${page.screenshot}) | ${page.featureRefs.map((ref) => `\`${ref}\``).join(", ")} |`);
  }
  lines.push("");
  lines.push("## Page Feature Notes");
  lines.push("");
  for (const page of capturedPages) {
    const pageFeatures = features.filter((feature) => page.featureRefs.includes(feature.ref));
    lines.push(`### ${page.title}`);
    lines.push("");
    lines.push(`Screenshot: [${page.screenshot}](${page.screenshot})`);
    lines.push("");
    lines.push(page.purpose);
    lines.push("");
    if (pageFeatures.length) {
      lines.push("| Ref | Feature | Scope | Catalog section |");
      lines.push("| --- | --- | --- | --- |");
      for (const feature of pageFeatures) {
        lines.push(`| \`${feature.ref}\` | ${markdownEscape(feature.feature)} | ${markdownEscape(feature.scope)} | ${markdownEscape(feature.section)} |`);
      }
      lines.push("");
    }
  }
  lines.push("## Catalog Coverage");
  lines.push("");
  lines.push(`Catalog rows parsed: ${features.length}`);
  lines.push(`Unique catalog refs: ${uniqueCatalogRefs.size}`);
  lines.push(`Unique refs with direct screenshot mapping: ${directCatalogRefs.length}`);
  lines.push("");
  lines.push("| Ref | Feature | Scope | Section | Screenshot page(s) | Coverage mode |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const feature of features) {
    const direct = directPagesForRef(feature.ref, capturedPages);
    const defaults = direct.length ? direct : defaultPagesForSection(feature.section, capturedPages);
    const pages = defaults.length ? defaults : [pageById.get("pmcm-command-dashboard")].filter(Boolean);
    const mode = direct.length ? "Direct" : feature.scope.toLowerCase().includes("phase 2") || feature.scope.toLowerCase().includes("ai") ? "Nearest / roadmap" : "Nearest surface";
    const pageLinks = pages.map((page) => `[${page.title}](${page.screenshot})`).join(", ");
    lines.push(`| \`${feature.ref}\` | ${markdownEscape(feature.feature)} | ${markdownEscape(feature.scope)} | ${markdownEscape(feature.section)} | ${pageLinks} | ${mode} |`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- `Direct` means the feature ref is intentionally assigned to that screenshot page in the capture manifest.");
  lines.push("- `Nearest surface` means the feature is in the catalog but does not have a one-feature route; the index points to the closest current page for that persona/workflow.");
  lines.push("- `Nearest / roadmap` is used for Phase 2 or live-AI catalog items whose current Prism evidence is a designed surface, data model, governance boundary, or roadmap view rather than live production behavior.");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await waitForHttp(`${BASE_URLS.api}/health`);
  await Promise.all([
    waitForHttp(BASE_URLS.client),
    waitForHttp(BASE_URLS.supplier),
    waitForHttp(BASE_URLS.guest),
    waitForHttp(BASE_URLS.event),
  ]);

  process.stdout.write("Preparing capture context... ");
  let state;
  try {
    state = normalizeState(await readJson(`${BASE_URLS.api}/api/demo/state`, 8_000));
    process.stdout.write("live API state loaded\n");
  } catch (error) {
    state = createFallbackState();
    process.stdout.write(`using deterministic fallback state (${error.message})\n`);
  }
  const event = state.events.find((item) => item.guestAccessCode) ?? state.events[0];
  if (!event) throw new Error("No demo event found for capture context.");

  const context = {
    state,
    event,
    eventId: event.id,
    sessions: {
      pmcm: sessionByEmail(state, "mys@pmcm.test"),
      client: sessionByEmail(state, "ana@ayala.test"),
      coordinator: sessionByEmail(state, "marco@pmcm.test"),
      supplier: sessionByEmail(state, "ops@xperto.test"),
      guest: buildGuestSession(state, event),
    },
  };

  const features = await parseCatalog();
  const browser = await startEdge();
  const capturedPages = [];

  try {
    for (const page of PAGE_DEFINITIONS) {
      process.stdout.write(`Capturing ${page.id}... `);
      const captured = await capturePage(browser, page, context);
      capturedPages.push(captured);
      process.stdout.write(`ok\n`);
    }
  } finally {
    await browser.close();
  }

  const index = buildIndex(features, capturedPages, context);
  await writeFile(INDEX_PATH, index, "utf8");
  await writeFile(MANIFEST_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), context: { eventId: context.eventId, eventName: event.eventName }, pages: capturedPages }, null, 2), "utf8");

  console.log(`\nWrote ${capturedPages.length} screenshots.`);
  console.log(INDEX_PATH);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
