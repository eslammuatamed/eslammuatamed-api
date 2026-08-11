// Leading `Re:` in any case, with optional surrounding whitespace. Deliberately anchored and
// deliberately NOT a general RFC 5322 subject parser: this recognises the one prefix this API
// itself produces, so `Re: Re:` cannot accumulate across a thread of replies (D10-21d).
//
// It does not attempt localized prefixes (`Antw:`, `رد:`, `SV:`) or bracketed list tags. Those are
// mail-client conventions, and matching them would mean guessing which of a dozen conventions a
// visitor's client used — a parser whose failures are silent and whose only symptom is a slightly
// wrong subject line. Not worth building; see doc 02 D02-13e (no threading infrastructure).
const REPLY_PREFIX = /^\s*re\s*:/i;

// Derives the reply subject from the original message's subject (D10-21d).
//
// Idempotent by construction: `deriveReplySubject(deriveReplySubject(s)) === deriveReplySubject(s)`,
// which is the property that matters — the same original can be replied to many times, and each
// reply is derived from the ORIGINAL rather than from the previous reply, so a drifting prefix
// would be a per-attempt inconsistency rather than a one-off cosmetic issue.
export function deriveReplySubject(originalSubject: string): string {
  const trimmed = originalSubject.trim();

  return REPLY_PREFIX.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}
