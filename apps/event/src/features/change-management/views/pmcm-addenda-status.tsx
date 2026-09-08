import type { PrismAddendum, PrismEventFreezeException } from "@prism/types";

export function PmcmAddendaStatus({ addenda, exceptions = [] }: { addenda: readonly PrismAddendum[]; exceptions?: readonly PrismEventFreezeException[] }) {
  return (
    <section aria-labelledby="pmcm-addenda-status" className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="pmcm-addenda-status" className="text-lg font-semibold">Scope freeze and addenda</h2>
        <p className="text-sm text-muted-foreground">Issued versions remain immutable. Scanned document bytes stay pending until the document workflow confirms availability.</p>
      </div>
      {addenda.length === 0 ? <p className="text-sm text-muted-foreground">No addenda issued.</p> : (
        <ul className="space-y-3">{addenda.map((addendum) => <li key={addendum.id} className="flex items-center justify-between border-b border-border pb-3 text-sm"><span><strong>Version {addendum.versionNumber}: {addendum.title}</strong><br /><span className="text-muted-foreground">{addendum.summary || "Scope change recorded"}</span></span><span className="text-right text-xs text-muted-foreground">{addendum.signatureMethod === "scanned_document" ? "Scanned document" : addendum.signatureMethod}<br />{addendum.documentState === "pending" ? "Document pending" : "Document available"}</span></li>)}</ul>
      )}
      {exceptions.length > 0 ? <div className="border-t border-border pt-3"><h3 className="text-sm font-semibold">Freeze exceptions</h3><ul className="mt-2 space-y-2 text-sm">{exceptions.map((exception) => <li key={exception.id} className="flex justify-between"><span>{exception.requestedChange}</span><span className="text-muted-foreground">{exception.status}</span></li>)}</ul></div> : null}
    </section>
  );
}
