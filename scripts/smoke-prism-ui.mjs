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
    file: "apps/client/src/app/components/dashboard/Dashboard.tsx",
    markers: ["Conforme", "Billing", "Official floorplan", "Activity"],
  },
  {
    file: "apps/supplier/src/app/dashboard/page.tsx",
    markers: ["Quote and assignment queue", "Selected assignment handoff", "Event-day status"],
  },
  {
    file: "apps/guest/src/app/dashboard/page.tsx",
    markers: ["Registration check-in", "Moderated feedback", "Event progress"],
  },
  {
    file: "apps/event/src/app/page.tsx",
    markers: ["Billing", "Supplier", "Defense"],
  },
  {
    file: "apps/event/src/app/components/pmcm/coordinator-view.tsx",
    markers: ["Role-safe", "Event-day actions", "Coordinator information boundary"],
  },
];

const publicFiles = [
  "apps/client/src/app/components/landing/MainLandingPage.tsx",
  "apps/client/src/app/components/public-inquiry/PublicInquiryPage.tsx",
  "apps/supplier/src/app/page.tsx",
  "apps/guest/src/app/page.tsx",
  "apps/event/src/app/page.tsx",
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

function publicSourceFor(file, source) {
  if (file !== "apps/event/src/app/page.tsx") return source;

  const start = source.indexOf("function SignIn");
  const end = source.indexOf("function PmcmPortal", start);
  if (start === -1 || end === -1) {
    throw new Error("Unable to isolate PMCM public sign-in source for smoke guards.");
  }
  return source.slice(start, end);
}

for (const file of publicFiles) {
  const source = readFileSync(file, "utf8");
  const publicSource = publicSourceFor(file, source);
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

const clientDashboard = readFileSync("apps/client/src/app/components/dashboard/Dashboard.tsx", "utf8");
for (const forbidden of ["approveFloorPlanDraft", "submitFloorPlanDraft"]) {
  if (clientDashboard.includes(forbidden)) {
    throw new Error(`Client dashboard contains official floorplan mutation helper: ${forbidden}`);
  }
}
if (!clientDashboard.includes("openFloorplanEditor(officialDraft, true)")) {
  throw new Error("Client dashboard no longer shows the official floorplan through the read-only editor path.");
}

const coordinatorView = readFileSync("apps/event/src/app/components/pmcm/coordinator-view.tsx", "utf8");
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
