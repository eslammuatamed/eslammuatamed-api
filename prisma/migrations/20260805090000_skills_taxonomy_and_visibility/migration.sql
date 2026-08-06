-- Public skills taxonomy + visibility.
--
-- The approved taxonomy (Docs `content/positioning-strategy.md` §5) is
-- Languages / Frontend Engineering / Backend Engineering / Delivery & Quality. The first slot
-- already carried Languages; the other three are renamed in place.
--
-- RENAME VALUE, not DROP/CREATE: it preserves every existing row AND the enum's declaration
-- order. That order is load-bearing — `SkillsService.compareSkills` ranks groups by
-- `Object.values(SkillGroup).indexOf(...)`, so recreating the type would silently reorder the
-- public skills response and the résumé's group sequence.
--
-- Row-level group assignment is NOT done here. Skill content is governed by the idempotent
-- content seed (doc 09 §6), which reconciles group, order, labels and visibility for the
-- records it owns; this migration only moves the structure underneath it.
ALTER TYPE "SkillGroup" RENAME VALUE 'FRAMEWORK' TO 'FRONTEND';
ALTER TYPE "SkillGroup" RENAME VALUE 'TOOLING' TO 'BACKEND';
ALTER TYPE "SkillGroup" RENAME VALUE 'PRACTICE' TO 'DELIVERY';

-- Visibility, not deletion. A skill removed from the public taxonomy may still be referenced by
-- a project or an experience, so it is hidden instead of deleted and every relation survives.
-- Existing rows default to visible; the content seed hides the ones the taxonomy excludes.
ALTER TABLE "skills" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT true;
