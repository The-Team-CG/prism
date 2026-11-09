import type { CanvaTemplateKey } from '@prism/kernel/shared';

export const CANVA_DESIGNS = Symbol('CANVA_DESIGNS');

/**
 * FR-59 and New-P3: fill one of PMCM's Canva brand templates. The template's data fields must use the names the
 * caller sends (see docs/runbooks/canva-integration.md). Throws 503 when Canva is not configured or not connected.
 */
export interface CanvaDesigns {
  fillTemplate(template: CanvaTemplateKey, input: { title: string; fields: Record<string, string> }): Promise<{ designId: string; editUrl: string; viewUrl: string }>;
}
