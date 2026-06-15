import type { ReactNode } from "react";

import type { RouteState } from "@/features/event-dashboard/event-dashboard.routing";

export type EventDashboardSkeletonVariant = "command" | "event" | "suppliers" | "audit" | "coordinator";

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gradient-to-r from-muted/80 via-muted/50 to-muted/80 ring-1 ring-border/30 ${className}`}
    />
  );
}

export function SkeletonCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm ring-1 ring-black/5 sm:p-5 ${className}`}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-(--prism-signal)/60 via-transparent to-transparent" />
      {children}
    </section>
  );
}

function MetricSkeletonGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard key={index}>
          <div className="flex items-center gap-3">
            <SkeletonLine className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-6 w-16 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-24 rounded-md" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function EventDashboardSessionSkeleton() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-sm rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <SkeletonLine className="size-11 rounded-md" />
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-4 w-32 rounded-md" />
            <SkeletonLine className="mt-2 h-3 w-40 rounded-md" />
          </div>
        </div>
        <SkeletonLine className="mt-5 h-3 w-full rounded-md" />
        <SkeletonLine className="mt-2 h-3 w-4/5 rounded-md" />
      </section>
    </main>
  );
}

export function EventDashboardSkeleton({ variant = "event" }: { variant?: EventDashboardSkeletonVariant }) {
  if (variant === "suppliers") {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SkeletonCard>
            <SkeletonLine className="h-3 w-32 rounded-full" />
            <SkeletonLine className="mt-3 h-7 w-72 max-w-full rounded-md" />
            <SkeletonLine className="mt-4 h-10 w-full max-w-md rounded-lg" />
          </SkeletonCard>
          <SkeletonCard>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                <SkeletonLine className="size-9 rounded-md" />
                <div className="min-w-0 flex-1">
                  <SkeletonLine className="h-4 w-44 rounded-md" />
                  <SkeletonLine className="mt-2 h-3 w-64 max-w-full rounded-md" />
                </div>
                <SkeletonLine className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </SkeletonCard>
        </div>
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-40 rounded-md" />
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonLine key={index} className="mt-4 h-10 w-full rounded-lg" />
          ))}
        </SkeletonCard>
      </div>
    );
  }

  if (variant === "audit") {
    return (
      <div className="space-y-5">
        <SkeletonCard>
          <SkeletonLine className="h-3 w-28 rounded-full" />
          <SkeletonLine className="mt-3 h-7 w-64 rounded-md" />
          <SkeletonLine className="mt-4 h-10 w-full max-w-lg rounded-lg" />
        </SkeletonCard>
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index}>
              <div className="flex items-start gap-3">
                <SkeletonLine className="size-8 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <SkeletonLine className="h-4 w-56 max-w-full rounded-md" />
                  <SkeletonLine className="mt-2 h-3 w-72 max-w-full rounded-md" />
                </div>
                <SkeletonLine className="h-7 w-24 rounded-full" />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "command") {
    return (
      <div className="space-y-5">
        <SkeletonCard>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-3 w-28 rounded-full" />
              <SkeletonLine className="mt-3 h-8 w-80 max-w-full rounded-md" />
              <SkeletonLine className="mt-3 h-4 w-full max-w-xl rounded-md" />
            </div>
            <SkeletonLine className="h-10 w-32 rounded-md" />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonLine key={index} className="h-9 rounded-full" />
            ))}
          </div>
        </SkeletonCard>
        <MetricSkeletonGrid />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <SkeletonCard>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="border-b border-border py-3 last:border-b-0">
                <SkeletonLine className="h-4 w-64 max-w-full rounded-md" />
                <SkeletonLine className="mt-2 h-3 w-44 rounded-md" />
              </div>
            ))}
          </SkeletonCard>
          <SkeletonCard className="min-h-60">
            <SkeletonLine className="h-4 w-36 rounded-md" />
            <SkeletonLine className="mt-5 h-24 w-full rounded-lg" />
            <SkeletonLine className="mt-4 h-4 w-4/5 rounded-md" />
            <SkeletonLine className="mt-2 h-4 w-2/3 rounded-md" />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  if (variant === "coordinator") {
    return (
      <div className="space-y-5">
        <MetricSkeletonGrid />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard className="min-h-64">
            <SkeletonLine className="h-4 w-40 rounded-md" />
            <SkeletonLine className="mt-5 h-20 w-full rounded-lg" />
            <SkeletonLine className="mt-3 h-20 w-full rounded-lg" />
          </SkeletonCard>
          <SkeletonCard className="min-h-64">
            <SkeletonLine className="h-4 w-44 rounded-md" />
            <SkeletonLine className="mt-5 h-32 w-full rounded-lg" />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SkeletonCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-3 w-32 rounded-full" />
            <SkeletonLine className="mt-3 h-8 w-80 max-w-full rounded-md" />
            <SkeletonLine className="mt-3 h-4 w-60 rounded-md" />
            <div className="mt-3 flex flex-wrap gap-2">
              <SkeletonLine className="h-7 w-24 rounded-full" />
              <SkeletonLine className="h-7 w-32 rounded-full" />
              <SkeletonLine className="h-7 w-28 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonLine className="h-9 w-28 rounded-md" />
            <SkeletonLine className="h-9 w-24 rounded-md" />
          </div>
        </div>
      </SkeletonCard>
      <MetricSkeletonGrid />
      <SkeletonCard>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonLine key={index} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      </SkeletonCard>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-40 rounded-md" />
          <SkeletonLine className="mt-5 h-36 w-full rounded-lg" />
          <SkeletonLine className="mt-4 h-4 w-3/4 rounded-md" />
        </SkeletonCard>
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-36 rounded-md" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonLine key={index} className="mt-4 h-12 w-full rounded-lg" />
          ))}
        </SkeletonCard>
      </div>
    </div>
  );
}

export function eventDashboardSkeletonVariant(routeState: RouteState): EventDashboardSkeletonVariant {
  if (routeState.section === "suppliers") return "suppliers";
  if (routeState.section === "audit") return "audit";
  if (routeState.eventId) return "event";
  return "command";
}
