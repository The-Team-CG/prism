export interface PrismSupportContact {
  email?: string;
  phone?: string;
}

/**
 * A real way to reach PMCM about account access: email (with the situation pre-filled) and phone when
 * configured, otherwise the plain instruction. `topic` names the situation, e.g. "an expired invitation".
 */
export function PrismAccountHelp({
  topic,
  fallback = "Contact PMCM for account issues or access requests.",
  contact,
}: {
  topic: string;
  /** Shown when no channel is configured; null when the surrounding copy already says what to do. */
  fallback?: string | null;
  /** The deployment's PMCM channel; portals read it from their own environment. */
  contact: PrismSupportContact;
}) {
  if (!contact.email && !contact.phone) return fallback ? <p>{fallback}</p> : null;
  const subject = encodeURIComponent(`P.R.I.S.M account help: ${topic}`);
  return (
    <p>
      Need help with {topic}?{" "}
      {contact.email ? (
        <a href={`mailto:${contact.email}?subject=${subject}`} className="text-primary transition-colors hover:text-primary/80">
          Email PMCM
        </a>
      ) : null}
      {contact.email && contact.phone ? " or " : null}
      {contact.phone ? (
        <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="text-primary transition-colors hover:text-primary/80">
          call {contact.phone}
        </a>
      ) : null}
      .
    </p>
  );
}
