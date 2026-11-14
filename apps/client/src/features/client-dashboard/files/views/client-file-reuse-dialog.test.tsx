/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientLibraryFile } from "../model/client-file-library";
import type { ClientFileLibraryViewModel } from "../view-models/use-client-file-library-view-model";
import { ClientFileReuseDialog } from "./client-file-reuse-dialog";

afterEach(cleanup);

const file = (name: string, expiresAt: string | null): ClientLibraryFile => ({
  id: name, name, kind: "pdf", size: 2048, category: "other", addedBy: "You", addedAt: "2026-06-01T00:00:00Z",
  status: "Approved", tone: "done", objectId: `obj_${name}`, eventId: "evt_old", eventName: "Spring Gala", expiresAt,
});

describe("Use a file from another event", () => {
  it("won't send an expired document again, and says to upload a current one", () => {
    const reuseFile = vi.fn();
    const vm = {
      reuseTarget: { key: "venue_permit", label: "Venue permit" }, reuseQuery: "", setReuseQuery: vi.fn(), closeReuse: vi.fn(),
      reuseLoading: false, busy: false, reuseFile,
      reuseCandidates: [file("permit-2025.pdf", "2025-12-31T00:00:00.000Z"), file("permit-2027.pdf", "2027-12-31T00:00:00.000Z")],
    } as unknown as ClientFileLibraryViewModel;
    render(<ClientFileReuseDialog vm={vm} />);

    const expired = screen.getByRole("button", { name: /permit-2025\.pdf/ });
    expect(expired.hasAttribute("disabled")).toBe(true);
    expect(expired.textContent).toContain("Expired 2025-12-31. Upload a current one instead.");
    fireEvent.click(screen.getByRole("button", { name: /permit-2027\.pdf/ }));
    expect(reuseFile).toHaveBeenCalledWith(expect.objectContaining({ name: "permit-2027.pdf" }));
  });
});
