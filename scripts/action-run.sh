# Sourced by action.yml. Runs orm-preflight with the action's inputs, which arrive as
# environment variables and are only ever passed as separate arguments, never evaluated.

orm_preflight() {
  local args=()
  if [ -n "${CHANGED_SINCE:-}" ]; then args+=(--changed-since "$CHANGED_SINCE"); fi
  if [ -n "${CONFIG:-}" ]; then args+=(--config "$CONFIG"); fi
  args+=("$@")
  if [ -n "${FILES:-}" ]; then
    # Split on whitespace only; globs are expanded by orm-preflight, not by the shell.
    local files
    read -r -a files <<< "$FILES"
    args+=(-- "${files[@]}")
  fi

  if [ "$VERSION" = local ]; then
    node "$ACTION_PATH/dist/cli.mjs" "${args[@]}"
    return
  fi
  # Installed with npm, not run with npx: npx skips node-sql-parser, an optional peer of
  # orm-preflight, even when it is asked for with --package. The action calls this function
  # up to twice, so the second call reuses the first install.
  local packages=("orm-preflight@$VERSION")
  if [ "${MYSQL:-false}" = true ]; then packages+=(node-sql-parser@5.4.0); fi
  local dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/orm-preflight-${VERSION}-${MYSQL:-false}"
  if [ ! -f "$dir/node_modules/orm-preflight/dist/cli.mjs" ]; then
    # Install output goes to stderr, so stdout carries only orm-preflight's output (SARIF).
    npm install --prefix "$dir" --no-save --no-audit --no-fund --ignore-scripts "${packages[@]}" >&2 || return 2
  fi
  node "$dir/node_modules/orm-preflight/dist/cli.mjs" "${args[@]}"
}
