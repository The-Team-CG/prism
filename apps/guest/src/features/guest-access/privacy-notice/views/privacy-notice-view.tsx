import { PRISM_PRIVACY_NOTICE } from "@prism/types";
import { PrismAuthShell } from "@prism/ui/auth-shell";
import { PrismPrivacyNoticeContent } from "@prism/ui/privacy-notice";

export function GuestPrivacyNoticeView() {
  return (
    <PrismAuthShell
      portal="guest"
      portalName="Guest pass"
      statement="Your event pass"
      homeHref="/"
      title={PRISM_PRIVACY_NOTICE.title}
    >
      <PrismPrivacyNoticeContent notice={PRISM_PRIVACY_NOTICE} />
    </PrismAuthShell>
  );
}
