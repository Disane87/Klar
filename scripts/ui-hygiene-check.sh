#!/usr/bin/env bash
# UI hygiene gate — fails CI when forbidden UI patterns appear.
# Mirrors the CLAUDE.md "harte Regeln" + Spartan-coverage plan §6.
#
# Allowlist:
#   apps/web/src/app/shared/ui/  (the wrappers themselves use the primitives)
#   apps/web/src/main.ts          (bootstrap fallback console.error)
#
# Run locally: bash scripts/ui-hygiene-check.sh

set -euo pipefail

WEB_SRC="apps/web/src/app"
EXCLUDE_DIR="$WEB_SRC/shared/ui"
fail=0

scan() {
  local label="$1"
  local pattern="$2"
  local extra_allow="${3:-}"
  local matches
  matches=$(grep -RInE "$pattern" "$WEB_SRC" \
    --include='*.ts' --include='*.html' 2>/dev/null \
    | grep -v "^$EXCLUDE_DIR" || true)
  if [ -n "$extra_allow" ] && [ -n "$matches" ]; then
    matches=$(echo "$matches" | grep -Ev "$extra_allow" || true)
  fi
  if [ -n "$matches" ]; then
    echo "::error title=UI hygiene failed::${label}"
    echo "$matches"
    echo
    fail=1
  fi
}

# 1. Browser-native dialogs (alert/prompt/confirm CALLS — not method definitions).
#    The pattern requires ( immediately after; method definitions look like
#    `confirm(): void {` which won't match `confirm\s*\(\s*['"\`]` etc.
scan "window.alert/prompt/confirm calls forbidden — use klar-toast / klar-confirm.service" \
  "(^|[^.a-zA-Z_\$])(window\.)?(alert|prompt|confirm)[[:space:]]*\\(['\"\`]"

# 2. Native form controls without hlm wrapper. Avoids false positives for
#    controls inside the wrappers themselves (excluded by EXCLUDE_DIR).
scan "Native <input> without hlmInput / klar-input / klar-money-input / klar-date-input" \
  "<input[[:space:]]+(?!.*(hlmInput|hlmCheckbox|type=\"file\"|type=\"hidden\"|type=\"checkbox\"|type=\"radio\"))" \
  "klar-input|klar-money-input|klar-date-input|klar-color-picker|klar-icon-picker"

scan "Native <select> forbidden — use <klar-select> (Spartan-backed)" \
  "<select[[:space:]>]"

scan "Native <textarea> without hlmInput" \
  "<textarea[[:space:]](?!.*hlmInput)"

# 3. Console logging in app code (allowed only in main.ts bootstrap fallback).
scan "console.log/warn/error/info/debug forbidden in app code (use Angular Logger)" \
  "(^|[^.a-zA-Z_\$])console\\.(log|warn|error|info|debug)\\(" \
  "main\\.ts"

# 4. localStorage outside the documented whitelist (theme, version-seen, install-prompt).
scan "localStorage outside whitelist (theme/version/install-prompt) forbidden" \
  "(^|[^.a-zA-Z_\$])localStorage\\." \
  "theme\\.service|version\\.service"

if [ "$fail" -ne 0 ]; then
  echo
  echo "UI hygiene gate failed. See https://github.com/Disane87/Klar/blob/main/docs/PLAN-SPARTAN-COVERAGE.md"
  exit 1
fi

echo "UI hygiene OK"
