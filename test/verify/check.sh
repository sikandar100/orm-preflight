#!/usr/bin/env bash
# Runs verify-locks.sh on one PostgreSQL version and fails if any result differs from
# expected.txt. Checks marked "(18+)" are left out on older versions.
# Needs Docker. Usage: test/verify/check.sh <postgres major version>
set -euo pipefail
ver=$1
here=$(cd "$(dirname "$0")" && pwd)

actual=$("$here/verify-locks.sh" "$ver")
echo "$actual" | head -1

expected=$(cat "$here/expected.txt")
if [ "$ver" -lt 18 ]; then expected=$(grep -v '(18+)' <<< "$expected"); fi

if diff <(echo "$expected") <(echo "$actual" | sed 1d); then
  echo "Every locking claim holds on PostgreSQL $ver."
else
  echo "::error::A locking claim does not hold on PostgreSQL $ver. See the diff above (< expected, > actual)."
  exit 1
fi
