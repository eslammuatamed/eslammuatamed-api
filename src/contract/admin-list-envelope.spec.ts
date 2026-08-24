import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Schema = {
  type?: string;
  items?: {
    $ref?: string;
  };
};

type OpenApiDocument = {
  paths: Record<
    string,
    {
      get?: {
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
});
