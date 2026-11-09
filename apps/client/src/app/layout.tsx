import type { Metadata } from "next";
import { Toaster } from "@prism/ui/components/sonner";
import { DocumentTitleProvider } from "@prism/ui/document-title";
import "./globals.css";

// No title here: the tab title belongs to the page, rendered through DocumentTitleProvider.
export const metadata: Metadata = {
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
        <DocumentTitleProvider defaultTitle="P.R.I.S.M - Event Operations Platform">{children}</DocumentTitleProvider>
        <Toaster />
      </body>
    </html>
  );
}
