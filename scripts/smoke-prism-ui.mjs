import { readFileSync } from "node:fs";

const routes = [
  { url: "http://localhost:4000/health", markers: ["ok"] },
  { url: "http://localhost:3001/", markers: ["P.R.I.S.M"] },
  { url: "http://localhost:3001/sign-in", markers: ["Client"] },
  { url: "http://localhost:3001/inquiry", markers: ["inquiry"] },
  { url: "http://localhost:3001/dashboard", markers: ["Client"] },
  { url: "http://localhost:3002/", markers: ["Supplier"] },
  { url: "http://localhost:3002/sign-in", markers: ["Supplier"] },
  { url: "http://localhost:3002/dashboard", markers: ["Supplier"] },
  { url: "http://localhost:3003/", markers: ["Guest"] },
  { url: "http://localhost:3003/open", markers: ["Guest"] },
  { url: "http://localhost:3003/dashboard", markers: ["Guest"] },
  { url: "http://localhost:3004/", markers: ["Event"] },
];

const publicFiles = [
  "apps/client/src/app/components/landing/MainLandingPage.tsx",
  "apps/client/src/app/components/public-inquiry/PublicInquiryPage.tsx",
  "apps/supplier/src/app/page.tsx",
  "apps/guest/src/app/page.tsx",
];

const forbiddenPatterns = [
  /href=["']\/dashboard["']/,
  /href=["']http:\/\/localhost:300[1-4][^"']*\/dashboard["']/,
  /router\.replace\(["']\/dashboard["']\)/,
];

for (const file of publicFiles) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      throw new Error(`Public dashboard link found in ${file}: ${pattern}`);
    }
  }
}

for (const route of routes) {
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
