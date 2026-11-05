'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InquiryTriageReview } from '@prism/types';
import { inquiryTriageRepository } from '../data/inquiry-triage-repository';

export type InquiryTriageStatus = 'loading' | 'idle' | 'running' | 'ready';

export function useInquiryTriageViewModel(inquiryId: string) {
  const [review, setReview] = useState<InquiryTriageReview | null>(null);
  const [status, setStatus] = useState<InquiryTriageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentInquiryId = useRef(inquiryId);
  currentInquiryId.current = inquiryId;

  useEffect(() => {
    let active = true;
    setReview(null);
    setErrorMessage(null);
    setStatus('loading');
    inquiryTriageRepository
      .latest(inquiryId)
      .then((latest) => {
        if (!active) return;
        setReview(latest);
        setStatus(latest ? 'ready' : 'idle');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setErrorMessage(cause instanceof Error ? cause.message : 'Could not load the triage advice.');
        setStatus('idle');
      });
    return () => {
      active = false;
    };
  }, [inquiryId]);

  const run = useCallback(async () => {
    if (status === 'running') return;
    const requestedId = inquiryId;
    setStatus('running');
    setErrorMessage(null);
    try {
      const next = await inquiryTriageRepository.run(requestedId);
      if (currentInquiryId.current !== requestedId) return;
      setReview(next);
      setStatus(next ? 'ready' : 'idle');
    } catch (cause) {
      if (currentInquiryId.current !== requestedId) return;
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not get triage advice.');
      setStatus(review ? 'ready' : 'idle');
    }
  }, [inquiryId, review, status]);

  return { review, status, errorMessage, run };
}
