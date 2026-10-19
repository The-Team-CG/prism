export { EventDashboardShellView as default, EventDashboardShellView } from "./views/event-dashboard-shell-view";
export { useEventDashboardShellViewModel } from "./view-models/use-event-dashboard-shell-view-model";
export { EventDashboardRouteView } from "./views/event-dashboard-route-view";
export {
  EventDashboardAuditSectionView,
  EventDashboardCalendarSectionView,
  EventDashboardClientsSectionView,
  EventDashboardCommandInboxSectionView,
  EventDashboardEventsListSectionView,
  EventDashboardFilesSectionView,
  EventDashboardFinanceSectionView,
  EventDashboardHomeSectionView,
  EventDashboardInquiriesSectionView,
  EventDashboardMessagesSectionView,
  EventDashboardPrivacySectionView,
  EventDashboardSettingsSectionView,
  EventDashboardSuppliersSectionView,
  EventDashboardTasksSectionView,
  EventDashboardTeamSectionView,
} from "./views/sections/event-dashboard-section-views";
export { EventDashboardEventWorkspaceView } from "./views/sections/event-dashboard-event-workspace-view";
export {
  eventDashboardCommands,
  type EventDashboardCommands,
} from "./data/event-dashboard-commands";
export type { EventDashboardClientProps } from "./model/event-dashboard-routing";
export type {
  DashboardSection,
  DetailTab,
  RouteState,
} from "./model/event-dashboard-routing";
export {
  CLIENT_DETAIL_ROUTES,
  CLIENT_DETAIL_ROUTE_ITEMS,
  CLIENT_LIST_ROUTE_ITEMS,
  DASHBOARD_ROUTE_ITEMS,
  EVENT_DETAIL_ROUTES,
  EVENT_LIST_ROUTE_ITEMS,
  EVENT_TAB_BY_ROUTE,
  EVENT_TAB_ROUTES,
  EVENT_WORKSPACE_ROUTE_ITEMS,
  EVENT_WORKSPACE_ROUTE_TABS,
  SECTION_ROUTE_ITEMS,
  SIDEBAR_STATIC_ROUTES,
  activeSidebarItemFromRoute,
  dashboardRouteState,
  eventListRouteState,
  eventRouteState,
  isEventListView,
  routeLoadingShellCopy,
  routeStateForSidebarItem,
  routeStateFromPath,
} from "./model/event-dashboard-routing";
export {
  selectClientRecords,
  selectClientRecordsForView,
  selectEventsForView,
  selectUnreviewedInquiryCount,
  type EventClientRecord,
} from "./model/event-dashboard-selectors";
export {
  getCachedCoordinatorWorkspace,
  getCachedPmcmState,
  isDashboardCacheFresh,
  loadCoordinatorWorkspace,
  loadPmcmState,
} from "./use-cases/load-dashboard-workspace";
export { pmcmDashboardRepository } from "./data/pmcm-dashboard-repository";
