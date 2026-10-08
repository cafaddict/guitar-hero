# docs/goal — 기타 연습 앱 v1 goal 실행 키트

> **v1.1**: 리서치를 충실히 옮기고 초급 2(Stage 8–11)를 여는 다음 goal 키트는 [`v1.1/`](v1.1/README.md)에 있다. 이 폴더(v1)는 완료 기록으로 보존한다.

이 폴더는 Claude Code `/goal`로 앱 v1을 자율 구현하기 위한 파일 묶음이다.

| 파일 | 역할 | goal 실행 중 수정 |
|---|---|---|
| `SPEC.md` | 상세 명세(승인된 계획, 1,100줄+) | **금지** (SHA-256 고정) |
| `thresholds.json` | 벤치마크 임계값·테스트 매트릭스 계약 | **금지** (SHA-256 고정) |
| `goal-condition.template.txt` | `/goal` 조건문 템플릿(해시 자리표시자) | — |
| `render-goal.sh` | 현재 해시를 넣어 조건문을 만들고 4,000자 제한 검사 | — |
| `PROGRESS.md` | 진행 장부(마일스톤·AC 표·턴 로그) | 실행자가 매 턴 갱신 |
| `DECISIONS.md` | 결정 기록(D-001–D-010은 사전 합의) | 실행자가 추가 |

## 왜 두 층인가

`/goal` 조건문은 최대 4,000자이고, 완료 여부를 판정하는 evaluator(작은 모델)는 **대화에 출력된 내용만** 본다(파일을 읽거나 명령을 실행하지 않는다). 그래서:

1. 길고 자세한 요구사항은 `SPEC.md`에 두고, 조건문은 "SPEC대로 구현 + 측정 가능한 완료 조건 + 마지막 턴에 증거 출력"만 담는다.
2. 실행자가 기준을 몰래 낮추지 못하도록 `SPEC.md`와 `thresholds.json`의 SHA-256을 조건문에 박아 둔다. 조건문은 실행 중 바뀌지 않으므로 마지막에 해시가 같아야만 완료로 판정된다.

## 실행 방법

```bash
cd ~/orca/projects/guitar-hero
bash docs/goal/render-goal.sh | pbcopy     # 조건문을 클립보드로 (글자 수는 터미널에 표시)
claude                                      # 새 세션 (이 세션과 분리 — 컨텍스트 오염 방지)
```

Claude Code 안에서:
1. `Shift+Tab`으로 **auto mode**로 전환한다. Manual mode면 도구 호출마다 승인을 기다리느라 멈춘다.
2. 클립보드 내용을 붙여 넣는다. 내용은 `/goal ...`로 시작한다.
3. 진행 확인
   - `/goal`로 상태(턴 수, 토큰, 마지막 판정 이유)를 본다.
   - `Ctrl+O`로 evaluator가 내린 판정의 이유를 본다.
   - `docs/goal/PROGRESS.md`를 열어 진도를 본다.
4. 중단은 `/goal clear`. 세션을 다시 열면(`claude --continue`) 활성 goal이 복원된다.

헤드리스로 돌리려면:

```bash
claude -p "$(bash docs/goal/render-goal.sh)" --output-format stream-json --verbose > goal-run.jsonl
```

## 실행 전 체크

- SPEC.md나 thresholds.json을 고쳤다면 `render-goal.sh`를 **다시 실행**해 새 조건문을 써야 한다. 예전 해시를 쓰면 완료 판정이 영원히 실패한다.
- 디스크 여유 2 GB 이상이 필요하다(GuitarSet 약 700 MB + node_modules + Playwright 브라우저).
- 네트워크: npm, Playwright 브라우저, Zenodo 다운로드가 필요하다.
- 비용과 시간: 상한은 300턴이고, 여러 시간에서 하루 이상 걸릴 수 있다. 사용량 한도에 걸리면 goal이 일시정지되고, 한도가 풀리면 이어서 진행한다.

## 끝난 뒤

1. `docs/goal/FINAL_REPORT.md`를 읽는다.
2. `docs/MANUAL_VALIDATION.md` 순서대로 실제 기타와 기기(MacBook, iPad, iPhone)로 검증한다.
3. 녹음 키트로 만든 fixture를 `tests/fixtures/real/`에 넣고 `npm run bench:real`을 실행한다.
4. 문제가 없으면 `feat/practice-app-v1` 브랜치를 `main`에 병합할지 정하고, `docs/DEPLOY.md`를 따라 배포한다.
