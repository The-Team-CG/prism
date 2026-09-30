import type { ReactNode } from "react";

export function CCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"rounded-2xl border border-border bg-card shadow-sm " + className}>{children}</div>;
}

export function CCardHeader({ children }: { children: ReactNode }) {
  return <div className="border-b border-border px-5 py-4">{children}</div>;
}

export function CCardBody({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={"px-5 py-4 " + className}>
      {children}
    </div>
  );
}

export const FIELD_LABEL = "text-xs font-bold text-muted-foreground";
export const FIELD_INPUT = "h-11 rounded-md border border-border bg-white px-3 text-sm";
export const FIELD_AREA = "rounded-md border border-border bg-white px-3 py-2 text-sm";
export const FORM_SUBMIT =
  "h-11 rounded-md bg-(--prism-ink) px-3 text-sm font-bold text-sidebar-foreground disabled:opacity-60";
export const FORM_ALERT =
  "rounded-md bg-(--prism-danger)/10 px-3 py-2 text-xs font-bold text-(--prism-danger)";
