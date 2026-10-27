import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

export function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Card className="gap-0 rounded-lg border-primary/12 bg-card shadow-none">
      <CardHeader className="flex min-h-12 flex-row items-center gap-2 border-b border-border px-4 py-0">
        <Icon className="size-4 text-attention" />
        <CardTitle className="text-sm font-black text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <Card className="gap-0 rounded-lg border-primary/12 bg-card p-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-secondary text-foreground">
          <Icon className="size-5" />
        </div>
        <p className="text-right text-2xl font-black text-foreground">{value}</p>
      </div>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </Card>
  );
}
