"use client";

import { useEffect, useRef, useState } from "react";
import { guestQrCheckInSchema, guestQrPassToken, parseContract } from "@prism/types";
import { qrPassRepository } from "../data/qr-pass-repository";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/** The browser's built-in QR reader. It needs HTTPS (or localhost) and a browser that ships BarcodeDetector. */
function qrDetector(): Detector | null {
  const Constructor = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  if (!Constructor || !globalThis.isSecureContext) return null;
  return new Constructor({ formats: ["qr_code"] });
}

/** FR-39 / FR-95: staff scan a guest QR pass with the device camera, or type the pass code when scanning is not available. */
export function QrScanCheckIn({ eventId, onCheckedIn }: { eventId: string; onCheckedIn?: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canScan = typeof window !== "undefined" && qrDetector() !== null;

  async function checkIn(scanned: string) {
    setBusy(true);
    setMessage(null);
    try {
      const checkIn = await qrPassRepository.checkIn(eventId, parseContract(guestQrCheckInSchema, { token: guestQrPassToken(scanned) }, "Guest pass"));
      setMessage({ tone: "ok", text: `${checkIn.guestName ?? "Guest"} is checked in.` });
      setCode("");
      onCheckedIn?.();
    } catch (caught) {
      setMessage({ tone: "error", text: caught instanceof Error ? caught.message : "This pass could not be checked in." });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!scanning) return;
    const detector = qrDetector();
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((media) => {
      stream = media;
      if (!videoRef.current || !detector) return;
      videoRef.current.srcObject = media;
      void videoRef.current.play();
      timer = setInterval(() => {
        if (!videoRef.current) return;
        void detector.detect(videoRef.current).then((codes) => {
          if (!codes[0]?.rawValue) return;
          setScanning(false);
          void checkIn(codes[0].rawValue);
        });
      }, 400);
    }).catch(() => {
      setScanning(false);
      setMessage({ tone: "error", text: "The camera is not available. Type the pass code instead." });
    });
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // checkIn reads only the current event id, which restarts this effect through the parent key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-sm">
      <p className="font-semibold">Check in with a QR pass</p>
      {canScan ? (
        <button type="button" disabled={busy} onClick={() => setScanning((open) => !open)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          {scanning ? "Stop camera" : "Scan a pass"}
        </button>
      ) : <p className="text-xs text-muted-foreground">Camera scanning needs HTTPS and a browser with a built-in QR reader. Type the code printed under the guest&apos;s QR instead.</p>}
      {scanning ? <video ref={videoRef} muted playsInline className="aspect-video w-full max-w-sm rounded-md bg-black" aria-label="Camera preview" /> : null}
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (code.trim()) void checkIn(code); }}>
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Pass code" aria-label="Pass code" className="min-w-48 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs" />
        <button type="submit" disabled={busy || !code.trim()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold">Check in pass</button>
      </form>
      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-destructive" : "text-foreground"}>{message.text}</p> : null}
    </div>
  );
}
