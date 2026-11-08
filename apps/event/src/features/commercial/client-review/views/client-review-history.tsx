import { BUDGET_EXPECTATION_LABELS, type PrismClientReviewItem } from "@prism/types";

/** FR-09: full revision history per option type, newest first, with the client's decision and budget answer. */
export function ClientReviewHistory({ items }: { items: PrismClientReviewItem[] }) {
  const ordered = [...items].sort((a, b) => a.kind.localeCompare(b.kind) || b.version - a.version);
  if (ordered.length === 0) return null;
  return (
    <details className="mt-4 rounded-md border border-border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Revision history ({ordered.length} versions)</summary>
      <ol className="mt-2 space-y-1 text-xs">
        {ordered.map((item) => (
          <li key={item.id}>
            <span className="font-semibold capitalize">{item.kind}</span> v{item.version} · {item.title} · {item.clientDecision ? item.clientDecision.action.replaceAll("_", " ") : "awaiting response"}
            {item.clientDecision?.budgetExpectation ? ` · ${BUDGET_EXPECTATION_LABELS[item.clientDecision.budgetExpectation]}` : ""}
            {item.clientDecision?.comment ? ` · "${item.clientDecision.comment}"` : ""}
          </li>
        ))}
      </ol>
    </details>
  );
}
