#!/usr/bin/env node
// Provenance guard for code-adjacent documentation and source comments.
//
// This repository keeps three kinds of writing in three different places:
//
//   1. Governing documentation  (../eslammuatamed-docs)  — "what must be true, and why"
//   2. Code-adjacent docs       (README.md, PROJECT_GUIDE.md, src/**/README.md, test/README.md)
//                                                        — "how does the CURRENT code work"
//   3. Historical evidence      (research notes, ledgers, PR history)
//                                                        — "how did we get here"
//
// Layers 1 and 3 leak into layer 2 constantly, because whoever fixes a defect is holding the
// audit identifier in their head at the moment they write the comment. The result is a comment
// that explains a finding number instead of an invariant, and a README that reports a release
// state that was true for one week in August.
//
// This guard mechanises the distinction. It classifies every identifier-shaped token it finds:
//
//   GOVERNANCE   D<NN>-<N>, FR-*, NFR-*, PUB-*, DSH-*  → KEEP. These point at normative
//                decisions and requirements in the governing docs. They are the reason a
//                reader can find out WHY a rule exists. Removing them destroys traceability.
//
//   ARCHAEOLOGY  C-*, B-*, F9-*, P9-*, AD-*, OD-*      → FLAG. These are audit / remediation
//                finding numbers from completed campaigns. A reader six months from now cannot
//                resolve them and does not need to: only the current invariant matters.
//                The fix is almost never to delete the comment — it is to delete the PREFIX and
//                keep the prose that explains the invariant.
//
//   EXEMPT       SHA-256, %PDF-1.4, CWE-*, CVE-*, ...  → IGNORE. Real technical vocabulary and
//                binary magic bytes that merely happen to match the identifier shape. Each entry
//                below is a regression case: every one of these was flagged by an earlier,
//                naiver version of this check.
//
// It also flags fast-rotting STATE claims in code-adjacent docs — deployment status, release
// freezes, "Planned" for already-built behaviour, bare commit SHAs, PR numbers. Those facts have
// an owner (the governing docs and the release record) and it is not a module README.
//
// TWO MODES
//   node scripts/check-doc-provenance.mjs --audit   Report every token, grouped, including an
//                                                   UNCLASSIFIED bucket. Never fails. This is the
//                                                   discovery mode: UNCLASSIFIED is where a new
//                                                   identifier family shows up and has to be
//                                                   triaged into GOVERNANCE or ARCHAEOLOGY below.
//   node scripts/check-doc-provenance.mjs           Guard mode. Fails ONLY on identifiers already
//                                                   classified as archaeology, and on rot markers.
//                                                   It never fails on an unknown token, so a new
//                                                   requirement family cannot break CI on the day
//                                                   it is introduced.
//
//   --self-test                                     Positive control. See SELF_TEST below.
//
// There is deliberately no comment or environment bypass. A token that genuinely belongs in the
// code adds itself to EXEMPT or GOVERNANCE here — a visible, reviewable change.
//
// ── WHAT THIS GUARD DOES NOT COVER ────────────────────────────────────────────────────────────
//
// Stating the gap explicitly, because a guard whose limits are undocumented gets read as proving
// more than it does — which is the same failure this campaign exists to fix.
//
//   1. ROT IS CHECKED IN DOCUMENTS ONLY, NEVER IN SOURCE COMMENTS. The rot rules are prose-shaped
//      ("Production deployed", "مؤجَّل حتى", bare SHAs) and would fire differently against code,
//      where hex literals and issue-shaped strings are ordinary. Extending them to `src/**` needs
//      its own control suite; until that exists this is a MANUAL review class.
//
//      The live example, deliberately left un-caught rather than silently assumed covered:
//      `test/prisma-error-mapping.e2e-spec.ts` carries a comment saying a Project-local P2002
//      translation "will" be deleted. It already was — `projects/projects.service.ts` documents
//      its absence. A stale future-tense claim about completed work is a correctness defect, and
//      no rule here detects it.
//
//   2. It does not verify that a GOVERNANCE token actually resolves. `D16-13` is cited in
//      PROJECT_GUIDE.md and exists on no authoritative ref of the governing-docs repo. Resolution
//      checking needs the sibling repo and its authoritative ref, which this guard has no access
//      to and must not assume is checked out.
//
//   3. It does not judge whether a kept comment is a GOOD comment. Prefix-stripping is mechanical;
//      deciding that the remaining prose states a real invariant is not.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

// ── Classification ────────────────────────────────────────────────────────────────────────────

// Normative pointers into ../eslammuatamed-docs. These EARN their place in a comment.
const GOVERNANCE = [
  /^D\d{2}-\d+[a-z]?$/, // decision log, e.g. D10-6, D07-1, D10-21c
  /^FR-\d+$/, // functional requirement, e.g. FR-004
  /^(FR|NFR)-[A-Z]{2,4}-\d+$/, // scoped requirement, e.g. FR-DSH-051, FR-PUB-020
  /^NFR-\d+$/, // non-functional requirement
  /^PUB-\d+$/, // publication requirement
  /^DSH-\d+$/, // dashboard requirement
];

// Campaign identifiers that carry NO hyphen, so the hyphenated TOKEN_RE below cannot see them.
// This family was missed entirely by the first version of this guard and was found by peer
// review, not by the instrument — which is why it is called out separately rather than folded
// silently into ARCHAEOLOGY.
//
// It is the larger surface of the two, and the more damaging to learnability, because these are
// used REFERENTIALLY rather than as a citation prefix. `media-processing.types.ts` says "so T6
// persists it without a mapping" — `T6` stands in for a component that has a real name. A reader
// without the SpecKit tasks file for that feature cannot resolve it, and deleting the token would
// leave the sentence without a subject.
//
// So these need a different repair from a `C-5:` prefix: rewrite the sentence to name the actual
// component. That distinction is recorded as repair bucket C in the campaign ledger.
const CAMPAIGN_PHRASES = [
  { name: 'SpecKit task id', re: /(?<![A-Za-z0-9_-])T\d{1,2}(?![A-Za-z0-9_-])/g },
  { name: 'compact feature id', re: /(?<![A-Za-z0-9_-])F\d{3}(?![A-Za-z0-9_-])/g },
  { name: 'spelled feature id', re: /\b[Ff]eature\s+\d{3}\b/g },
  { name: 'campaign phase', re: /\bPhase\s+\d+[A-Z]?\b/g },
];

// Completed-campaign finding numbers. Unresolvable to a future reader.
const ARCHAEOLOGY = [
  /^[BC]-\d+$/, // backend-audit findings, e.g. C-5, C-6, B-2, B-3
  /^F\d+-\d+$/, // hardening-campaign findings, e.g. F9-9, F9-13
  /^P\d+-\d+$/, // Prisma-migration research decisions, e.g. P9-3, P9-8
  /^AD-\d+$/, // architecture-deviation findings, e.g. AD-7
  /^OD-\d+$/, // owner-decision queue items, e.g. OD-2
];

// Real vocabulary that matches the identifier shape. Every entry is a past false positive.
const EXEMPT = new Set([
  'SHA-256', // hash algorithm
  'SHA-1',
  'PDF-1', // from the `%PDF-1.4` magic bytes used as an upload-rejection fixture
  'CWE-674', // weakness taxonomy
  'RFC-7807', // problem+json
  'UTF-8',
  'ISO-8601',
  'BASE-64',
  'HTTP-1',
  'TLS-1',
  'AES-256',
  'ES-2022',
  'P-256',
  'TEST-NET-1', // RFC 5737 reserved documentation ranges, used as literal IPs in throttling tests
  'TEST-NET-2',
  'TEST-NET-3',
]);

const EXEMPT_PREFIX = [/^CVE-\d{4}$/, /^GHSA-/, /^RFC-\d+$/, /^UTF-\d+$/, /^ISO-\d+$/];

// Fast-rotting state claims. A code-adjacent doc must not own these.
const ROT_MARKERS = [
  {
    name: 'deployment-state claim',
    re: /Production deployed|Deployed:\s*(YES|NO)|منشورة للإنتاج|منشور للإنتاج|بانتظار إصدار الإنتاج/i,
    why: 'Deployment state belongs to the release record, not to a module README.',
  },
  {
    name: 'release-freeze claim',
    // `\p{M}*` absorbs Arabic combining marks (مؤجَّل carries shadda+fatha, and the same word is
    // written without them elsewhere), and the separator class absorbs the markdown emphasis that
    // routinely lands between the two words (`**مؤجَّل** حتى`). Matching the bare literal
    // `مؤجَّل حتى` missed both variants — the self-test caught it.
    re: /release freeze|تجميد الإصدار(?:ات)?|مؤج\p{M}*ل\p{M}*[\s*_`]{0,4}حتى/iu,
    why: 'A freeze is a governing decision with a lifetime; citing it here goes stale silently.',
  },
  {
    name: 'campaign / feature completion status',
    re: /\bIn Progress\b|\bIn-Progress\b|^\s*\*\*`?Planned`?\*\*|قيد التنفيذ|غير مكتوبة بعد/im,
    why: 'Feature status belongs to the roadmap and the spec, not to code-adjacent docs.',
  },
  {
    // A hex run must contain at least one a-f letter. Pure-digit runs of this length are
    // overwhelmingly constants — `31536000` (one year in seconds) and `20260806` (a date stamp)
    // both tripped an earlier version of this rule. The residual false-negative (an all-numeric
    // short SHA) is rare and far cheaper than flagging every cache max-age in the corpus.
    name: 'bare commit SHA',
    re: /(?<![\w/])(?=[0-9a-f]{7,40}(?![\w]))[0-9]*[a-f][0-9a-f]*/,
    why: 'A pinned SHA turns the document into a snapshot of one moment.',
  },
  {
    name: 'PR reference',
    re: /\bPR #\d+|\(#\d+\)|pull\/\d+/,
    why: 'PR numbers are historical evidence, not current-state documentation.',
  },
];

// ── File selection ────────────────────────────────────────────────────────────────────────────

const DOC_PATTERNS = [
  /^README\.md$/,
  /^PROJECT_GUIDE\.md$/,
  /^src\/.*README\.md$/,
  /^test\/README\.md$/,
  /^prisma\/README\.md$/,
  /^scripts\/.*README\.md$/,
];

// CONTRIBUTING.md and CLAUDE.md are contributor/agent-facing process docs, not learning docs;
// they legitimately discuss branches, PRs and release policy. .specify/ holds SpecKit specs,
// which are historical-evidence artifacts by design and MUST keep their campaign identifiers.
const SOURCE_DIRS = ['src', 'test'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-ops') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function docFiles() {
  return walk(ROOT)
    .map((f) => relative(ROOT, f))
    .filter((f) => DOC_PATTERNS.some((re) => re.test(f)))
    .sort();
}

function sourceFiles() {
  return SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d)))
    .map((f) => relative(ROOT, f))
    .filter((f) => f.endsWith('.ts'))
    .sort();
}

// ── Token extraction ──────────────────────────────────────────────────────────────────────────

// Identifier shape, in two forms:
//   plain    1-4 uppercase letters, optional digits, hyphen, digits, optional letter  (D10-6, C-5)
//   scoped   two uppercase segments before the number                     (FR-DSH-051, FR-PUB-020)
// The scoped alternative is listed FIRST so the engine prefers the longer match; otherwise
// `FR-DSH-051` would be read as an unmatched `FR-` followed by a token starting mid-string.
//
// NOTE ON ARABIC: JavaScript's \b is defined over [A-Za-z0-9_], and Arabic codepoints are not in
// that class. An Arabic letter adjacent to a Latin one therefore COUNTS as a word boundary, which
// would make `\b` unreliable here in both directions. Substring poisoning (a token found inside a
// longer word such as `foo_C-5_bar` or `ABC-123-XYZ`) is prevented instead by explicit
// [^A-Za-z0-9_-] lookarounds — note `_`, which an earlier version omitted and which the
// self-test caught.
const TOKEN_RE =
  /(?<![A-Za-z0-9_-])((?:[A-Z]{2,4}-[A-Z]{2,4}-\d+)|(?:[A-Z]{1,4}\d{0,2}-\d+[a-z]?))(?![A-Za-z0-9_-])/g;

function classify(token) {
  if (EXEMPT.has(token) || EXEMPT_PREFIX.some((re) => re.test(token))) return 'EXEMPT';
  if (GOVERNANCE.some((re) => re.test(token))) return 'GOVERNANCE';
  if (ARCHAEOLOGY.some((re) => re.test(token))) return 'ARCHAEOLOGY';
  return 'UNCLASSIFIED';
}

function scanTokens(files) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(TOKEN_RE)) {
        hits.push({ file, line: i + 1, token: m[1], kind: classify(m[1]), text: line.trim() });
      }
    });
  }
  return hits;
}

// For a `.ts` file, return only the COMMENT portion of a line; markdown is prose throughout.
//
// This is not fussiness. `T\d{1,2}` is a short, generic shape, and in TypeScript source it
// collides with real identifiers — `generic<T1>()` being the obvious one. Campaign archaeology
// lives in comments, never in identifiers, so restricting the scan to comment text removes the
// entire false-positive class instead of trying to enumerate it. The self-test pins this: the
// `const T1 = generic<T1>()` case must NOT match.
function commentTextOf(line, file) {
  if (!file.endsWith('.ts')) return line;
  const trimmed = line.trim();
  if (trimmed.startsWith('//')) return trimmed.slice(2);
  if (trimmed.startsWith('*') || trimmed.startsWith('/*')) return trimmed;
  const idx = line.indexOf('//');
  return idx === -1 ? '' : line.slice(idx + 2);
}

function scanCampaignPhrases(files) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const text = commentTextOf(line, file);
      if (!text) return;
      for (const fam of CAMPAIGN_PHRASES) {
        for (const m of text.matchAll(fam.re)) {
          hits.push({ file, line: i + 1, token: m[0], family: fam.name, text: line.trim() });
        }
      }
    });
  }
  return hits;
}

function scanRot(files) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const marker of ROT_MARKERS) {
        if (marker.re.test(line)) {
          hits.push({ file, line: i + 1, marker: marker.name, why: marker.why, text: line.trim() });
        }
      }
    });
  }
  return hits;
}

// ── Positive control ──────────────────────────────────────────────────────────────────────────
//
// A classifier that flags nothing looks identical to a clean repository. These cases pin the
// discriminating behaviour: it must flag archaeology, must NOT flag governance, must NOT flag
// real vocabulary, and must behave identically when the surrounding prose is Arabic.

const SELF_TEST = [
  { input: 'C-5: a nested create is already atomic', expect: ['ARCHAEOLOGY'] },
  { input: 'the ordering invariant (B-2) holds', expect: ['ARCHAEOLOGY'] },
  { input: 'shape moved in v7 (F9-9)', expect: ['ARCHAEOLOGY'] },
  { input: 'decision P9-3 in the research note', expect: ['ARCHAEOLOGY'] },
  { input: 'the 1 MiB JSON limit (AD-7)', expect: ['ARCHAEOLOGY'] },
  { input: 'governing decision D10-6 applies', expect: ['GOVERNANCE'] },
  { input: 'per D07-1 and D10-21c', expect: ['GOVERNANCE', 'GOVERNANCE'] },
  { input: 'requirement FR-004 and NFR-006', expect: ['GOVERNANCE', 'GOVERNANCE'] },
  { input: 'FR-DSH-051 is served', expect: ['GOVERNANCE'] },
  { input: 'hashed with SHA-256', expect: [] },
  { input: "Buffer.from('%PDF-1.4\\n')", expect: [] },
  { input: 'mitigates CWE-674', expect: [] },
  { input: 'CVE-2026-40345 patched', expect: [] },
  // Arabic-embedded cases: the same tokens must classify identically inside Arabic prose.
  { input: 'القرار الحاكم D16-13 يَنسَخ D16-6', expect: ['GOVERNANCE', 'GOVERNANCE'] },
  { input: 'هذا كان إصلاح C-5 في الحملة السابقة', expect: ['ARCHAEOLOGY'] },
  { input: 'التجزئة SHA-256 مستعملة هنا', expect: [] },
  // Substring poisoning: a token embedded in a longer identifier must NOT match.
  { input: 'the ABC-123-XYZ build tag', expect: [] },
  { input: 'variable named foo_C-5_bar', expect: [] },
];

// The rot rules need their own control for the same reason: a rule that matches nothing and a
// clean corpus are indistinguishable from the outside. `expect` is the marker name, or null for
// lines that must NOT trip any rule.
const ROT_SELF_TEST = [
  { input: '`Prisma v7 Production deployed: NO`', expect: 'deployment-state claim' },
  { input: 'الوحدة **مُسلَّمة ومنشورة للإنتاج**', expect: 'deployment-state claim' },
  { input: 'منفَّذة على `dev` — بانتظار إصدار الإنتاج', expect: 'deployment-state claim' },
  { input: 'النشر **مؤجَّل** حتى بدء مرحلة الموقع', expect: 'release-freeze claim' },
  { input: 'this is under a release freeze', expect: 'release-freeze claim' },
  { input: 'مدموجة على `main` (PR #7)', expect: 'PR reference' },
  { input: 'promoted in (#85)', expect: 'PR reference' },
  { input: 'baseline at `4c6653e`', expect: 'bare commit SHA' },
  { input: 'release `20260814T203732Z-19ebbb4` is live', expect: 'bare commit SHA' },
  // Must NOT trip: real constants and ordinary current-state prose.
  { input: '`Cache-Control: max-age=31536000, immutable`', expect: null },
  { input: 'the seed runs on 20260806 fixtures', expect: null },
  { input: 'الخدمة تُعيد 404 عند غياب الترجمة', expect: null },
  { input: 'the service resolves the translation for one locale', expect: null },
  { input: 'a `$transaction` wraps the slug rename and its redirect', expect: null },
];

// Controls for the hyphenless campaign families. The negative cases matter more than the
// positive ones here: `T\d` is a short, generic-looking shape and a careless rule would sweep up
// ordinary prose and real identifiers.
const PHRASE_SELF_TEST = [
  { input: 'so T6 persists it without a mapping', expect: 'SpecKit task id' },
  { input: 'the buildRedirectOps callers (articles/projects, T7)', expect: 'SpecKit task id' },
  { input: 'لا CRUD يدويّ للتحويلات في F004', expect: 'compact feature id' },
  { input: 'Feature 003 (`media`) مدموجة', expect: 'spelled feature id' },
  { input: 'Phase 12A will delete the local translation', expect: 'campaign phase' },
  // Must NOT match: real identifiers and ordinary text that merely contain the shape.
  { input: 'const T1 = generic<T1>()', file: 'x.ts', expect: null }, // TS generic param
  { input: '  // so T6 persists it (comment in a .ts file)', file: 'x.ts', expect: 'SpecKit task id' },
  { input: 'the WEBP1 variant', expect: null },
  { input: 'a T-shaped column', expect: null },
  { input: 'HTTP2 transport', expect: null },
  { input: 'featured 003 items', expect: null },
];

function phraseSelfTest() {
  let failed = 0;
  for (const testCase of PHRASE_SELF_TEST) {
    // Exercised through commentTextOf with a .ts filename, so the control tests the code path
    // that actually runs — not a regex in isolation that skips the comment extraction.
    const text = commentTextOf(testCase.input, testCase.file ?? 'x.md');
    const got = CAMPAIGN_PHRASES.filter((f) => [...text.matchAll(f.re)].length > 0).map(
      (f) => f.name,
    );
    const ok = testCase.expect === null ? got.length === 0 : got.includes(testCase.expect);
    if (!ok) {
      failed += 1;
      console.error(
        `✖ phrase self-test: ${JSON.stringify(testCase.input)}\n` +
          `    expected ${testCase.expect ?? 'no match'}  got [${got.join(', ') || 'none'}]`,
      );
    }
  }
  return failed;
}

function rotSelfTest() {
  let failed = 0;
  for (const testCase of ROT_SELF_TEST) {
    const got = ROT_MARKERS.filter((m) => m.re.test(testCase.input)).map((m) => m.name);
    const ok = testCase.expect === null ? got.length === 0 : got.includes(testCase.expect);
    if (!ok) {
      failed += 1;
      console.error(
        `✖ rot self-test: ${JSON.stringify(testCase.input)}\n` +
          `    expected ${testCase.expect ?? 'no match'}  got [${got.join(', ') || 'none'}]`,
      );
    }
  }
  return failed;
}

function selfTest() {
  let failed = rotSelfTest() + phraseSelfTest();
  for (const testCase of SELF_TEST) {
    const got = [...testCase.input.matchAll(TOKEN_RE)]
      .map((m) => classify(m[1]))
      .filter((k) => k !== 'EXEMPT');
    const ok =
      got.length === testCase.expect.length && got.every((k, i) => k === testCase.expect[i]);
    if (!ok) {
      failed += 1;
      console.error(
        `✖ self-test: ${JSON.stringify(testCase.input)}\n` +
          `    expected [${testCase.expect.join(', ')}]  got [${got.join(', ')}]`,
      );
    }
  }
  const total = SELF_TEST.length + ROT_SELF_TEST.length + PHRASE_SELF_TEST.length;
  if (failed > 0) {
    console.error(`\n✖ provenance guard self-test: ${failed}/${total} case(s) failed.`);
    process.exit(1);
  }
  console.log(`✓ provenance guard self-test: ${total}/${total} cases pass.`);
  console.log(
    '  (flags archaeology · keeps governance · ignores real vocabulary · stable in Arabic prose)',
  );
}

// ── Modes ─────────────────────────────────────────────────────────────────────────────────────

function audit() {
  const docs = docFiles();
  const src = sourceFiles();
  const hits = [...scanTokens(docs), ...scanTokens(src)];

  const byKind = new Map();
  for (const hit of hits) {
    if (!byKind.has(hit.kind)) byKind.set(hit.kind, new Map());
    const tokens = byKind.get(hit.kind);
    tokens.set(hit.token, (tokens.get(hit.token) ?? 0) + 1);
  }

  console.log(`# provenance audit — ${docs.length} doc(s), ${src.length} source file(s)\n`);
  for (const kind of ['ARCHAEOLOGY', 'UNCLASSIFIED', 'GOVERNANCE', 'EXEMPT']) {
    const tokens = byKind.get(kind) ?? new Map();
    const total = [...tokens.values()].reduce((a, b) => a + b, 0);
    console.log(`## ${kind} — ${tokens.size} distinct token(s), ${total} occurrence(s)`);
    console.log(
      [...tokens.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `   ${String(n).padStart(4)}  ${t}`)
        .join('\n') || '   (none)',
    );
    console.log('');
  }

  console.log('## ARCHAEOLOGY occurrences (file:line)');
  const arch = hits.filter((h) => h.kind === 'ARCHAEOLOGY');
  for (const hit of arch) {
    console.log(`   ${hit.file}:${hit.line}  [${hit.token}]  ${hit.text.slice(0, 100)}`);
  }
  if (arch.length === 0) console.log('   (none)');

  const phrases = scanCampaignPhrases([...docs, ...src]);
  const byFam = new Map();
  for (const h of phrases) byFam.set(h.family, (byFam.get(h.family) ?? 0) + 1);
  console.log(`\n## CAMPAIGN PHRASES (hyphenless, invisible to the token matcher) — ${phrases.length} occurrence(s)`);
  for (const [fam, n] of [...byFam.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(4)}  ${fam}`);
  }
  const phraseFiles = new Set(phrases.map((h) => h.file));
  console.log(`   across ${phraseFiles.size} file(s)`);

  const rot = scanRot(docs);
  console.log(`\n## ROT markers in code-adjacent docs — ${rot.length} occurrence(s)`);
  for (const hit of rot) {
    console.log(`   ${hit.file}:${hit.line}  [${hit.marker}]  ${hit.text.slice(0, 100)}`);
  }
  if (rot.length === 0) console.log('   (none)');
}

function guard() {
  const docs = docFiles();
  const src = sourceFiles();
  const arch = [...scanTokens(docs), ...scanTokens(src)].filter((h) => h.kind === 'ARCHAEOLOGY');
  const rot = scanRot(docs);

  if (arch.length === 0 && rot.length === 0) {
    console.log(
      `✓ provenance guard: ${docs.length} code-adjacent doc(s) and ${src.length} source file(s) ` +
        'carry no campaign archaeology and no fast-rotting state claims.',
    );
    return;
  }

  if (arch.length > 0) {
    console.error(`✖ provenance guard: ${arch.length} campaign-archaeology reference(s).\n`);
    for (const hit of arch) {
      console.error(`  ${hit.file}:${hit.line}  [${hit.token}]\n    ${hit.text.slice(0, 110)}`);
    }
    console.error(
      '\n  These are finding numbers from completed campaigns. A future reader cannot resolve\n' +
        '  them. Usually the comment itself is worth keeping: delete the identifier prefix and\n' +
        '  keep the sentence that states the invariant.\n',
    );
  }

  if (rot.length > 0) {
    console.error(`✖ provenance guard: ${rot.length} fast-rotting state claim(s).\n`);
    for (const hit of rot) {
      console.error(`  ${hit.file}:${hit.line}  [${hit.marker}]\n    ${hit.why}`);
    }
  }

  process.exit(1);
}

const mode = process.argv[2];
if (mode === '--self-test') selfTest();
else if (mode === '--audit') audit();
else guard();
