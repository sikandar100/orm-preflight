#!/usr/bin/env bash
# Generates the golden migrations in test/golden/ with real `typeorm migration:generate`
# (SPEC 8.3). Needs Docker and network access. Run it when TypeORM is bumped, then review
# the diff and update test/golden/expected.json if a scenario's findings change.
#
# Usage: scripts/golden/generate.sh
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
work=$(mktemp -d)
typeorm_versions=(0.3.31 1.1.1)
postgres_image=postgres:16-alpine
mysql_image=mysql:8.4

# timestamp, class name, scenario
scenarios=(
  '1727100001000 WidenVarchar widen-varchar'
  '1727100002000 IntToBigint int-to-bigint'
  '1727100003000 AddEnumValue add-enum-value'
  '1727100004000 AddIndex add-index'
  '1727100005000 AddRelation add-relation'
  '1727100006000 RenameProperty rename-property'
  '1727100007000 AddNotNullColumn add-not-null-column'
  '1727100008000 MakeRequired make-required'
  '1727100009000 RemoveEnumValue remove-enum-value'
  '1727100010000 RemoveColumn remove-column'
  '1727100011000 AddUnique add-unique'
)

cleanup() {
  docker rm -f golden-postgres golden-mysql >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "Starting $postgres_image and $mysql_image"
docker rm -f golden-postgres golden-mysql >/dev/null 2>&1 || true
docker run -d --name golden-postgres -p 55432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gen "$postgres_image" >/dev/null
docker run -d --name golden-mysql -p 53306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=gen "$mysql_image" >/dev/null
for _ in $(seq 1 90); do docker exec golden-postgres pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done
for _ in $(seq 1 90); do docker exec golden-mysql mysql -uroot -proot -e 'SELECT 1' gen >/dev/null 2>&1 && break; sleep 2; done

for version in "${typeorm_versions[@]}"; do
  dir="$work/typeorm-$version"
  mkdir -p "$dir"
  echo "Installing typeorm@$version"
  (cd "$dir" && npm init -y >/dev/null && npm install --no-audit --no-fund --silent \
    "typeorm@$version" pg@8.23.0 mysql2@3.24.4 reflect-metadata@0.2.2)
  cp "$here/data-source.cjs" "$here/sync-before.cjs" "$dir/"

  for db in postgres mysql; do
    out="$root/test/golden/typeorm-$version/$db"
    mkdir -p "$out"
    for entry in "${scenarios[@]}"; do
      read -r timestamp name scenario <<< "$entry"
      (
        cd "$dir"
        DB=$db SCENARIO=$scenario node sync-before.cjs
        DB=$db SCENARIO=$scenario PHASE=after npx --no typeorm migration:generate "out/$name" \
          -d data-source.cjs -t "$timestamp" >/dev/null
      )
      cp "$dir/out/$timestamp-$name.ts" "$out/"
      echo "  $version $db $name"
    done
  done
done

echo "Done. Review the changes in test/golden/ before committing."
