// Anti-spam signal evaluation for the public contact intake (D02-1, doc 19 §6). Two lightweight,
// request-only layers backed by the IP rate limit — deliberately cheap and spoofable, chosen over
// CAPTCHA (D02-1):
//   - honeypot `website`: a real form keeps this hidden and empty; any non-empty value is a bot.
//   - time-trap `elapsedMs`: the CLIENT-computed milliseconds between form render and submit (an
//     elapsed duration, never an absolute timestamp — a skewed client clock must never falsely drop
//     a genuine submission on the platform's single conversion point, D05-4). A human takes time;
//     an instant (or missing/negative) submission is a bot.
// Neither field is ever persisted. When this returns true the caller DROPS-AS-SUCCESS: it returns
// the same 2xx receipt but writes nothing, so a bot gets no signal that its submission was rejected.

// A genuine form cannot be filled and submitted in under 3 seconds (doc 19 §6, D02-1).
export const MIN_FILL_MS = 3000;

export interface SpamSignals {
  readonly website?: string;
  readonly elapsedMs?: number;
}

// True when the submission trips either trap: the honeypot carries a value, or the fill time is
// absent/negative/below the human threshold.
export function isSpam(signals: SpamSignals): boolean {
  // Any non-empty value trips the honeypot — a hidden field a human never touches, so even
  // whitespace is a bot signal (D02-1). No trimming: emptiness is length 0, nothing else.
  const honeypotTripped =
    typeof signals.website === 'string' && signals.website.length > 0;
  if (honeypotTripped) {
    return true;
  }

  const { elapsedMs } = signals;
  if (elapsedMs === undefined || elapsedMs < MIN_FILL_MS) {
    return true;
  }

  return false;
}
