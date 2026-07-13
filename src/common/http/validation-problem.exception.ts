import { HttpException, HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { FieldError } from './problem-details';

// Thrown by the global ValidationPipe's exceptionFactory. Carries structured field errors
// so the exception filter can emit the RFC 7807 `errors[]` extension (doc 10 §3). Validation
// failures are 422 (not Nest's default 400) — 400 is reserved for malformed requests.
export class ValidationProblemException extends HttpException {
  constructor(readonly fieldErrors: readonly FieldError[]) {
    super('Validation failed', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

// Flattens class-validator's nested ValidationError tree into dotted/bracketed paths
// (e.g. `translations[0].slug`) so every failing field is individually addressable.
export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): FieldError[] {
  const flattened: FieldError[] = [];

  for (const error of errors) {
    const path = buildPath(parentPath, error.property);

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        flattened.push({ field: path, message });
      }
    }

    if (error.children && error.children.length > 0) {
      flattened.push(...flattenValidationErrors(error.children, path));
    }
  }

  return flattened;
}

function buildPath(parentPath: string, property: string): string {
  if (!parentPath) {
    return property;
  }
  // Numeric property = array index → bracket notation; otherwise dotted.
  return /^\d+$/.test(property)
    ? `${parentPath}[${property}]`
    : `${parentPath}.${property}`;
}
