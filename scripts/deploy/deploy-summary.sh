#!/usr/bin/env bash
#
# Renders the production deploy summary from the state GitHub Actions actually has.
# Piped by deploy.yml ("Deploy summary" step) into $GITHUB_STEP_SUMMARY.
#
# REPORTING ONLY: this script reads environment variables and prints text. It performs
# no network, SSH, or GitHub API calls and takes no part in any deployment decision.
# Its one rule: report only what the recorded outcomes can prove — an output of a step
# that never ran is indistinguishable from one that was never written, so absence of
# evidence must never be classified as an event.
#
# Inputs (all optional; absent means "that phase never produced a signal"):
#   TRIGGER          preflight's event name
#   SHA              github.sha of the run
#   RELEASE_ID       computed release id (<UTC-ts>-<short-sha>); presence does NOT
#                    imply anything reached the server
#   GATE_OUTCOME     outcome of the exact-SHA re-check step ("gate")
#   PROCEED          gate output: 'true' | 'false' | '' when the gate never wrote it
#   SHIP_OUTCOME     outcome of the tarball upload step ("ship")
#   CUTOVER_OUTCOME  outcome of the remote cutover step
#   PRUNE_INCOMPLETE / PRUNE_DIRS  cleanup report from the remote script
#
# Classification contract (mirrored 1:1 by deploy-summary.spec.ts):
#   released            gate ok + proceed=true + ship ok + cutover ok
#   superseded          ONLY gate ok + proceed=false (+ ship/cutover skipped) — the one
#                       state where a moved main tip is actually proven
#   failed pre-decision gate did not succeed (never ran, or its own lookup failed)
#   shipping failure    gate ok + proceed=true + ship failed, before any remote cutover
#   remote failure      gate ok + proceed=true + ship ok + cutover failed — the workflow
#                       cannot know which phase failed or whether rollback ran, so no
#                       rollback claim is made here
#   anything else       FAILED / unexpected — fail truthful, not optimistic
set -euo pipefail

TRIGGER="${TRIGGER:-}"
SHA="${SHA:-}"
RELEASE_ID="${RELEASE_ID:-}"
GATE_OUTCOME="${GATE_OUTCOME:-}"
PROCEED="${PROCEED:-}"
SHIP_OUTCOME="${SHIP_OUTCOME:-}"
CUTOVER_OUTCOME="${CUTOVER_OUTCOME:-}"
PRUNE_INCOMPLETE="${PRUNE_INCOMPLETE:-}"
PRUNE_DIRS="${PRUNE_DIRS:-}"

{
  echo "### Deploy result"
  echo "- trigger: \`${TRIGGER}\`"
  echo "- target SHA: \`${SHA}\`"
  echo "- release id: \`${RELEASE_ID:-<none>}\`"

  if [ "$GATE_OUTCOME" = "success" ] && [ "$PROCEED" = "true" ] \
     && [ "$SHIP_OUTCOME" = "success" ] && [ "$CUTOVER_OUTCOME" = "success" ]; then
    echo "- result: **released** (post-cutover verification passed: liveness + readiness + DB-backed smoke all passed)"
  elif [ "$GATE_OUTCOME" = "success" ] && [ "$PROCEED" = "false" ] \
       && [ "$SHIP_OUTCOME" = "skipped" ] && [ "$CUTOVER_OUTCOME" = "skipped" ]; then
    echo "- result: **superseded** (main moved after this run started; no server mutation)"
  elif [ -n "$GATE_OUTCOME" ] && [ "$GATE_OUTCOME" != "success" ] \
       && [ "$SHIP_OUTCOME" = "skipped" ] && [ "$CUTOVER_OUTCOME" = "skipped" ]; then
    echo "- result: **FAILED** before the exact-SHA supersession decision completed (gate outcome: \`${GATE_OUTCOME}\`); no server mutation"
  elif [ "$GATE_OUTCOME" = "success" ] && [ "$PROCEED" = "true" ] \
       && [ "$SHIP_OUTCOME" = "failure" ] && [ "$CUTOVER_OUTCOME" = "skipped" ]; then
    echo "- result: **FAILED** while shipping the release tarball, before remote cutover started"
  elif [ "$GATE_OUTCOME" = "success" ] && [ "$PROCEED" = "true" ] \
       && [ "$SHIP_OUTCOME" = "success" ] && [ "$CUTOVER_OUTCOME" = "failure" ]; then
    echo "- result: **FAILED** during remote cutover / migration / verification; inspect the cutover logs for the exact phase and rollback outcome"
  else
    echo "- result: **FAILED** — unexpected deployment state (gate: \`${GATE_OUTCOME:-<unset>}\`, proceed: \`${PROCEED:-<unset>}\`, ship: \`${SHIP_OUTCOME:-<unset>}\`, cutover: \`${CUTOVER_OUTCOME:-<unset>}\`)"
  fi

  # Cleanup is reported separately from the release result, so an unremovable legacy
  # directory can never be mistaken for a failed deployment — or hidden. No line at all
  # means the cutover step never ran far enough to report pruning either way.
  if [ "$PRUNE_INCOMPLETE" = "true" ]; then
    echo "- cleanup: ⚠️ **pruning incomplete** — could not remove:\`${PRUNE_DIRS:-unknown}\` (release itself is healthy)"
  elif [ "$PRUNE_INCOMPLETE" = "false" ]; then
    echo "- cleanup: old releases pruned"
  fi
}
