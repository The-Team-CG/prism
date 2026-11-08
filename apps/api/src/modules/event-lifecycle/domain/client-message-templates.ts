import type { ClientLanguage, PrismAccountInvitationOutcome } from '@prism/types';

/**
 * FR-55: English and Filipino wording for the key automated client messages. English is the default and the source;
 * the Filipino copy should be read by a fluent PMCM staff member before relying on it for formal notices.
 */
type Invitation = PrismAccountInvitationOutcome['outcome'] | null;

const RECEIVED: Record<ClientLanguage, (eventName: string) => string> = {
  en: (eventName) => `We received your inquiry for ${eventName}. PMCM will review it and reply by email.`,
  fil: (eventName) => `Natanggap namin ang inyong inquiry para sa ${eventName}. Susuriin ito ng PMCM at sasagutin kayo sa email.`,
};

const EDIT_LINK: Record<ClientLanguage, (hours: number, link: string) => string> = {
  en: (hours, link) => ` You can change the details for ${hours} hours, until PMCM reviews it: ${link}`,
  fil: (hours, link) => ` Maaari ninyong baguhin ang mga detalye sa loob ng ${hours} oras, hanggang masuri ito ng PMCM: ${link}`,
};

const ACCEPTED: Record<ClientLanguage, { base: (eventName: string) => string; invited: string; existing: string; pending: string }> = {
  en: {
    base: (eventName) => `PMCM accepted your inquiry for ${eventName}. The next step is to review and sign your conforme in the P.R.I.S.M client portal.`,
    invited: 'We sent you a separate email, "Set up your P.R.I.S.M account", with a link to set your password. If it isn\'t in your inbox, check Spam or Promotions.',
    existing: 'Sign in with your existing P.R.I.S.M account to continue.',
    pending: 'PMCM will send you a link to set up your account shortly.',
  },
  fil: {
    base: (eventName) => `Tinanggap ng PMCM ang inyong inquiry para sa ${eventName}. Ang susunod na hakbang ay suriin at pirmahan ang inyong conforme sa P.R.I.S.M client portal.`,
    invited: 'Nagpadala kami ng hiwalay na email, "Set up your P.R.I.S.M account", na may link para itakda ang inyong password. Kung wala ito sa inbox, tingnan ang Spam o Promotions.',
    existing: 'Mag-sign in gamit ang inyong kasalukuyang P.R.I.S.M account para magpatuloy.',
    pending: 'Magpapadala ang PMCM ng link para ma-set up ang inyong account sa lalong madaling panahon.',
  },
};

/** Only these reasons are explained to the client; every other reason, including none, uses the generic wording. */
const DISCLOSED_DECLINE_REASONS: Record<ClientLanguage, Map<string, string>> = {
  en: new Map([
    ['Date Unavailable', "We're not available on your requested date."],
    ['Outside Service Scope', 'The event is outside the services we currently offer.'],
  ]),
  fil: new Map([
    ['Date Unavailable', 'Hindi kami available sa petsang hiniling ninyo.'],
    ['Outside Service Scope', 'Ang event ay wala sa mga serbisyong kasalukuyan naming iniaalok.'],
  ]),
};

const DECLINED: Record<ClientLanguage, (eventName: string) => [string, string, string, string]> = {
  en: (eventName) => [`About your inquiry for ${eventName}.`, 'Thank you for thinking of PMCM.', `We can't take on ${eventName} this time.`, 'We would welcome the chance to work with you on future events, so please reach out anytime.'],
  fil: (eventName) => [`Tungkol sa inyong inquiry para sa ${eventName}.`, 'Salamat sa pag-alala sa PMCM.', `Hindi namin matatanggap ang ${eventName} sa pagkakataong ito.`, 'Ikalulugod naming makatrabaho kayo sa mga susunod na event, kaya huwag mag-atubiling makipag-ugnayan anumang oras.'],
};

const CONFORME_REMINDER: Record<ClientLanguage, string> = {
  en: 'Reminder: signed conforme is still outstanding',
  fil: 'Paalala: hinihintay pa ang pirmadong conforme',
};

export function inquiryReceivedText(language: ClientLanguage, eventName: string, editLink?: { hours: number; link: string }) {
  return `${RECEIVED[language](eventName)}${editLink ? EDIT_LINK[language](editLink.hours, editLink.link) : ''}`;
}

export function inquiryAcceptedText(language: ClientLanguage, eventName: string, invitation: Invitation) {
  const copy = ACCEPTED[language];
  const next = invitation === 'invited' ? copy.invited : invitation === 'existing_account' ? copy.existing : copy.pending;
  return `${copy.base(eventName)} ${next}`;
}

/** The first sentence becomes the mail subject, so it names the event and stays a plain headline. */
export function inquiryDeclinedText(language: ClientLanguage, eventName: string, declineReason?: string | null) {
  const [headline, thanks, decline, closing] = DECLINED[language](eventName);
  const disclosure = declineReason ? DISCLOSED_DECLINE_REASONS[language].get(declineReason) : undefined;
  return [headline, thanks, decline, disclosure, closing].filter(Boolean).join(' ');
}

export function conformeReminderText(language: ClientLanguage) {
  return CONFORME_REMINDER[language];
}
