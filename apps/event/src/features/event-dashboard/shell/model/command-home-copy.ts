export function commandGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function daysUntilEvent(eventDate?: string, now = Date.now()) {
  if (!eventDate) return null;
  try {
    const diff = Math.ceil((new Date(eventDate).getTime() - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  } catch {
    return null;
  }
}

export function commandHomeSummary(eventCount: number, unreviewedInquiries: number) {
  if (eventCount === 0) {
    return "No confirmed events yet. Accept an inquiry and upload the signed conforme to activate the first workspace.";
  }
  const events = `${eventCount} active event workspace${eventCount === 1 ? "" : "s"}.`;
  if (unreviewedInquiries === 0) return `${events} No unreviewed inquiries.`;
  return `${events} ${unreviewedInquiries} unreviewed inquiry${unreviewedInquiries === 1 ? "" : "s"} need attention.`;
}

export function inquiryReviewLabel(count: number) {
  return `Review ${count} inquiry${count === 1 ? "" : "s"}`;
}
