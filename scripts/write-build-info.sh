#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="${project_root}/app/generated-build-info.ts"

commit="${APP_COMMIT_SHA:-}"
if [[ -z "${commit}" ]]; then
  commit="$(git -C "${project_root}" rev-parse HEAD 2>/dev/null || echo unknown)"
fi

built_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cat > "${output}" <<EOF
export const buildInfo = {
  commit: "${commit}",
  builtAt: "${built_at}",
} as const;
EOF

echo "Wrote build info for ${commit}."
