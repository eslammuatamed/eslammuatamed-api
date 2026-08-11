// Turns the SMTP config group ON for a suite that needs `AppConfigService.mail` to be populated —
// today, the 11B-β2 security/history matrix, which asserts the configured sender and the owner
// notification destination and therefore cannot run against the disabled group.
//
// WHY A SIDE-EFFECTING MODULE RATHER THAN A `beforeAll` ASSIGNMENT. `ConfigModule.forRoot()` runs
// while `app.module.ts` is being IMPORTED, not when the testing module is compiled, and it validates
// and snapshots the environment at that moment. An assignment inside `beforeAll` is therefore too
// late: it was measured returning `{enabled:false, smtp:null, from:null, ownerNotificationTo:null}`.
// A side-effect import placed ABOVE the `e2e-app` import runs first — ts-jest emits CommonJS, which
// preserves `require` order — so the values are in place before the graph is loaded.
//
// NO MAIL CAN BE SENT AS A RESULT. The suites that import this also override `MAIL_TRANSPORT` with a
// fake, and an overridden provider's factory never runs, so `mailTransportProvider` never calls
// `createTransport` and no SMTP client is constructed. These values exist to make the CONFIG real,
// not the connection: the host is unroutable and both addresses are RFC 2606 reserved domains that
// cannot receive mail even if something did try.
export const E2E_MAIL_ENV = {
  SMTP_ENABLED: 'true',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'e2e-smtp-user',
  SMTP_PASSWORD: 'e2e-smtp-password',
  SMTP_FROM: 'no-reply@example.com',
  CONTACT_NOTIFICATION_TO: 'owner-notifications@example.com',
} as const;

for (const [key, value] of Object.entries(E2E_MAIL_ENV)) {
  process.env[key] = value;
}
