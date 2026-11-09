"use client";

import { PortalErrorPage } from "@prism/ui/portal-status-pages";

export default function EventError({ error, retry }: { error: unknown; retry: () => void }) {
  return <PortalErrorPage error={error} retry={retry} />;
}
