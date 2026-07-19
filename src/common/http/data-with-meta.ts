// A single (non-paginated) 2xx body that must carry a `meta` object alongside `data` (D10-3) —
// e.g. the media upload's 200 response with `meta: { deduplicated: true }`. The
// ResponseEnvelopeInterceptor unwraps it to `{ data, meta }`, mirroring how a PaginatedResult is
// unwrapped; every other single return value stays `{ data }`. Keeping this a dedicated sentinel
// (rather than a bare `{ data, meta }` object) is what lets the interceptor tell "wrap this" apart
// from "this IS already the payload".
export class DataWithMeta<TData = unknown, TMeta = unknown> {
  constructor(
    readonly data: TData,
    readonly meta: TMeta,
  ) {}
}
