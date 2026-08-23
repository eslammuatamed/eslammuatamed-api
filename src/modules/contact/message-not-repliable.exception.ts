import { ConflictException } from '@nestjs/common';

// 409 raised when a reply is requested for a message that carries no email address.
//
// This is not an edge case that slipped through — it is D02-10 working as designed: a visitor may
// submit a phone number instead of an email, and the database CHECK constraint guarantees only that
// AT LEAST ONE is present. So a stored, perfectly valid message can have nowhere to reply to.
//
// 409 rather than 422 or 404, following `MediaInUseException` — the request is well-formed and the
// target exists; it is the target's STATE that forbids the operation. 404 would deny a message the
// caller can plainly see in the inbox; 422 would blame a request that is not at fault. The reply
// affordance is a per-message capability the dashboard can derive from `email !== null` before ever
// issuing the call, so this is the backstop rather than the expected path.
//
// Raised BEFORE the idempotency key is claimed, so a client cannot burn a key on a message it can
// never reply to — a later fix to the message's address, were one ever possible, must not
// find the key already spent.
export class MessageNotRepliableException extends ConflictException {
  constructor() {
    super({
      message:
        'This message carries no email address and cannot be replied to by email.',
      reason: 'no_email_address',
    });
  }
}
