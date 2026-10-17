import {
  eventGameTemplateConfigurationSchema,
  type PrismEventGameTemplateConfiguration,
} from '@prism/types';

type ConfigFor<Kind extends PrismEventGameTemplateConfiguration['kind']> = Extract<
  PrismEventGameTemplateConfiguration,
  { kind: Kind }
>;

export function templateConfiguration<Kind extends PrismEventGameTemplateConfiguration['kind']>(
  configuration: Readonly<Record<string, unknown>>,
  kind: Kind,
): ConfigFor<Kind> | null {
  const parsed = eventGameTemplateConfigurationSchema.safeParse(configuration.configuration);
  if (!parsed.success || parsed.data.kind !== kind) return null;
  return parsed.data as ConfigFor<Kind>;
}

export function configurationErrors(
  configuration: Readonly<Record<string, unknown>>,
  kind: PrismEventGameTemplateConfiguration['kind'],
): string[] {
  return templateConfiguration(configuration, kind) ? [] : ['Template configuration is invalid'];
}

export function normalizeAnswer(value: string): string {
  return value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}
