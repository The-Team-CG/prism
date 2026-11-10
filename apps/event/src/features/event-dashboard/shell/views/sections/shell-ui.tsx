"use client";


export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-6 py-4 [&_h2]:text-base! [&_h2]:font-semibold! [&_h3]:text-base! [&_h3]:font-semibold!">{children}</div>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

export function SectionAccent({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground">{children}</p>
  );
}
