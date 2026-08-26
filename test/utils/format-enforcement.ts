import {
  ErrorCode,
  makeApiSpec,
  makeResponse,
} from '@ehuelsmann/openapi-validator';
import type {
  ActualResponse,
  OpenApiSpec,
  OpenAPISpecObject,
  RawResponse,
} from '@ehuelsmann/openapi-validator';
import ajvFormats from 'ajv-formats';
import OpenAPIResponseValidator from 'openapi-response-validator';

// Response-relevant formats enforced on top of structural validation (CONTRIBUTING.md
// "Contract-test validator"). `binary` is request-serialization metadata and `int32`
// appears only on response headers this body validator never reads, so both stay out;
// media `WEBP` values are an enum, not an OpenAPI format keyword.
export const ENFORCED_RESPONSE_FORMATS = [
  'date',
  'date-time',
  'email',
  'uri',
  'uuid',
] as const;

type FormatPredicate = (value: unknown) => boolean;

export type CustomFormats = Record<string, FormatPredicate>;

export interface SpecAssertion {
  readonly pass: boolean;
  readonly message: string;
}

interface FormatValidatorContext {
  readonly apiSpec: OpenApiSpec;
  readonly customFormats: CustomFormats;
  readonly components: unknown;
}

// ajv-formats owns format semantics; its definitions arrive as RegExp sources, RegExp
// instances, bare validators, or `{validate}` objects depending on the format. Each shape
// converts to the boolean predicate that openapi-response-validator's runtime registers via
// addFormat (dist/index.js:28-35 only accepts functions); an unrecognized shape fails setup
// instead of silently skipping a requested format.
function toBooleanPredicate(
  name: string,
  definition: unknown,
): FormatPredicate {
  if (typeof definition === 'string') {
    const pattern = new RegExp(definition);
    return (value) => typeof value === 'string' && pattern.test(value);
  }
  if (definition instanceof RegExp) {
    return (value) => typeof value === 'string' && definition.test(value);
  }
  if (typeof definition === 'function') {
    const validate = definition as (data: string) => boolean;
    return (value) => typeof value === 'string' && validate(value) === true;
  }
  if (
    typeof definition === 'object' &&
    definition !== null &&
    typeof (definition as { validate?: unknown }).validate === 'function'
  ) {
    const validate = (definition as { validate: (data: string) => boolean })
      .validate;
    return (value) => typeof value === 'string' && validate(value) === true;
  }
  throw new Error(
    `Cannot convert ajv-formats definition for format "${name}" to a predicate`,
  );
}

export function buildCustomFormats(): CustomFormats {
  return Object.fromEntries(
    ENFORCED_RESPONSE_FORMATS.map((name) => [
      name,
      toBooleanPredicate(name, ajvFormats.get(name)),
    ]),
  );
}

// openapi-response-validator@12.1.3's runtime accepts content-style OpenAPI 3.0 response
// objects and registers only function-valued customFormats entries; its published typings
// instead model swagger-2 `{schema}` responses and non-function Formats the runtime drops.
// The boundary below encodes the runtime contract that @ehuelsmann/openapi-validator itself
// constructs ({responses, components}) plus our predicate map.
type ResponseValidatorArgs = ConstructorParameters<
  typeof OpenAPIResponseValidator
>[0];

function responseValidatorArgs(
  status: string,
  responseDefinition: object,
  context: FormatValidatorContext,
): ResponseValidatorArgs {
  return {
    responses: { [status]: responseDefinition },
    components: context.components,
    customFormats: context.customFormats,
  } as unknown as ResponseValidatorArgs;
}

// Compiled validators are cached per resolved response-definition identity, so repeated
// assertions against one endpoint/status reuse their compiled schema instead of recompiling.
function createFormatGate(
  context: FormatValidatorContext,
): (response: ActualResponse) => string | null {
  const validatorCache = new WeakMap<object, OpenAPIResponseValidator>();

  return (actualResponse) => {
    // Structural validation has already passed, so findExpectedResponse resolved this exact
    // request once inside validateResponse; the same public resolution is reused here rather
    // than reimplemented.
    const resolved = context.apiSpec.findExpectedResponse(actualResponse);
    const status = Object.keys(resolved)[0];
    if (status === undefined) {
      throw new Error('Resolved expected response carries no status key');
    }
    const responseDefinition = resolved[status];
    if (!responseDefinition) {
      throw new Error(
        `Resolved expected response for status '${status}' is missing`,
      );
    }
    let validator = validatorCache.get(responseDefinition);
    if (!validator) {
      validator = new OpenAPIResponseValidator(
        responseValidatorArgs(status, responseDefinition, context),
      );
      validatorCache.set(responseDefinition, validator);
    }
    const failure = validator.validateResponse(
      status,
      actualResponse.getBodyForValidation(),
    );
    if (!failure || !failure.errors) {
      return null;
    }
    // ORV's published typing leaves `errors` as `any`; its runtime always produces
    // `{path?, errorCode, message}` entries (dist/index.js toOpenapiValidationError).
    const details = failure.errors as ReadonlyArray<{
      path?: string;
      message: string;
    }>;
    return details
      .map((error) => `${error.path ?? ''} ${error.message}`)
      .join(', ');
  };
}

function endpointOf(actualResponse: ActualResponse): string {
  return `${actualResponse.req.method.toUpperCase()} ${actualResponse.req.path}`;
}

function serverUrls(apiSpec: OpenApiSpec): string[] {
  return 'getServerUrls' in apiSpec ? apiSpec.getServerUrls() : [];
}

function structuralFailureMessage(
  apiSpec: OpenApiSpec,
  actualResponse: ActualResponse,
  validationError: { code: ErrorCode; message: string },
): string {
  const endpoint = endpointOf(actualResponse);
  const preamble =
    `expected received to satisfy a '${actualResponse.status}' response defined for ` +
    `endpoint '${endpoint}' in your API spec`;

  switch (validationError.code) {
    case ErrorCode.ServerNotFound:
      return [
        preamble,
        `received had request path '${actualResponse.req.path}', but your API spec has no matching servers`,
        `Servers found in API spec: ${serverUrls(apiSpec).join(', ')}`,
      ].join('\n\n');
    case ErrorCode.PathNotFound:
      return [
        preamble,
        `received had request path '${actualResponse.req.path}', but your API spec has no matching path`,
        `Paths found in API spec: ${apiSpec.paths().join(', ')}`,
      ].join('\n\n');
    case ErrorCode.MethodNotFound: {
      const path = apiSpec.findOpenApiPathMatchingRequest(actualResponse.req);
      const operations = Object.keys(
        apiSpec.findExpectedPathItem(actualResponse.req),
      )
        .map((operation) => operation.toUpperCase())
        .join(', ');
      return [
        preamble.replace(
          endpoint,
          `${actualResponse.req.method.toUpperCase()} ${path}`,
        ),
        `received had request method '${actualResponse.req.method.toUpperCase()}', but your API spec has no '${actualResponse.req.method.toUpperCase()}' operation defined for path '${path}'`,
        `Request operations found for path '${path}' in API spec: ${operations}`,
      ].join('\n\n');
    }
    case ErrorCode.StatusNotFound: {
      const operation = apiSpec.findExpectedResponseOperation(
        actualResponse.req,
      );
      const statuses = operation
        ? Object.keys(operation.responses).join(', ')
        : '(none)';
      return [
        preamble,
        `received had status '${actualResponse.status}', but your API spec has no '${actualResponse.status}' response defined for endpoint '${endpoint}'`,
        `Response statuses found for endpoint '${endpoint}' in API spec: ${statuses}`,
      ].join('\n\n');
    }
    default:
      return [
        `expected received to satisfy the '${actualResponse.status}' response defined for endpoint '${endpoint}' in your API spec`,
        `received did not satisfy it because: ${validationError.message}`,
      ].join('\n\n');
  }
}

// Builds the evaluator behind expect(...).toSatisfyApiSpec(): structural validation through
// @ehuelsmann/openapi-validator stays the first gate and keeps route/method/status/$ref/
// nullable/allOf resolution authoritative; format enforcement runs only against an
// already-resolved response definition, using openapi-response-validator's public
// customFormats option with semantics supplied by ajv-formats.
export function createSpecEvaluator(
  doc: OpenAPISpecObject,
): (received: unknown) => SpecAssertion {
  if (!('openapi' in doc)) {
    throw new Error('This contract suite requires an OpenAPI 3.x document');
  }
  const components = 'components' in doc ? doc.components : undefined;
  const context: FormatValidatorContext = {
    apiSpec: makeApiSpec(doc),
    customFormats: buildCustomFormats(),
    components,
  };
  const enforceFormats = createFormatGate(context);

  return (received: unknown): SpecAssertion => {
    const actualResponse = makeResponse(received as RawResponse);
    const structuralError = context.apiSpec.validateResponse(actualResponse);
    if (structuralError) {
      return {
        pass: false,
        message: structuralFailureMessage(
          context.apiSpec,
          actualResponse,
          structuralError,
        ),
      };
    }
    const formatFailure = enforceFormats(actualResponse);
    if (formatFailure) {
      return {
        pass: false,
        message: [
          `expected received body of the '${actualResponse.status}' response defined for endpoint '${endpointOf(actualResponse)}' in your API spec to honor its declared formats`,
          `received did not satisfy it because: ${formatFailure}`,
        ].join('\n\n'),
      };
    }
    return { pass: true, message: '' };
  };
}
