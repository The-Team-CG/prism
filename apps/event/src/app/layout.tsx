import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P.R.I.S.M - Event-Day Command",
  description:
    "Coordinator-facing event-day command portal for assignments, readiness, supplier status, and urgent issue handling.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
