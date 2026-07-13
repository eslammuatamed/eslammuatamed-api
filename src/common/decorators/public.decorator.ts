import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Opt out of the default-deny global auth guard (doc 19 §3). An endpoint is private unless
// it explicitly declares @Public() — new endpoints are private by accident, not exposed by it.
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
