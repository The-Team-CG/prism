import { QRCodeSVG } from "qrcode.react";
import { GUEST_QR_PASS_PREFIX, guestQrCheckInSchema } from "@prism/types";

/**
 * FR-39 Mode 1: the guest's QR pass. It is drawn from the link alone, so opening it calls no API and shows no
 * guest or event details; staff scan it at the registration desk.
 */
export function GuestPassView({ token }: { token: string }) {
  const valid = guestQrCheckInSchema.safeParse({ token }).success;
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-foreground">Your event pass</h1>
      {valid ? (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <QRCodeSVG value={`${GUEST_QR_PASS_PREFIX}${token}`} size={240} aria-label="Guest QR pass" />
          </div>
          <p className="text-sm text-muted-foreground">Show this QR code at registration. If it does not scan, staff can type this code:</p>
          <p className="break-all font-mono text-xs text-foreground">{token}</p>
        </>
      ) : (
        <p role="alert" className="text-sm text-destructive">This pass link is not valid. Ask the event organizer for a new one.</p>
      )}
    </main>
  );
}
