"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createEventEodReplySchema,
  createEventEodReportSchema,
  createEventHandoffSchema,
  createEventScheduleDaySchema,
  createEventScheduleSegmentSchema,
  parseContract,
  updateEventScheduleSegmentStatusSchema,
  type PrismEventEodReport,
  type PrismEventHandoff,
  type PrismEventSchedule,
} from "@prism/types";
import { liveOpsScheduleRepository } from "../data/live-ops-schedule-repository";

type LocalScheduleSegmentInput = {
  title: string;
  plannedStartAt: string;
  plannedEndAt: string;
  ownerRole: string;
  location?: string;
  sequence: number;
};

/**
 * A PMCM reads the event record for its status; a coordinator reads the coordinator-scoped schedule, which carries the
 * same status and is available only for an event they are assigned to.
 */
async function loadScheduleAndStatus(eventId: string, coordinatorScope: boolean): Promise<{ schedule: PrismEventSchedule; eventStatus: string }> {
  if (coordinatorScope) {
    const scoped = await liveOpsScheduleRepository.getCoordinatorSchedule(eventId);
    return { schedule: scoped.schedule, eventStatus: scoped.eventStatus };
  }
  const [schedule, event] = await Promise.all([liveOpsScheduleRepository.getSchedule(eventId), liveOpsScheduleRepository.getEvent(eventId)]);
  return { schedule, eventStatus: event.status };
}

export function useLiveOpsScheduleDeskViewModel(eventId: string, { coordinatorScope = false }: { coordinatorScope?: boolean } = {}) {
  const [schedule, setSchedule] = useState<PrismEventSchedule | null>(null);
  const [eventStatus, setEventStatus] = useState<string | null>(null);
  const [handoffs, setHandoffs] = useState<PrismEventHandoff[]>([]);
  const [reports, setReports] = useState<PrismEventEodReport[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus((current) => current === "ready" ? current : "loading");
    setError(null);
    try {
      const [{ schedule: nextSchedule, eventStatus: nextStatus }, nextHandoffs, nextReports] = await Promise.all([
        loadScheduleAndStatus(eventId, coordinatorScope),
        liveOpsScheduleRepository.listHandoffs(eventId),
        liveOpsScheduleRepository.listEodReports(eventId),
      ]);
      if (requestVersion.current !== version) return;
      setSchedule(nextSchedule);
      setEventStatus(nextStatus);
      setHandoffs(nextHandoffs);
      setReports(nextReports);
      setStatus("ready");
    } catch (cause) {
      if (requestVersion.current !== version) return;
      setError(cause instanceof Error ? cause.message : "Unable to load event-day records.");
      setStatus("error");
    }
  }, [coordinatorScope, eventId]);

  useEffect(() => {
    setSchedule(null);
    setEventStatus(null);
    setHandoffs([]);
    setReports([]);
    setStatus("loading");
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);

  const run = useCallback(async (action: () => Promise<unknown>, savedMessage: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await reload();
      setNotice(savedMessage);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the event-day update.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [reload]);

  const startEventDay = useCallback(() => run(() => liveOpsScheduleRepository.startEventDay(eventId), "Event day started."), [eventId, run]);

  const createDay = useCallback((value: unknown) => run(async () => {
    const input = parseContract(createEventScheduleDaySchema, value, "Schedule day");
    await liveOpsScheduleRepository.createDay(eventId, input);
  }, "Schedule day added."), [eventId, run]);

  const createSegment = useCallback((dayId: string, value: LocalScheduleSegmentInput) => run(async () => {
    const toIso = (localValue: string, label: string) => {
      const parsed = new Date(localValue);
      if (!localValue || Number.isNaN(parsed.getTime())) throw new Error(`Enter a valid ${label}.`);
      return parsed.toISOString();
    };
    const input = parseContract(createEventScheduleSegmentSchema, {
      ...value,
      plannedStartAt: toIso(value.plannedStartAt, "planned start time"),
      plannedEndAt: toIso(value.plannedEndAt, "planned end time"),
    }, "Schedule segment");
    await liveOpsScheduleRepository.createSegment(eventId, dayId, input);
  }, "Schedule segment added."), [eventId, run]);

  const updateSegmentStatus = useCallback((segmentId: string, action: string) => run(async () => {
    const input = parseContract(updateEventScheduleSegmentStatusSchema, { action }, "Schedule segment status");
    await liveOpsScheduleRepository.updateSegmentStatus(eventId, segmentId, input);
  }, "Schedule segment updated."), [eventId, run]);

  const createHandoff = useCallback((value: unknown) => run(async () => {
    const input = parseContract(createEventHandoffSchema, value, "Coordinator handoff");
    await liveOpsScheduleRepository.createHandoff(eventId, input);
  }, "Shift handoff recorded."), [eventId, run]);

  const submitReport = useCallback((value: unknown) => run(async () => {
    const input = parseContract(createEventEodReportSchema, value, "End-of-day report");
    await liveOpsScheduleRepository.submitEodReport(eventId, input);
  }, "End-of-day report submitted."), [eventId, run]);

  const replyToReport = useCallback((reportId: string, value: unknown) => run(async () => {
    const input = parseContract(createEventEodReplySchema, value, "End-of-day report reply");
    await liveOpsScheduleRepository.replyEodReport(eventId, reportId, input);
  }, "Reply added to end-of-day report."), [eventId, run]);

  return {
    schedule,
    eventStatus,
    startEventDay,
    handoffs,
    reports,
    status,
    busy,
    error,
    notice,
    reload,
    createDay,
    createSegment,
    updateSegmentStatus,
    createHandoff,
    submitReport,
    replyToReport,
  };
}
