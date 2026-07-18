// Pure, side-effect-free helpers for the media processing pipeline (T5). Kept separate from the
// service so the subtle quality-ladder logic and the filename/PDF validation are unit-testable
// without Sharp or the ESM `file-type` loader (they run under the plain Jest tier).

export interface BudgetLadderOptions {
  /** Encoder quality to try first (doc 20 §4: WebP 78, AVIF 55). */
  readonly startQuality: number;
  /** Lowest quality the ladder will drop to (doc 20 §4: WebP 55, AVIF 40). */
  readonly floorQuality: number;
  /** Quality decrement per step (doc 20 §4: 8). */
  readonly step: number;
  /** Width×format byte budget the rendition should meet (doc 20 §4 table). */
  readonly budgetBytes: number;
}

export interface BudgetLadderResult {
  readonly buffer: Buffer;
  /** The quality that produced `buffer`. */
  readonly quality: number;
  /** True when the output is still over budget at the floor (kept anyway — D20-6). */
  readonly overBudget: boolean;
}

// Encodes a rendition, stepping quality down by the explicit rule
// `nextQuality = max(floorQuality, currentQuality − step)` until the output fits `budgetBytes`
// or the floor is reached (D20-6). A rendition still over budget at the floor is kept and flagged
// `overBudget` — over-budget is delivery-non-blocking, never a failed upload. The encoder is
// injected so this logic is tested deterministically without Sharp.
export async function encodeWithinBudget(
  encode: (quality: number) => Promise<Buffer>,
  options: BudgetLadderOptions,
): Promise<BudgetLadderResult> {
  let quality = options.startQuality;
  let buffer = await encode(quality);

  while (
    buffer.length > options.budgetBytes &&
    quality > options.floorQuality
  ) {
    quality = Math.max(options.floorQuality, quality - options.step);
    buffer = await encode(quality);
  }

  return { buffer, quality, overBudget: buffer.length > options.budgetBytes };
}

const MAX_FILENAME_LENGTH = 200;

// Sanitizes an untrusted upload filename down to display/search metadata (doc 19 §5): the result
// is never a storage key or public path, so this only has to be safe to store and show. Strips any
// directory component, folds diacritics to ASCII, collapses every unsafe character run to a single
// underscore, and can never become a hidden or empty name.
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? '';

  let cleaned = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // drop combining diacritical marks (é → e)
    .replace(/[^A-Za-z0-9._-]+/g, '_') // collapse any other run to one underscore
    .replace(/^\.+/, '') // never a hidden dotfile
    .replace(/^_+/, '')
    .replace(/_+$/, '');

  if (cleaned.length === 0) {
    return 'file';
  }

  if (cleaned.length > MAX_FILENAME_LENGTH) {
    const dot = cleaned.lastIndexOf('.');
    const hasExtension = dot > 0 && cleaned.length - dot <= 12;
    if (hasExtension) {
      const ext = cleaned.slice(dot);
      cleaned = cleaned.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
    } else {
      cleaned = cleaned.slice(0, MAX_FILENAME_LENGTH);
    }
  }

  return cleaned;
}

// Basic structural integrity for a PDF (doc 19 §5): a real PDF starts with the `%PDF-` magic and
// ends with a `%%EOF` marker. This rejects truncated or malformed files without parsing the object
// graph — the magic-byte sniff already confirmed the type; this catches a cut-off upload.
export function hasPdfStructure(buffer: Buffer): boolean {
  if (buffer.length < 5) {
    return false;
  }
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return false;
  }
  // `%%EOF` sits at the tail of a well-formed PDF; scan the trailing window rather than the whole
  // file (trailing whitespace/newlines after the marker are permitted).
  const tail = buffer
    .subarray(Math.max(0, buffer.length - 1024))
    .toString('latin1');
  return tail.includes('%%EOF');
}
