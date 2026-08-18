// The transport-agnostic message MailService accepts. Deliberately narrower than Nodemailer's
// SendMailOptions: callers describe an email, they do not configure a transport. Keeping headers,
// attachments and auth out of this shape means no domain module can reach the delivery layer's
// configuration through a message it builds.
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  // Plain text is the only body format. Every message this API sends is a short operational
  // notification, so HTML would add a second representation to keep in sync, an escaping
  // obligation on visitor-supplied text, and spam-filter surface, for no gain (principle 2).
  readonly text: string;
  // Set on the owner notification so a reply in the mail client reaches the visitor rather than
  // the envelope sender. Never set to a value the API did not itself validate.
  readonly replyTo?: string;
  // Opt-in duplicate-send protection for a message whose send the caller may legitimately RE-ATTEMPT
  // with an ambiguous prior outcome. Provider-neutral on purpose: the caller states "these two send
  // attempts are the same logical email", and MailService alone decides which transport header
  // expresses that. The provider's name does not appear in any domain module.
  //
  // Absent on the notification path, and that absence is asserted rather than assumed: those sends
  // are independent logical operations that must never be collapsed into one another.
  //
  // NOT the client's application `Idempotency-Key`. That value identifies the logical OPERATION and
  // lives forever in the database; this one identifies the external SEND and is honoured by the
  // provider for a bounded window. Distinct names because they are distinct values with distinct
  // lifetimes — see contact/provider-idempotency.ts.
  readonly providerIdempotencyKey?: string;
}

// What a send attempt concluded. MailService returns this instead of throwing: delivery is a side
// effect of an already-committed database write, so its failure is a fact to record, not an
// exception for a caller to handle (see contact.service.ts).
export type MailSendResult =
  | {
      readonly status: 'sent';
      readonly messageId: string;
      readonly attempts: number;
    }
  | { readonly status: 'disabled' }
  | {
      readonly status: 'failed';
      readonly attempts: number;
      readonly reason: string;
    };
