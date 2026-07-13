// The permission catalog (D19-8, D09-7): the single code-defined source of truth. Every
// protected endpoint declares one of these keys via @RequirePermission; grants are data
// (RolePermission rows) referencing these keys. Keys are `<resource>.<action>` — CRUD verbs
// plus named actions where a capability exceeds CRUD (e.g. articles.publish). Adding a
// guarded capability means adding its key here (and a doc-18 test fails if an endpoint
// declares an unknown one, because the decorator is typed against this list).
export const PERMISSIONS = [
  'articles.read',
  'articles.create',
  'articles.update',
  'articles.delete',
  'articles.publish',
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
  'messages.delete',
  'settings.read',
  'settings.update',
  'seo.read',
  'seo.update',
  'redirects.read',
  'redirects.create',
  'redirects.update',
  'redirects.delete',
  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
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
