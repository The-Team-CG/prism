"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { commsDraftResultSchema, type CommsDraftResult, type ConformeDraftReviewRecord, type PrismInquiry } from '@prism/types';
import {
  approveConformeDraft,
  cancelConformeDraft,
  generateConformeDraft,
  loadConformeDraft,
  saveManualConformeDraft,
} from '../use-cases/conforme-draft-use-cases';

export type ConformeDraftReviewStatus =
  | 'loading'
  | 'idle'
  | 'starting'
  | 'generating'
  | 'cancelling'
  | 'editing'
  | 'saving'
  | 'pending'
  | 'approved'
  | 'cancelled'
  | 'unavailable';

export function useConformeDraftReviewViewModel(inquiry: PrismInquiry) {
  const [status, setStatus] = useState<ConformeDraftReviewStatus>('loading');
  const [draft, setDraft] = useState<ConformeDraftReviewRecord | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    loadConformeDraft(inquiry.id).then((saved) => {
      if (!active) return;
      setDraft(saved);
      setSubject(saved?.draft.subject ?? '');
      setBody(saved?.draft.body ?? '');
      setStatus(saved?.status === 'pending_human_approval' ? 'pending' : saved?.status === 'approved' ? 'approved' : saved ? 'cancelled' : 'idle');
    }).catch(() => {
      if (!active) return;
      setErrorMessage('Draft status is unavailable. Retry loading or write manually.');
      setStatus('unavailable');
    });
    return () => {
      active = false;
      abortRef.current?.abort(new Error('Draft review closed'));
      abortRef.current = null;
    };
  }, [inquiry.id]);

  const generate = useCallback(async () => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('starting');
    setErrorMessage(null);
    try {
      const saved = await generateConformeDraft(inquiry.id, controller.signal, () => {
        if (!controller.signal.aborted) setStatus('generating');
      });
      setDraft(saved);
      setSubject(saved.draft.subject);
      setBody(saved.draft.body);
      setStatus(saved.status === 'pending_human_approval' ? 'pending' : 'cancelled');
    } catch {
      if (controller.signal.aborted) {
        setStatus('idle');
      } else {
        setErrorMessage('AI draft is unavailable. Retry or write the message manually.');
        setStatus('unavailable');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [inquiry.id]);

  const cancelGeneration = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    controller.abort(new Error('Draft generation cancelled'));
    setStatus('cancelling');
  }, []);

  const startManualWriting = useCallback(() => {
    setErrorMessage(null);
    setSubject('');
    setBody('');
    setStatus('editing');
  }, []);

  const cancelManualWriting = useCallback(() => {
    setErrorMessage(null);
    setSubject(draft?.draft.subject ?? '');
    setBody(draft?.draft.body ?? '');
    setStatus(draft ? (draft.status === 'pending_human_approval' ? 'pending' : 'cancelled') : 'idle');
  }, [draft]);

  const saveManual = useCallback(async () => {
    setStatus('saving');
    setErrorMessage(null);
    try {
      const input = commsDraftResultSchema.parse({ subject, body }) as CommsDraftResult;
      const saved = await saveManualConformeDraft(inquiry.id, input);
      setDraft(saved);
      setSubject(saved?.draft.subject ?? input.subject);
      setBody(saved?.draft.body ?? input.body);
      setStatus('pending');
    } catch {
      setErrorMessage('The manual draft could not be saved. Check both fields and try again.');
      setStatus('editing');
    }
  }, [body, inquiry.id, subject]);

  const approve = useCallback(async () => {
    if (!draft) return;
    setStatus('saving');
    setErrorMessage(null);
    try {
      const input = commsDraftResultSchema.parse({ subject, body });
      const saved = await approveConformeDraft(draft.draftId, input);
      setDraft(saved);
      setSubject(saved?.draft.subject ?? input.subject);
      setBody(saved?.draft.body ?? input.body);
      setStatus('approved');
    } catch {
      setErrorMessage('Approval could not be completed. Refresh the inquiry and review its current state.');
      setStatus('pending');
    }
  }, [body, draft, subject]);

  const cancelDraft = useCallback(async () => {
    if (!draft) return;
    setStatus('saving');
    setErrorMessage(null);
    try {
      const saved = await cancelConformeDraft(draft.draftId);
      setDraft(saved);
      setStatus('cancelled');
    } catch {
      setErrorMessage('The draft could not be cancelled. Refresh and try again.');
      setStatus('pending');
    }
  }, [draft]);

  return {
    status,
    draft,
    subject,
    body,
    errorMessage,
    setSubject,
    setBody,
    generate,
    cancelGeneration,
    startManualWriting,
    cancelManualWriting,
    saveManual,
    approve,
    cancelDraft,
  };
}
