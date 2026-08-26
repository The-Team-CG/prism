"use client";

import { useEffect, useState } from "react";
import type { EventSession } from "@/app/lib/session";
import type { PrismCoordinatorRoleView, PrismCoordinatorWorkspace } from "@prism/types";
import {
  acknowledgeAndRefreshRoleView,
  loadCoordinatorRoleView,
} from "../use-cases/coordinator-desk-actions";
import {
  isRegistrationCoordinatorRole,
  pickActiveAssignment,
  sameCoordinatorName,
} from "../model/coordinators-desk-rules";

export type CoordinatorViewStatus = "idle" | "loading" | "success" | "error";

export function useCoordinatorViewModel({
  session,
  state,
  onRefresh,
}: {
  session: EventSession;
  state: PrismCoordinatorWorkspace;
  onRefresh: () => Promise<void>;
}) {
  const assignments = state.assignments.filter((item) =>
    sameCoordinatorName(item.coordinatorName, session.name),
  );
  const assignment = pickActiveAssignment(assignments);
  const event = assignment ? state.events.find((item) => item.id === assignment.eventId) : undefined;
  const activeDraft = event?.floorPlanDrafts?.find((draft) => draft.eventId === event.id && draft.isActive);
  const [busy, setBusy] = useState(false);
  const [roleView, setRoleView] = useState<PrismCoordinatorRoleView | null>(null);
  const [roleViewStatus, setRoleViewStatus] = useState<CoordinatorViewStatus>("idle");
  const [roleViewError, setRoleViewError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("coord-home");

  useEffect(() => {
    if (!event?.id) {
      setRoleView(null);
      setRoleViewStatus("idle");
      setRoleViewError(null);
      return;
    }

    let alive = true;
    setRoleViewStatus("loading");
    setRoleViewError(null);
    loadCoordinatorRoleView(session, event.id)
      .then((next) => {
        if (!alive) return;
        setRoleView(next);
        setRoleViewStatus("success");
      })
      .catch((err) => {
        if (!alive) return;
        setRoleView(null);
        setRoleViewStatus("error");
        setRoleViewError(err instanceof Error ? err.message : "Unable to load role-safe event data.");
      });

    return () => {
      alive = false;
    };
  }, [event?.id, session.email, session.name]);

  async function acknowledge() {
    if (!event || !assignment) return;
    setBusy(true);
    try {
      setRoleViewStatus("loading");
      setRoleViewError(null);
      try {
        setRoleView(
          await acknowledgeAndRefreshRoleView({
            session,
            eventId: event.id,
            assignmentId: assignment.id,
          }),
        );
        setRoleViewStatus("success");
      } catch (err) {
        setRoleView(null);
        setRoleViewStatus("error");
        setRoleViewError(err instanceof Error ? err.message : "Unable to refresh role-safe event data.");
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  function selectSection(section: string) {
    setActiveSection(section);
  }

  return {
    status: roleViewStatus,
    assignments,
    assignment,
    event,
    activeDraft,
    busy,
    roleView,
    roleViewLoading: roleViewStatus === "loading",
    roleViewError,
    roleDataStatus:
      roleViewStatus === "loading"
        ? "loading"
        : roleViewStatus === "error"
          ? "unavailable"
          : roleView
            ? "ready"
            : "pending",
    activeSection,
    registrationRole: isRegistrationCoordinatorRole(assignment?.role),
    acknowledge,
    selectSection,
  };
}
