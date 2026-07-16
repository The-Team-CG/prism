import { Skeleton } from "@/app/components/ui/skeleton";

export default function GuestLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-4 flex w-full max-w-md flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
