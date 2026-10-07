#!/usr/bin/env bash
# SPEC.md·thresholds.json의 현재 SHA-256을 템플릿에 넣어 /goal 조건문을 만든다.
# 사용: bash docs/goal/render-goal.sh            → 조건문을 stdout으로 출력(+ 글자 수를 stderr로)
#       bash docs/goal/render-goal.sh | pbcopy   → 클립보드로 복사 (macOS)
# SPEC.md나 thresholds.json을 고쳤다면 반드시 다시 실행해 새 조건문을 쓴다.
set -euo pipefail

goal_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
spec_sha="$(shasum -a 256 "$goal_dir/SPEC.md" | cut -d' ' -f1)"
thresh_sha="$(shasum -a 256 "$goal_dir/thresholds.json" | cut -d' ' -f1)"

condition="$(sed -e "s/{{SPEC_SHA}}/$spec_sha/" -e "s/{{THRESH_SHA}}/$thresh_sha/" "$goal_dir/goal-condition.template.txt")"

# /goal 조건문 상한은 4,000자(문자 단위). Python으로 유니코드 문자 수를 센다.
char_count="$(printf '%s' "$condition" | python3 -c 'import sys; print(len(sys.stdin.read()))')"
if (( char_count > 4000 )); then
  echo "ERROR: 조건문이 ${char_count}자로 4,000자를 넘습니다." >&2
  exit 1
fi

printf '/goal %s\n' "$condition"
echo "(조건문 ${char_count}자 / 4000자, SPEC ${spec_sha:0:12}…, thresholds ${thresh_sha:0:12}…)" >&2
