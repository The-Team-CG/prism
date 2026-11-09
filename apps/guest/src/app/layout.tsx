import type { Metadata } from "next";
import { DocumentTitleProvider } from "@prism/ui/document-title";
import "./globals.css";

// No title here: the tab title belongs to the page, rendered through DocumentTitleProvider.
export const metadata: Metadata = {
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
      <body className="min-h-screen bg-background text-foreground antialiased">
        <DocumentTitleProvider defaultTitle="P.R.I.S.M - Guest Experience Portal">{children}</DocumentTitleProvider>
      </body>
    </html>
  );
}
