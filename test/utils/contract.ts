import jestOpenAPI from '@ehuelsmann/jest-openapi';
import { join } from 'node:path';

// The committed openapi.json is THE contract oracle: `npm run contract:export` derives it from
// the code, and every contract assertion in this repo measures responses against that artifact
// (doc 10 §1, doc 18). This module is the single registration point for that oracle — specs
// call loadApiSpec() and use `expect(res).toSatisfyApiSpec()`; they never import validator
// internals directly, so the validating library stays swappable without touching test files.
//
// Run `npm run contract:export` before the e2e suite so openapi.json is current.
export function loadApiSpec(): void {
  jestOpenAPI(join(__dirname, '..', '..', 'openapi.json'));
}
