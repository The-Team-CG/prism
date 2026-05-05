export const prismTokens = {
  radius: {
    panel: "0.5rem",
    control: "0.375rem",
    badge: "999px",
  },
  density: {
    shellGutter: "1.25rem",
    panelPadding: "1rem",
    compactPanelPadding: "0.75rem",
  },
  status: {
    success: "confirmed",
    attention: "pending",
    danger: "at_risk",
    blocked: "blocked",
  },
  typography: {
    ui: "Manrope",
    heading: "Sora",
    display: "Sora",
    bodySize: "0.9375rem",
    bodyLineHeight: "1.55",
    headingLineHeight: "1.2",
  },
} as const;

export type PrismTokens = typeof prismTokens;
