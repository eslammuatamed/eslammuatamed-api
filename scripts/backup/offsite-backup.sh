#!/usr/bin/env bash
# Copies one verified *existing* PostgreSQL backup to private object storage.
#
# This program is intentionally not an application deploy helper.  It never runs pg_dump,
# changes PostgreSQL, deletes any local/remote object, or restarts a service.  Phase B installs
# it behind a dedicated forced SSH command; Phase A keeps it as versioned source only.
set -euo pipefail

umask 077

readonly ENV_FILE="${OFFSITE_BACKUP_ENV_FILE:-/srv/backups/offsite/offsite.env}"
readonly SOURCE_DIRECTORY="${OFFSITE_BACKUP_SOURCE_DIR:-/srv/backups/postgres}"
readonly LOCK_FILE="${OFFSITE_BACKUP_LOCK_FILE:-/srv/backups/offsite/offsite.lock}"
readonly RCLONE_BIN="${OFFSITE_BACKUP_RCLONE_BIN:-/usr/local/bin/rclone}"
readonly EXPECTED_RCLONE_VERSION="${OFFSITE_BACKUP_RCLONE_VERSION:-1.75.0}"
readonly MINIMUM_AGE_SECONDS="${OFFSITE_BACKUP_MINIMUM_AGE_SECONDS:-1800}"
readonly MAXIMUM_AGE_SECONDS="${OFFSITE_BACKUP_MAXIMUM_AGE_SECONDS:-86400}"

RCLONE_CONFIG_FILE=""
RCLONE_ROOT=""
TEMPORARY_MANIFEST=""

fail() {
  printf 'offsite-backup: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$TEMPORARY_MANIFEST" && -e "$TEMPORARY_MANIFEST" ]]; then
    rm -f -- "$TEMPORARY_MANIFEST"
  fi
}
trap cleanup EXIT

require_regular_file() {
  local file="$1"
  [[ -f "$file" && -r "$file" ]] || fail "required readable file is missing: $file"
}

load_runtime_contract() {
  require_regular_file "$ENV_FILE"

  # This is a deliberately tiny key/value parser rather than `source`: the server-only
  # configuration is data, not executable shell.  The rclone config itself contains the
  # bucket-scoped R2 credentials and is never printed or read by GitHub.
  local key value
  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    case "$key" in
      OFFSITE_RCLONE_CONFIG)
        [[ -z "$RCLONE_CONFIG_FILE" ]] || fail 'duplicate OFFSITE_RCLONE_CONFIG'
        RCLONE_CONFIG_FILE="$value"
        ;;
      OFFSITE_RCLONE_ROOT)
        [[ -z "$RCLONE_ROOT" ]] || fail 'duplicate OFFSITE_RCLONE_ROOT'
        RCLONE_ROOT="$value"
        ;;
      *) fail "unsupported runtime-contract key: $key" ;;
    esac
  done < "$ENV_FILE"

  [[ -n "$RCLONE_CONFIG_FILE" ]] || fail 'OFFSITE_RCLONE_CONFIG is required'
  [[ -n "$RCLONE_ROOT" ]] || fail 'OFFSITE_RCLONE_ROOT is required'
  require_regular_file "$RCLONE_CONFIG_FILE"
  [[ "$RCLONE_ROOT" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*:[^[:space:]]+$ ]] || \
    fail 'OFFSITE_RCLONE_ROOT must be a rclone remote plus private bucket path'
}

require_rclone() {
  [[ -x "$RCLONE_BIN" ]] || fail "rclone executable is missing: $RCLONE_BIN"
  local reported_version
  reported_version="$($RCLONE_BIN version | sed -n 's/^rclone v\([^[:space:]]*\).*/\1/p' | head -n 1)"
  [[ "$reported_version" == "$EXPECTED_RCLONE_VERSION" ]] || \
    fail "rclone version must be $EXPECTED_RCLONE_VERSION (found ${reported_version:-unknown})"
}

remote_path() {
  printf '%s/%s' "$RCLONE_ROOT" "$1"
}

remote_has_file() {
  local key="$1"
  local listing
  listing="$($RCLONE_BIN --config "$RCLONE_CONFIG_FILE" lsf "$RCLONE_ROOT" \
    --files-only --format p --include "$key")"
  [[ -n "$listing" ]]
}

remote_sha256() {
  local key="$1"
  "$RCLONE_BIN" --config "$RCLONE_CONFIG_FILE" cat "$(remote_path "$key")" | sha256sum | awk '{print $1}'
}

select_candidate() {
  local now candidate filename mtime age newest_mtime=-1 newest=''
  now="$(date -u +%s)"
  shopt -s nullglob
  for candidate in "$SOURCE_DIRECTORY"/eslammuatamed_prod-*.sql.gz; do
    [[ -f "$candidate" ]] || continue
    filename="$(basename "$candidate")"
    [[ "$filename" =~ ^eslammuatamed_prod-[0-9]{8}T[0-9]{6}Z\.sql\.gz$ ]] || continue
    mtime="$(stat -c %Y -- "$candidate")"
    age=$((now - mtime))
    (( age >= MINIMUM_AGE_SECONDS && age <= MAXIMUM_AGE_SECONDS )) || continue
    if (( mtime > newest_mtime )); then
      newest_mtime="$mtime"
      newest="$candidate"
    fi
  done
  shopt -u nullglob
  [[ -n "$newest" ]] || fail 'no eligible recent completed backup exists'
  printf '%s\n' "$newest"
}

manifest_matches() {
  local key="$1" filename="$2" size="$3" sha256="$4" manifest
  manifest="$("$RCLONE_BIN" --config "$RCLONE_CONFIG_FILE" cat "$(remote_path "$key")")" || return 1
  local expected_lines=5 actual_lines
  actual_lines="$(printf '%s\n' "$manifest" | wc -l | tr -d ' ')"
  [[ "$actual_lines" == "$expected_lines" ]] || return 1
  grep -Fqx 'version=1' <<< "$manifest" &&
    grep -Fqx "source_filename=$filename" <<< "$manifest" &&
    grep -Fqx "size_bytes=$size" <<< "$manifest" &&
    grep -Fqx "sha256=$sha256" <<< "$manifest" &&
    grep -Eq '^completed_at_utc=[0-9]{8}T[0-9]{6}Z$' <<< "$manifest"
}

write_manifest() {
  local key="$1" filename="$2" size="$3" sha256="$4"
  TEMPORARY_MANIFEST="$(mktemp)"
  printf 'version=1\nsource_filename=%s\nsize_bytes=%s\nsha256=%s\ncompleted_at_utc=%s\n' \
    "$filename" "$size" "$sha256" "$(date -u +%Y%m%dT%H%M%SZ)" > "$TEMPORARY_MANIFEST"
  "$RCLONE_BIN" --config "$RCLONE_CONFIG_FILE" copyto "$TEMPORARY_MANIFEST" "$(remote_path "$key")"
  rm -f -- "$TEMPORARY_MANIFEST"
  TEMPORARY_MANIFEST=""
}

main() {
  (( MINIMUM_AGE_SECONDS >= 0 && MAXIMUM_AGE_SECONDS >= MINIMUM_AGE_SECONDS )) || \
    fail 'invalid candidate age window'
  load_runtime_contract
  require_rclone

  mkdir -p -- "$(dirname "$LOCK_FILE")"
  exec {lock_fd}>"$LOCK_FILE"
  flock -n "$lock_fd" || fail 'another offsite backup invocation holds the lock'

  local candidate filename mtime age size sha256 timestamp hash_suffix data_key manifest_key remote_sha
  candidate="$(select_candidate)"
  filename="$(basename "$candidate")"
  mtime="$(stat -c %Y -- "$candidate")"
  age=$(( $(date -u +%s) - mtime ))
  gzip -t -- "$candidate" || fail "gzip integrity check failed: $filename"
  size="$(stat -c %s -- "$candidate")"
  sha256="$(sha256sum -- "$candidate" | awk '{print $1}')"
  [[ "$sha256" =~ ^[a-f0-9]{64}$ ]] || fail 'could not calculate a SHA-256 checksum'
  timestamp="$(date -u -d "@$mtime" +%Y%m%dT%H%M%SZ)"
  hash_suffix="${sha256:0:12}"
  data_key="postgres/eslammuatamed_prod-${timestamp}-${hash_suffix}.sql.gz"
  manifest_key="${data_key}.manifest"

  printf 'offsite-backup: candidate=%s age_seconds=%s size_bytes=%s key=%s phase=preflight\n' \
    "$filename" "$age" "$size" "$data_key"

  if remote_has_file "$data_key"; then
    if remote_has_file "$manifest_key"; then
      manifest_matches "$manifest_key" "$filename" "$size" "$sha256" || \
        fail 'existing completion manifest conflicts with local backup metadata'
      remote_sha="$(remote_sha256 "$data_key")"
      [[ "$remote_sha" == "$sha256" ]] || fail 'existing remote backup SHA-256 does not match local backup'
      printf 'offsite-backup: key=%s phase=idempotent-complete\n' "$data_key"
      return 0
    fi

    remote_sha="$(remote_sha256 "$data_key")"
    [[ "$remote_sha" == "$sha256" ]] || fail 'existing unmanifested remote backup SHA-256 conflicts with local backup'
    write_manifest "$manifest_key" "$filename" "$size" "$sha256"
    manifest_matches "$manifest_key" "$filename" "$size" "$sha256" || \
      fail 'completion manifest verification failed'
    printf 'offsite-backup: key=%s phase=manifest-recovered\n' "$data_key"
    return 0
  fi

  if remote_has_file "$manifest_key"; then
    fail 'completion manifest exists without its data object'
  fi

  "$RCLONE_BIN" --config "$RCLONE_CONFIG_FILE" copyto --ignore-existing "$candidate" "$(remote_path "$data_key")"
  remote_sha="$(remote_sha256 "$data_key")"
  [[ "$remote_sha" == "$sha256" ]] || fail 'remote backup SHA-256 does not match local backup'
  write_manifest "$manifest_key" "$filename" "$size" "$sha256"
  manifest_matches "$manifest_key" "$filename" "$size" "$sha256" || fail 'completion manifest verification failed'
  printf 'offsite-backup: key=%s phase=complete\n' "$data_key"
}

main "$@"
