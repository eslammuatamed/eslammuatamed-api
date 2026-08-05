// Plan rendering for the canonical content synchronization (doc 09 §6.2, D09-21).
//
// The report is the review surface: it is what a human reads before authorizing a run that deletes
// rows in production, and what gets attached to the release record. Two properties matter more than
// prettiness — it is DETERMINISTIC (the builder already sorts; nothing here reorders), and it never
// overstates what will happen (a `hide` is printed as a hide, a cascade as a cascade).
import type { Plan } from './types';
import { summarize } from './types';

const MAX_VALUE = 120;

/**
 * Secrets never legitimately appear in governed portfolio content, but the report prints stored
 * values verbatim, so a redaction pass is cheap insurance against one leaking into a release record
 * or a CI log if a field is ever mis-classified as governed.
 */
const SECRET_PATTERN =
  /(password|secret|token|apikey|api_key|authorization|passwordhash|bearer)/i;

export function renderValue(field: string, value: unknown): string {
  if (SECRET_PATTERN.test(field)) return '«redacted»';
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (value instanceof Date) return value.toISOString();
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const oneLine = text.replace(/\n/g, '\\n');
  return oneLine.length > MAX_VALUE
    ? `${oneLine.slice(0, MAX_VALUE)}… (${oneLine.length} chars)`
    : oneLine;
}

const ICON: Readonly<Record<string, string>> = {
  create: '+',
  update: '~',
  delete: '-',
  hide: 'h',
  unchanged: '=',
};

export function renderPlan(
  plan: Plan,
  options?: { verbose?: boolean },
): string {
  const summary = summarize(plan);
  const lines: string[] = [];

  lines.push('Canonical content synchronization — PLAN');
  lines.push('='.repeat(72));
  lines.push('');
  lines.push(
    `creates ${summary.creates} · updates ${summary.updates} · deletes ${summary.deletes} · ` +
      `hides ${summary.hides} · unchanged ${summary.unchanged}`,
  );
  lines.push(
    `relation additions ${summary.relationAdditions} · relation removals ${summary.relationRemovals}`,
  );
  lines.push(
    `affected models: ${summary.affectedModels.length ? summary.affectedModels.join(', ') : '(none)'}`,
  );
  lines.push('');

  const acting = plan.records.filter((record) => record.action !== 'unchanged');
  if (acting.length) {
    lines.push('CHANGES');
    lines.push('-'.repeat(72));
    for (const record of acting) {
      lines.push(
        `${ICON[record.action] ?? '?'} ${record.model}  ${record.naturalKey}` +
          `${record.label && record.label !== record.naturalKey ? `  — ${record.label}` : ''}` +
          `${record.id ? `  [id ${record.id}]` : ''}`,
      );
      for (const field of record.fields)
        lines.push(
          `      ${field.field}: ${renderValue(field.field, field.before)} → ` +
            `${renderValue(field.field, field.after)}`,
        );
    }
    lines.push('');
  }

  if (plan.relations.length) {
    lines.push('RELATIONS');
    lines.push('-'.repeat(72));
    for (const relation of plan.relations) {
      lines.push(`  ${relation.model}  ${relation.owner}`);
      if (relation.added.length)
        lines.push(`      + ${relation.added.join(', ')}`);
      if (relation.removed.length)
        lines.push(`      - ${relation.removed.join(', ')}`);
    }
    lines.push('');
  }

  if (plan.cascades.length) {
    lines.push(
      'CASCADES (consequences of a governed delete — disclosed, not issued directly)',
    );
    lines.push('-'.repeat(72));
    for (const cascade of plan.cascades)
      lines.push(
        `  ${cascade.model} ×${cascade.count} via ${cascade.owner}` +
          `  [${cascade.detail.join(', ')}]`,
      );
    lines.push(
      '  The referenced MediaAsset rows are NOT deleted — only the governed relation goes.',
    );
    lines.push('');
  }

  lines.push(
    'PROTECTED (never written; counted before and re-verified after apply)',
  );
  lines.push('-'.repeat(72));
  for (const [model, count] of Object.entries(plan.protectedCounts).sort(
    ([a], [b]) => a.localeCompare(b),
  ))
    lines.push(`  ${model.padEnd(24)} ${count}`);
  lines.push('');

  if (options?.verbose) {
    const unchanged = plan.records.filter(
      (record) => record.action === 'unchanged',
    );
    lines.push(`UNCHANGED (${unchanged.length})`);
    lines.push('-'.repeat(72));
    for (const record of unchanged)
      lines.push(`  = ${record.model}  ${record.naturalKey}`);
    lines.push('');
  }

  if (plan.problems.length) {
    lines.push('PROBLEMS — THIS PLAN CANNOT BE APPLIED');
    lines.push('-'.repeat(72));
    for (const problem of plan.problems) lines.push(`  ✗ ${problem}`);
    lines.push('');
  } else if (
    summary.creates ||
    summary.updates ||
    summary.deletes ||
    summary.hides ||
    summary.relationAdditions ||
    summary.relationRemovals
  ) {
    lines.push(
      'Plan is applicable. Run `npm run content:sync:apply` to apply it.',
    );
  } else {
    lines.push(
      'No changes — the database already matches the canonical dataset.',
    );
  }

  return lines.join('\n');
}

/** Machine-readable form for attaching to a release record or diffing between runs. */
export function renderPlanJson(plan: Plan): string {
  return JSON.stringify(
    {
      summary: summarize(plan),
      records: plan.records.map((record) => ({
        ...record,
        fields: record.fields.map((field) => ({
          field: field.field,
          before: SECRET_PATTERN.test(field.field)
            ? '«redacted»'
            : field.before,
          after: SECRET_PATTERN.test(field.field) ? '«redacted»' : field.after,
        })),
      })),
      relations: plan.relations,
      cascades: plan.cascades,
      protectedCounts: plan.protectedCounts,
      problems: plan.problems,
    },
    null,
    2,
  );
}
