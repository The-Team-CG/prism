import Link from "next/link";

export function ClientSharedFloorplansNavigation() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card p-4 md:block">
      <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Client Portal</p>
      <nav aria-label="Client portal navigation" className="mt-2 space-y-1">
        <Link
          href="/dashboard"
          className="block rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          Dashboard
        </Link>
        <Link
          href="/dashboard/shared-floorplans"
          aria-current="page"
          className="block rounded-md bg-primary/10 px-3 py-2 text-sm font-bold text-primary"
        >
          Shared floorplans
        </Link>
      </nav>
    </aside>
  );
}
