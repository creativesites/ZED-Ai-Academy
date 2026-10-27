#!/bin/bash
# usage: tools/render.sh <out.png> [advance]   (run from design/rive)
set -e
cd "$(dirname "$0")/.."
node tools/gen_teacher.mjs >/dev/null
~/.rive/bin/rive teacher --verify 2>&1 | grep -E 'error|warn|verified' | head -5
~/.rive/bin/rive teacher --screenshot="$1" --advance="${2:-30}" "${@:3}" 2>&1 | grep -E 'built|wrote|error' | head
