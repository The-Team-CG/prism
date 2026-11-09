/* FR-59 and New-P3: PMCM's Canva connection and the designs it fills. */

export interface PrismCanvaConnection {
  /** The deployment has Canva Connect credentials. */
  configured: boolean;
  /** A PMCM admin connected the organization's Canva account. */
  connected: boolean;
  connectedAt: string | null;
  /** Which brand templates are configured. */
  templates: { proposal: boolean; testimonial: boolean };
}

/** A design Canva made from a brand template; PMCM finishes it in Canva. */
export interface PrismCanvaDesign {
  designId: string;
  editUrl: string;
  viewUrl: string;
}
