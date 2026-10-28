"use client";

import type { FormEvent } from "react";
import { Alert } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Card, CardBody, CardHeader } from "@/features/supplier-dashboard/workspace/views/sections/shell-ui";
import { useSupplierQuoteLinkViewModel } from "../view-models/use-supplier-quote-link-view-model";

export function SupplierQuoteLinkView({ token }: { token: string }) {
  const vm = useSupplierQuoteLinkViewModel(token);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void vm.submit();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 sm:px-6">
      <Card>
        <CardHeader>
          <p className="text-xs font-semibold text-muted-foreground">P.R.I.S.M supplier quote</p>
          <h1 className="mt-2 text-xl font-bold text-foreground">{vm.detail?.eventName ?? "Quote request"}</h1>
          {vm.detail ? <p className="mt-1 text-sm text-muted-foreground">{vm.detail.request.category}{vm.detail.eventDate ? ` · ${vm.detail.eventDate}` : ""}</p> : null}
        </CardHeader>
        <CardBody>
          {vm.error ? <Alert variant="destructive" className="mb-4">{vm.error}</Alert> : null}
          {vm.complete ? <p role="status" className="text-sm font-medium text-foreground">Your quote has been sent to PMCM for review.</p> : vm.loading ? (
            <p className="text-sm text-muted-foreground" role="status">Loading secure quote request…</p>
          ) : vm.detail ? (
            <form onSubmit={submit} className="space-y-4">
              {vm.detail.request.message ? <p className="text-sm leading-6 text-muted-foreground">{vm.detail.request.message}</p> : null}
              <p className="text-xs text-muted-foreground">Deadline: {vm.detail.request.dueDate ?? "Not specified"} · Your quote is private to PMCM.</p>
              <label className="grid gap-1.5 text-sm font-medium">Quote amount (PHP)<Input required type="number" min="1" step="1" value={vm.form.amount} onChange={(e) => vm.update({ amount: e.target.value })} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Inclusions, one per line<Textarea rows={4} value={vm.form.inclusions} onChange={(e) => vm.update({ inclusions: e.target.value })} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Payment terms<Input value={vm.form.paymentTerms} onChange={(e) => vm.update({ paymentTerms: e.target.value })} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Notes<Textarea rows={3} value={vm.form.notes} onChange={(e) => vm.update({ notes: e.target.value })} /></label>
              <Button type="submit" disabled={vm.busy}>{vm.busy ? "Sending…" : vm.detail.quote ? "Send revised quote" : "Send quote to PMCM"}</Button>
            </form>
          ) : null}
        </CardBody>
      </Card>
    </main>
  );
}
