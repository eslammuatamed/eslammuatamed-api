import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../permissions';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

// Declares the permission a protected endpoint requires (doc 19 §3, D19-8); enforced by
// PermissionsGuard. Typed against the catalog, so an unknown key is a compile error. A
// protected endpoint that omits it fails the doc-18 metadata-coverage test and is denied
// at runtime (fail closed).
export const RequirePermission = (
  permission: PermissionKey,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
