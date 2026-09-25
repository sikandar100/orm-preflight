#!/usr/bin/env bash
# Verifies the locking claims behind orm-preflight's rules on one PostgreSQL version.
# Needs Docker. Usage: test/verify/verify-locks.sh <postgres major version>
# Results are kept in test/verify/results/. See test/verify/README.md.
set -uo pipefail
ver=$1; name=pg-verify-$ver
docker rm -f $name >/dev/null 2>&1
docker pull -q postgres:$ver-alpine >/dev/null
docker run -d --name $name -e POSTGRES_PASSWORD=p postgres:$ver-alpine >/dev/null
for i in $(seq 1 60); do docker exec $name pg_isready -U postgres -q 2>/dev/null && break; sleep 1; done; sleep 1
psql() { docker exec -i $name psql -U postgres -X -q -t -A -v ON_ERROR_STOP=0 "$@"; }
psql -c "SELECT 'PostgreSQL ' || current_setting('server_version')"

setup() {
  psql <<'SQL'
SET client_min_messages = warning;
DROP TABLE IF EXISTS child, parent CASCADE;
CREATE TABLE parent (id int PRIMARY KEY);
INSERT INTO parent SELECT g FROM generate_series(1, 1000) g;
CREATE TABLE child (id int PRIMARY KEY, parent_id int, name varchar(100), n int, email text);
INSERT INTO child SELECT g, g, 'n' || g, g, 'e' || g FROM generate_series(1, 1000) g;
SQL
}

# Runs a statement in a transaction and prints the lock it holds on each table, and whether
# the table was rewritten (its file node changed).
check() {
  local label=$1 sql=$2
  setup
  psql <<SQL | tr '\n' ' ' | sed "s/^/$label | /"; echo
CREATE TEMP TABLE before AS SELECT relname, pg_relation_filenode(oid) AS node FROM pg_class WHERE relname IN ('child', 'parent');
BEGIN;
$sql;
SELECT string_agg(c.relname || '=' || l.mode, ', ' ORDER BY c.relname, l.mode) FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE l.pid = pg_backend_pid() AND c.relname IN ('child', 'parent');
SELECT CASE WHEN bool_or(b.node <> pg_relation_filenode(c.oid)) THEN '| REWRITE' ELSE '| no rewrite' END FROM before b JOIN pg_class c ON c.relname = b.relname;
ROLLBACK;
SQL
}

check "create index                   " "CREATE INDEX i ON child (email)"
check "add column constant default    " "ALTER TABLE child ADD c text NOT NULL DEFAULT 'x'"
check "add column volatile default    " "ALTER TABLE child ADD c uuid DEFAULT gen_random_uuid()"
check "add column now() default       " "ALTER TABLE child ADD c timestamptz DEFAULT now()"
check "add column serial              " "ALTER TABLE child ADD c serial"
check "add column identity            " "ALTER TABLE child ADD c int GENERATED ALWAYS AS IDENTITY"
check "add column stored generated    " "ALTER TABLE child ADD c int GENERATED ALWAYS AS (n * 2) STORED"
check "type varchar(100)->varchar(255)" "ALTER TABLE child ALTER COLUMN name TYPE varchar(255)"
check "type varchar(100)->text        " "ALTER TABLE child ALTER COLUMN name TYPE text"
check "type varchar(100)->varchar     " "ALTER TABLE child ALTER COLUMN name TYPE varchar"
check "type varchar(100)->varchar(50) " "ALTER TABLE child ALTER COLUMN name TYPE varchar(50)"
check "type int->bigint               " "ALTER TABLE child ALTER COLUMN n TYPE bigint"
check "add foreign key                " "ALTER TABLE child ADD CONSTRAINT fk FOREIGN KEY (parent_id) REFERENCES parent (id)"
check "add foreign key NOT VALID      " "ALTER TABLE child ADD CONSTRAINT fk FOREIGN KEY (parent_id) REFERENCES parent (id) NOT VALID"
check "validate constraint            " "ALTER TABLE child ADD CONSTRAINT fk FOREIGN KEY (parent_id) REFERENCES parent (id) NOT VALID; COMMIT; BEGIN; ALTER TABLE child VALIDATE CONSTRAINT fk"
check "set not null                   " "ALTER TABLE child ALTER COLUMN email SET NOT NULL"
check "add check NOT VALID            " "ALTER TABLE child ADD CONSTRAINT c CHECK (n > 0) NOT VALID"
if [ "$ver" -ge 18 ]; then
  check "add not null NOT VALID (18+)   " "ALTER TABLE child ADD CONSTRAINT nn NOT NULL email NOT VALID"
  check "validate not null (18+)        " "ALTER TABLE child ADD CONSTRAINT nn NOT NULL email NOT VALID; COMMIT; BEGIN; ALTER TABLE child VALIDATE CONSTRAINT nn"
fi

echo "--- errors"
setup
echo -n "NOT NULL without default, rows exist | "; psql -c "ALTER TABLE child ADD c text NOT NULL" 2>&1 | tr '\n' ' '; echo
echo -n "CONCURRENTLY inside BEGIN            | "; psql -c "BEGIN" -c "CREATE INDEX CONCURRENTLY i ON child (email)" 2>&1 | tr '\n' ' '; echo
echo -n "CONCURRENTLY in multi-statement query| "; printf 'CREATE INDEX CONCURRENTLY i2 ON child (email); SELECT 1;\n' | docker exec -i $name sh -c 'cat > /tmp/q.sql; psql -U postgres -X -q -t -A -c "$(cat /tmp/q.sql)"' 2>&1 | tr '\n' ' '; echo
echo -n "DROP INDEX CONCURRENTLY inside BEGIN | "; psql -c "BEGIN" -c "DROP INDEX CONCURRENTLY IF EXISTS i" 2>&1 | tr '\n' ' '; echo
echo -n "REINDEX CONCURRENTLY inside BEGIN    | "; psql -c "BEGIN" -c "REINDEX INDEX CONCURRENTLY child_pkey" 2>&1 | tr '\n' ' '; echo
echo -n "CONCURRENTLY alone (autocommit)      | "; psql -c "CREATE INDEX CONCURRENTLY i3 ON child (email)" 2>&1 && echo "ok"
echo -n "SET NOT NULL uses valid CHECK        | "; psql <<'SQL' 2>&1 | grep -i -E 'sufficient|proved|implied' | head -1; echo
ALTER TABLE child ADD CONSTRAINT nn CHECK (email IS NOT NULL) NOT VALID;
ALTER TABLE child VALIDATE CONSTRAINT nn;
SET client_min_messages = debug1;
ALTER TABLE child ALTER COLUMN email SET NOT NULL;
SQL
docker rm -f $name >/dev/null
