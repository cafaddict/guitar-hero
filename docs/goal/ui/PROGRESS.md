# PROGRESS — guitar-hero UI 마감 goal

> goal 실행자가 **매 턴 시작 시 읽고, 턴 끝에 갱신**한다. 컨텍스트가 압축된 뒤에는 이 파일과 `docs/goal/ui/SPEC.md`만으로 이어갈 수 있어야 한다.
> 상태 값: TODO / DOING / DONE. DONE에는 증거(테스트 이름·명령·커밋·파일 경로)를 적는다.

## 현재 상태

- 현재 마일스톤: **U6 (마감)** — 독립 리뷰(코드·UI), 문서(README·MANUAL_VALIDATION, 초안 scratchpad `readme-screen.md`·`manual-ui.md`), 전 화면 888장 검토와 §2, FINAL_REPORT, 최종 verify
- 시작 지점: `cafaddict/ui`, 키트 커밋(D-088). 그 부모는 D-087 UI 개편 커밋.
- 마지막 갱신: 2026-10-21 (goal 실행자)
- 누적 턴(대략): 4
- 턴 상한: **400**
- 막힌 점: 없음
- 메모:
  - E2E·verify는 `E2E_PORT=4183 PROD_PORT=4184`로 실행한다(SPEC §2.5).
  - 타입 검사는 `npm run typecheck`(앱·node·worklet 3개 tsconfig)로 한다.
  - 같은 화면을 두 번 연달아 `openScreen`하면 같은 URL이라 다시 마운트되지 않는다. 다른 화면을 거쳐서 연다.
  - 빠른 촬영: `npx vite --mode e2e --port 5199 --strictPort`를 띄우고 `UI_SHOTS_BASE=http://localhost:5199`(필터와 함께)로 찍는다. 15초 안팎. 끝나면 서버를 끈다.
  - UQ 문제 수 세기: 로그에서 `UQ-n ` 접두 줄을 diff 기호·따옴표를 벗겨 중복 없이 센다(세 프로젝트 같은 줄은 1회).
  - 마일스톤마다 다른 마일스톤 작업분은 scratchpad에 따로 두고, 게이트는 그 마일스톤 파일만 있는 트리에서 돌린 뒤 그 파일만 커밋한다. U4·U5 작업분: `u45/`(목록 `u45-files.txt`), 문구는 `apply-ko.py`로 더한다.
  - U5 할 일: F-36 고대비 `bg-surface` 칸 경계(styles.css 훅).

## 마일스톤

| M | 이름 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| U1 | 기반 | DONE | `UI U1: 기반` | UQ-4·5·6·10 0(7·8 유지), 기존 E2E 86 통과, 단위 1902 통과 |
| U2 | 연습 화면 | DONE | `UI U2: 연습 화면` | `PracticeStage`(D-090), UQ-1·3·9 0, 독립 리뷰 10건 처리(High 1: 일시정지 포커스 + 회귀 E2E), E2E 88 + 새 1개 통과 |
| U3 | 세션 러너 | DONE | `UI U3: 세션 러너` | 실행 뒤·블록 전환·일시정지·자가 평가 위계(D-091), 상태 촬영 도구 `tools/ui/states.spec.ts`, UQ-1 0 유지 |
| U4 | 앱 화면 | DONE | `UI U4: 앱 화면` | 홈·단계·튜너·메트로놈·루틴 편집·온보딩·라이브러리·코드·시험·진도(D-092). E2E 92개 전부 통과(UQ 게이트 4개 포함) |
| U5 | 폼·도구·테마 | DONE | `UI U5: 폼·도구·테마` | 설정 세 카드, 진단·녹음 키트 카드, 고대비 칸 경계, 온보딩 단계(D-093). 감사 OPEN High·Medium 0 |
| U6 | 마감 | TODO | | |

## UQ 문제 수 (SPEC §7.1-3)

`E2E_PORT=4183 PROD_PORT=4184 npx playwright test tests/e2e/ui-quality` 출력(두 파일)의 문제 줄을 `UQ-n` 접두로 센 값이다. 세 프로젝트(chromium-mic, webkit-ipad, webkit-iphone)에서 같은 줄은 한 번만 센다.

| 시점 | UQ-1 | UQ-2 | UQ-3 | UQ-4 | UQ-5 | UQ-6 | UQ-7 | UQ-8 | UQ-9 | UQ-10 | UR-1·2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 키트 기준(D-087 + 키트) | 84 | 28 | 5 | 36 | 1093 | 162 | 0 | 0 | 8 | 24 | 통과 |
| U1 끝 | 84 | 28 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 통과 |
| U2 끝 | 0 | 28 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 통과 |
| U3 끝 | 0 | 28 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 통과 |
| U4 끝 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 통과 |
| U5 끝 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 통과 |

기준 시점의 대표 문제:
- UQ-1·UQ-2: `[data-primary-action]` 표식이 아직 없다. 표식을 달아도 첫 화면 밖인 곳이 있다.
  - 단계 화면의 연습 시작(모든 뷰포트)
  - E9·E11 실행 중 자가 평가(MacBook·iPad 가로)
  - 루틴 편집 저장(iPad 가로·iPhone)
  - iPhone의 E1·E2·E3·S 주 버튼
  - 시퀀스 연습 준비 상태(E17-ready)에는 터치 시작 조작이 없다(Space만).
- UQ-3: E5 BPM이 화면 높이의 7–10 %다(`BigBpm` clamp 상한 5rem). E1 타이머는 iPad 세로에서 13.6 %다(`BigTimer` 상한 10rem).
- UQ-4: 셀렉트 높이 23 px(메트로놈·설정·루틴 편집), 메트로놈 BPM 슬라이더 높이 16 px.
- UQ-5: 전역 `word-break`가 normal이다. "튜닝부/터"처럼 낱말 가운데서 줄이 바뀐다.
- UQ-6: 고대비 테마에서 `[data-theme="contrast"] button { outline: 1px }`가 포커스 outline을 덮는다.
- UQ-9: K1·E9·E11·S-paused의 안내 문단이 넓은 화면에서 52–55em이다.
- UQ-10: 필드 경계가 다크 1.4–1.5:1, 라이트 약 1.5:1이다(기준 3:1).

## Acceptance Criteria (SPEC §8)

| AC | 요약 | 상태 | 증거 |
|---|---|---|---|
| AC-UG1 | 키트 이후 U1–U6 커밋, main·feat/practice-feedback 그대로, upstream 없음, clean | TODO | |
| AC-UG2 | 고정 파일 7개 SHA-256 일치 | TODO | |
| AC-UG3 | `npm ci && E2E_PORT=4183 PROD_PORT=4184 npm run verify` exit 0, 전 단계 PASS | TODO | |
| AC-UQ | ui-quality 테스트 4개 통과(1부 3프로젝트, 2부 chromium-mic), ui-rules 통과 | TODO | |
| AC-UX1 | UI_AUDIT §2 범위표 완성(전 화면 × 4뷰포트 × 3테마, 마지막 변경 이후) | TODO | |
| AC-UX2 | UI_AUDIT §3 OPEN High·Medium 0 | TODO | |
| AC-UX3 | 연습 화면 공통 뼈대, iPad 가로·MacBook 2단 | TODO | |
| AC-UX4 | 동작 보존, 고친 기존 테스트 목록 | TODO | |
| AC-UD1 | DECISIONS·README·MANUAL_VALIDATION 갱신 | TODO | |
| AC-UD2 | U2·U6 독립 리뷰와 처리 기록 | TODO | |

## 턴 로그

| 턴 | 한 일 | 다음 |
|---|---|---|
| 0 | 키트 작성(SPEC, 고정 테스트, ui:shots, PROGRESS, UI_AUDIT 틀), 고정 전 독립 리뷰 반영(D-088). 기존 E2E 83개 + UQ-7·8 통과, UQ 게이트 5개는 기준 문제로 실패 | U1 시작: `UI_SHOTS_DIR=ui-shots/before npm run ui:shots` → 감사 초기 발견 → 기반 작업 |
| 1 | `ui-shots/before/` 888장 촬영, 감사 초기 발견 F-01–F-32 등록. U1(D-089): keep-all·break-word, 문단 48em, `--field-border`와 `src/ui/Field.tsx`(Select·TextInput·TextArea·Field·Choice), 슬라이더, 고대비 포커스, `LoadingPlaceholder`. 필드 화면 3테마 × iPad 가로·iPhone 검토. 게이트: typecheck·lint·단위 1902·E2E 86 통과, UQ-4·5·6·7·8·9·10 0 | U2: `PracticeStage`(2단·sticky 행동 막대·RunControls), 뷰 전부 이전, 시퀀스 터치 시작, 핵심 숫자 18vh/16vh |
| 2 | U2: `PracticeStage`로 E0–E17·K1·Q1–Q5·S·시작 화면 이전, 시퀀스 터치 시작, 핵심 숫자 18/16vh, TAB 확대 상한, 퀴즈 답 정렬, "중단" 문구(D-090). 독립 리뷰 → 일시정지 포커스 유실(High) 등 10건 처리, 회귀 E2E 추가. 게이트 3회(2회째 Q3 "pluck" 판정 사라짐 → 수정). 다크 4뷰포트 + 라이트·고대비 iPad 가로·iPhone 검토 | U3: 세션 상태(전환·일시정지·실행 뒤·자가 평가) 촬영 도구로 검토, 그다음 U4 |
| 3 | U3: 세션 실행 뒤 "다음 항목"만 주 조작, 블록 전환 16vh 카운트다운, 일시정지 카드, 자가 평가 폼, 결과 한 단(D-091). `tools/ui/states.spec.ts`로 세션·결과 상태 3테마 × iPad 가로·iPhone 72장 검토 | U4: u45 되돌리기 + 문구, 앱 화면 UQ-2 |
| 4 | U4: 홈 주 조작 하나, 단계 "먼저 해 볼 연습", 튜너 2단·눌림 칩, 메트로놈 16vh BPM, 루틴 편집 sticky 저장 막대, 온보딩 진행 막대, 라이브러리 격자, 코드 상세, 시험 줄, 진도 표, 스케일 이름(D-092). 다크 4뷰포트 검토. 게이트: E2E 92 전부 통과, UQ 전부 0 | U5: 설정·진단·녹음 키트·고대비·온보딩 단계, 그다음 U6 |
| 5 | U5: 설정 "화면·판정·연습·세션" 카드, 진단·녹음 키트 카드와 진행 줄, 고대비 `bg-surface` 칸 안쪽 외곽선, 온보딩 단계 tint(D-093). 3테마 × iPad 가로·iPhone 검토. 감사 OPEN은 Low 0(F-34 WONTFIX) | U6 |
