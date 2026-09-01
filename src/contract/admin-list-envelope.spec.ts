import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Schema = {
  type?: string;
  items?: {
    $ref?: string;
  };
  $ref?: string;
};

type Parameter = {
  name?: string;
  in?: string;
  description?: string;
  schema?: {
    type?: string;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    default?: number;
    example?: number | string;
  };
};

type OpenApiDocument = {
  paths: Record<
    string,
    {
      get?: {
        parameters?: Parameter[];
        responses?: Record<
          string,
          {
            content?: {
              'application/json'?: {
                schema?: {
                  properties?: {
                    data?: Schema;
                  };
                };
              };
            };
          }
        >;
      };
    }
  >;
};

const contract = JSON.parse(
  readFileSync(join(process.cwd(), 'openapi.json'), 'utf8'),
) as OpenApiDocument;

describe('admin list envelopes', () => {
  it.each([
    ['/api/v1/admin/users', '#/components/schemas/UserEntity'],
    ['/api/v1/admin/roles', '#/components/schemas/RoleEntity'],
  ])('documents %s data as an array', (path, itemRef) => {
    const data =
      contract.paths[path]?.get?.responses?.['200']?.content?.[
        'application/json'
      ]?.schema?.properties?.data;

    expect(data).toEqual({
      type: 'array',
      items: { $ref: itemRef },
    });
  });

  it.each([
    ['/api/v1/admin/categories', '#/components/schemas/AdminCategoryEntity'],
    ['/api/v1/admin/tags', '#/components/schemas/AdminTagEntity'],
  ])('documents canonical pagination for %s', (path, itemRef) => {
    const operation = contract.paths[path]?.get;
    const parameters = operation?.parameters?.filter(
      (parameter) => parameter.in === 'query',
    );
    const schema =
      operation?.responses?.['200']?.content?.['application/json']?.schema;

    expect(parameters).toEqual([
      {
        name: 'page',
        required: false,
        in: 'query',
        schema: { minimum: 1, default: 1, example: 1, type: 'number' },
      },
      {
        name: 'perPage',
        required: false,
        in: 'query',
        schema: {
          minimum: 1,
          maximum: 50,
          default: 12,
          example: 12,
          type: 'number',
        },
      },
    ]);
    expect(schema?.properties).toEqual({
      data: { type: 'array', items: { $ref: itemRef } },
      meta: { $ref: '#/components/schemas/PageMeta' },
    });
  });

  it('documents title-only q for the admin Articles collection', () => {
    const q = contract.paths['/api/v1/admin/articles']?.get?.parameters?.find(
      (parameter) => parameter.in === 'query' && parameter.name === 'q',
    );

    expect(q).toEqual({
      name: 'q',
      required: false,
      in: 'query',
      description:
        'Case-insensitive substring match on title across all authored translations. Blank or whitespace-only values are ignored.',
      schema: {
        maxLength: 120,
        example: 'modular monolith',
        type: 'string',
      },
    });
  });

  it('documents canonical pagination for the existing admin Experiences collection', () => {
    const operation = contract.paths['/api/v1/admin/experiences']?.get;
    const parameters = operation?.parameters?.filter(
      (parameter) => parameter.in === 'query',
    );
    const schema =
      operation?.responses?.['200']?.content?.['application/json']?.schema;

    expect(parameters).toEqual([
      {
        name: 'page',
        required: false,
        in: 'query',
        schema: { minimum: 1, default: 1, example: 1, type: 'number' },
      },
      {
        name: 'perPage',
        required: false,
        in: 'query',
        schema: {
          minimum: 1,
          maximum: 50,
          default: 12,
          example: 12,
          type: 'number',
        },
      },
    ]);
    expect(schema?.properties).toEqual({
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/AdminExperienceEntity' },
      },
      meta: { $ref: '#/components/schemas/PageMeta' },
    });
  });

  it('documents canonical pagination for the existing admin Testimonials collection', () => {
    const operation = contract.paths['/api/v1/admin/testimonials']?.get;
    const parameters = operation?.parameters?.filter(
      (parameter) => parameter.in === 'query',
    );
    const schema =
      operation?.responses?.['200']?.content?.['application/json']?.schema;

    expect(parameters).toEqual([
      {
        name: 'page',
        required: false,
        in: 'query',
        schema: { minimum: 1, default: 1, example: 1, type: 'number' },
      },
      {
        name: 'perPage',
        required: false,
        in: 'query',
        schema: {
          minimum: 1,
          maximum: 50,
          default: 12,
          example: 12,
          type: 'number',
        },
      },
    ]);
    expect(schema?.properties).toEqual({
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/AdminTestimonialEntity' },
      },
      meta: { $ref: '#/components/schemas/PageMeta' },
    });
  });
});
