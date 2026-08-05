// Plan shape for the canonical content synchronization (doc 09 §6.2, D09-21).
//
// One plan type is produced by the dry-run and consumed by apply — the SAME object from the SAME
// builder. A dry-run computed by a different code path would prove nothing about what apply does,
// which is the whole reason the pair is trustworthy.
import type { GovernedModel } from './allowlist';

/**
 * `hide` is distinct from `delete` on purpose. A skill leaving the public taxonomy is set
 * `isPublic: false` and keeps its id and every project/experience relation (doc 09 §6.4). Reporting
 * that as a deletion would overstate what happened, and the report is the review surface.
 */
export type RecordAction =
  'create' | 'update' | 'delete' | 'hide' | 'unchanged';

export interface FieldChange {
  readonly field: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface RecordChange {
  readonly model: GovernedModel;
  readonly action: RecordAction;
  /** Stable natural key — what makes this row THIS row across databases. */
  readonly naturalKey: string;
  /** Existing row id. Absent for `create`; present otherwise, and preserved by design. */
  readonly id?: string;
  /** Human-readable identity for the report (e.g. the English title). */
  readonly label?: string;
  /** Governed scalar before/after pairs. Empty for `unchanged`. */
  readonly fields: readonly FieldChange[];
}

export interface RelationChange {
  readonly model: GovernedModel;
  /** Natural key of the owning record. */
  readonly owner: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/**
 * A deletion the synchronization does not issue itself but which the database performs as a
 * consequence of a governed delete. Disclosed because an undisclosed cascade is an undisclosed
 * deletion — see `CASCADE_ONLY_MODELS`.
 */
export interface CascadeDisclosure {
  readonly model: GovernedModel;
  readonly owner: string;
  readonly count: number;
  readonly detail: readonly string[];
}

export interface Plan {
  /** Records in deterministic order: by model, then by natural key. */
  readonly records: readonly RecordChange[];
  readonly relations: readonly RelationChange[];
  readonly cascades: readonly CascadeDisclosure[];
  /**
   * Pre-run counts for every protected model. Apply re-reads them afterwards and fails the run if
   * any moved — the protection is verified, not asserted.
   */
  readonly protectedCounts: Readonly<Record<string, number>>;
  /**
   * Ambiguities and policy violations. A non-empty list means the plan MUST NOT be applied. Apply
   * refuses before its first write; the dry-run prints them and exits non-zero.
   */
  readonly problems: readonly string[];
}

export interface PlanSummary {
  readonly creates: number;
  readonly updates: number;
  readonly deletes: number;
  readonly hides: number;
  readonly unchanged: number;
  readonly relationAdditions: number;
  readonly relationRemovals: number;
  readonly affectedModels: readonly string[];
}

export function summarize(plan: Plan): PlanSummary {
  const byAction = (action: RecordAction): number =>
    plan.records.filter((record) => record.action === action).length;

  const affected = new Set<string>();
  for (const record of plan.records) {
    if (record.action !== 'unchanged') affected.add(record.model);
  }
  for (const relation of plan.relations) {
    if (relation.added.length || relation.removed.length)
      affected.add(relation.model);
  }
  for (const cascade of plan.cascades) affected.add(cascade.model);

  return {
    creates: byAction('create'),
    updates: byAction('update'),
    deletes: byAction('delete'),
    hides: byAction('hide'),
    unchanged: byAction('unchanged'),
    relationAdditions: plan.relations.reduce(
      (total, relation) => total + relation.added.length,
      0,
    ),
    relationRemovals: plan.relations.reduce(
      (total, relation) => total + relation.removed.length,
      0,
    ),
    affectedModels: [...affected].sort(),
  };
}

/** True when the plan would change nothing — the property the second run must satisfy. */
export function isNoOp(plan: Plan): boolean {
  const summary = summarize(plan);
  return (
    summary.creates === 0 &&
    summary.updates === 0 &&
    summary.deletes === 0 &&
    summary.hides === 0 &&
    summary.relationAdditions === 0 &&
    summary.relationRemovals === 0
  );
}
