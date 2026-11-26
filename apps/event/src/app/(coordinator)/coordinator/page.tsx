import { CoordinatorPortalView } from "@/features/coordinators/portal";

/** Coordinators work here; PMCM works under /dashboard. The view in the query (?view=tasks&event=…) picks the screen. */
export default function CoordinatorPortalPage() {
  return <CoordinatorPortalView />;
}
