import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card/50 px-8 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="size-5" />
        </span>
      ) : null}
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
