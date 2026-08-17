import { PROVIDER_IDEMPOTENCY_WINDOW_MS } from '../mail/mail.service';

// The two rules that make a reply's EXTERNAL send idempotent. Both are pure and both are here
// rather than inline in the service, for the same reason `reply-subject.ts` is its own module: they
// are the parts a test can pin exactly, with no database and no clock.
//
// Application idempotency and provider idempotency are different guarantees with different
// lifetimes, and conflating them is the defect this file exists to prevent:
//
//   application key  — client-supplied, identifies the logical OPERATION, enforced by a unique
//                      index, lives as long as the row does. PERMANENT.
//   provider key     — server-derived, identifies the external SEND, enforced by the provider,
//                      honoured for 24 hours. BOUNDED.
//
// A permanent record protected by a bounded guarantee is exactly why re-attempting an ambiguous
// send is only safe for a while — see `isWithinProviderIdempotencyWindow`.

// Namespace prefix. Matches the provider's own recommended `<event-type>/<entity-id>` shape and
// keeps the reply key space disjoint from anything the notification path might later adopt, so two
// unrelated emails can never collide on one key and silently suppress each other.
const REPLY_KEY_PREFIX = 'contact-reply';

// Derives the provider key for one logical reply attempt (ledger §5aj-1).
//
// Derived from the PERSISTED ROW ID and nothing else, which is what makes it correct in both
// directions: the same attempt re-derives the same key on every replay for as long as the row
// exists, and a deliberate second reply is a different row and therefore a different key. Anything
// else on hand would break one of those two properties — a body hash changes if the operator edits
// their text, a recipient or operator id is shared by every reply to that message, a timestamp
// differs per call, and the client's own header is an opaque value it may reuse across messages.
//
// A UUIDv7 id keeps the result far inside the provider's 256-character limit.
export function deriveProviderIdempotencyKey(replyId: string): string {
  return `${REPLY_KEY_PREFIX}/${replyId}`;
}

// Whether an unresolved attempt may still be re-sent under its original provider key.
//
// A PENDING row means no terminal outcome was recorded — which honestly covers both "the send was
// never made" and the hard case, "the provider accepted it and the status write did not land". The
// row cannot tell those apart — there is deliberately no claim marker — so the only safe re-attempt
// is one the PROVIDER would recognise as a duplicate and refuse to send twice.
//
// The deadline is measured from `createdAt`, which is conservative in the safe direction and
// deliberately so: the provider's window opens when it first SAW the key, which is strictly after
// the row was created, so this can only ever expire recovery EARLY. It can refuse a send that would
// in fact have been safe; it cannot permit one that would duplicate. Past the deadline the only
// correct action is to do nothing — an ambiguous outcome may not be resolved by an action that
// might send a second email to a real person.
//
// `>=` at the boundary, so the exact expiry instant refuses rather than sends.
export function isWithinProviderIdempotencyWindow(
  createdAt: Date,
  now: Date,
): boolean {
  return now.getTime() - createdAt.getTime() < PROVIDER_IDEMPOTENCY_WINDOW_MS;
}
