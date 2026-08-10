// The permission catalog (D19-8, D09-7): the single code-defined source of truth. Every
// protected endpoint declares one of these keys via @RequirePermission; grants are data
// (RolePermission rows) referencing these keys.
//
// The catalog lists capabilities that really exist and are really guarded — nothing else
// (D19-11). A key here is an offer to the operator: it is grantable, so listing a capability
// the API does not enforce hands out a role that silently does nothing. Both directions are
// asserted in route-permissions.spec.ts, so a key with no route fails the build.
//
// Keys are `<resource>.<action>`, currently all CRUD verbs. A named action beyond CRUD (a
// separate `articles.publish`, say) is admitted only once a route separately enforces it —
// never ahead of the enforcement that gives it meaning (D19-11c). Publishing today rides on
// `articles.update`, so no separate publish key exists.
export const PERMISSIONS = [
  'articles.read',
  'articles.create',
  'articles.update',
  'articles.delete',
  'projects.read',
  'projects.create',
  'projects.update',
  'projects.delete',
  'categories.read',
  'categories.create',
  'categories.update',
  'categories.delete',
  'tags.read',
  'tags.create',
  'tags.update',
  'tags.delete',
  'experiences.read',
  'experiences.create',
  'experiences.update',
  'experiences.delete',
  'skills.read',
  'skills.create',
  'skills.update',
  'skills.delete',
  'testimonials.read',
  'testimonials.create',
  'testimonials.update',
  'testimonials.delete',
  'media.read',
  'media.create',
  'media.update',
  'media.delete',
  'messages.read',
  'messages.update',
  'settings.read',
  'settings.update',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'users.read',
  'users.create',
  'users.update',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

// The reserved superadmin grant: matches every permission, present and future (D19-8). Held by
// the OWNER system role as its single grant; also grantable to custom roles.
export const WILDCARD_PERMISSION = '*';

// A stored grant is either a catalog key or the wildcard. Used to validate role-grant payloads.
export const GRANTABLE_PERMISSIONS: readonly string[] = [
  ...PERMISSIONS,
  WILDCARD_PERMISSION,
];

export function isGrantablePermission(value: string): boolean {
  return GRANTABLE_PERMISSIONS.includes(value);
}
