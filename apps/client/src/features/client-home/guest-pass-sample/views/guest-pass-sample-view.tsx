"use client";

import { ArrowLeft, CheckCircle2, QrCode, RotateCcw, Star } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@prism/ui/components/card";
import { SAMPLE_ACCESS_CODE, SAMPLE_EVENT } from "../model/guest-pass-sample";
import { useGuestPassSampleViewModel } from "../view-models/use-guest-pass-sample-view-model";

/** FR-42: a scripted guest pass for prospects. Sample content only; nothing here reaches a live event. */
export function GuestPassSampleView() {
  const vm = useGuestPassSampleViewModel();
  const { state } = vm;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to PMCM
          </a>
          <PrismBrandLogo />
        </div>
        <div className="max-w-2xl">
          <h1 className="prism-serif text-3xl font-black leading-tight sm:text-4xl">Try the guest pass</h1>
          <p className="mt-3 text-muted-foreground">
            This is what your guests see on event day: no app and no account, just the event code. Everything on this page is a sample and is not connected to any real event.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Card className="mx-auto w-full max-w-sm rounded-[2rem] border-4 border-ink/80 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">{SAMPLE_EVENT.eventName}</CardTitle>
              <p className="text-xs text-muted-foreground">Sample guest pass</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {state.step === "code" ? (
                <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); vm.openPass(); }}>
                  <label className="block font-semibold">
                    Event code
                    <input
                      value={state.code}
                      onChange={(event) => vm.typeCode(event.target.value)}
                      placeholder={SAMPLE_ACCESS_CODE}
                      autoComplete="off"
                      className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 font-mono tracking-wide"
                    />
                  </label>
                  {state.error ? <p role="alert" className="text-destructive">{state.error}</p> : <p className="text-xs text-muted-foreground">Use {SAMPLE_ACCESS_CODE} to open the sample.</p>}
                  <Button type="submit" className="w-full">Open my pass</Button>
                </form>
              ) : null}

              {state.step === "pass" || state.step === "checked_in" || state.step === "feedback_sent" ? (
                <div className="space-y-3">
                  <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                    <div><dt className="text-muted-foreground">Guest</dt><dd className="font-semibold">{SAMPLE_EVENT.guestName}</dd></div>
                    <div><dt className="text-muted-foreground">Seat</dt><dd className="font-semibold">{SAMPLE_EVENT.table}</dd></div>
                    <div><dt className="text-muted-foreground">Date</dt><dd className="font-semibold">{SAMPLE_EVENT.dateLabel}</dd></div>
                    <div><dt className="text-muted-foreground">Doors</dt><dd className="font-semibold">{SAMPLE_EVENT.startTime}</dd></div>
                    <div className="col-span-2"><dt className="text-muted-foreground">Venue</dt><dd className="font-semibold">{SAMPLE_EVENT.venue}</dd></div>
                  </dl>
                  {state.step === "pass" ? (
                    <>
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 text-center">
                        <QrCode className="size-20 text-ink" aria-hidden />
                        <p className="text-xs text-muted-foreground">Show this at the door. In the sample, tap below instead.</p>
                      </div>
                      <Button type="button" className="w-full" onClick={vm.checkIn}>Check in</Button>
                    </>
                  ) : (
                    <p className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="size-4" /> Checked in. Enjoy the event.</p>
                  )}
                </div>
              ) : null}

              {state.step === "checked_in" ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="font-semibold">How was the event?</p>
                  <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button key={value} type="button" role="radio" aria-checked={state.rating === value} aria-label={`${value} star${value > 1 ? "s" : ""}`} onClick={() => vm.rate(value)}>
                        <Star className={`size-6 ${value <= state.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                  <Button type="button" variant="outline" className="w-full" disabled={state.rating === 0} onClick={vm.sendFeedback}>Send feedback</Button>
                </div>
              ) : null}

              {state.step === "feedback_sent" ? (
                <div className="space-y-3 border-t border-border pt-3">
                  <p>Thanks for the {state.rating}-star rating. On a real event, PMCM reviews feedback before it is shared with the client.</p>
                  <Button type="button" variant="outline" className="w-full" onClick={vm.restart}><RotateCcw data-icon="inline-start" /> Start the sample again</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <ol className="space-y-2 text-sm">
              {vm.steps.map((item, index) => (
                <li key={item.step} className={`flex items-center gap-3 rounded-lg border p-3 ${item.current ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}>
                  <span className={`grid size-6 place-items-center rounded-full text-xs ${item.done ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{item.done ? "✓" : index + 1}</span>
                  {item.label}
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground">Planning an event with PMCM? Your guests get a pass like this one.</p>
            <Button asChild className="w-full"><a href="/inquiry">Start an inquiry</a></Button>
          </div>
        </div>
      </div>
    </main>
  );
}
