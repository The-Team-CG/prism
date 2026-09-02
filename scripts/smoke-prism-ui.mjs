import { readFileSync } from "node:fs";

const publicRoutes = [
  { url: "http://localhost:4000/health", markers: ["ok"] },
  { url: "http://localhost:3001/", markers: ["P.R.I.S.M"] },
  { url: "http://localhost:3001/sign-in", markers: ["Client"] },
  { url: "http://localhost:3001/inquiry", markers: ["inquiry"] },
  { url: "http://localhost:3002/", markers: ["Supplier"] },
  { url: "http://localhost:3002/sign-in", markers: ["Supplier"] },
  { url: "http://localhost:3003/", markers: ["Guest"] },
  { url: "http://localhost:3003/open", markers: ["Guest", "event code"] },
  { url: "http://localhost:3004/", markers: ["Event", "PMCM"] },
];

const sourceGuards = [
  {
    file: "apps/client/src/features/client-dashboard/workspace/views/client-dashboard-workspace-view.tsx",
    markers: ["conforme", "billing", "floorplan"],
  },
  {
    file: "apps/supplier/src/features/supplier-dashboard/workspace/views/sections/dashboard-page.tsx",
    markers: ["Quote requests", "Supplier-scoped handoff state", "Event-day status"],
  },
  {
    file: "apps/guest/src/features/guest-checkin/dashboard/views/sections/guest-dashboard-panels.tsx",
    markers: ["Registration check-in", "Moderated feedback", "Event details"],
  },
  {
    file: "apps/event/src/features/event-public/landing/views/event-command-landing.tsx",
    markers: ["Billing", "Supplier", "Live operations", "Closure"],
  },
  {
    file: "apps/event/src/features/coordinators/desk/views/sections/coordinator-view-sections.tsx",
    markers: ["Role-safe", "Event-day actions", "Coordinator information boundary"],
  },
];

const publicFiles = [
  "apps/client/src/features/client-home/landing/views/client-home-landing-view.tsx",
  "apps/client/src/features/inquiry/submit/views/inquiry-submit-view.tsx",
  "apps/supplier/src/features/supplier-home/landing/views/supplier-home-landing-view.tsx",
  "apps/guest/src/features/guest-home/landing/views/guest-home-landing-view.tsx",
  "apps/event/src/features/event-public/landing/views/event-command-landing.tsx",
];

const forbiddenPatterns = [
  /href=["']\/dashboard["']/,
  /href=["']http:\/\/localhost:300[1-4][^"']*\/dashboard["']/,
  /router\.replace\(["']\/dashboard["']\)/,
];

const forbiddenPublicPhrases = [
  /dashboard shortcut/i,
  /defense/i,
  /PMCM-only/i,
  /role-safe/i,
  /boundary/i,
  /selected event cockpit/i,
  /readiness score/i,
  /See cockpit/i,
  /sample/i,
  /Ayala Tech/i,
  /Leadership Forum/i,
  /92%/,
];

for (const file of publicFiles) {
  const source = readFileSync(file, "utf8");
  const publicSource = source;
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(publicSource)) {
      throw new Error(`Public dashboard link found in ${file}: ${pattern}`);
    }
  }
  for (const pattern of forbiddenPublicPhrases) {
    if (pattern.test(publicSource)) {
      throw new Error(`Forbidden public-facing phrase found in ${file}: ${pattern}`);
    }
  }
}

const clientDashboard = readFileSync(
  "apps/client/src/features/client-dashboard/workspace/views/client-dashboard-workspace-view.tsx",
  "utf8",
);
for (const forbidden of ["approveFloorPlanDraft", "submitFloorPlanDraft"]) {
  if (clientDashboard.includes(forbidden)) {
    throw new Error(`Client dashboard contains official floorplan mutation helper: ${forbidden}`);
  }
}
if (!clientDashboard.includes('openFloorplanEditor(officialDraft, officialDraft.status === "approved")')) {
  throw new Error("Client dashboard no longer shows the official floorplan through the read-only editor path.");
}

const coordinatorView = readFileSync(
  "apps/event/src/features/coordinators/desk/views/coordinator-view.tsx",
  "utf8",
);
for (const forbidden of ["billingStatements", "auditLogs", "billingSources", "supplierReviews"]) {
  if (coordinatorView.includes(forbidden)) {
    throw new Error(`Coordinator role view references PMCM-only data: ${forbidden}`);
  }
}

for (const guard of sourceGuards) {
  const source = readFileSync(guard.file, "utf8");
  for (const marker of guard.markers) {
    if (!source.toLowerCase().includes(marker.toLowerCase())) {
      throw new Error(`${guard.file} did not include dashboard source marker "${marker}"`);
    }
  }
}

console.log(`OK static source guards (${sourceGuards.length} dashboard views)`);

for (const route of publicRoutes) {
  const response = await fetch(route.url);
  if (!response.ok) {
    throw new Error(`${route.url} returned ${response.status}`);
  }
  const body = await response.text();
  for (const marker of route.markers) {
    if (!body.toLowerCase().includes(marker.toLowerCase())) {
      throw new Error(`${route.url} did not include marker "${marker}"`);
    }
  }
  console.log(`OK ${response.status} ${route.url}`);
}
