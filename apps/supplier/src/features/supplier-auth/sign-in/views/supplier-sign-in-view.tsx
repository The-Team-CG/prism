"use client";

import { PrismAccountHelp } from "@prism/ui/account-help";
import { portalHref } from "@prism/ui/portal-path";
import { PrismAuthShell } from "@prism/ui/auth-shell";
import { PrismAuthAlternative, PrismAuthEmailField, PrismAuthError, PrismAuthLinks, PrismAuthPasswordField, PrismAuthSubmit, PrismEmailCodeStep } from "@prism/ui/auth-form";
import { EMAIL_SIGN_IN_CODE_TTL_MINUTES } from "@prism/types";
import { ArrowRight, ChevronDown, ShieldCheck } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@prism/ui/components/collapsible";
import { SignInCodeStep } from "@prism/ui/sign-in-code-step";
import { SUPPLIER_PORTAL_POINTS, SUPPLIER_PORTAL_STATEMENT } from "../model/supplier-portal-copy";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import { useSupplierSignInViewModel } from "../view-models/use-supplier-sign-in-view-model";

function ExistingSessionBanner({ name, organization }: { name: string; organization: string }) {
  return (
    <a
      href={portalHref("/dashboard")}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">Continue as {name}</p>
        <p className="text-sm text-muted-foreground">{organization}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

function ApprovalRequestPanel({
  showApproval,
  busy,
  consentAccepted,
  onToggle,
  onConsentChange,
  onRequest,
}: {
  showApproval: boolean;
  busy: boolean;
  consentAccepted: boolean;
  onToggle: () => void;
  onConsentChange: (accepted: boolean) => void;
  onRequest: () => void;
}) {
  return (
    <Collapsible open={showApproval} onOpenChange={onToggle} className="border-t border-border pt-5">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto w-full justify-between px-0 text-sm font-medium text-foreground hover:text-primary">
          <span>Need supplier access?</span>
          <span className="flex items-center gap-1.5 font-normal text-muted-foreground">
            {showApproval ? "Close" : "Request"}
            <ChevronDown className={`size-4 transition-transform ${showApproval ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 flex flex-col gap-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Request PMCM approval for a new supplier account. A coordinator will review and activate your access.
          </p>
          <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => onConsentChange(e.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <span>I consent to PMCM processing this request for supplier portal access review.</span>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !consentAccepted}
            onClick={onRequest}
            className="h-12 w-full rounded-lg text-sm font-semibold"
          >
            <ShieldCheck className="size-4" /> Request PMCM approval
          </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

type SupplierSignInVm = ReturnType<typeof useSupplierSignInViewModel>;

function CodeForm({ vm }: { vm: SupplierSignInVm }) {
  return (
    <form className="flex flex-col gap-5" onSubmit={vm.submit} noValidate>
      <SignInCodeStep code={vm.code} onCodeChange={vm.setCode} busy={vm.busy} invalid={Boolean(vm.error)} errorId="supplier-sign-in-error" onBack={vm.backToPassword} />
      <PrismAuthError id="supplier-sign-in-error" message={vm.error} />
      <PrismAuthSubmit portal="supplier" busy={vm.busy} disabled={vm.code.length !== 6} label="Verify code" busyLabel="Checking..." />
    </form>
  );
}

export function SupplierSignInView() {
  const vm = useSupplierSignInViewModel();

  return (
    <PrismAuthShell
      portal="supplier"
      portalName="Supplier portal"
      statement={SUPPLIER_PORTAL_STATEMENT}
      points={SUPPLIER_PORTAL_POINTS}
      homeHref={portalHref("/")}
      title="Sign in to the supplier portal"
      footer={
        <>
          <p>Approved supplier accounts only.</p>
          <PrismAccountHelp contact={pmcmSupportContactFromEnvironment()} topic="supplier portal access" />
        </>
      }
    >
      {vm.existing ? (
        <div className="mb-6">
          <ExistingSessionBanner name={vm.existing.name} organization={vm.existing.organization} />
        </div>
      ) : null}

      {vm.twoStepToken ? <CodeForm vm={vm} /> : vm.codeSentTo ? (
      <form className="flex flex-col gap-5" onSubmit={vm.submit} noValidate>
        <PrismEmailCodeStep
          email={vm.codeSentTo}
          code={vm.emailCode}
          onCodeChange={vm.setEmailCode}
          busy={vm.busy}
          invalid={Boolean(vm.error)}
          errorId="supplier-sign-in-error"
          resendIn={vm.resendIn}
          onResend={vm.resendEmailCode}
          onChangeEmail={vm.changeEmail}
          ttlMinutes={EMAIL_SIGN_IN_CODE_TTL_MINUTES}
        />
        <PrismAuthError id="supplier-sign-in-error" message={vm.error} />
        <PrismAuthSubmit portal="supplier" busy={vm.busy} disabled={vm.emailCode.length !== 6} label="Continue" busyLabel="Checking..." />
      </form>
      ) : (
      <form className="flex flex-col gap-5" onSubmit={vm.submit}>
        <PrismAuthEmailField value={vm.draft.email} onChange={vm.updateEmail} placeholder="supplier@example.com" errorId={vm.error ? "supplier-sign-in-error" : undefined} />
        {vm.method === "password" ? (
          <PrismAuthPasswordField
            value={vm.draft.password}
            onChange={vm.updatePassword}
            shown={vm.showPassword}
            onToggleShown={() => vm.setShowPassword((shown) => !shown)}
            forgotHref={portalHref("/password-reset")}
            errorId={vm.error ? "supplier-sign-in-error" : undefined}
          />
        ) : null}
        <PrismAuthError id="supplier-sign-in-error" message={vm.error} />
        {vm.notice ? (
          <p role="status" className="text-sm text-foreground">
            {vm.notice}
          </p>
        ) : null}
        <PrismAuthSubmit
          portal="supplier"
          busy={vm.busy}
          label={vm.method === "code" ? "Email me a sign-in code" : "Sign in"}
          busyLabel={vm.method === "code" ? "Sending..." : "Signing in..."}
        />
        <PrismAuthAlternative>
          <Button type="button" variant="outline" className="h-12 w-full rounded-lg text-sm font-semibold" onClick={() => vm.chooseMethod(vm.method === "code" ? "password" : "code")}>
            {vm.method === "code" ? "Sign in with password" : "Email me a code instead"}
          </Button>
        </PrismAuthAlternative>
      </form>
      )}

      <div className="mt-6">
        <PrismAuthLinks primary={{ href: portalHref("/apply"), label: "Apply to become a PMCM supplier" }} secondary={{ href: portalHref("/status"), label: "Check an application" }} />
      </div>

      <div className="mt-8">
        <ApprovalRequestPanel
          showApproval={vm.showApproval}
          busy={vm.busy}
          consentAccepted={vm.approvalConsentAccepted}
          onToggle={() => vm.setShowApproval((v) => !v)}
          onConsentChange={vm.setApprovalConsentAccepted}
          onRequest={() => void vm.requestApproval()}
        />
      </div>
    </PrismAuthShell>
  );
}
