# docs/goal/ui — UI 마감 goal 실행 키트

D-087 UI 개편 위에서, 앱 전체를 UI 전문가 수준으로 마감하는 작업을 Claude Code `/goal`로 자율 실행하기 위한 파일 묶음이다. 결정은 `../DECISIONS.md`의 D-088.

| 파일 | 역할 | goal 실행 중 수정 |
|---|---|---|
| `SPEC.md` | 목표·규칙·게이트·마일스톤·AC | **금지** (SHA-256 고정) |
| `tests/e2e/ui-quality.spec.ts`·`ui-quality.chromium.spec.ts` | UI 품질 게이트 UQ-1–UQ-10(2부는 Chromium 전용) | **금지** |
| `tests/integrity/ui-rules.test.ts` | 소스 규칙 UR-1–UR-2 | **금지** |
| `layout.spec.ts`·`a11y.spec.ts`·`support/screens.ts` | 기존 레이아웃·axe 게이트와 화면 목록 | **금지** |
| `goal-condition.template.txt` | `/goal` 조건문 템플릿(키트 커밋 + 해시 7개 자리표시자) | — |
| `render-goal.sh` | 조건문을 만들고 4,000자 제한 검사 | — |
| `PROGRESS.md` | 진행 장부(마일스톤, UQ 문제 수, AC 표, 턴 로그) | 실행자가 매 턴 갱신 |
| `UI_AUDIT.md` | 표식 표, 검토 범위표, 발견 표 | 실행자가 갱신 |
| `FINAL_REPORT.md` | (실행 마지막에 생성) | 실행자가 작성 |

품질 게이트 정의는 SPEC §5에 있다. 키트를 만들 때 측정한 기준 문제 수는 PROGRESS의 "UQ 문제 수" 표에 있다.

## 실행 방법

이 워크트리(`~/orca/workspaces/guitar-hero/ui`, 브랜치 `cafaddict/ui`)에서 새 세션으로 실행한다.

```bash
# 키트 커밋 직후, 작업 트리가 clean일 때
claude --permission-mode auto --model opus "$(bash docs/goal/ui/render-goal.sh)"
```

`/`로 시작하는 첫 프롬프트는 바로 보내지지 않고 입력창에 들어간다. Enter를 한 번 눌러 `/goal`을 실행한다. 안 되면 `bash docs/goal/ui/render-goal.sh | pbcopy`로 복사해 새 세션에 붙여 넣는다.

- 진행 확인: `/goal`(상태), `Ctrl+O`(판정 이유), `docs/goal/ui/PROGRESS.md`.
- 중단: `/goal clear`. 세션을 다시 열면(`claude --continue`) 활성 goal이 복원된다.

## 실행 전 체크

- 다른 체크아웃의 `vite preview`가 4173을 잡고 있다. 그래서 E2E 포트를 `E2E_PORT`·`PROD_PORT` 환경 변수로 바꿀 수 있게 했고, 실행은 4183·4184를 쓴다.
- `bench:guitarset`용 `data/guitarset`은 `~/orca/projects/guitar-hero/data/guitarset`을 가리키는 심볼릭 링크다(`data/`는 gitignore 대상).
- 실행 중에는 이 워크트리에서 다른 세션이 파일을 고치지 않는다.

## 끝난 뒤

1. `FINAL_REPORT.md`와 `UI_AUDIT.md`를 읽는다.
2. `ui-shots/before/`(시작 전)와 `ui-shots/`(끝)의 그림으로 전후를 훑어본다.
3. `docs/MANUAL_VALIDATION.md`의 UI 항목을 실제 iPad·iPhone·MacBook에서 확인한다(safe area, 터치, 거리 가독성).
4. `cafaddict/ui`를 어디에 병합할지 정한다.
