import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@prism/ui/components/sonner";
import { DocumentTitleProvider } from "./components/document-title";

// No title here: the tab title belongs to the page, rendered through DocumentTitleProvider.
export const metadata: Metadata = {
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
      <body className="min-h-screen bg-background text-foreground antialiased">
        <DocumentTitleProvider>{children}</DocumentTitleProvider>
        <Toaster />
      </body>
    </html>
  );
}
