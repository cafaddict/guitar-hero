# docs/goal/v1.1 — 기타 연습 앱 v1.1 goal 실행 키트

v1(`docs/goal/`, 완료·보존)에 이어, 리서치를 충실히 옮기고 초급 2(Stage 8–11)를 여는 v1.1을 Claude Code `/goal`로 자율 구현하기 위한 파일 묶음이다. 만든 배경과 차이 목록은 `GAP_AUDIT.md`, 결정은 `../DECISIONS.md`의 D-052–D-061.

| 파일 | 역할 | goal 실행 중 수정 |
|---|---|---|
| `SPEC.md` | v1.1 상세 명세(자체 완결형, v1 본문을 옮겨 고침) | **금지** (SHA-256 고정) |
| `thresholds.json` | 임계값·매트릭스 계약(v1 계약의 상위 집합 + `beta` 보고 구획) | **금지** |
| `traceability.json` | 리서치 권고 → SPEC 절 → AC, 또는 제외 근거(215건) | **금지** |
| `GAP_AUDIT.md` | 리서치 ↔ v1 SPEC ↔ v1 구현 차이 34건과 v1.1 처리 | **금지** |
| `goal-condition.template.txt` | `/goal` 조건문 템플릿(해시 자리표시자 6개) | — |
| `render-goal.sh` | 현재 해시 6개를 넣어 조건문을 만들고 4,000자 제한 검사 | — |
| `PROGRESS.md` | 진행 장부(M9–M15, AC 41개, 턴 로그) | 실행자가 매 턴 갱신 |
| `FINAL_REPORT.md` | (실행 마지막에 생성) | 실행자가 작성 |

v1의 `docs/goal/SPEC.md`·`thresholds.json`도 해시로 고정된다(v1 기록 보존).

## 실행 방법

```bash
cd ~/orca/projects/guitar-hero
git switch feat/practice-app-v1.1                 # 키트가 커밋된 브랜치(부모 5e94332). 아직 없으면 키트 작성자가 만든다(아래 '키트 커밋')
bash docs/goal/v1.1/render-goal.sh | pbcopy        # 조건문을 클립보드로 (글자 수는 터미널에 표시)
claude                                             # 새 세션 (이 세션과 분리 — 컨텍스트 오염 방지)
```

Claude Code 안에서:
1. `Shift+Tab`으로 **auto mode**로 전환한다.
2. 클립보드 내용(`/goal ...`)을 붙여 넣는다.
3. 진행 확인은 `/goal`(상태), `Ctrl+O`(판정 이유), `docs/goal/v1.1/PROGRESS.md`로 한다.
4. 중단은 `/goal clear`. 세션을 다시 열면(`claude --continue`) 활성 goal이 복원된다.

## 키트 커밋 (goal 실행 전 1회)

```bash
git switch -c feat/practice-app-v1.1 5e94332      # 작업 트리의 키트 변경은 그대로 따라온다
git add .gitignore docs/goal
git commit -m "docs(v1.1): goal kit"
bash docs/goal/v1.1/render-goal.sh | pbcopy        # 고정 파일을 모두 마친 뒤에 조건문을 만든다
```

## 실행 전 체크

- 고정 파일 6개 중 하나라도 고쳤다면 `render-goal.sh`를 **다시 실행**해 새 조건문을 쓴다.
- 디스크 여유 2 GB 이상(GuitarSet은 v1 때 받은 `data/guitarset/`를 재사용), 네트워크(npm, Playwright, 필요하면 Zenodo).
- 규모: v1(M0–M8)보다 크다. 상한 1000턴이고 하루 이상 걸릴 수 있다. 사용량 한도에 걸리면 일시정지 후 이어 간다.
- 실행 중에는 이 레포에서 `vite preview`나 dev 서버를 띄워 두지 않는다(E2E 포트 4173/4174 충돌).

## 끝난 뒤

1. `docs/goal/v1.1/FINAL_REPORT.md`를 읽는다(리서치 추적표 대조 결과 포함).
2. `docs/MANUAL_VALIDATION.md`의 v1.1 항목을 실제 기타와 기기로 확인한다.
3. 녹음 키트 fixture로 `npm run bench:real`을 실행한다.
4. `main` 병합 여부를 정하고, `docs/DEPLOY.md`를 따라 배포한다.
