export interface PrismPrivacyNoticeDocument {
  effectiveDate: string;
  sections: ReadonlyArray<{ heading: string; paragraphs: readonly string[] }>;
}

/** Renders the shared privacy notice. The page heading comes from the surrounding shell. */
export function PrismPrivacyNoticeContent({ notice }: { notice: PrismPrivacyNoticeDocument }) {
  return (
    <article className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">Effective {notice.effectiveDate}</p>
      {notice.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
