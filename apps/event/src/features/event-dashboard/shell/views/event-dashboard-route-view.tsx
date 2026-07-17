/**
 * Thin route slot for App Router dashboard URLs.
 * Route UI is owned by `EventDashboardShellView` in the layout (pathname-driven).
 * This view exists so every dashboard page composes a feature module instead of
 * an anonymous `return null`.
 */
export function EventDashboardRouteView(_props?: {
  /** Optional route key for future per-route section extraction */
  routeKey?: string;
}) {
  return null;
}
