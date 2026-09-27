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
  local packages=(--package "orm-preflight@$VERSION")
  if [ "${MYSQL:-false}" = true ]; then packages+=(--package node-sql-parser@5.4.0); fi
  npx --yes "${packages[@]}" -- orm-preflight "${args[@]}"
}
