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
