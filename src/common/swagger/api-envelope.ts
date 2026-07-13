import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { PageMeta } from '../pagination/page-meta';

// Documents the `{ data: <model> }` envelope (D10-3) for a 200 response.
export function ApiOkEnvelope<TModel extends Type<unknown>>(
  model: TModel,
  options?: { description?: string },
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: options?.description,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(model) } },
      },
    }),
  );
}

// Documents the `{ data: <model>[], meta }` envelope (D10-3) for a paginated 200 response.
export function ApiOkPaginated<TModel extends Type<unknown>>(
  model: TModel,
  options?: { description?: string },
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(model, PageMeta),
    ApiOkResponse({
      description: options?.description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PageMeta) },
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
