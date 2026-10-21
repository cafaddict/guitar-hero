# PROGRESS — guitar-hero UI 마감 goal

> goal 실행자가 **매 턴 시작 시 읽고, 턴 끝에 갱신**한다. 컨텍스트가 압축된 뒤에는 이 파일과 `docs/goal/ui/SPEC.md`만으로 이어갈 수 있어야 한다.
> 상태 값: TODO / DOING / DONE. DONE에는 증거(테스트 이름·명령·커밋·파일 경로)를 적는다.

## 현재 상태

- 현재 마일스톤: **U2 (연습 화면)** — 진행 중(공통 뼈대 `PracticeStage`, 뷰 이전 중)
- 시작 지점: `cafaddict/ui`, 키트 커밋(D-088). 그 부모는 D-087 UI 개편 커밋.
- 마지막 갱신: 2026-10-21 (goal 실행자)
- 누적 턴(대략): 1
- 턴 상한: **400**
- 막힌 점: 없음
- 메모:
  - E2E·verify는 `E2E_PORT=4183 PROD_PORT=4184`로 실행한다(SPEC §2.5).
  - 타입 검사는 `npm run typecheck`(앱·node·worklet 3개 tsconfig)로 한다.
  - 같은 화면을 두 번 연달아 `openScreen`하면 같은 URL이라 다시 마운트되지 않는다. 다른 화면을 거쳐서 연다.
  - 빠른 촬영: `npx vite --mode e2e --port 5199 --strictPort`를 띄우고 `UI_SHOTS_BASE=http://localhost:5199`(필터와 함께)로 찍는다. 15초 안팎. 끝나면 서버를 끈다.
  - UQ 문제 수 세기: 로그에서 `UQ-n ` 접두 줄을 diff 기호·따옴표를 벗겨 중복 없이 센다(세 프로젝트 같은 줄은 1회).
  - U2에서 쓸 문구(ko.ts, U1 커밋 뒤에 더함): `exercises.common.readyTitle/readyMic/readyKeys`, `exercises.sequence.start`, 시퀀스 준비 안내의 "시작 버튼이나 Space로", 꼬리 버튼 "마치기"→"중단"(D-090).

## 마일스톤

| M | 이름 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| U1 | 기반 | DONE | `UI U1: 기반` | UQ-4·5·6·10 0(7·8 유지), 기존 E2E 86 통과, 단위 1902 통과 |
| U2 | 연습 화면 | TODO | | |
| U3 | 세션 러너 | TODO | | |
| U4 | 앱 화면 | TODO | | |
| U5 | 폼·도구·테마 | TODO | | |
| U6 | 마감 | TODO | | |

## UQ 문제 수 (SPEC §7.1-3)

`E2E_PORT=4183 PROD_PORT=4184 npx playwright test tests/e2e/ui-quality` 출력(두 파일)의 문제 줄을 `UQ-n` 접두로 센 값이다. 세 프로젝트(chromium-mic, webkit-ipad, webkit-iphone)에서 같은 줄은 한 번만 센다.

| 시점 | UQ-1 | UQ-2 | UQ-3 | UQ-4 | UQ-5 | UQ-6 | UQ-7 | UQ-8 | UQ-9 | UQ-10 | UR-1·2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 키트 기준(D-087 + 키트) | 84 | 28 | 5 | 36 | 1093 | 162 | 0 | 0 | 8 | 24 | 통과 |
| U1 끝 | 84 | 28 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 통과 |

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
