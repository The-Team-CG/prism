export function sanitizeGuestSession<T extends object>(
  session: T,
): Omit<T, "guestName" | "attendanceCount"> {
  return Object.fromEntries(
    Object.entries(session).filter(([key]) => key !== "guestName" && key !== "attendanceCount"),
  ) as Omit<T, "guestName" | "attendanceCount">;
}
