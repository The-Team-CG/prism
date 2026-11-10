'use client';

import { formatPortalDateTime } from '@prism/ui/format-date';
import { Sparkles } from 'lucide-react';
import { Button } from '@prism/ui/components/button';
import { actionLabel, fitLabel } from '../model/inquiry-triage';
import { useInquiryTriageViewModel } from '../view-models/use-inquiry-triage-view-model';

function BulletList({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h5 className="text-xs font-semibold text-foreground">{title}</h5>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export function InquiryTriagePanel({ inquiryId }: { inquiryId: string }) {
  const model = useInquiryTriageViewModel(inquiryId);
  const { review } = model;
  const running = model.status === 'running';

  return (
    <section className="rounded-lg border border-border bg-background px-4 py-3" aria-label="AI triage advice">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">AI triage advice</h4>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={running || model.status === 'loading'} onClick={() => void model.run()}>
          {running ? 'Reading inquiry…' : review ? 'Refresh advice' : 'Get advice'}
        </Button>
      </div>

      {model.errorMessage ? <p role="alert" className="mt-3 text-sm text-destructive">{model.errorMessage}</p> : null}
      {running ? <p role="status" className="mt-3 text-sm text-muted-foreground">This can take up to half a minute.</p> : null}

      {review ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            {fitLabel(review.result.fit)} · {actionLabel(review.result.suggestedAction)}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{review.result.summary}</p>
          <BulletList title="Signals" items={review.result.signals} />
          <BulletList title="Risks" items={review.result.risks} />
          <BulletList title="Questions to ask" items={review.result.suggestedQuestions} />
          <p className="text-xs text-muted-foreground">
            Advice only, written by {review.modelVersion} on {formatPortalDateTime(review.requestedAt)}. It sees the
            inquiry wording but not the client&apos;s name, email, phone or company. You decide what happens next.
          </p>
        </div>
      ) : model.status === 'idle' && !model.errorMessage ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Get a second opinion on fit, risks and what to ask before you accept, hold or decline.
        </p>
      ) : null}
    </section>
  );
}
