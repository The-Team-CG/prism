import { afterEach, describe, expect, it, vi } from "vitest";
import { OpsUserRole } from "@prism/kernel/event-core";
import { CoordinatorAcknowledgementReminderScheduler } from "./coordinator-acknowledgement-reminder.scheduler";
import type { CoordinatorsService } from "./coordinators.service";

describe("CoordinatorAcknowledgementReminderScheduler", () => {
  const previousDisabledValue = process.env.PRISM_DISABLE_COORDINATOR_ACKNOWLEDGEMENT_JOB;

  afterEach(() => {
    vi.useRealTimers();
    if (previousDisabledValue === undefined) {
      delete process.env.PRISM_DISABLE_COORDINATOR_ACKNOWLEDGEMENT_JOB;
    } else {
      process.env.PRISM_DISABLE_COORDINATOR_ACKNOWLEDGEMENT_JOB = previousDisabledValue;
    }
  });

  it("runs the reminder sweep once per minute with an explicit system actor", async () => {
    vi.useFakeTimers();
    delete process.env.PRISM_DISABLE_COORDINATOR_ACKNOWLEDGEMENT_JOB;
    const enqueueAcknowledgementReminders = vi.fn().mockResolvedValue(undefined);
    const scheduler = new CoordinatorAcknowledgementReminderScheduler({
      enqueueAcknowledgementReminders,
    } as unknown as CoordinatorsService);

    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    scheduler.onModuleDestroy();

    expect(enqueueAcknowledgementReminders).toHaveBeenCalledTimes(1);
    expect(enqueueAcknowledgementReminders).toHaveBeenCalledWith(undefined, expect.objectContaining({
      id: "system:coordinator-acknowledgement-reminder",
      role: OpsUserRole.System,
      explicit: true,
      verified: true,
    }));
  });

  it("does not start when explicitly disabled", async () => {
    vi.useFakeTimers();
    process.env.PRISM_DISABLE_COORDINATOR_ACKNOWLEDGEMENT_JOB = "1";
    const enqueueAcknowledgementReminders = vi.fn().mockResolvedValue(undefined);
    const scheduler = new CoordinatorAcknowledgementReminderScheduler({
      enqueueAcknowledgementReminders,
    } as unknown as CoordinatorsService);

    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    scheduler.onModuleDestroy();

    expect(enqueueAcknowledgementReminders).not.toHaveBeenCalled();
  });
});
