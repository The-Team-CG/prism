import { execFileSync } from "node:child_process";

// Use npm's severity gate directly; no package or advisory exemptions.
try {
  execFileSync("npm", ["audit", "--audit-level=moderate"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
} catch (error) {
  process.exitCode = error.status ?? 1;
}
