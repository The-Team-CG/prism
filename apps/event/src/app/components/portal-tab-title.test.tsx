/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismGuestShell, PrismPortalShell } from "@prism/ui";
import { DocumentTitleProvider } from "@prism/ui/document-title";

const DEFAULT_TITLE = "P.R.I.S.M - Client Portal";

beforeAll(() => {
  // The sidebar reads these browser APIs; jsdom does not provide them.
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
  });
});

afterEach(() => {
  cleanup();
});

function ClientPage({ title }: { title: string }) {
  return (
    <PrismPortalShell portal="client" roleLabel="Client Portal" title={title} navItems={[{ id: "home", label: "Home", icon: Inbox, section: "Home" }]} activeItemId="home">
      <p>page body</p>
    </PrismPortalShell>
  );
}

describe("tab title from the shared shells", () => {
  it("names the tab after the open page and follows navigation, so every page is not called the same", () => {
    const { rerender } = render(<DocumentTitleProvider defaultTitle={DEFAULT_TITLE}><ClientPage title="Approvals" /></DocumentTitleProvider>);
    expect(document.title).toBe("Approvals · P.R.I.S.M.");

    rerender(<DocumentTitleProvider defaultTitle={DEFAULT_TITLE}><ClientPage title="Billing" /></DocumentTitleProvider>);
    expect(document.title).toBe("Billing · P.R.I.S.M.");
  });

  it("falls back to the portal's own title on a page with no shell, and names the guest tab after the event", () => {
    const { rerender } = render(<DocumentTitleProvider defaultTitle={DEFAULT_TITLE}><p>sign in</p></DocumentTitleProvider>);
    expect(document.title).toBe(DEFAULT_TITLE);

    rerender(<DocumentTitleProvider defaultTitle={DEFAULT_TITLE}><PrismGuestShell eventName="Ayala Summit"><p>pass</p></PrismGuestShell></DocumentTitleProvider>);
    expect(document.title).toBe("Ayala Summit · P.R.I.S.M.");
  });
});
