// The request principal set by the JWT guard after a valid access token. Authorization is
// resolved from the database per request (D19-8), so the token carries no role/permission
// claims — only the subject id.
export interface AuthenticatedUser {
  readonly id: string;
}
