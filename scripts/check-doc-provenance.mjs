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
// THREE CHECKS
//   Archaeology  completed-campaign identifiers in code-adjacent docs and source comments.
//   Rot          fast-rotting state claims in code-adjacent docs.
//   Existence    every syntactically valid D-decision citation on an authored, current-state
//                surface must resolve to a decision DEFINITION in the authoritative governing
//                docs (see the limits section — existence, not semantic fit).
//
// MODES
//   node scripts/check-doc-provenance.mjs --audit   Report every token, grouped, including an
//                                                   UNCLASSIFIED bucket and the governance
//                                                   split (GOVERNANCE_RESOLVED vs
//                                                   GOVERNANCE_UNRESOLVED). Never fails. This
//                                                   is the discovery mode: UNCLASSIFIED is
//                                                   where a new identifier family shows up and
//                                                   has to be triaged into GOVERNANCE or
//                                                   ARCHAEOLOGY below.
//   node scripts/check-doc-provenance.mjs           Guard mode. Fails ONLY on identifiers already
//                                                   classified as archaeology, on rot markers,
//                                                   and on D-citations that are syntactically
//                                                   valid but authoritatively undefined. It
//                                                   never fails on an unknown token, so a new
//                                                   requirement family cannot break CI on the
//                                                   day it is introduced.
//
//   --self-test                                     Positive AND negative controls. Fully
//                                                   self-contained: builds throwaway fixture
//                                                   git repositories in the OS temp dir and runs
//                                                   the REAL loading/parsing/scanning path
//                                                   against them. Never requires the sibling
//                                                   docs checkout; never touches the network.
//
//   Flags (any position):
//     --governance-repo <path>   local path to the governing-docs git repository
//                                (default ../eslammuatamed-docs)
//     --governance-ref <ref>     authoritative ref inside that repository
//                                (default origin/main)
//
// There is deliberately no comment or environment bypass. A token that genuinely belongs in the
// code adds itself to EXEMPT or GOVERNANCE here — a visible, reviewable change.
//
// ── WHAT THIS GUARD PROVES — AND WHAT IT DELIBERATELY DOES NOT ────────────────────────────────
//
// Stating the limits explicitly, because a guard whose limits are undocumented gets read as proving
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
//   2. DECISION EXISTENCE IS MECHANICALLY PROVEN; SEMANTIC APPROPRIATENESS IS NOT. Every
//      syntactically valid `D\d{2}-\d+[a-z]?` citation on an authored, current-state surface
//      must resolve to a decision DEFINITION — the first cell of a data row in a
//      `## N. Decision Log` Markdown table inside a numbered governing document — read from the
//      governing repository's GIT OBJECTS at an explicit authoritative ref (by default
//      `../eslammuatamed-docs` @ `origin/main`). The distinction matters because the string
//      appearing SOMEWHERE in the docs repository proves nothing: research ledgers, historical
//      prose, changelog entries, generated group bundles, cross-document citations and abandoned
//      branches all freely mention IDs that were never decisions. Reading the object store rather
//      than the working tree means a sibling checkout left on an abandoned branch can never
//      legitimize a phantom citation, and this guard performs NO network fetch — obtaining a
//      fresh authoritative ref is the operator's (or CI's) job, and normal guard mode FAILS
//      CLOSED when the repository or the ref is unavailable.
//
//      The boundary is equally explicit: resolution proves the decision EXISTS on the
//      authoritative ref. It does NOT judge whether an otherwise-real citation is semantically
//      appropriate — a genuine `D10-6` bolted onto an invariant D10-6 never made is a MANUAL
//      review class, and nothing here claims otherwise. Requirement families other than
//      decisions (`FR-*`, `NFR-*`, `PUB-*`, `DSH-*`) are verified for shape only; their corpora
//      live in different structures and remain syntax-checked, not existence-checked.
//
//   3. It does not judge whether a kept comment is a GOOD comment. Prefix-stripping is mechanical;
//      deciding that the remaining prose states a real invariant is not.

import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, resolve, dirname } from 'node:path';

const ROOT = process.cwd();

// ── Classification ────────────────────────────────────────────────────────────────────────────

// Normative pointers into ../eslammuatamed-docs. These EARN their place in a comment.
const GOVERNANCE = [
  /^D\d{2}-\d+[a-z]?$/, // decision log, e.g. D10-6, D07-1, D19-8
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

// ── Authoritative decision corpus (existence check) ───────────────────────────────────────────
//
// A D-token is RESOLVED only when it is DEFINED on the authoritative governing ref: a first-cell
// `| Dxx-n[a-z]? |` data row inside a `## N. Decision Log` Markdown table of a numbered governing
// document (`docs/NN-*.md`). Everything else in the docs repository — research ledgers,
// historical prose, changelog entries, generated group bundles, cross-references from other
// decisions and documents, unmerged branches — is deliberately NOT a definition source. Those
// surfaces mention IDs that were never decisions; that is exactly how phantoms survived audits.
//
// The corpus is read from the repository's GIT OBJECTS at an explicit ref, never from its working
// tree: a sibling checkout left on an abandoned branch must not legitimize a citation, and a
// dirty one must not break the guard. No network operation happens here — if the local clone has
// no such ref, the guard fails closed and says so.
//
// Suffix forms (`D02-13e`) are supported because the table syntax carries them structurally;
// they are rare, and numbering gaps (a doc whose log skips a number) are normal and preserved —
// contiguity is never assumed.

const GOVERNANCE_REPO_DEFAULT = '../eslammuatamed-docs';
const GOVERNANCE_REF_DEFAULT = 'origin/main';

// Numbered governing documents only. `docs/group/*` are GENERATED concatenations of these
// (regenerated by the docs repo's own tooling), so parsing them would add nothing but risk;
// research/, superpowers/ and content/ are not normative.
const GOVERNING_DOC_PATH_RE = /^docs\/\d{2}-[a-z0-9-]+\.md$/;

class GovernanceSourceError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason; // 'repo-missing' | 'ref-missing' | 'no-corpus'
  }
}

function gitCapture(repoPath, gitArgs) {
  // Explicit stdio: expected-failure probes (missing repo, missing ref) must not leak raw git
  // diagnostics to the guard's own output — they are rethrown as typed, actionable errors.
  return execFileSync('git', ['-C', repoPath, ...gitArgs], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveGovernanceSha(repoPath, ref) {
  let gitDir;
  try {
    gitDir = gitCapture(repoPath, ['rev-parse', '--git-dir']).trim();
  } catch {
    throw new GovernanceSourceError(
      'repo-missing',
      `no git repository at "${repoPath}" (pass --governance-repo <path> to point at the ` +
        'governing docs checkout)',
    );
  }
  let sha;
  try {
    sha = gitCapture(repoPath, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
  } catch {
    throw new GovernanceSourceError(
      'ref-missing',
      `"${repoPath}" (${gitDir}) has no ref "${ref}". The guard never fetches; obtain the ` +
        `authoritative ref yourself (e.g. git -C ${repoPath} fetch origin) or pass ` +
        '--governance-ref <ref> explicitly',
    );
  }
  return sha;
}

// The decision-DEFINITION extractor. Strict by design: only a plain first-cell token counts.
// Bolded cells, prose mentions, headings and changelog bullets do NOT define anything.
function extractDecisionIds(markdown) {
  const ids = new Set();
  const LOG_HEADING = /^##\s+\d+\.\s+Decision\s+Log\s*$/;
  const ANY_HEADING = /^#{1,6}\s/;
  const ROW = /^\|\s*(D\d{2}-\d+[a-z]?)\s*\|/;
  let inLog = false;
  for (const line of markdown.split('\n')) {
    if (LOG_HEADING.test(line)) {
      inLog = true;
      continue;
    }
    if (ANY_HEADING.test(line)) inLog = false;
    if (!inLog) continue;
    const m = line.match(ROW);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function loadDecisionCorpus(repoPath, ref) {
  const sha = resolveGovernanceSha(repoPath, ref);
  const paths = gitCapture(repoPath, ['ls-tree', '-r', '--name-only', sha, '--', 'docs/'])
    .split('\n')
    .filter((p) => GOVERNING_DOC_PATH_RE.test(p));
  if (paths.length === 0) {
    throw new GovernanceSourceError(
      'no-corpus',
      `"${repoPath}" @ ${ref} (${sha.slice(0, 12)}) contains no numbered governing documents ` +
        `(docs/NN-*.md) — refusing to resolve against an unrecognizable corpus`,
    );
  }
  const ids = new Set();
  for (const p of paths) {
    const blob = gitCapture(repoPath, ['show', `${sha}:${p}`]);
    for (const id of extractDecisionIds(blob)) ids.add(id);
  }
  return { repoPath, ref, sha, fileCount: paths.length, ids };
}

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

// Generated output is not repository-authored source. `src/generated/prisma/**` is produced by
// `prisma generate` and gitignored (.gitignore), and its comments carry upstream research
// identifiers that this repository cannot rewrite — an archaeology token there is not a finding
// about OUR comments, so the scanner must never see the directory. Authored `src/**` and
// `test/**` are unaffected.
const GENERATED_PREFIXES = ['src/generated/prisma/'];

function isScannedSource(f) {
  return f.endsWith('.ts') && !GENERATED_PREFIXES.some((p) => f.startsWith(p));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-ops' || entry === '.git')
      continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function docFiles(root = ROOT) {
  return walk(root)
    .map((f) => relative(root, f))
    .filter((f) => DOC_PATTERNS.some((re) => re.test(f)))
    .sort();
}

function sourceFiles(root = ROOT) {
  return SOURCE_DIRS.flatMap((d) => walk(join(root, d)))
    .map((f) => relative(root, f))
    .filter(isScannedSource)
    .sort();
}

// ── Governance-resolution scan surface ────────────────────────────────────────────────────────
//
// DELIBERATELY NOT the archaeology scan boundaries. Archaeology scanning stays conservative
// (code-adjacent docs + src/test comments); decision citations, however, legitimately live in
// more authored, current-state surfaces — swagger description STRINGS inside DTOs (not only
// comments), prisma schema and migration SQL headers, workflow step names, env examples,
// contributor docs. The inclusion/exclusion policy:
//
// INCLUDED — authored, human-reviewed, current-state surfaces where a Dxx-* citation can appear:
//   README.md, PROJECT_GUIDE.md                 root current-state documentation
//   CONTRIBUTING.md, .github/PULL_REQUEST_TEMPLATE.md
//                                               contributor-facing process docs (resolution ONLY;
//                                               they stay outside archaeology/rot scanning)
//   src/**/*, test/**/*.ts                      application source and tests, ALL text (comments
//                                               AND string literals: DTO descriptions carry
//                                               citations by convention here)
//   src/**/README.md, test/README.md, prisma/README.md, scripts/**/README.md
//                                               module documentation
//   prisma/schema.prisma, prisma/migrations/**/*.sql
//                                               schema/migration commentary cites decisions
//   prisma/**/*.ts                              seed, content canonical dataset, sync tooling
//   scripts/**/*.mjs                            operational guard/tooling commentary
//   .github/workflows/*.yml                     step names/comments cite gating decisions
//   .env.example                                documented configuration carries decision ids
//
// EXCLUDED — with reasons, not by omission:
//   .campaign/**, .specify/**                   historical campaign/spec evidence; MUST keep
//                                               unresolvable identifiers; outside current-state
//                                               enforcement by design
//   src/generated/prisma/**                     generated client; mirrors upstream/authored inputs
//   openapi.json                                generated contract artifact; its freshness is owned
//                                               by the contract fixed-point CI gate, not here
//   package-lock.json, *.svg/*.png binaries     lockfiles and non-prose artifacts
//   .env                                        local secrets; gitignored, never scanned
//   scripts/check-doc-provenance.mjs            THIS guard: its self-test necessarily embeds
//                                               phantom literals as negative controls, so it can
//                                               never be scanned by the check it implements
//
// The D-decision token shape cannot be a TypeScript identifier (hyphenated), so full-line
// scanning of code files adds no false-positive class FOR THIS FAMILY — unlike the short,
// generic archaeology shapes that require comment-only extraction.
const RESOLUTION_DOC_PATTERNS = [
  /^README\.md$/,
  /^PROJECT_GUIDE\.md$/,
  /^CONTRIBUTING\.md$/,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/,
  /^src\/.*README\.md$/,
  /^test\/README\.md$/,
  /^prisma\/README\.md$/,
  /^scripts\/.*README\.md$/,
];

const RESOLUTION_CODE_PATTERNS = [
  /^src\/.*\.ts$/,
  /^test\/.*\.ts$/,
  /^prisma\/schema\.prisma$/,
  /^prisma\/migrations\/.*\.sql$/,
  /^prisma\/.*\.ts$/,
  /^scripts\/.*\.mjs$/,
  /^\.github\/workflows\/[^/]+\.ya?ml$/,
  /^\.env\.example$/,
];

const RESOLUTION_EXCLUDED_PREFIXES = ['.campaign/', '.specify/', 'src/generated/prisma/'];

// See policy comment above: this file is the one deliberate, documented exception.
const RESOLUTION_EXCLUDED_FILES = new Set(['scripts/check-doc-provenance.mjs']);

function isResolutionSurface(f) {
  if (RESOLUTION_EXCLUDED_FILES.has(f)) return false;
  if (RESOLUTION_EXCLUDED_PREFIXES.some((p) => f.startsWith(p))) return false;
  return (
    RESOLUTION_DOC_PATTERNS.some((re) => re.test(f)) || RESOLUTION_CODE_PATTERNS.some((re) => re.test(f))
  );
}

function resolutionFiles(root = ROOT) {
  return walk(root)
    .map((f) => relative(root, f))
    .filter(isResolutionSurface)
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

function scanTokens(files, root = ROOT) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(join(root, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(TOKEN_RE)) {
        hits.push({ file, line: i + 1, token: m[1], kind: classify(m[1]), text: line.trim() });
      }
    });
  }
  return hits;
}

// Decision-citation scanner for the governance-resolution surface. Unlike TOKEN_RE (which must
// stay conservative because its shapes are short and generic), this shape is hyphenated and
// cannot be a code identifier — so every file type is scanned across the WHOLE line, which is
// what lets string-literal citations (swagger DTO descriptions) resolve.
const DECISION_TOKEN_RE = /(?<![A-Za-z0-9_-])(D\d{2}-\d+[a-z]?)(?![A-Za-z0-9_-])/g;

function scanDecisionTokens(files, root = ROOT) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(join(root, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(DECISION_TOKEN_RE)) {
        hits.push({ file, line: i + 1, token: m[1], text: line.trim() });
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
  { input: 'per D07-1 and D19-8', expect: ['GOVERNANCE', 'GOVERNANCE'] },
  { input: 'requirement FR-004 and NFR-006', expect: ['GOVERNANCE', 'GOVERNANCE'] },
  { input: 'FR-DSH-051 is served', expect: ['GOVERNANCE'] },
  { input: 'hashed with SHA-256', expect: [] },
  { input: "Buffer.from('%PDF-1.4\\n')", expect: [] },
  { input: 'mitigates CWE-674', expect: [] },
  { input: 'CVE-2026-40345 patched', expect: [] },
  // Arabic-embedded cases: the same tokens must classify identically inside Arabic prose.
  // Both IDs are authoritative current decisions (doc 16's decision log); this suite classifies
  // SHAPE — existence is proven separately by the resolution suites below.
  { input: 'القرار الحاكم D16-8 يَنسَخ D16-6', expect: ['GOVERNANCE', 'GOVERNANCE'] },
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

// Controls for the file-selection boundary. Excluding generated output must not silently stop
// the scanner from seeing authored source, and the exclusion must hold for whatever token the
// generator happens to emit. The guard flags a token in a file exactly when the file is scanned
// AND the token classifies as archaeology — so each case asserts that whole decision through the
// REAL `isScannedSource` + `classify` pair, never a re-typed rule.
const SELECTION_SELF_TEST = [
  // Positive controls: authored source is still scanned; its P9-1 is flagged.
  { file: 'src/modules/contact/anti-spam.ts', token: 'P9-1', expect: true },
  { file: 'test/reply-http-security.e2e-spec.ts', token: 'C-5', expect: true },
  // Negative controls: the same tokens under generated prisma output are ignored.
  { file: 'src/generated/prisma/internal/class.ts', token: 'P9-1', expect: false },
  { file: 'src/generated/prisma/client.ts', token: 'P9-3', expect: false },
];

function selectionSelfTest() {
  let failed = 0;
  for (const testCase of SELECTION_SELF_TEST) {
    const got =
      isScannedSource(testCase.file) && classify(testCase.token) === 'ARCHAEOLOGY';
    if (got !== testCase.expect) {
      failed += 1;
      console.error(
        `✖ selection self-test: ${testCase.file} carrying ${testCase.token}\n` +
          `    expected ${testCase.expect ? 'flagged' : 'ignored'}  got ${
            got ? 'flagged' : 'ignored'
          }`,
      );
    }
  }
  return failed;
}

// ── Resolution controls ────────────────────────────────────────────────────────────────────────
//
// The existence check gets its own control suite, held to a higher standard than the classifier
// suites above: every case below runs the REAL pipeline — a throwaway fixture GIT repository is
// committed to the OS temp dir and read back through `git` object-store calls, the real corpus
// loader, the real decision-table parser and the real surface selection — never a re-typed or
// in-memory approximation of them. The negative controls are the point: a mention is not a
// definition, syntax is not existence, and each rule here was written because a phantom of that
// exact shape once survived a manual audit.

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

const PARSER_SELF_TEST = [
  {
    name: 'plain first-cell rows define; both halves of a blank-line-split table count',
    md: ['## 9. Decision Log', '', '| # | D | A | R |', '| - | - | - | - |', '| D09-21 | a | b | c |', '', '| D09-24 | a | b | c |'].join('\n'),
    expect: ['D09-21', 'D09-24'],
  },
  {
    name: 'section ends at the next heading',
    md: ['## 9. Decision Log', '| D10-6 | a | b | c |', '', '## 10. Review Notes', '| D10-99 | x | y | z |'].join('\n'),
    expect: ['D10-6'],
  },
  {
    name: 'a bolded first cell is NOT a definition (strict table syntax)',
    md: ['## 9. Decision Log', '| **D10-5** | a | b | c |', '| D10-5 | a | b | c |'].join('\n'),
    expect: ['D10-5'],
  },
  {
    name: 'prose mentions inside the log section do not define',
    md: ['## 9. Decision Log', 'supersedes D10-4 (see rationale)', '| D10-18 | a | b | c |'].join('\n'),
    expect: ['D10-18'],
  },
  {
    name: 'suffix decisions are structurally supported',
    md: ['## 9. Decision Log', '| D02-13e | a | b | c |'].join('\n'),
    expect: ['D02-13e'],
  },
  {
    name: 'no Decision Log heading — nothing defines, even tabular text',
    md: ['| D10-1 | a | b | c |', '## 3. Rules', '| D10-2 | a | b | c |'].join('\n'),
    expect: [],
  },
];

function parserSelfTest() {
  let failed = 0;
  for (const t of PARSER_SELF_TEST) {
    const got = [...extractDecisionIds(t.md)].sort();
    const want = [...t.expect].sort();
    if (got.join(',') !== want.join(',')) {
      failed += 1;
      console.error(`✖ parser self-test: ${t.name}\n    expected [${want}]  got [${got}]`);
    }
  }
  return failed;
}

// Fixture governing document with a Decision Log carrying the given first-cell tokens.
function fixtureGoverningDoc(rows) {
  return [
    '# 10 — Fixture Doc',
    '',
    '## 9. Decision Log',
    '',
    '| #     | Decision | Alternatives considered | Rationale |',
    '| ----- | -------- | ----------------------- | --------- |',
    ...rows.map((r) => `| ${r} | d | a | r |`),
    '',
    '## 10. Review Notes',
    '',
    '- changelog prose cites D10-77 in passing; a changelog is not a definition.',
  ].join('\n');
}

function writeFixtureTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

function initFixtureGitRepo(dir) {
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'add', '-A']);
  execFileSync('git', ['-C', dir, '-c', 'user.email=fixture@invalid', '-c', 'user.name=fixture', 'commit', '-q', '-m', 'fixture corpus']);
}

// Builds a complete fixture world: an authoritative docs repo (definitions AND non-definitional
// mentions) plus an API-like tree whose authored surfaces cite various tokens.
function buildResolutionFixture() {
  const root = mkdtempSync(join(tmpdir(), 'guard-resolution-fixture-'));
  const docsRepo = join(root, 'docs-repo');
  writeFixtureTree(docsRepo, {
    'docs/10-api-design.md': fixtureGoverningDoc(['D10-6', 'D10-11']),
    'docs/02-product-requirements.md': fixtureGoverningDoc(['D02-13', 'D02-13e']),
    // Normative PROSE only: "see D10-88" outside any Decision Log defines nothing.
    'docs/07-backend-architecture.md': ['# 07 — Fixture', '', 'Body prose: see D10-88 before surrendering.'].join('\n'),
    // Research ledger: records that D10-19 existed ONLY on an unmerged branch. The string exists
    // in the docs repository; the DEFINITION does not. This exact shape once passed an audit.
    'docs/research/ledger.md': ['# Research Ledger', '', 'D10-19 existed only on an unmerged branch.'].join('\n'),
  });
  initFixtureGitRepo(docsRepo);
  writeFixtureTree(join(root, 'api'), {
    'src/valid.ts': '// per D10-6 the locale query is explicit\nexport const L = ["?locale="];\n',
    'src/valid-string.ts': 'description: "uniform envelope (D10-11)." // string literals carry citations too\n',
    'src/suffix.ts': '// plain-text body only (D02-13e)\n',
    'src/phantom.ts': '// shaped like D99-999 but defined nowhere\n',
    'src/research-cite.ts': '// D10-19 is mentioned in the research ledger — a mention is not a definition\n',
    'src/prose-cite.ts': '// normative prose says "see D10-88" — prose is not a definition either\n',
    '.campaign/ledger.md': '# campaign\nfinding D99-888 lives in history\n',
    '.specify/specs/001-x/spec.md': '# spec\nuses D99-777 as evidence\n',
    'src/generated/prisma/client.ts': '// upstream comment citing D99-666\n',
    '.github/workflows/ci.yml': ['name: CI', 'jobs:', '  verify:', '    steps:', '      # FTS gate (D10-6) must stay green', '      - run: npm run guard:fts # phantom D99-555 must be caught here'].join('\n'),
    'scripts/tool.mjs': '// operational tooling governed by D10-11\n',
    'prisma/schema.prisma': '// model Foo — retention basis D99-444\nmodel Foo { id String @id }\n',
    '.env.example': 'PREVIEW_BASE=https://example.com # minted per D10-11\nPHANTOM_FLAG=1 # D99-333\n',
  });
  return root;
}

function runResolutionPipeline(fixtureRoot) {
  const apiRoot = join(fixtureRoot, 'api');
  const corpus = loadDecisionCorpus(join(fixtureRoot, 'docs-repo'), 'HEAD');
  const files = resolutionFiles(apiRoot);
  const hits = scanDecisionTokens(files, apiRoot).map((h) => ({
    ...h,
    resolved: corpus.ids.has(h.token),
  }));
  return { corpus, hits };
}

const RESOLUTION_PIPELINE_SELF_TEST = [
  {
    name: 'valid definition resolves (comment)',
    file: 'src/valid.ts',
    token: 'D10-6',
    expect: 'resolved',
  },
  {
    name: 'valid definition resolves (string literal — swagger-description class)',
    file: 'src/valid-string.ts',
    token: 'D10-11',
    expect: 'resolved',
  },
  {
    name: 'suffixed definition resolves',
    file: 'src/suffix.ts',
    token: 'D02-13e',
    expect: 'resolved',
  },
  {
    name: 'phantom fails: syntactically valid, authoritatively undefined',
    file: 'src/phantom.ts',
    token: 'D99-999',
    expect: 'unresolved',
  },
  {
    name: 'research-ledger MENTION does not resolve (critical negative control)',
    file: 'src/research-cite.ts',
    token: 'D10-19',
    expect: 'unresolved',
  },
  {
    name: 'normative-prose MENTION does not resolve',
    file: 'src/prose-cite.ts',
    token: 'D10-88',
    expect: 'unresolved',
  },
  {
    name: 'workflow comments are covered — resolved case',
    file: '.github/workflows/ci.yml',
    token: 'D10-6',
    expect: 'resolved',
  },
  {
    name: 'workflow comments are covered — phantom detected',
    file: '.github/workflows/ci.yml',
    token: 'D99-555',
    expect: 'unresolved',
  },
  {
    name: 'scripts surface covered — resolved case',
    file: 'scripts/tool.mjs',
    token: 'D10-11',
    expect: 'resolved',
  },
  {
    name: 'prisma schema covered — phantom detected',
    file: 'prisma/schema.prisma',
    token: 'D99-444',
    expect: 'unresolved',
  },
  {
    name: '.env.example covered — resolved case',
    file: '.env.example',
    token: 'D10-11',
    expect: 'resolved',
  },
  {
    name: '.env.example covered — phantom detected',
    file: '.env.example',
    token: 'D99-333',
    expect: 'unresolved',
  },
];

// Historical artifacts must not even ENTER the resolution scan.
const RESOLUTION_EXCLUSION_SELF_TEST = [
  { file: '.campaign/ledger.md', token: 'D99-888' },
  { file: '.specify/specs/001-x/spec.md', token: 'D99-777' },
  { file: 'src/generated/prisma/client.ts', token: 'D99-666' },
];

function resolutionPipelineSelfTest() {
  let failed = 0;
  const root = buildResolutionFixture();
  try {
    const { hits } = runResolutionPipeline(root);
    for (const t of RESOLUTION_PIPELINE_SELF_TEST) {
      const hit = hits.find((h) => h.file === t.file && h.token === t.token);
      const got = hit ? (hit.resolved ? 'resolved' : 'unresolved') : 'absent';
      if (got !== t.expect) {
        failed += 1;
        console.error(
          `✖ resolution self-test: ${t.name}\n` +
            `    ${t.file} [${t.token}] expected ${t.expect}  got ${got}`,
        );
      }
    }
    for (const t of RESOLUTION_EXCLUSION_SELF_TEST) {
      if (hits.some((h) => h.file === t.file && h.token === t.token)) {
        failed += 1;
        console.error(
          `✖ resolution exclusion self-test: ${t.file} carrying ${t.token} was scanned\n` +
            '    historical/generated surfaces must stay outside current-state enforcement',
        );
      }
    }
  } finally {
    execFileSync('rm', ['-rf', root]);
  }
  return failed;
}

// Fail-closed behaviour: guard mode must refuse to run — with a reason, never silently — when
// the authoritative source is missing at any of its three failure points.
function resolutionFailClosedSelfTest() {
  let failed = 0;
  const cases = [];
  try {
    loadDecisionCorpus(join(tmpdir(), 'guard-missing-repo-fixture-xyz'), 'HEAD');
    cases.push(['nonexistent path', null]);
  } catch (e) {
    cases.push(['nonexistent path', e]);
  }
  const emptyRepo = mkdtempSync(join(tmpdir(), 'guard-empty-repo-fixture-'));
  execFileSync('git', ['-C', emptyRepo, 'init', '-q']);
  try {
    loadDecisionCorpus(emptyRepo, 'origin/main');
    cases.push(['repo without the ref', null]);
  } catch (e) {
    cases.push(['repo without the ref', e]);
  }
  const noDocsRepo = mkdtempSync(join(tmpdir(), 'guard-nodocs-repo-fixture-'));
  writeFixtureTree(noDocsRepo, { 'README.md': 'no numbered docs here\n' });
  initFixtureGitRepo(noDocsRepo);
  try {
    loadDecisionCorpus(noDocsRepo, 'HEAD');
    cases.push(['repo without governing corpus', null]);
  } catch (e) {
    cases.push(['repo without governing corpus', e]);
  }
  const expectedReasons = ['repo-missing', 'ref-missing', 'no-corpus'];
  cases.forEach(([name, err], i) => {
    if (!(err instanceof GovernanceSourceError) || err.reason !== expectedReasons[i]) {
      failed += 1;
      console.error(
        `✖ fail-closed self-test: ${name}\n` +
          `    expected GovernanceSourceError(${expectedReasons[i]})  got ${
            err ? err.constructor.name + '(' + (err.reason ?? 'none') + ')' : 'NO ERROR'
          }`,
      );
    }
  });
  execFileSync('rm', ['-rf', emptyRepo, noDocsRepo]);
  return failed;
}

function selfTest() {
  let failed =
    rotSelfTest() +
    phraseSelfTest() +
    selectionSelfTest() +
    parserSelfTest() +
    resolutionPipelineSelfTest() +
    resolutionFailClosedSelfTest();
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
  const total =
    SELF_TEST.length +
    ROT_SELF_TEST.length +
    PHRASE_SELF_TEST.length +
    SELECTION_SELF_TEST.length +
    PARSER_SELF_TEST.length +
    RESOLUTION_PIPELINE_SELF_TEST.length +
    RESOLUTION_EXCLUSION_SELF_TEST.length +
    3; // fail-closed cases
  if (failed > 0) {
    console.error(`\n✖ provenance guard self-test: ${failed}/${total} case(s) failed.`);
    process.exit(1);
  }
  console.log(`✓ provenance guard self-test: ${total}/${total} cases pass.`);
  console.log(
    '  (flags archaeology · keeps governance · verifies decision existence against fixture git corpora · mentions never define · fails closed when the authoritative ref is missing · ignores real vocabulary · stable in Arabic prose · skips generated prisma output)',
  );
}

// ── Modes ─────────────────────────────────────────────────────────────────────────────────────

function audit(opts = {}) {
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

  // Decision-existence split. Distinct from the classifier buckets above: it runs over the
  // governance-resolution surface (authored current-state files) and needs the authoritative
  // corpus, so audit degrades gracefully when that source is unavailable.
  let corpus = null;
  try {
    corpus = loadDecisionCorpus(opts.governanceRepo, opts.governanceRef);
  } catch (e) {
    console.log(
      `## GOVERNANCE RESOLUTION — SKIPPED (${e.reason ?? 'unavailable'})\n\n   ${e.message}\n`,
    );
  }
  if (corpus) {
    const govHits = scanDecisionTokens(resolutionFiles()).map((h) => ({
      ...h,
      resolved: corpus.ids.has(h.token),
    }));
    const resolved = govHits.filter((h) => h.resolved);
    const unresolved = govHits.filter((h) => !h.resolved);
    const distinct = (list) => new Set(list.map((h) => h.token)).size;
    console.log(
      `## GOVERNANCE_RESOLVED — ${distinct(resolved)} decision id(s), ${resolved.length} occurrence(s)\n` +
        `   defined on ${corpus.repoPath} @ ${corpus.ref} (${corpus.sha.slice(0, 12)}, ` +
        `${corpus.ids.size} decisions across ${corpus.fileCount} governing doc(s))\n`,
    );
    console.log(
      `## GOVERNANCE_UNRESOLVED — ${distinct(unresolved)} decision id(s), ${unresolved.length} occurrence(s)` +
        (unresolved.length ? ' — syntax is not existence; these need definitions or removal' : ''),
    );
    for (const hit of unresolved) {
      console.log(`   ${hit.file}:${hit.line}  [${hit.token}]  ${hit.text.slice(0, 100)}`);
    }
    if (unresolved.length === 0 && govHits.length > 0) console.log('   (none)');
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

function guard(opts = {}) {
  const docs = docFiles();
  const src = sourceFiles();
  const arch = [...scanTokens(docs), ...scanTokens(src)].filter((h) => h.kind === 'ARCHAEOLOGY');
  const rot = scanRot(docs);

  // Decision existence. Fail-closed: without the authoritative corpus the guard CANNOT do its
  // job and must say so rather than pass by omission.
  let corpus;
  try {
    corpus = loadDecisionCorpus(opts.governanceRepo, opts.governanceRef);
  } catch (e) {
    console.error('✖ provenance guard: decision existence cannot be verified — failing closed.\n');
    console.error(`  ${e.message}`);
    process.exit(1);
  }
  const govHits = scanDecisionTokens(resolutionFiles()).map((h) => ({
    ...h,
    resolved: corpus.ids.has(h.token),
  }));
  const unresolved = govHits.filter((h) => !h.resolved);
  const resolvedCount = govHits.length - unresolved.length;

  if (arch.length === 0 && rot.length === 0 && unresolved.length === 0) {
    console.log(
      `✓ provenance guard: ${docs.length} code-adjacent doc(s), ${src.length} source file(s), ` +
        `${resolvedCount} governance citation(s) — no campaign archaeology, no fast-rotting ` +
        'state claims, every D-decision resolves.',
    );
    console.log(
      `  decision existence proven against ${corpus.repoPath} @ ${corpus.ref} ` +
        `(${corpus.sha.slice(0, 12)}, ${corpus.ids.size} decisions / ${corpus.fileCount} docs).`,
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

  if (unresolved.length > 0) {
    console.error(
      `✖ provenance guard: ${unresolved.length} syntactically valid but UNRESOLVED governance ` +
        'decision citation(s).\n',
    );
    for (const hit of unresolved) {
      console.error(`  ${hit.file}:${hit.line}  [${hit.token}]`);
    }
    console.error(
      `\n  No decision with ${unresolved.length > 1 ? 'these ids' : 'this id'} is DEFINED on ` +
        `${corpus.repoPath} @ ${corpus.ref} (${corpus.sha.slice(0, 12)}). A token matching the ` +
        'D\\d\\d-n shape is not a decision: syntax validity is not decision existence. Mentions in\n' +
        '  research ledgers, historical prose, changelogs or other documents never define anything.\n' +
        '  Fix by citing an existing decision, or land the missing decision row in the governing\n' +
        "  docs first ('doc-first'). This is never downgraded to UNCLASSIFIED.\n",
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

function parseArgv(argv) {
  const opts = { mode: 'guard', governanceRepo: GOVERNANCE_REPO_DEFAULT, governanceRef: GOVERNANCE_REF_DEFAULT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--audit') opts.mode = 'audit';
    else if (a === '--self-test') opts.mode = 'self-test';
    else if (a === '--governance-repo') opts.governanceRepo = argv[++i];
    else if (a === '--governance-ref') opts.governanceRef = argv[++i];
    else {
      console.error(`Unknown argument: ${a}`);
      console.error('Usage: node scripts/check-doc-provenance.mjs [--audit|--self-test] [--governance-repo <path>] [--governance-ref <ref>]');
      process.exit(2);
    }
  }
  return opts;
}

const opts = parseArgv(process.argv.slice(2));
if (opts.mode === 'self-test') selfTest();
else if (opts.mode === 'audit') audit(opts);
else guard(opts);
