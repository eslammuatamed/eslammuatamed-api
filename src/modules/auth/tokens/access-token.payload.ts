// Minimal access-token claims (doc 19 §2, D19-8): subject id only. Authorization (role and
// permission grants) is resolved server-side per request, never carried in the token, so a
// grant change takes effect immediately rather than waiting out the token TTL.
export interface AccessTokenPayload {
  readonly sub: string;
}
