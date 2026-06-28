#!/usr/bin/env sh
set -eu

if ! command -v node >/dev/null 2>&1; then
  pnpm_path="$(command -v pnpm || true)"
  deps_dir="${pnpm_path%/bin/pnpm}"
  bundled_node="$deps_dir/node/bin"

  if [ -x "$bundled_node/node" ]; then
    PATH="$bundled_node:$PATH"
    export PATH
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js is required. Install Node or run through the bundled Codex pnpm runtime." >&2
  exit 127
fi

exec "$@"
