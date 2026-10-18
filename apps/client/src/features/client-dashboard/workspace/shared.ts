/**
 * Sibling-vertical surface for client-dashboard modules.
 * Prefer this over deep relative imports into model/views internals.
 * Do not import the shell view from here (avoids circular deps).
 */
export {
  ClientWorkspaceProvider,
  useClientWorkspace,
  type ClientWorkspaceValue,
  type PreferenceForm,
  type ClientRequestForm,
  type ClientWorkspaceRouter,
} from "./client-workspace-context";
export { useClientDashboardViewModel } from "./view-models/use-client-dashboard-view-model";
export type {
  ClientDashboardRoute,
  ClientPortalView,
  ClientSession,
  DetailTab,
  ClientSidebarRenderItem,
  ClientSidebarSubItem,
} from "./model/client-dashboard-types";
export {
  CLIENT_PORTAL_VIEW_META,
  CLIENT_SIDEBAR_ITEMS,
  DETAIL_TAB_TO_ROUTE,
  EVENT_ROUTE_TO_NAV_ITEM,
  EVENT_WORKSPACE_NAV_ITEMS,
  PORTAL_ROUTE_TO_NAV_ITEM,
  ROUTE_TO_DETAIL_TAB,
  dashboardHref,
  clientEventCardOpenRoute,
  clientEventWorkspaceAvailable,
  dashboardLoadingVariant,
  findClientSidebarLink,
  portalViewFromLink,
  sidebarActiveItemId,
} from "./model/client-dashboard-navigation";
export {
  clientEventMatchesFilter,
  selectClientEvents,
  selectClientEventHistoryEvents,
  selectEventDrafts,
  selectEventWorkspaceResources,
  selectSelectedClientEvent,
} from "./model/client-dashboard-selectors";
export {
  clientFloorplanDashboardActionLabel,
  eventProgressDots,
  formatStatusLabel,
  greetingByTime,
  type ClientDashboardAction,
} from "./model/client-dashboard-view-rules";
export {
  EventSummaryCard,
  EventWorkspaceNav,
  FieldGroup,
  NoticeBanner,
  PageHeader,
} from "./views/sections/shell-presentational";
export { LayoutPreview } from "./views/sections/layout-preview";
export { ClientPortalSidebar } from "./views/sections/client-portal-sidebar";
