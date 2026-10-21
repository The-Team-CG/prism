import type { CreateEventEodReplyInput, CreateEventEodReportInput, CreateEventHandoffInput, CreateEventScheduleDayInput, CreateEventScheduleSegmentInput, PrismEventEodReport, PrismEventHandoff, PrismEventRunSheetResult, PrismEventSchedule, PrismEventScheduleSegment, UpdateEventScheduleSegmentStatusInput } from '@prism/types';
import { eventApi } from '@/lib/prism-api';

export const liveOpsScheduleRepository = {
  getSchedule(eventId: string): Promise<PrismEventSchedule> { return eventApi.liveOps.schedule(eventId); },
  createDay(eventId: string, input: CreateEventScheduleDayInput) { return eventApi.liveOps.createScheduleDay(eventId, input); },
  createSegment(eventId: string, dayId: string, input: CreateEventScheduleSegmentInput): Promise<PrismEventScheduleSegment> { return eventApi.liveOps.createScheduleSegment(eventId, dayId, input); },
  updateSegmentStatus(eventId: string, segmentId: string, input: UpdateEventScheduleSegmentStatusInput) { return eventApi.liveOps.updateScheduleSegmentStatus(eventId, segmentId, input); },
  getRunSheet(eventId: string, dayId?: string): Promise<PrismEventRunSheetResult> { return eventApi.liveOps.runSheet(eventId, dayId); },
  createHandoff(eventId: string, input: CreateEventHandoffInput): Promise<PrismEventHandoff> { return eventApi.liveOps.createHandoff(eventId, input); },
  listHandoffs(eventId: string): Promise<PrismEventHandoff[]> { return eventApi.liveOps.listHandoffs(eventId); },
  listEodReports(eventId: string): Promise<PrismEventEodReport[]> { return eventApi.liveOps.listEodReports(eventId); },
  submitEodReport(eventId: string, input: CreateEventEodReportInput): Promise<PrismEventEodReport> { return eventApi.liveOps.submitEodReport(eventId, input); },
  replyEodReport(eventId: string, reportId: string, input: CreateEventEodReplyInput) { return eventApi.liveOps.replyEodReport(eventId, reportId, input); },
};
