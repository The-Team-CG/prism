import path from "node:path";
import type { NextConfig } from "next";

const serviceMode = process.env.PRISM_VERCEL_SERVICES === "1";
const basePath = serviceMode ? "/event" : "";

const DASHBOARD = "/dashboard";

/**
 * Dashboard URLs that no longer have their own page. Each one permanently redirects to the section that
 * owns it, so old links keep working. Order matters: the first matching rule wins.
 */
const DEAD_VIEW_REDIRECTS = [
  { source: `${DASHBOARD}/command-inbox`, destination: DASHBOARD },
  ...["overview", "upcoming-events", "pending-tasks", "recent-messages", "financial-summary"].map((view) => ({
    source: `${DASHBOARD}/${view}`,
    destination: DASHBOARD,
  })),
  { source: `${DASHBOARD}/clients/:view(all|active|prospects|past|archived)`, destination: `${DASHBOARD}/clients` },
  { source: `${DASHBOARD}/calendar/:view`, destination: `${DASHBOARD}/calendar` },
  { source: `${DASHBOARD}/tasks/:view`, destination: `${DASHBOARD}/tasks` },
  { source: `${DASHBOARD}/messages/:view`, destination: `${DASHBOARD}/messages` },
  { source: `${DASHBOARD}/files/:view`, destination: `${DASHBOARD}/files` },
  { source: `${DASHBOARD}/finance/:view`, destination: `${DASHBOARD}/finance` },
  { source: `${DASHBOARD}/settings/system-logs`, destination: `${DASHBOARD}/audit` },
  { source: `${DASHBOARD}/settings/:view`, destination: `${DASHBOARD}/settings` },
];

/** Event workspace alias segments, each redirecting to the single canonical tab URL that renders it. */
const EVENT_ALIAS_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: "games", to: "registration?part=games" },
  { from: "planning-checklist", to: "briefing" },
  { from: "decisions", to: "decision-log" },
  { from: "schedule", to: "live-ops" },
  { from: "attendees", to: "live-ops" },
  { from: "timeline", to: "live-ops" },
  { from: "staff", to: "coordinators" },
  { from: "budget", to: "billing" },
  { from: "post-event-report", to: "closure" },
];

const nextConfig: NextConfig = {
  ...(process.env.PRISM_PUBLIC_HOST ? { allowedDevOrigins: [process.env.PRISM_PUBLIC_HOST] } : {}),
  ...(process.env.PRISM_NEXT_DIST_DIR ? { distDir: process.env.PRISM_NEXT_DIST_DIR } : {}),
  basePath,
  ...(serviceMode ? { env: {
    NEXT_PUBLIC_API_URL: "",
    NEXT_PUBLIC_PRISM_API_BASE_URL: "/api",
    NEXT_PUBLIC_PORTAL_BASE_PATH: basePath,
    NEXT_PUBLIC_CLIENT_PORTAL_URL: "/",
    NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "/supplier",
    NEXT_PUBLIC_GUEST_PORTAL_URL: "/guest",
    NEXT_PUBLIC_EVENT_PORTAL_URL: "/event",
  } } : {}),
  ...(process.env.PRISM_DOCKER_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@prism/ui", "@prism/tokens", "@prism/api-client", "@prism/types", "@prism/portal-query"],
  async redirects() {
    return [
      ...DEAD_VIEW_REDIRECTS.map((rule) => ({ ...rule, permanent: true })),
      ...EVENT_ALIAS_REDIRECTS.map(({ from, to }) => ({
        source: `${DASHBOARD}/events/:eventSlug/${from}`,
        destination: `${DASHBOARD}/events/:eventSlug/${to}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
