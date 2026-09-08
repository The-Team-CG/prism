import type { PrismAddendum } from "@prism/types";

export function ClientAddendaStatus({ addenda }: { addenda: readonly PrismAddendum[] }) {
  return (
    <section aria-labelledby="client-addenda-status" className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div><h2 id="client-addenda-status" className="text-lg font-semibold">Addendum status</h2><p className="text-sm text-muted-foreground">Review the scope changes issued for your event. Document availability is shown as recorded by PMCM.</p></div>
      {addenda.length === 0 ? <p className="text-sm text-muted-foreground">No addenda have been issued.</p> : <ul className="space-y-3">{addenda.map((addendum) => <li key={addendum.id} className="border-b border-border pb-3 text-sm"><strong>Version {addendum.versionNumber}: {addendum.title}</strong><p className="text-muted-foreground">{addendum.summary || "Scope change recorded"}</p><p className="text-xs text-muted-foreground">{addendum.documentState === "pending" ? "Document pending" : "Document available"} · Issued {new Date(addendum.issuedAt).toLocaleDateString()}</p></li>)}</ul>}
    </section>
  );
}
