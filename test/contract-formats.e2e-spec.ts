import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { OpenAPISpecObject } from '@ehuelsmann/openapi-validator';
import { createE2eApp, httpServer } from './utils/e2e-app';
import { loadApiSpec } from './utils/contract';
import { createSpecEvaluator } from './utils/format-enforcement';

// Supertest-shaped stub accepted by makeResponse (a `status` key selects the supertest
// branch, which reads body + text + req.method/req.path for validation).
interface ResponseStub {
  status: number;
  body: unknown;
  text: string;
  req: { method: string; path: string };
}

function responseOf(
  method: string,
  path: string,
  status: number,
  body: unknown,
): ResponseStub {
  return {
    status,
    body,
    text: JSON.stringify(body) ?? '',
    req: { method, path },
  };
}

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const DATETIME = '2026-08-25T10:00:00.000Z';

// Minimal OpenAPI 3.0 document exercising the adapter's format and structural semantics
// without coupling them to the volatility of a production entity. The committed openapi.json
// stays the source of truth for the live-response assertions below.
const MINI_DOC: OpenAPISpecObject = {
  openapi: '3.0.0',
  info: { title: 'contract-formats', version: '0.0.0' },
  paths: {
    '/thing': {
      post: {
        responses: {
          201: {
            description: 'created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Thing' },
              },
            },
          },
        },
      },
    },
    '/nullable': {
      get: {
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['nickname'],
                  properties: {
                    nickname: {
                      type: 'string',
                      nullable: true,
                      format: 'email',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/enummed': {
      get: {
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'id'],
                  properties: {
                    status: { type: 'string', enum: ['ACTIVE', 'HIDDEN'] },
                    id: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/combined': {
      get: {
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    {
                      type: 'object',
                      required: ['name'],
                      properties: { name: { type: 'string' } },
                    },
                    {
                      type: 'object',
                      required: ['refId'],
                      properties: { refId: { type: 'string', format: 'uuid' } },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Thing: {
        type: 'object',
        required: ['id', 'createdAt', 'email', 'url', 'day'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          email: { type: 'string', format: 'email' },
          url: { type: 'string', format: 'uri' },
          day: { type: 'string', format: 'date' },
        },
      },
      Inner: {
        type: 'object',
        required: ['innerId'],
        properties: { innerId: { type: 'string', format: 'uuid' } },
      },
    },
  },
};

describe('Contract adapter: response format enforcement (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    loadApiSpec();
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('live responses against the committed openapi.json', () => {
    it('health still satisfies the contract structurally', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/health')
        .expect(200);
      expect(res).toSatisfyApiSpec();
    });

    it('public site settings satisfy the contract with formats enforced', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/settings/site')
        .expect(200);
      expect(res).toSatisfyApiSpec();
    });

    it('corrupting a declared uuid in a real response shape fails with the format diagnostic', async () => {
      const res = await request(httpServer(app))
        .get('/api/v1/settings/site')
        .expect(200);
      const corruptedBody = structuredClone(
        res.body as { data: Record<string, unknown>; meta?: unknown },
      );
      corruptedBody.data.portraitAssetId = 'not-a-uuid';
      const corrupted = responseOf(
        'get',
        '/api/v1/settings/site',
        200,
        corruptedBody,
      );
      expect(() => expect(corrupted).toSatisfyApiSpec()).toThrow(
        /must match format "uuid"/,
      );
    });
  });

  describe('structural failures remain authoritative through the global matcher', () => {
    it('undocumented path fails', () => {
      expect(() =>
        expect(responseOf('get', '/api/v1/nope', 200, {})).toSatisfyApiSpec(),
      ).toThrow(/has no matching path/);
    });

    it('undocumented method fails', () => {
      expect(() =>
        expect(
          responseOf('delete', '/api/v1/health', 200, {}),
        ).toSatisfyApiSpec(),
      ).toThrow(/no 'DELETE' operation defined for path/);
    });

    it('undocumented status fails', () => {
      expect(() =>
        expect(responseOf('get', '/api/v1/health', 503, {})).toSatisfyApiSpec(),
      ).toThrow(/has no '503' response defined/);
    });
  });

  describe('format and structural controls on a focused specification', () => {
    const evaluate = createSpecEvaluator(MINI_DOC);

    const thing = {
      id: UUID,
      createdAt: DATETIME,
      email: 'user@example.com',
      url: 'https://media.example.com/media/1280-webp.webp',
      day: '2026-08-25',
    };

    it.each([
      ['uuid', { id: UUID }],
      ['date-time', { createdAt: DATETIME }],
      ['email', { email: 'user@example.com' }],
      ['uri', { url: 'https://example.com/a/b?c=d#e' }],
      ['date', { day: '2026-08-25' }],
    ])(
      'accepts a valid %s value only when the rest of the body is valid',
      (_format, patch) => {
        const result = evaluate(
          responseOf('post', '/thing', 201, { ...thing, ...patch }),
        );
        expect(result.pass).toBe(true);
      },
    );

    it.each([
      ['NC1 uuid', 'id', 'not-a-uuid', /must match format "uuid"/],
      [
        'NC2 date-time',
        'createdAt',
        'tomorrow at noon',
        /must match format "date-time"/,
      ],
      ['NC3 email', 'email', 'not-an-email', /must match format "email"/],
      ['NC4 uri', 'url', 'http://exa mple.com/x', /must match format "uri"/],
      ['NC5 date', 'day', '2026-99-77', /must match format "date"/],
    ])(
      '%s rejects its invalid representative',
      (_name, key, value, expected) => {
        const body = { ...thing, [key]: value };
        const result = evaluate(responseOf('post', '/thing', 201, body));
        expect(result.pass).toBe(false);
        expect(result.message).toMatch(expected);
        expect(result.message).toMatch(new RegExp(`${key} must match format`));
      },
    );

    it('nullable null passes while a non-format-conforming string fails', () => {
      expect(
        evaluate(responseOf('get', '/nullable', 200, { nickname: null })).pass,
      ).toBe(true);
      const invalid = evaluate(
        responseOf('get', '/nullable', 200, { nickname: 'nope' }),
      );
      expect(invalid.pass).toBe(false);
      expect(invalid.message).toMatch(/must match format "email"/);
    });

    it('enum membership is enforced alongside formats', () => {
      expect(
        evaluate(
          responseOf('get', '/enummed', 200, { status: 'ACTIVE', id: UUID }),
        ).pass,
      ).toBe(true);
      const invalidEnum = evaluate(
        responseOf('get', '/enummed', 200, { status: 'ARCHIVED', id: UUID }),
      );
      expect(invalidEnum.pass).toBe(false);
      expect(invalidEnum.message).toMatch(/allowed values/);
    });

    it('allOf composition enforces every member schema', () => {
      expect(
        evaluate(
          responseOf('get', '/combined', 200, { name: 'x', refId: UUID }),
        ).pass,
      ).toBe(true);
      const missingName = evaluate(
        responseOf('get', '/combined', 200, { refId: UUID }),
      );
      expect(missingName.pass).toBe(false);
      expect(missingName.message).toMatch(/required property 'name'/);
      const badFormat = evaluate(
        responseOf('get', '/combined', 200, { name: 'x', refId: 'bad' }),
      );
      expect(badFormat.pass).toBe(false);
      expect(badFormat.message).toMatch(/must match format "uuid"/);
    });

    it('nested $ref resolution reaches inner format declarations', () => {
      const doc: OpenAPISpecObject = {
        ...MINI_DOC,
        components: {
          schemas: {
            ...(MINI_DOC.components?.schemas ?? {}),
            Outer: {
              type: 'object',
              required: ['inner'],
              properties: { inner: { $ref: '#/components/schemas/Inner' } },
            },
          },
        },
        paths: {
          '/outer': {
            get: {
              responses: {
                200: {
                  description: 'ok',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Outer' },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const evaluateOuter = createSpecEvaluator(doc);
      expect(
        evaluateOuter(
          responseOf('get', '/outer', 200, { inner: { innerId: UUID } }),
        ).pass,
      ).toBe(true);
      const invalid = evaluateOuter(
        responseOf('get', '/outer', 200, {
          inner: { innerId: 'bad', extraType: 7 },
        }),
      );
      expect(invalid.pass).toBe(false);
      expect(invalid.message).toMatch(
        /inner\/innerId must match format "uuid"/,
      );
    });

    it('missing required fields fail before formats are reported', () => {
      const result = evaluate(responseOf('post', '/thing', 201, {}));
      expect(result.pass).toBe(false);
      expect(result.message).toMatch(/required property/);
    });

    it('wrong primitive types fail', () => {
      const result = evaluate(
        responseOf('post', '/thing', 201, { ...thing, id: 42 }),
      );
      expect(result.pass).toBe(false);
      expect(result.message).toMatch(/must be string/);
    });
  });
});
