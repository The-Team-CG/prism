import { createEventOpsClient } from '@prism/api-client';
import type { EventOpsActorQuery } from '@prism/api-client';
import type { CreateEventEodReplyInput, CreateEventEodReportInput, CreateEventHandoffInput, CreateEventScheduleDayInput, CreateEventScheduleSegmentInput, PrismEventEodReport, PrismEventHandoff, PrismEventRunSheet, PrismEventSchedule, PrismEventScheduleSegment, UpdateEventScheduleSegmentStatusInput } from '@prism/types';

const client = createEventOpsClient();

export const liveOpsScheduleRepository = {
  getSchedule(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventSchedule> { return client.liveOps.schedule(eventId, actor); },
  createDay(eventId: string, input: CreateEventScheduleDayInput, actor?: EventOpsActorQuery) { return client.liveOps.createScheduleDay(eventId, input, actor); },
  createSegment(eventId: string, dayId: string, input: CreateEventScheduleSegmentInput, actor?: EventOpsActorQuery): Promise<PrismEventScheduleSegment> { return client.liveOps.createScheduleSegment(eventId, dayId, input, actor); },
  updateSegmentStatus(eventId: string, segmentId: string, input: UpdateEventScheduleSegmentStatusInput, actor?: EventOpsActorQuery) { return client.liveOps.updateScheduleSegmentStatus(eventId, segmentId, input, actor); },
  getRunSheet(eventId: string, dayId?: string, actor?: EventOpsActorQuery): Promise<PrismEventRunSheet | { eventId: string; authored: false; reason: 'no_schedule' }> { return client.liveOps.runSheet(eventId, dayId, actor); },
  createHandoff(eventId: string, input: CreateEventHandoffInput, actor?: EventOpsActorQuery): Promise<PrismEventHandoff> { return client.liveOps.createHandoff(eventId, input, actor); },
  listEodReports(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventEodReport[]> { return client.liveOps.listEodReports(eventId, actor); },
  submitEodReport(eventId: string, input: CreateEventEodReportInput, actor?: EventOpsActorQuery): Promise<PrismEventEodReport> { return client.liveOps.submitEodReport(eventId, input, actor); },
  replyEodReport(eventId: string, reportId: string, input: CreateEventEodReplyInput, actor?: EventOpsActorQuery) { return client.liveOps.replyEodReport(eventId, reportId, input, actor); },
};
