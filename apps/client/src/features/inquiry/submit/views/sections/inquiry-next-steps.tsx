import { inquiryImages } from "../../content/inquiry-images";

const NEXT_STEPS = [
  { title: "PMCM reviews your inquiry", text: "A coordinator reads the brief and checks the date." },
  { title: "You get your client account", text: "If PMCM takes the event on, you get a link to set a password and sign the conforme." },
  { title: "Planning opens", text: "Proposal, payments and your floorplan preferences live in your client portal." },
] as const;

export function InquiryNextSteps({ reviewing = false }: { reviewing?: boolean }) {
  return (
    <div className="grid gap-8">
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
