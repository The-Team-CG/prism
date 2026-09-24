"use client";

import type { PrismInquiry } from '@prism/types';
import { Button } from '@/app/components/ui/button';
import { canOfferConformeDraft, CONFORME_DRAFT_DELAY_MS, isCurrentConformeDraftWindow } from '../model/conforme-draft-review';
import { useConformeDraftReviewViewModel } from '../view-models/use-conforme-draft-review-view-model';

function displayTimestamp(value: string | null | undefined) {
  if (!value) return 'No reminder recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Reminder date unavailable' : date.toLocaleString();
}

function ConformeDraftCard({ inquiry }: { inquiry: PrismInquiry }) {
  const model = useConformeDraftReviewViewModel(inquiry);
  const eligible = canOfferConformeDraft(inquiry);
  const currentWindowDraft = isCurrentConformeDraftWindow(model.draft, inquiry);
  const stalePendingDraft = Boolean(model.draft && !currentWindowDraft && model.status === 'pending');
  const reminderWindowBaseAt = inquiry.lastConformeReminderAt ?? inquiry.conformeSentAt;
  const availableAt = reminderWindowBaseAt
    ? new Date(Date.parse(reminderWindowBaseAt) + CONFORME_DRAFT_DELAY_MS).toLocaleString()
    : 'after the conforme is sent';
  const editable = model.status === 'pending' || model.status === 'editing';

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{inquiry.eventName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{inquiry.clientName} · {inquiry.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Conforme sent: {displayTimestamp(inquiry.conformeSentAt)}</p>
          <p className="text-xs text-muted-foreground">
            Last reminder: {displayTimestamp(model.draft?.lastConformeReminderAt ?? inquiry.lastConformeReminderAt)}
          </p>
        </div>
        {model.status === 'loading' && <p role="status" className="text-sm text-muted-foreground">Loading draft status…</p>}
        {model.status === 'streaming' && (
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <span className="text-sm text-muted-foreground">Generating draft · {model.streamedCharacters} characters received</span>
            <Button type="button" variant="secondary" onClick={model.cancelGeneration}>Cancel</Button>
          </div>
        )}
        {model.status === 'approved' && currentWindowDraft && (
          <span className="text-sm font-medium text-emerald-700">Approved and queued for delivery</span>
        )}
        {model.status === 'approved' && !currentWindowDraft && (
          <span className="text-sm text-muted-foreground">Previous reminder draft was approved</span>
        )}
        {model.status === 'cancelled' && currentWindowDraft && (
          <span className="text-sm text-muted-foreground">Draft cancelled</span>
        )}
        {model.status === 'cancelled' && !currentWindowDraft && (
          <span className="text-sm text-muted-foreground">Previous reminder draft was cancelled</span>
        )}
      </div>

      {model.draft && (
        <p className="mt-3 text-xs text-muted-foreground">
          {model.draft.source === 'manual' ? 'PMCM-written draft' : 'AI-assisted draft'} · {model.draft.status.replaceAll('_', ' ')}
        </p>
      )}

      {editable && (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Subject
            <input
              value={model.subject}
              onChange={(event) => model.setSubject(event.target.value)}
              className="min-h-10 rounded-md border border-input bg-background px-3 py-2 font-normal"
              maxLength={180}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Message
            <textarea
              value={model.body}
              onChange={(event) => model.setBody(event.target.value)}
              className="min-h-36 resize-y rounded-md border border-input bg-background px-3 py-2 font-normal"
              maxLength={8000}
            />
          </label>
        </div>
      )}

      {model.errorMessage && <p role="alert" className="mt-3 text-sm text-destructive">{model.errorMessage}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {eligible && !stalePendingDraft && (model.status === 'idle' || model.status === 'unavailable' || (model.draft && !currentWindowDraft)) && (
          <>
            <Button type="button" onClick={model.generate}>
              {model.status === 'unavailable' ? 'Retry AI draft' : 'Generate AI draft'}
            </Button>
            <Button type="button" variant="secondary" onClick={model.startManualWriting}>Write manually</Button>
          </>
        )}
        {!eligible && model.status !== 'loading' && model.status !== 'pending' && (
          <p className="self-center text-sm text-muted-foreground">Draft review opens {availableAt}.</p>
        )}
        {model.status === 'editing' && (
          <>
            <Button type="button" onClick={model.saveManual}>Save manual draft</Button>
            <Button type="button" variant="secondary" onClick={model.cancelManualWriting}>Cancel writing</Button>
          </>
        )}
        {model.status === 'pending' && currentWindowDraft && (
          <>
            <Button type="button" onClick={model.approve}>Approve and queue for delivery</Button>
            <Button type="button" variant="secondary" onClick={model.cancelDraft}>Cancel draft</Button>
          </>
        )}
        {stalePendingDraft && (
          <>
            <p className="self-center text-sm text-muted-foreground">This pending draft belongs to an earlier reminder window and cannot be approved.</p>
            <Button type="button" variant="secondary" onClick={model.cancelDraft}>Cancel previous draft</Button>
          </>
        )}
        {model.status === 'unavailable' && model.draft && currentWindowDraft && (
          <Button type="button" variant="secondary" onClick={model.startManualWriting}>Write manually</Button>
        )}
        {model.status === 'saving' && <p role="status" className="self-center text-sm text-muted-foreground">Saving…</p>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A message enters the notification outbox only after PMCM approval. Delivery follows the existing notification gate.
      </p>
    </article>
  );
}

export function ConformeDraftReviewView({ inquiries }: { inquiries: PrismInquiry[] }) {
  const candidates = inquiries.filter((inquiry) =>
    inquiry.status === 'accepted' && Boolean(inquiry.conformeSentAt) && !inquiry.conformeSignedAt,
  );

  return (
    <section className="mt-6 space-y-4" aria-labelledby="conforme-draft-review-title">
      <div>
        <h2 id="conforme-draft-review-title" className="text-lg font-semibold text-foreground">Conforme follow-up drafts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review a follow-up after five days. The inquiry remains the record key before an event exists.
        </p>
      </div>
      {candidates.length ? (
        <div className="grid gap-3">
          {candidates.map((inquiry) => <ConformeDraftCard key={inquiry.id} inquiry={inquiry} />)}
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No accepted inquiries have an unsigned conforme.
        </p>
      )}
    </section>
  );
}
