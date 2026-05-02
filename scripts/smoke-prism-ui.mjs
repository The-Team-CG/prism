import { readFileSync } from "node:fs";

const routes = [
  "http://localhost:4000/health",
  "http://localhost:3001/",
  "http://localhost:3001/sign-in",
  "http://localhost:3001/inquiry",
  "http://localhost:3001/dashboard",
  "http://localhost:3002/",
  "http://localhost:3002/sign-in",
  "http://localhost:3002/dashboard",
  "http://localhost:3003/",
  "http://localhost:3003/open",
  "http://localhost:3003/dashboard",
  "http://localhost:3004/",
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
  const response = await fetch(route);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}`);
  }
  console.log(`OK ${response.status} ${route}`);
}
