import { PrismBrandLogo } from "@prism/ui";
import { cn } from "@/app/components/ui/utils";
import { inquiryBriefRows } from "../../model/inquiry-submit-rules";
import type { InquiryForm } from "../../model/inquiry-submit-types";
import { inquiryImages } from "../../content/inquiry-images";

const NEXT_STEPS = [
  { title: "PMCM reviews your inquiry", text: "A coordinator reads the brief and checks the date." },
  { title: "You get your client account", text: "If PMCM takes the event on, you get a link to set a password and sign the conforme." },
  { title: "Planning opens", text: "Proposal, payments and your floorplan preferences live in your client portal." },
] as const;

/** The brief PMCM will open, filled in as the client answers. */
export function InquiryBrief({ form, reviewing = false }: { form: InquiryForm; reviewing?: boolean }) {
  const rows = inquiryBriefRows(form);
  const filled = rows.filter((row) => row.value).length;
  return (
    <div className="grid gap-8">
      <section aria-labelledby="inquiry-brief-title" className="overflow-hidden rounded-xl bg-card" data-ui>
          <div className="bg-ink px-6 pb-5 pt-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <h2 id="inquiry-brief-title" className="text-sm font-semibold text-white/70">
                {reviewing ? "Ready to send to PMCM" : "Inquiry brief for PMCM"}
              </h2>
              <PrismBrandLogo compact dark markClassName="size-7 rounded-md" />
            </div>
            <p className={cn("mt-4 font-heading text-2xl font-bold leading-tight", form.eventName.trim() ? "text-white" : "text-white/50")}>
              {form.eventName.trim() || "Untitled event"}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <div className="grid flex-1 grid-cols-6 gap-1" aria-hidden="true">
                {rows.map((row) => (
                  <span key={row.label} className={cn("h-1 rounded-full", row.value ? "bg-primary" : "bg-white/15")} />
                ))}
              </div>
              <p className="text-sm tabular-nums text-white/70">
                {filled} of {rows.length} answered
              </p>
            </div>
          </div>
          {reviewing ? null : (
          <dl className="grid gap-3 rounded-b-xl border-x border-b border-border px-6 py-5">
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className={row.value ? "font-medium text-foreground" : "text-muted-foreground"}>{row.value || "–"}</dd>
              </div>
            ))}
          </dl>
          )}
        </section>

      <section aria-labelledby="inquiry-next-title">
        <h2 id="inquiry-next-title" className="text-base font-semibold text-foreground">
          What happens after you send it
        </h2>
        <ol className="mt-4 grid gap-4">
          {NEXT_STEPS.map((step) => (
            <li key={step.title} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3">
              <span aria-hidden="true" className="mt-1.5 size-2.5 rounded-full bg-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {reviewing ? (
        <img src={inquiryImages.ballroom.src} alt={inquiryImages.ballroom.alt} className="hidden aspect-[16/10] w-full rounded-xl object-cover lg:block" />
      ) : null}
    </div>
  );
}
