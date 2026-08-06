import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiResponseExamples,
  getSchemaPath,
} from '@nestjs/swagger';
import { PageMeta } from '../pagination/page-meta';

// Documents the `{ data: <model> }` envelope (D10-3) for a 200 response. Pass
// `{ isArray: true }` for a non-paginated list endpoint whose `data` is `<model>[]`
// (small fixed collections that skip pagination, e.g. skills/experiences/testimonials).
//
// `examples` documents NAMED, addressable response examples at the MEDIA-TYPE level. A schema-level
// property example describes one field in isolation and cannot express a whole representative
// payload — so a locale-resolved endpoint documented only that way advertises exactly one body for
// every `?locale=`, and any mock replaying the contract serves the wrong locale's content. Named
// examples are the OpenAPI-level answer, and they stay addressable by consumers (Stoplight Prism
// selects one with `Prefer: example=<name>`). Kept here, on the shared envelope decorator, so the
// examples describe the FULL `{ data: … }` body every endpoint actually returns.
export function ApiOkEnvelope<TModel extends Type<unknown>>(
  model: TModel,
  options?: {
    description?: string;
    isArray?: boolean;
    examples?: Record<string, ApiResponseExamples>;
  },
): MethodDecorator & ClassDecorator {
  const data = options?.isArray
    ? { type: 'array' as const, items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: options?.description,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data },
      },
      ...(options?.examples ? { examples: options.examples } : {}),
    }),
  );
}

// Documents the `{ data: <model>[], meta }` envelope (D10-3) for a paginated 200 response.
//
// `options.meta` documents a WIDENED meta for endpoints that carry list-scoped data beyond
// pagination (`/projects` → facets). It must extend `PageMeta`, which the caller's own type
// declaration enforces; passing it here only changes which schema the contract points at.
export function ApiOkPaginated<TModel extends Type<unknown>>(
  model: TModel,
  options?: { description?: string; meta?: Type<PageMeta> },
): MethodDecorator & ClassDecorator {
  const meta = options?.meta ?? PageMeta;
  return applyDecorators(
    ApiExtraModels(model, meta),
    ApiOkResponse({
      description: options?.description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(meta) },
        },
      },
    }),
  );
}

// Documents the `{ data: <model> }` envelope for a 201 response.
export function ApiCreatedEnvelope<TModel extends Type<unknown>>(
  model: TModel,
  options?: { description?: string },
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      description: options?.description,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(model) } },
      },
    }),
  );
}
