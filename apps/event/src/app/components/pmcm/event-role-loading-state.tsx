import { Radio } from "lucide-react";

import { Card } from "@/app/components/ui/card";

export function EventRoleLoadingState({ role }: { role: "pmcm-admin" | "coordinator" | string }) {
  const isCoordinator = role === "coordinator";
  const title = `Loading ${isCoordinator ? "coordinator" : "PMCM"} command data`;
  const description = isCoordinator
    ? "Role-safe assignments, attendance state, and event-day queues are being prepared."
    : "Events, finance, close gates, and local notification queue are being prepared.";
  const skeletonItems = isCoordinator ? ["Assignment", "Role queue", "Issues"] : ["Events", "Finance", "Closure"];

  return (
    <Card className="min-h-[420px] rounded-lg border-primary/12 bg-card p-6" aria-live="polite">
      <div className="mx-auto grid max-w-2xl gap-4 py-10 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-lg bg-secondary text-primary">
          <Radio className="size-5" />
        </span>
        <div>
          <p className="text-sm font-black text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {skeletonItems.map((item) => (
            <span key={item} className="h-10 rounded-md border border-border bg-secondary/45" />
          ))}
        </div>
      </div>
    </Card>
  );
}
