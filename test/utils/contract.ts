import jestOpenAPI from '@ehuelsmann/jest-openapi';
import type { OpenAPISpecObject } from '@ehuelsmann/openapi-validator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createSpecEvaluator } from './format-enforcement';

// The committed openapi.json is THE contract oracle: `npm run contract:export` derives it from
// the code, and every contract assertion in this repo measures responses against that artifact
// (doc 10 §1, doc 18). This module is the single registration point for that oracle — specs
// call loadApiSpec() and use `expect(res).toSatisfyApiSpec()`; they never import validator
// internals directly, so the validating library stays swappable without touching test files.
//
// Registration order is load-bearing: @ehuelsmann/jest-openapi registers first (its global
// typings cover both matchers and toSatisfySchemaInApiSpec stays available), then the
// format-enforcing evaluator below overrides toSatisfyApiSpec — the later expect.extend
// wins. Structural validation (route/method/status/$ref/nullable/allOf) still runs through
// the fork's public validateResponse; see ./format-enforcement for the enforced formats.
//
// Run `npm run contract:export` before the e2e suite so openapi.json is current.
const SPEC_PATH = join(__dirname, '..', '..', 'openapi.json');

function assertIsOpenApiDocument(
  value: unknown,
): asserts value is OpenAPISpecObject {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('openapi' in value) ||
    !('paths' in value)
  ) {
    throw new Error(`${SPEC_PATH} is not an OpenAPI document`);
  }
}

export function loadApiSpec(): void {
  const rawDoc: unknown = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
  assertIsOpenApiDocument(rawDoc);

  jestOpenAPI(rawDoc);
  const evaluate = createSpecEvaluator(rawDoc);

  expect.extend({
    toSatisfyApiSpec(received: unknown) {
      const result = evaluate(received);
      return { pass: result.pass, message: () => result.message };
    },
  });
}
