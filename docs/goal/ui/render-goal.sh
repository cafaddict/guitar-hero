#!/usr/bin/env bash
# 키트 커밋, main 커밋, 고정 파일 7개의 SHA-256을 템플릿에 넣어 /goal 조건문을 만든다.
# 사용: bash docs/goal/ui/render-goal.sh            → 조건문을 stdout으로 출력(+ 글자 수를 stderr로)
#       bash docs/goal/ui/render-goal.sh | pbcopy   → 클립보드로 복사 (macOS)
# 키트를 커밋한 직후(작업 트리 clean, HEAD = 키트 커밋)에 실행한다. 고정 파일을 고쳤다면 다시 커밋하고 다시 실행한다.
set -euo pipefail

goal_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$goal_dir/../../.." && pwd)"
cd "$root"

if [[ -n "$(git status --short)" ]]; then
  echo "ERROR: 작업 트리가 깨끗하지 않습니다. 키트를 커밋한 뒤 실행하세요." >&2
  exit 1
fi

sha() { shasum -a 256 "$1" | cut -d' ' -f1; }
kit="$(git rev-parse --short HEAD)"
main="$(git rev-parse --short main)"

condition="$(sed \
  -e "s/{{KIT}}/$kit/" \
  -e "s/{{MAIN}}/$main/" \
  -e "s/{{H_SPEC}}/$(sha docs/goal/ui/SPEC.md)/" \
  -e "s/{{H_UQ}}/$(sha tests/e2e/ui-quality.spec.ts)/" \
  -e "s/{{H_UQC}}/$(sha tests/e2e/ui-quality.chromium.spec.ts)/" \
  -e "s/{{H_UR}}/$(sha tests/integrity/ui-rules.test.ts)/" \
  -e "s/{{H_LAYOUT}}/$(sha tests/e2e/layout.spec.ts)/" \
  -e "s/{{H_A11Y}}/$(sha tests/e2e/a11y.spec.ts)/" \
  -e "s/{{H_SCREENS}}/$(sha tests/e2e/support/screens.ts)/" \
  "$goal_dir/goal-condition.template.txt")"

if grep -q '{{' <<<"$condition"; then
  echo "ERROR: 채우지 못한 자리표시자가 남았습니다." >&2
  exit 1
fi

# /goal 조건문 상한은 4,000자(문자 단위). Python으로 유니코드 문자 수를 센다.
char_count="$(printf '%s' "$condition" | python3 -c 'import sys; print(len(sys.stdin.read()))')"
if (( char_count > 4000 )); then
  echo "ERROR: 조건문이 ${char_count}자로 4,000자를 넘습니다." >&2
  exit 1
fi

printf '/goal %s\n' "$condition"
echo "(조건문 ${char_count}자 / 4000자, 키트 ${kit})" >&2
