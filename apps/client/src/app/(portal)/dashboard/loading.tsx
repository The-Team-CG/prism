import { Skeleton } from "../../components/ui/skeleton";

export default function ClientDashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col p-6">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
