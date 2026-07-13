import jestOpenAPI from 'jest-openapi';
import { join } from 'node:path';

// Registers the exported OpenAPI document as the contract oracle: `expect(res).toSatisfyApiSpec()`
// then asserts a response matches the documented schema for its path/status (doc 10 §1, doc 18).
// Run `npm run contract:export` before the e2e suite so openapi.json is current.
export function loadApiSpec(): void {
  jestOpenAPI(join(__dirname, '..', '..', 'openapi.json'));
}
