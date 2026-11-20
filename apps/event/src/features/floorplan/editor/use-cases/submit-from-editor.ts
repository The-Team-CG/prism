/**
 * Submitting from either floor plan editor: save what is on screen, submit the draft, then reload both the dashboard
 * and the event's drafts before closing, so the floor plans page shows the draft as in review. A failed save stops
 * here, leaving the editor open with the layout unsubmitted.
 */
export async function submitFromEditor(steps: {
  save(): Promise<unknown>;
  submit(): Promise<unknown>;
  refreshDashboard(): Promise<unknown>;
  refreshEventDrafts(): Promise<unknown>;
  close(): void;
}): Promise<void> {
  await steps.save();
  await steps.submit();
  await Promise.all([steps.refreshDashboard(), steps.refreshEventDrafts()]);
  steps.close();
}
