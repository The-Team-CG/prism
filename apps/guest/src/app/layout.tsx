import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P.R.I.S.M - Guest Experience Portal",
  description:
    "Guest-facing P.R.I.S.M portal preview for registration, check-in, event engagement, and moderated post-event feedback.",
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
