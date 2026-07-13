import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { buildPageMeta, PaginatedResult } from '../pagination/page-meta';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor();
  const context = {} as ExecutionContext;

  const run = async (returned: unknown): Promise<unknown> => {
    const next: CallHandler = { handle: () => of(returned) };
    return firstValueFrom(interceptor.intercept(context, next));
  };

  it('wraps a plain object in { data }', async () => {
    const result = await run({ id: 'abc', title: 'Hello' });
    expect(result).toEqual({ data: { id: 'abc', title: 'Hello' } });
  });

  it('unwraps a PaginatedResult into { data, meta }', async () => {
    const meta = buildPageMeta(1, 12, 2);
    const result = await run(
      new PaginatedResult([{ id: '1' }, { id: '2' }], meta),
    );
    expect(result).toEqual({ data: [{ id: '1' }, { id: '2' }], meta });
  });

  it('normalizes undefined return values to { data: null }', async () => {
    const result = await run(undefined);
    expect(result).toEqual({ data: null });
  });
});
