import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("event dashboard shell architecture", () => {

  it("keeps each dashboard route's bundle to its own section", () => {
    // Importing the shell barrel (or the all-sections module) from a page shipped every section's code with every
    // route: 417 KB gzip per page instead of about 260 KB.
    const pagesRoot = new URL("../../../../app/(portal)/dashboard/", import.meta.url);
    const offenders: string[] = [];
    const importsAllSections = (source: string) =>
      source.includes(`from "@/features/event-dashboard/shell";`) || source.includes("/event-dashboard-section-views\"");
    function collectPages(url: URL) {
      for (const entry of readdirSync(url, { withFileTypes: true })) {
        const child = new URL(`${encodeURIComponent(entry.name)}${entry.isDirectory() ? "/" : ""}`, url);
        if (entry.isDirectory()) collectPages(child);
        else if (entry.name === "page.tsx" && importsAllSections(readFileSync(child, "utf8"))) {
          offenders.push(child.pathname);
        }
      }
    }
    collectPages(pagesRoot);
    expect(offenders).toEqual([]);
  });

  it("retires the cross-feature event-ops facade", () => {
    const sourceRoot = new URL("../../..", import.meta.url);
    const sourceFiles: string[] = [];

    function collectFiles(url: URL) {
      for (const entry of readdirSync(url, { withFileTypes: true })) {
        const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, url);
        if (entry.isDirectory()) {
          collectFiles(child);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
          sourceFiles.push(readFileSync(child, "utf8"));
        }
      }
    }

    collectFiles(sourceRoot);
    const retiredFacade = ["features", "event-ops"].join("/");
    expect(sourceFiles.join("\n")).not.toContain(retiredFacade);
    expect(sourceFiles.join("\n")).not.toContain("useEventOpsCommands");
    expect(sourceFiles.join("\n")).not.toContain("eventOpsRepository");
  });
});
