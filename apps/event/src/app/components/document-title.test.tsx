/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_DOCUMENT_TITLE, DocumentTitleProvider, useDocumentTitle } from "./document-title";

function Page({ title }: { title?: string }) {
  useDocumentTitle(title);
  return <p>page body</p>;
}

function renderPage(title?: string) {
  return render(<DocumentTitleProvider><Page title={title} /></DocumentTitleProvider>);
}

afterEach(() => {
  cleanup();
});

describe("DocumentTitleProvider", () => {
  it("shows the open page's title in the tab, and the product name when a page names none", () => {
    const { unmount } = renderPage("Suppliers · P.R.I.S.M");
    expect(document.title).toBe("Suppliers · P.R.I.S.M");
    unmount();

    renderPage(undefined);
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
  });

  it("follows a route change to the next page's title, and restores the default when the page leaves", () => {
    const { rerender } = renderPage("Inbox · P.R.I.S.M");
    rerender(<DocumentTitleProvider><Page title="My shift · P.R.I.S.M" /></DocumentTitleProvider>);
    expect(document.title).toBe("My shift · P.R.I.S.M");

    // The root layout stays mounted across routes; only the page leaves.
    rerender(<DocumentTitleProvider><Page /></DocumentTitleProvider>);
    expect(document.title).toBe(DEFAULT_DOCUMENT_TITLE);
  });
});
