import type { RiskLevel } from "@prism/types";

export const riskLevelOptions: ReadonlyArray<{ value: RiskLevel; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function riskLevelLabel(level: RiskLevel | null | undefined): string {
  return riskLevelOptions.find((option) => option.value === level)?.label ?? "Not yet recorded";
}

/** Mirrors the server rule so the form asks for the reason before a lowering is sent. The server still enforces it. */
export function isLoweringRiskLevel(recorded: RiskLevel | null, next: RiskLevel): boolean {
  return recorded !== null && RANK[next] < RANK[recorded];
}
