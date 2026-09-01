import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Schema = {
  type?: string;
  items?: {
    $ref?: string;
  };
};

type Parameter = {
  name?: string;
  in?: string;
  description?: string;
  schema?: {
    type?: string;
    maxLength?: number;
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
    ['/api/v1/admin/categories', '#/components/schemas/AdminCategoryEntity'],
    ['/api/v1/admin/tags', '#/components/schemas/AdminTagEntity'],
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
});
