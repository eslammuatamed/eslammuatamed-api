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
  // A named action beyond CRUD, admitted under D19-11c because the route that enforces it ships in
  // the same change: replying is not "updating a message", it is an outbound send visible to a
  // third party (D19-12). Deliberately `messages.reply` and not `messages.send` / `mail.send` — a
  // general send capability would authorize the next mail feature by accident.
  'messages.reply',
  'settings.read',
  'settings.update',
  // Static-page SEO (FR-DSH-051, D09-24). Named `seo.*` after the module and the Dashboard route
  // (doc 07 §2, doc 04 §1), and scoped to the `page_seo` rows only: FR-DSH-052's global head/tag
  // fields live on the settings singleton and stay under `settings.*`, because the authorization
  // boundary follows the data rather than the screen the operator sees them on.
  //
  // Only read and update exist, matching the routes exactly — the page set is code-defined, so there
  // is nothing to create or delete (D19-11c: no key ahead of the enforcement that gives it meaning).
  'seo.read',
  'seo.update',
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
