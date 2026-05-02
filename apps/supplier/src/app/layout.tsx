import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P.R.I.S.M - Supplier Network Portal",
  description:
    "Supplier-facing P.R.I.S.M portal preview for quote requests, assignment confirmation, readiness checks, and event-day status updates.",
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
