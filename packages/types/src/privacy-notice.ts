export interface PrismPrivacyNoticeSection {
  heading: string;
  paragraphs: string[];
}

/** Versioned privacy notice. A new version date means a new notice; PMCM reviews the text before launch. */
export interface PrismPrivacyNotice {
  version: string;
  effectiveDate: string;
  title: string;
  sections: PrismPrivacyNoticeSection[];
}

export const PRISM_PRIVACY_NOTICE: PrismPrivacyNotice = {
  version: "2026-10-25",
  effectiveDate: "2026-10-25",
  title: "Privacy notice",
  sections: [
    {
      heading: "What we collect",
      paragraphs: [
        "Account details: your name, email address, organization and role. We also keep your sign-in history and the times of failed sign-in attempts.",
        "Client inquiries: your name, company, email address, event name, event type and date, the kind of client you are, how you heard about PMCM, and the message you send.",
        "Supplier applications: your company, contact name, email address, phone number, past events, services, certifications, price range, BNI membership, portfolio link and notes.",
        "Event day: guest names that PMCM imports for an event, names given at check-in, check-in times and headcounts, and feedback you leave, including your rating and comment.",
        "Uploads: for photos and videos you attach to feedback, PRISM keeps only the file name, type and size.",
        "Your consent: whether you agreed to this notice, which version you agreed to, when you agreed, and whether you agreed to marketing messages.",
      ],
    },
    {
      heading: "Why we use it",
      paragraphs: [
        "We use your information to answer your inquiry, prepare your event proposal and agreement, and run the event you book with PMCM.",
        "We use your account details to let you sign in, keep your account secure, and tell you about changes to your access.",
        "We use supplier applications to decide whether to approve a supplier and to manage the supplier's work on events.",
        "We use check-in and feedback records to run the event, record attendance and understand guest experience.",
        "We keep an audit trail of changes to records. PMCM needs it to run its operations and to show how personal information was handled.",
        "We record whether you agreed to marketing messages from PMCM, and we respect that choice.",
      ],
    },
    {
      heading: "Who can see it",
      paragraphs: [
        "Each part of PRISM shows only the information its users need. We do not show one user's information to another user unless the work requires it.",
        "Clients see their own inquiry, event status, floor plan submissions and the official layouts shared with them.",
        "Suppliers see their own application, quotes, bookings, readiness and event day status. They do not see other suppliers' quotes or client details.",
        "Guests see their own check-in pass, check-in status and the feedback they submitted.",
        "PMCM coordinators see the events they work on. PMCM administrators also see account access records, the audit trail and privacy requests.",
      ],
    },
    {
      heading: "Who we share it with",
      paragraphs: [
        "We share personal information only with service providers that PRISM uses to run the service, such as the email provider that sends your sign-in and password emails.",
        "Where PMCM uses an AI service to help draft messages or plans, personal information is sent only as PMCM's AI rules allow.",
        "PMCM confirms the list of service providers before launch.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "PMCM sets how long each type of record is kept. Until those periods are confirmed, event records are kept under PMCM's records policy for each event.",
        "Account records are kept while your account is active.",
        "Audit records are not deleted in normal use. A correction or redaction is recorded as a new entry.",
      ],
    },
    {
      heading: "Your rights under the Data Privacy Act of 2012",
      paragraphs: [
        "You can ask to see the personal information PMCM holds about you, to get a copy of it in a usable form, to correct it, to have it deleted or anonymized where the law allows, and to object to how it is used.",
        "To use these rights, send a privacy request through PMCM. PMCM reviews each request. Some information cannot be deleted while the law requires it to be kept, or while a legal hold applies.",
        "You can also complain to the National Privacy Commission.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "Contact PMCM through your event coordinator or the contact details in your PMCM agreement.",
      ],
    },
  ],
};
