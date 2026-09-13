#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
qa_agent="/home/danman60/projects/qa-agent/qa_agent.py"
checklist="$repo_root/tests/agent/flow-master-lifecycle.md"
qa_report_root="${XDG_STATE_HOME:-/home/danman60/.local/state}/transposepdf/qa-reports"

if [[ $# -lt 1 || -z "${1:-}" ]]; then
  echo "Usage: npm test -- <explicit-url> [QA Agent options]" >&2
  echo "No default URL exists; tests will not target production implicitly." >&2
  exit 2
fi

target_url="$1"
shift
case "$target_url" in
  http://*|https://*) ;;
  *) echo "URL must begin with http:// or https://" >&2; exit 2 ;;
esac

if [[ ! -f "$qa_agent" ]]; then
  echo "QA Agent not found: $qa_agent" >&2
  exit 2
fi

echo "QA target: $target_url"
echo "Checklist: $checklist"
echo "Reports: $qa_report_root"
mkdir -p "$qa_report_root"
exec python3 "$qa_agent" "$target_url" --checklist "$checklist" --report-dir "$qa_report_root" "$@"
