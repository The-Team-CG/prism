import {
  BadRequestException,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

/**
 * Nest body/query pipe backed by a shared Zod schema from `@prism/types`.
 * Prefer this over class-validator DTOs for migrated write surfaces.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) {
      return result.data;
    }

    const message = result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    });

    throw new BadRequestException({
      statusCode: 400,
      error: 'Validation failed',
      message,
    });
  }
}

/** Convenience factory for `@Body(zodBody(schema))`. */
export function zodBody(schema: ZodTypeAny) {
  return new ZodValidationPipe(schema);
}
