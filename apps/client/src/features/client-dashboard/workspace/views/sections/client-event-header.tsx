"use client";

import { NoticeBanner } from "./shell-presentational";

export function ClientWorkspaceBanners({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? <NoticeBanner tone="danger">{error}</NoticeBanner> : null}
      {notice ? <NoticeBanner tone="success">{notice}</NoticeBanner> : null}
    </>
  );
}

