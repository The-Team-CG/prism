"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/app/components/ui/skeleton";

export type DashboardSkeletonVariant =
  | "home"
  | "request"
  | "events"
  | "event"
  | "floorplan"
  | "messages";

export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function SkeletonCard({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm ring-1 ring-black/5 sm:p-5 ${className ?? ""}`}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-(--prism-signal)/60 via-transparent to-transparent" />
      {children}
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-3 w-28 rounded-full" />
      <SkeletonLine className="mt-3 h-7 w-full max-w-sm rounded-md" />
      <SkeletonLine className="mt-3 h-4 w-full max-w-2xl rounded-md" />
      <div className="mt-4 flex flex-wrap gap-2">
        <SkeletonLine className="h-7 w-24 rounded-md" />
        <SkeletonLine className="h-7 w-28 rounded-md" />
        <SkeletonLine className="h-7 w-32 rounded-md" />
      </div>
    </SkeletonCard>
  );
}

export function MetricGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} className="min-h-24">
          <div className="flex items-center gap-3">
            <SkeletonLine className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-5 w-20 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-28 rounded-md" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-4 w-36 rounded-md" />
      <div className="mt-4 divide-y divide-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 py-3">
            <SkeletonLine className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-4 w-3/5 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-4/5 rounded-md" />
            </div>
            <SkeletonLine className="h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

export function EventWorkspaceSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} className="min-h-28">
            <SkeletonLine className="size-8 rounded-md" />
            <SkeletonLine className="mt-4 h-4 w-24 rounded-md" />
            <SkeletonLine className="mt-2 h-3 w-full rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <MetricGridSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ListSkeleton rows={4} />
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-32 rounded-md" />
          <SkeletonLine className="mt-5 h-28 w-full rounded-lg" />
          <SkeletonLine className="mt-4 h-4 w-3/4 rounded-md" />
          <SkeletonLine className="mt-2 h-4 w-1/2 rounded-md" />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function RequestSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <SkeletonCard>
        <SkeletonLine className="h-3 w-32 rounded-full" />
        <SkeletonLine className="mt-3 h-7 w-72 rounded-md" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index}>
              <SkeletonLine className="h-3 w-24 rounded-md" />
              <SkeletonLine className="mt-2 h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <SkeletonLine className="mt-4 h-28 w-full rounded-lg" />
        <SkeletonLine className="mt-5 h-11 w-40 rounded-md" />
      </SkeletonCard>
      <div className="space-y-4">
        <SkeletonCard className="min-h-48">
          <SkeletonLine className="h-3 w-32 rounded-full" />
          <SkeletonLine className="mt-5 h-4 w-full rounded-md" />
          <SkeletonLine className="mt-3 h-4 w-5/6 rounded-md" />
          <SkeletonLine className="mt-3 h-4 w-3/4 rounded-md" />
        </SkeletonCard>
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}

export function EventsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-3 w-24 rounded-full" />
            <SkeletonLine className="mt-3 h-7 w-72 max-w-full rounded-md" />
            <SkeletonLine className="mt-3 h-4 w-full max-w-lg rounded-md" />
          </div>
          <SkeletonLine className="h-10 w-36 rounded-md" />
        </div>
        <SkeletonLine className="mt-5 h-10 w-full max-w-md rounded-lg" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonLine key={index} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </SkeletonCard>
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={index}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_9rem] lg:items-center">
              <div>
                <SkeletonLine className="h-5 w-64 max-w-full rounded-md" />
                <SkeletonLine className="mt-2 h-4 w-44 rounded-md" />
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <SkeletonLine className="h-9 rounded-md" />
                  <SkeletonLine className="h-9 rounded-md" />
                  <SkeletonLine className="h-9 rounded-md" />
                </div>
              </div>
              <SkeletonLine className="h-10 w-36 rounded-md" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export function FloorplanSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <SkeletonCard className="min-h-[28rem]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SkeletonLine className="h-3 w-40 rounded-full" />
              <SkeletonLine className="mt-3 h-6 w-56 rounded-md" />
              <SkeletonLine className="mt-3 h-4 w-full max-w-lg rounded-md" />
            </div>
            <SkeletonLine className="h-7 w-24 rounded-md" />
          </div>
          <SkeletonLine className="mt-6 aspect-[16/9] h-auto w-full rounded-lg" />
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <SkeletonLine className="h-20 rounded-lg" />
            <SkeletonLine className="h-20 rounded-lg" />
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonLine className="h-5 w-44 rounded-md" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="mt-4">
              <SkeletonLine className="h-3 w-28 rounded-md" />
              <SkeletonLine className="mt-2 h-10 w-full rounded-lg" />
            </div>
          ))}
          <SkeletonLine className="mt-5 h-11 w-full rounded-lg" />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ variant = "event" }: { variant?: DashboardSkeletonVariant }) {
  if (variant === "request") return <RequestSkeleton />;
  if (variant === "events") return <EventsSkeleton />;
  if (variant === "floorplan") return <FloorplanSkeleton />;
  if (variant === "messages") {
    return (
      <div className="space-y-5">
        <HeaderSkeleton />
        <ListSkeleton rows={6} />
      </div>
    );
  }
  if (variant === "event") return <EventWorkspaceSkeleton />;

  return (
    <div className="space-y-5">
      <SkeletonCard className="min-h-48">
        <SkeletonLine className="h-3 w-28 rounded-full" />
        <SkeletonLine className="mt-4 h-8 w-full max-w-md rounded-md" />
        <SkeletonLine className="mt-3 h-4 w-full max-w-2xl rounded-md" />
        <div className="mt-6 flex flex-wrap gap-2">
          <SkeletonLine className="h-10 w-32 rounded-md" />
          <SkeletonLine className="h-10 w-28 rounded-md" />
        </div>
      </SkeletonCard>
      <MetricGridSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ListSkeleton rows={4} />
        <SkeletonCard className="min-h-64">
          <SkeletonLine className="h-4 w-36 rounded-md" />
          <SkeletonLine className="mt-5 h-28 w-full rounded-lg" />
          <SkeletonLine className="mt-4 h-4 w-3/4 rounded-md" />
          <SkeletonLine className="mt-2 h-4 w-1/2 rounded-md" />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function DashboardRightRailSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard key={index}>
          <div className="flex items-start gap-3">
            <SkeletonLine className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-3 w-24 rounded-full" />
              <SkeletonLine className="mt-3 h-4 w-32 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-full rounded-md" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function DashboardSessionSkeleton() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-sm rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <SkeletonLine className="size-11 rounded-md" />
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-4 w-28 rounded-md" />
            <SkeletonLine className="mt-2 h-3 w-36 rounded-md" />
          </div>
        </div>
        <SkeletonLine className="mt-5 h-3 w-full rounded-md" />
        <SkeletonLine className="mt-2 h-3 w-4/5 rounded-md" />
      </section>
    </main>
  );
}

