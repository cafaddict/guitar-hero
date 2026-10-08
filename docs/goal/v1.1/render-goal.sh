#!/usr/bin/env bash
# v1·v1.1 고정 파일 6개의 현재 SHA-256을 템플릿에 넣어 v1.1 /goal 조건문을 만든다.
# 사용: bash docs/goal/v1.1/render-goal.sh            → 조건문을 stdout으로 출력(+ 글자 수를 stderr로)
#       bash docs/goal/v1.1/render-goal.sh | pbcopy   → 클립보드로 복사 (macOS)
# 고정 파일을 고쳤다면 반드시 다시 실행해 새 조건문을 쓴다.
set -euo pipefail

kit_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
goal_dir="$(dirname "$kit_dir")"
sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

condition="$(sed \
  -e "s/{{H_V1_SPEC}}/$(sha "$goal_dir/SPEC.md")/" \
  -e "s/{{H_V1_THRESH}}/$(sha "$goal_dir/thresholds.json")/" \
  -e "s/{{H_SPEC}}/$(sha "$kit_dir/SPEC.md")/" \
  -e "s/{{H_THRESH}}/$(sha "$kit_dir/thresholds.json")/" \
  -e "s/{{H_TRACE}}/$(sha "$kit_dir/traceability.json")/" \
  -e "s/{{H_AUDIT}}/$(sha "$kit_dir/GAP_AUDIT.md")/" \
  "$kit_dir/goal-condition.template.txt")"

if grep -q '{{' <<<"$condition"; then
  echo "ERROR: 채워지지 않은 자리표시자가 남았습니다." >&2
  exit 1
fi

# /goal 조건문 상한은 4,000자(문자 단위). Python으로 유니코드 문자 수를 센다.
char_count="$(printf '%s' "$condition" | python3 -c 'import sys; print(len(sys.stdin.read()))')"
if (( char_count > 4000 )); then
  echo "ERROR: 조건문이 ${char_count}자로 4,000자를 넘습니다." >&2
  exit 1
fi

printf '/goal %s\n' "$condition"
echo "(조건문 ${char_count}자 / 4000자)" >&2
