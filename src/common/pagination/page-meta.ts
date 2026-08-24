import { ApiProperty } from '@nestjs/swagger';

// List-response meta (D10-3/D10-4): offset pagination totals.
export class PageMeta {
  @ApiProperty({ example: 1, description: 'Current page (1-based).' })
  readonly page!: number;

  @ApiProperty({ example: 12, description: 'Items per page (max 50).' })
  readonly perPage!: number;

  @ApiProperty({ example: 42, description: 'Total matching items.' })
  readonly total!: number;

  @ApiProperty({
    example: 4,
    description: 'Total pages for the current perPage.',
  })
  readonly totalPages!: number;
}

export function buildPageMeta(
  page: number,
  perPage: number,
  total: number,
): PageMeta {
  return {
    page,
    perPage,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / perPage),
  };
}

// Sentinel returned by controllers for list endpoints. The envelope interceptor unwraps it
// into `{ data, meta }`; every other return value becomes `{ data }`.
//
// `M` lets a list endpoint widen its meta with list-scoped information that is genuinely NOT
// per-item — `/projects` carries the technology facets there, because a facet describes
// the whole published set and so cannot live on a page of items. It defaults to `PageMeta`, so
// every existing call site is unchanged, and the bound keeps pagination non-negotiable: a widened
// meta ADDS to `page`/`perPage`/`total`/`totalPages`, it can never replace them.
export class PaginatedResult<T, M extends PageMeta = PageMeta> {
  constructor(
    readonly data: readonly T[],
    readonly meta: M,
  ) {}
}
