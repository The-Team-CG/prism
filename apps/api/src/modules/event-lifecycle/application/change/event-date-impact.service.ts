import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DATE_CHANGE_FACTS_READER, type DateChangeFactsReader } from '@prism/contexts/read-models/date-change-facts';
import {
  planningEventDateKey,
  type DateChangeImpactQuery,
  type PrismDateChangeImpact,
  type PrismPlanApplyResult,
  type SyncEventPlanInput,
} from '@prism/types';
import { approvedWorkFrom, paymentImpacts, shiftBetween, supplierConflicts } from '../../domain/date-change-impact.policy';
import { EventPlanService } from '../planning/event-plan.service';
import type { PlanningActor } from '../planning/planning-templates.service';

/**
 * What moving an event's date touches. The impact only reads: supplier bookings, payment milestones and the client's
 * approvals are reported with the reasons they need a second look, and stay with the contexts that own them. The one thing
 * that can follow the date from here is the event's own plan, and only through an apply that presents its preview.
 */
@Injectable()
export class EventDateImpactService {
  constructor(
    @Inject(DATE_CHANGE_FACTS_READER) private readonly facts: DateChangeFactsReader,
    private readonly plans: EventPlanService,
  ) {}

  async impact(eventId: string, query: DateChangeImpactQuery): Promise<PrismDateChangeImpact> {
    const requested = query.newDate ?? null;
    const first = await this.facts.getFacts(eventId, null);
    if (!first) throw new NotFoundException('Event not found');
    const currentDate = planningEventDateKey(first.eventDate);
    // The date the event already has is not a change: it reviews the event as it stands, which is what follows a recorded postponement.
    const newDate = requested !== null && requested !== currentDate ? requested : null;
    const facts = newDate === null ? first : (await this.facts.getFacts(eventId, newDate)) ?? first;
    const shiftDays = newDate === null ? null : shiftBetween(currentDate, newDate);
    const templates = await this.plans.previewSync(eventId, newDate);
    return {
      eventId,
      eventName: facts.eventName,
      currentDate,
      newDate,
      shiftDays,
      planApplicable: newDate === null && !facts.archived,
      plan: {
        templates,
        movable: templates.reduce((sum, template) => sum + template.update.length, 0),
        kept: templates.reduce((sum, template) => sum + template.kept.length, 0),
      },
      suppliers: facts.suppliers.map(({ blockedOnNewDate, otherEventsOnNewDate, ...supplier }) => ({
        ...supplier,
        conflicts: supplierConflicts({ blockedOnNewDate, otherEventsOnNewDate }),
      })),
      payments: paymentImpacts(facts.milestones, shiftDays),
      approvedWork: approvedWorkFrom(facts.approved),
    };
  }

  /** Moves the plan's open tasks to follow the event date, applying exactly the previews that were shown. */
  syncPlan(eventId: string, input: SyncEventPlanInput, actor: PlanningActor): Promise<PrismPlanApplyResult> {
    return this.plans.applySync(eventId, input, actor);
  }
}
