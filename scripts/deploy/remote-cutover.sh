#!/usr/bin/env bash
#
# Remote half of the production cutover. Piped to the server by deploy.yml
# (`ssh … bash -s -- "$RELEASE" < scripts/deploy/remote-cutover.sh`) and executed as the
# `deploy` user, whose sudo rights are scoped to `systemctl restart` of the two app units.
#
# It lives in the repository rather than inline in the workflow so the cutover logic is
# reviewable and testable: `remote-cutover.spec.ts` runs this exact file against stubbed
# `curl`/`sudo`/`npx`/`tar` binaries and a temporary release tree.
#
# WHY THE VERIFICATION IS WHAT IT IS (2026-08-14 incident):
# the gate used to be a single `curl /api/v1/health`. That endpoint is LIVENESS — it never
# touches PostgreSQL. Release `d2f516c` booted with no usable database connection, passed
# that gate, and was cut over; because the automatic rollback hangs off the same gate, the
# rollback never armed either. A liveness probe cannot gate a database-backed application,
# and a gate that cannot fail cannot roll back. Verification is therefore liveness AND
# readiness AND real DB-backed endpoints, and the SAME verification is re-run after a
# rollback so "rolled back successfully" means genuinely healthy, not merely listening.
set -euo pipefail

RELEASE="${1:?release id is required}"

# Overridable only so the spec can drive the script against a temporary tree and a stub
# server. Production passes nothing and gets these values.
BASE="${DEPLOY_BASE:-/srv/eslammuatamed-api}"
API_BASE="${API_BASE_URL:-http://127.0.0.1:3001/api/v1}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

REL_DIR="$BASE/releases/$RELEASE"
TARBALL="${TARBALL_PATH:-/tmp/eslammuatamed-api-${RELEASE}.tar.gz}"

PREV="$(readlink -f "$BASE/current" 2>/dev/null || true)"

# --- verification -------------------------------------------------------------------

# One probe. Bodies go to /dev/null: responses are never echoed into the job log, so no
# configuration value can leak through verification output.
probe() {
  local name="$1" url="$2"
  if curl --fail --silent --show-error --output /dev/null \
       --retry 5 --retry-delay 3 --retry-connrefused --max-time 10 "$url"; then
    echo "  [ok]   $name"
    return 0
  fi
  echo "  [FAIL] $name" >&2
  return 1
}

# A release is healthy only when it is live, DB-ready, AND actually serving data.
# `/health` alone is the 2026-08-14 failure mode; `/health/ready` executes a query and
# answers 503 when the database is unreachable; the two smoke endpoints prove the ORM
# path end to end, which is where a driver/auth regression actually surfaces.
verify_app() {
  local label="$1" failed=0
  echo "Verifying $label:"
  probe "liveness  /health"           "$API_BASE/health"                 || failed=1
  probe "readiness /health/ready"     "$API_BASE/health/ready"           || failed=1
  probe "smoke     /settings/site"    "$API_BASE/settings/site?locale=en" || failed=1
  probe "smoke     /projects"         "$API_BASE/projects?locale=en"      || failed=1
  return "$failed"
}

# --- cleanup ------------------------------------------------------------------------

# Best-effort pruning of superseded releases. This is CLEANUP, not part of the deployment
# result: it runs strictly after the cutover has been verified healthy, so by the time it
# can fail the release is already serving correctly.
#
# The 2026-08-14 deploy exited 123 here. The oldest release was created by an early manual
# deploy and its 14,354 files are owned by `ubuntu:ubuntu` under a `root:root` directory;
# `deploy` cannot write inside it, and its sudo grant covers only `systemctl restart`, so
# it can never remove that tree. That is a permanent condition — every future deploy would
# have failed the same way, reporting a red deployment for an untouchable legacy directory.
#
# So: failures are collected and reported on a machine-readable line for the workflow to
# surface as a warning. They are NOT swallowed — an unremovable directory is named every
# time — and they no longer misreport a healthy cutover as a failed one.
prune_old_releases() {
  local failed="" d resolved current_target
  cd "$BASE/releases" 2>/dev/null || return 0
  current_target="$(readlink -f "$BASE/current" 2>/dev/null || true)"

  while IFS= read -r d; do
    [ -n "$d" ] || continue
    d="${d%/}"
    # Never prune the live release, whatever the mtime ordering claims.
    resolved="$(readlink -f "$d" 2>/dev/null || true)"
    if [ -n "$current_target" ] && [ "$resolved" = "$current_target" ]; then
      continue
    fi
    if rm -rf -- "$d" 2>/dev/null && [ ! -e "$d" ]; then
      echo "  pruned $d"
    else
      failed="$failed $d"
    fi
  done < <(ls -1dt -- */ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))")

  if [ -n "$failed" ]; then
    printf 'PRUNE_INCOMPLETE:%s\n' "$failed"
  fi
}

# --- cutover ------------------------------------------------------------------------

# 1. Extract the release (self-contained; carries no secrets).
mkdir -p "$REL_DIR"
tar -xzf "$TARBALL" -C "$REL_DIR"
rm -f "$TARBALL"

# 2. Pre-deploy migration (fix-forward only — doc 09 §6).
set -a
# shellcheck disable=SC1091
. "$BASE/shared/.env"
set +a
( cd "$REL_DIR" && npx prisma migrate deploy )

# 3. Atomic cut over.
ln -sfn "$REL_DIR" "$BASE/current.new"
mv -Tf "$BASE/current.new" "$BASE/current"

# 4. Restart via the scoped sudoers rule.
sudo systemctl restart eslammuatamed-api

# 5. Health gate with AUTOMATIC application rollback.
if verify_app "release $RELEASE"; then
  echo "Post-cutover verification passed for release $RELEASE."
else
  echo "Post-cutover verification FAILED for $RELEASE — rolling the application back." >&2
  if [ -n "$PREV" ] && [ -d "$PREV" ] && [ "$PREV" != "$REL_DIR" ]; then
    ln -sfn "$PREV" "$BASE/current.new"
    mv -Tf "$BASE/current.new" "$BASE/current"
    sudo systemctl restart eslammuatamed-api
    # The rollback target gets the SAME full verification. A rollback that only proved
    # liveness would repeat the very mistake that caused the incident.
    if verify_app "rollback target $PREV"; then
      echo "Rolled back to previous release ($PREV); full verification passed." >&2
    else
      echo "Rolled back to $PREV but verification STILL FAILING — MANUAL INTERVENTION REQUIRED." >&2
    fi
  else
    echo "No previous healthy release to roll back to — MANUAL INTERVENTION REQUIRED." >&2
  fi
  exit 1
fi

# 6. Keep the last N releases. Never fatal — see prune_old_releases.
prune_old_releases
