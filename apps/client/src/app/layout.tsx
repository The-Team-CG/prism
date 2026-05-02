import type { Metadata } from "next";
import { Toaster } from "./components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "P.R.I.S.M - Event Operations Platform",
  description:
    "P.R.I.S.M connects event inquiries, approvals, floorplans, suppliers, guests, billing, compliance, and closure into one operating system.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
