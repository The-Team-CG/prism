import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"rounded-2xl border border-border bg-card shadow-sm " + className}>{children}</div>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="border-b border-border px-6 py-4">{children}</div>;
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"px-6 py-5 " + className}>{children}</div>;
}
