# guitar-hero UI 마감 goal — SPEC

> 이 문서는 Claude Code `/goal` 자율 실행의 **단일 진실 원천**이다. SHA-256으로 고정되며 실행 중 수정하지 않는다.
> 진행 상황은 `docs/goal/ui/PROGRESS.md`에, 결정은 `docs/goal/DECISIONS.md`(D-089부터)에, 화면 검토 기록은 `docs/goal/ui/UI_AUDIT.md`에 쓴다.

## 0. 이 문서를 읽는 법

- 매 턴 시작: `PROGRESS.md` → 이 문서의 해당 마일스톤 절(§7) → 필요한 절.
- 기능 명세는 `docs/goal/v1.1/SPEC.md`(고정, 수정 금지)가 그대로 유효하다. 특히 §12 UI/UX(레이아웃·키·문구·접근성)를 지킨다. 이 문서는 그 위에 **UI 품질**만 더한다.
- 출발점: D-087 UI 개편(앰프 톤 팔레트, 하단 탭바·사이드바, 연습 집중 모드, `src/ui` 공통 컴포넌트)과 D-088(이 goal 키트) 커밋.

### 0.1 고정 파일 (goal 조건문에 SHA-256으로 박힘, 수정 금지)

| 파일 | 내용 |
|---|---|
| `docs/goal/ui/SPEC.md` | 이 문서 |
| `tests/e2e/ui-quality.spec.ts` | UI 품질 게이트 1부: UQ-1–UQ-5, UQ-9 (모든 프로젝트) |
| `tests/e2e/ui-quality.chromium.spec.ts` | UI 품질 게이트 2부: UQ-6, UQ-7, UQ-8, UQ-10 (Chromium 전용) |
| `tests/integrity/ui-rules.test.ts` | 소스 규칙 UR-1–UR-2 |
| `tests/e2e/layout.spec.ts` | E2E-10 가로 스크롤 0, 연습 버튼 ≥ 64 px |
| `tests/e2e/a11y.spec.ts` | E2E-11 axe serious/critical 0, 3테마 |
| `tests/e2e/support/screens.ts` | 검사 대상 화면과 각 화면의 준비 상태 |

## 1. 목표

UI 전문가의 눈으로 앱 전체를 **"기타를 안은 초보가 바로 쓰는 연습 도구"** 수준으로 마감한다. 기능·판정·데이터는 바꾸지 않는다.

사용 맥락(설계 판단의 기준):
- 학습자는 완전 초보다. 손은 기타 위에 있고, 화면은 보면대나 책상 위 60–80 cm 거리에 있다. 연습 중에는 화면을 흘끗 본다.
- 기기 우선순위: **iPad 가로(1180×820) 1순위**, 그다음 iPhone 세로(390×844)·MacBook(1440×900)·iPad 세로(820×1180).
- 테마: 다크 기본, 라이트, 고대비. 세 테마 모두 같은 품질이어야 한다.
- 한국어 UI다. 줄바꿈·문장 길이·존댓말 규칙(v1.1 SPEC §12.4)을 지킨다.

성공의 모습:
1. 어느 화면이든 **첫 화면에서 다음에 할 일이 보이고**, 그 조작이 가려지지 않는다.
2. 연습 화면은 한눈에 읽힌다. 핵심 숫자는 크고(화면 높이 15–25 %), 상태(준비·진행·일시정지·결과)가 분명하며, 같은 구조를 공유한다.
3. 터치 타깃, 포커스, 대비, 모션, 한국어 줄바꿈이 기준을 만족한다(§5).
4. 같은 것은 같게 생겼다. 타이포·간격·카드·필드·버튼·배지가 `src/ui`의 공통 컴포넌트와 토큰으로 일관된다.

## 2. 자율 실행 규칙

### 2.1 브랜치와 커밋
- 브랜치 `cafaddict/ui`에서만 작업한다. 마일스톤 게이트(§7.1) 통과 후 그 브랜치에 커밋한다(메시지 `UI U<n>: <이름>`).
- push, 원격 추가, 다른 브랜치(`main`, `feat/*`) 수정·병합, 배포, force, 키트 커밋 이전 히스토리 재작성은 금지한다.
- Plan Mode 진입과 사용자 질문(AskUserQuestion)은 금지한다. 모호하면 이 문서의 기본값을 따르고, 없으면 보수적으로 고른 뒤 `docs/goal/DECISIONS.md`에 기록한다.

### 2.2 바꿔도 되는 것
- `src/ui/**`, `src/app/**`(라우트 추가 금지), `src/features/**`, `src/exercises/**`의 **렌더링 부분**(JSX·클래스·배치·표시용 컴포넌트), `src/i18n/ko.ts`(문구 다듬기만, 뜻은 유지), `index.html`의 meta.
- `tools/ui/**`(촬영 도구), 문서(`docs/**` 중 고정 파일과 `docs/goal/v1.1/**`·`docs/goal/SPEC.md`·`docs/goal/thresholds.json` 제외), `README.md`.
- 기존 테스트 파일(고정 파일 제외)은 §2.4 규칙 안에서만.

### 2.3 바꾸면 안 되는 것
- 고정 파일 7개(§0.1), `docs/goal/v1.1/**`, `docs/goal/SPEC.md`, `docs/goal/thresholds.json`.
- 동작: `src/domain`, `src/dsp`, `src/audio`, `src/data`, `src/content`, 워커·worklet, 판정 로직과 타이밍, 저장 스키마, 라우트 목록, 키 바인딩(v1.1 SPEC §12.3), `exercise-start`·`next-item` autofocus, `aria-live` 판정 안내.
- `package.json`의 dependencies·devDependencies와 `package-lock.json`(새 라이브러리·웹 폰트 금지. CSP `font-src 'self'`, `style-src 'self'`를 지킨다. `<style>` 블록 금지, 인라인 style 속성은 허용).
- 새 기능, 새 화면, 새 설정 항목. UI 개선에 필요한 표시 상태(예: 로딩 자리표시)는 허용한다. 키보드로만 할 수 있던 기존 동작에 터치 조작을 더하는 것(예: 시퀀스 연습의 Space 시작에 "시작" 버튼)은 새 기능이 아니라 허용·권장한다.
- 고정 테스트가 기대는 이름과 표식(바꾸면 고정 테스트가 깨진다):
  - 접근 가능한 이름: "마이크 없이 쓰기", 테마 라디오 "다크"·"라이트"·"고대비", §5.1 표의 이름(준비됐어요, 시작, 마이크 허용, 튜너 켜기 등)
  - testid: `exercise-start`, `exercise-pause`, `exercise-paused`, `exercise-finish`, `seq-flawless`, `seq-finish`, `session-header`, `end-session`, `focus-exit`, `start-session`, `resume-session`, `stage-practice-now`, `stage-practice-start`, `metronome-toggle`, `editor-save`, `k1-done`, 각 연습의 `*-view`, `e17-spelled`, `song-view`와 그 `data-phase`
  - 화면마다 보이는 `h1` 1개
- 연습 화면의 주 버튼은 `main` 안에 두고 `min-h-16` 클래스를 유지한다(E2E-10이 그 클래스로 찾는다). 화면 아래에 붙는 막대가 필요하면 `position: sticky`로 만든다. `fixed` 막대 안의 버튼은 E2E-10에서 빠진다.

### 2.4 기존 테스트를 고칠 때
- DOM 구조나 문구가 바뀌어서 따라 고치는 경우에만 허용한다. 단언 삭제·완화, skip, 타임아웃 늘리기, 검사 대상 축소는 금지한다.
- 테스트가 쓰는 `data-testid`와 `data-*` 속성, 접근 가능한 이름(버튼·링크 이름)은 유지하는 것이 기본이다. 바꿔야 하면 DECISIONS에 이유와 함께 파일·테스트 이름을 적는다.
- 고친 기존 테스트 파일 목록은 FINAL_REPORT에 모두 적는다.

### 2.5 실행 환경
- 다른 체크아웃의 `vite preview`가 4173을 잡고 있다. E2E와 verify는 항상 `E2E_PORT=4183 PROD_PORT=4184`를 붙여 실행한다. 그 프로세스는 건드리지 않는다.
- 10분 넘을 수 있는 명령(전체 E2E, verify, ui:shots 전체)은 백그라운드로 실행하고 로그 파일로 결과를 확인한다.
- 턴을 끝낼 때 dev 서버나 preview 서버를 남기지 않는다.
- `data/guitarset`은 다른 체크아웃의 데이터를 가리키는 심볼릭 링크다(`bench:guitarset`용). 지우거나 고치지 않는다.

### 2.6 시각 검토 루프 (필수)
화면을 바꿀 때마다 눈으로 확인한다. 테스트 통과만으로 끝내지 않는다.
1. `npm run ui:shots`(필터: `UI_SHOTS_THEMES`, `UI_SHOTS_VIEWPORTS`, `UI_SHOTS_SCREENS`)로 `ui-shots/<theme>/<viewport>-<screen>-{fold,full}.png`를 만든다(gitignore 대상. `test-results/`는 E2E가 실행마다 비우므로 쓰지 않는다). 빠르게 볼 때는 dev 서버를 띄우고 `UI_SHOTS_BASE=http://localhost:<port>`를 준다.
2. Read 도구로 **`-fold`(첫 화면)와 `-full`(전체)을 둘 다** 본다. fullPage 그림은 고정 탭바를 한 번만 그려서 첫 화면 가림을 숨긴다(vault 교훈 2026-10-21).
3. 발견은 `UI_AUDIT.md` §3 표에 남긴다(§6).

### 2.7 막혔을 때
- 같은 UQ 항목 때문에 마일스톤 게이트가 3회 연속 실패하면, 그 화면에 한해 더 단순한 배치를 택하고 DECISIONS에 기록한다. 게이트 자체를 바꾸는 선택지는 없다.
- 고정 파일의 결함(검사 불가능한 조건 등)을 발견하면 우회하지 말고 PROGRESS의 "막힌 점"에 증거와 함께 적고, 나머지 작업을 계속한다.

## 3. 기준 뷰포트와 상태

- 뷰포트 4개: macbook 1440×900, ipad-landscape 1180×820, ipad-portrait 820×1180, iphone 390×844. `lg`(1024 px) 이상은 사이드바, 미만은 하단 탭바다(D-087).
- 화면과 상태: `tests/e2e/support/screens.ts`의 `SCREENS`(준비 상태 포함). **첫 화면**이란 그 준비 상태에서 `scrollY = 0`일 때 보이는 영역이다.
- 테마 3개: `data-theme` = dark | light | contrast.

## 4. 개선 범위 (전문가 브리프)

아래는 무엇을 봐야 하는지의 목록이다. 정확한 방법은 실행자가 정하고, 중요한 선택은 DECISIONS에 남긴다.

### 4.1 기반
- **타이포 스케일**: 단계(예: 12·14·16·18·22·28·36 + 핵심 숫자)를 정하고 모든 화면이 그 단계만 쓴다. 연습 화면의 안내 문장은 60–80 cm에서 읽히는 크기(기본 16 px 이상, 연습 중 지시문은 18 px 이상 권장).
- **한국어 줄바꿈**: `word-break: keep-all`과 `overflow-wrap`(break-word 또는 anywhere)을 전역으로 둔다. 제목은 `text-wrap: balance`, 문단은 `text-wrap: pretty`를 쓴다. 한 글자만 다음 줄로 넘어가는 곳을 고친다.
- **문단 길이**: 넓은 화면에서 한 줄이 48em을 넘지 않게 한다(UQ-9).
- **간격·반경·경계**: 4 px 기반 간격 단계, 카드 반경·테두리·그림자 규칙을 하나로 맞춘다.
- **필드**: 입력·셀렉트·슬라이더·체크박스·라디오를 공통 스타일로 만든다. 높이 ≥ 44 px, 경계 대비 ≥ 3:1(UQ-10), 포커스·비활성·오류 상태를 갖춘다. 필요하면 `--field-border` 같은 토큰을 더한다(텍스트 대비 4.5:1은 그대로).
- **상태 표현**: 로딩(빈 화면 대신 자리표시), 비어 있음(EmptyState), 오류, 비활성의 모양을 정한다. 데이터를 기다리며 그린 틀은 `Screen`·`FocusScreen`의 `busy`(= `aria-busy="true"`)로 표시한다. `openScreen`은 busy인 요소가 없을 때까지 기다린다(D-088). 새 로딩 상태도 이 규칙을 따른다.
- **모션**: transform 위주로 짧게, 색·투명도 전환 금지(UQ-8), reduced-motion 존중(UQ-7).

### 4.2 연습 화면 (가장 중요)
- v1.1 SPEC §12.2를 화면마다 확인한다. **iPad 가로·MacBook은 2단**(왼쪽: 다이어그램·TAB·지판·패턴 같은 그림, 오른쪽: 핵심 숫자·상태·주 조작). iPad 세로·iPhone은 1단이고, 주 조작이 첫 화면에 들어온다(UQ-1).
- 모든 연습이 같은 뼈대를 쓴다: 집중 헤더 → (하는 법) → 무대(그림·숫자) → 주 조작 → 보조 조작·키 안내. 준비·진행·일시정지·결과 상태가 한눈에 구분된다.
- 핵심 숫자(남은 시간, BPM, 카운트인)는 화면 높이의 15–25 %(UQ-3)이고 `data-core-number`를 단다.
- 결과 화면은 결과 → 다음 할 일(다시 하기, 홈) 순서로 읽힌다.
- 하는 법 패널은 처음에는 열려 있고(D-079), 이미 본 연습에서는 무대를 가리지 않는다.
- 키보드로만 시작할 수 있는 상태가 없어야 한다. 키트 기준에서 시퀀스 연습(E9·E10·E11·E17)의 준비 상태는 Space로만 시작된다. iPad 터치로는 시작할 수 없으므로 High다.

### 4.3 세션 러너
- 헤더(진행·항목·남은 시간), 블록 전환 화면, 휴식 알림, 일시정지, 자가 평가, 분할 지점, 세션 끝의 위계를 정리한다. 세션 준비 상태에서도 주 조작이 첫 화면에 있다.

### 4.4 앱 화면
- 홈: 오늘 할 일과 "연습 시작"이 첫 화면 위쪽에 있다(D-087 보강).
- 커리큘럼·단계: 단계 화면에서 **연습을 시작하는 조작을 첫 화면에** 올린다(추천 연습의 "바로 하기" `stage-practice-now` 하나, 또는 고른 연습으로 시작 `stage-practice-start`). 배울 것·팁·진급 기준의 위계를 정리한다.
- 시험, 진도(차트 가독성, 세 테마의 차트 색), 도구 허브, 코드 라이브러리·코드 상세, 튜너(큰 cents 표시와 방향), 메트로놈(큰 BPM, 44 px 조작)을 다듬는다.

### 4.5 폼 화면
- 설정, 온보딩, 루틴 편집(저장 버튼이 첫 화면에 보이게. 예: 탭바 위에 붙는 sticky 저장 막대), 진단, 녹음 키트. 그룹·라벨·도움말·오류의 위계를 맞춘다.

### 4.6 테마 패리티
- 라이트·고대비를 다크와 같은 깊이로 본다. 고대비는 외곽선 훅(`.card`, `button`)을 유지한다.

### 4.7 범위 밖
- 새 기능·화면·설정, 콘텐츠(곡·커리큘럼) 변경, 오디오·DSP, 아이콘·브랜딩 재작업, 다국어.

## 5. 품질 게이트 (고정)

검사 코드는 `tests/e2e/ui-quality.spec.ts`·`tests/e2e/ui-quality.chromium.spec.ts`(E2E)와 `tests/integrity/ui-rules.test.ts`(단위)에 있다. `*.chromium.spec.ts`는 `playwright.config.ts`의 CHROMIUM_ONLY 목록으로 chromium-mic에서만 돈다. 아래는 그 정의다.

| ID | 무엇을 | 어디서 | 기준 |
|---|---|---|---|
| UQ-1 | 연습 화면의 주 조작 | `SCREENS` 중 `practice: true` 전부 + `stage-practice`, 4뷰포트 | 첫 화면에 보이는 `[data-primary-action]`이 **정확히 1개**다. 조건: 뷰포트 안에 있다, 넓이가 뷰포트의 절반 이하다, 화면별로 고정된 조작(§5.1, 테스트의 `PRIMARY`)을 하나 이상 담는다, 나가기·마치기·세션 끝내기·내비를 담지 않는다, 그 안의 조작마다 중심점이 가려지지 않는다(`elementFromPoint`) |
| UQ-2 | 앱 화면의 주 조작 | onboarding, home, stage, stage-10, tuner, metronome, routine-edit, 4뷰포트 | UQ-1과 같다 |
| UQ-3 | 핵심 숫자 | 전 화면 4뷰포트. practice-E1·practice-E5는 1개 이상 필수 | 보이는 `[data-core-number]`마다, 그 안에서 글자를 가진 요소 중 가장 큰 글자 크기가 화면 높이의 15–25 %이고, 가로로 화면 안이다 |
| UQ-4 | 터치 타깃 | 전 화면 4뷰포트, 문서 전체의 조작 요소 | 44×44 px 이상. 체크박스·라디오는 연결된 label 상자로 잰다. `p` 안의 인라인 링크와 1 px 이하(스크린 리더 전용) 요소는 제외 |
| UQ-5 | 한국어 줄바꿈 | 전 화면, iphone | `body`와 텍스트를 가진 모든 요소가 `word-break: keep-all`, `overflow-wrap`이 normal이 아니다(pre·code·kbd·samp·svg 안 제외) |
| UQ-6 | 포커스 표시 | 전 화면, 3테마, Chromium 1440×900, Tab 최대 40회 | 포커스된 요소마다 outline이 2 px 이상이고(box-shadow는 상시 그림자일 수 있어 인정하지 않는다) 화면 안에 보인다. 키트 기준에서 고대비 테마의 `[data-theme="contrast"] button { outline: 1px }`가 포커스 outline을 덮는다 |
| UQ-7 | reduced motion | 전 화면, Chromium | reduce에서 열면 transition·animation 길이 ≤ 10 ms, 실행 중 Web Animation ≤ 10 ms, smooth 스크롤 없음 |
| UQ-8 | 색 전환 금지 | 전 화면, Chromium | 길이가 0보다 큰 transition 속성(속성과 길이를 위치로 짝지음) 중에 all·color·background(-color)·opacity·fill·stroke·outline-color·text-decoration-color·caret-color·visibility가 없다 |
| UQ-9 | 줄 길이 | 전 화면, macbook·ipad-landscape | 텍스트를 가진 `p`의 실제 줄 폭이 그 글자 크기의 48배 이하(표·pre·svg·핵심 숫자 안 제외) |
| UQ-10 | 필드 경계 대비 | 전 화면, 3테마, Chromium | 텍스트형 input·select·textarea마다 테두리 또는 채움이 뒤 배경과 3:1 이상(rgb·`color(srgb)`·oklab·oklch 계산값을 읽는다) |
| UR-1 | 토큰 색만 | `src/**/*.{ts,tsx,css}`(i18n·content 제외) | Tailwind 기본 팔레트 색 클래스(`bg-slate-800`, `text-white` 등) 0개 |
| UR-2 | safe area | `src/**` | `env(safe-area-inset-top/right/bottom/left)`를 모두 쓴다 |

기존 게이트도 그대로다: E2E-10 레이아웃, E2E-11 axe(3테마), 그 밖의 모든 단위·E2E 테스트, `npm run verify`의 전 단계.

### 5.1 표식 규칙 (게이트를 속이지 않기 위한 정의)
- `[data-primary-action]`은 **그 상태에서 학습자가 다음에 누를 조작만** 감싼다. 화면마다 아래가 기준이다. 나가기·설정·보조 링크 같은 다른 조작을 함께 감싸지 않는다.

| 화면(상태) | 영역이 담아야 하는 조작(하나 이상) |
|---|---|
| onboarding | "마이크 허용" |
| home | `start-session` 또는 `resume-session` |
| stage, stage-10 | `stage-practice-now` 또는 `stage-practice-start` |
| tuner / metronome / routine-edit | "튜너 켜기·끄기" / `metronome-toggle` / `editor-save` |
| stage-practice, practice-E17-how-to, session(시작 전) | `exercise-start` 또는 "마이크 없이 쓰기" |
| practice-E1 | "준비됐어요" |
| practice-E2·E3·E5·E12·S-perform | 이름이 "시작"으로 시작하는 버튼 |
| practice-Q1·Q3·Q4·Q5 | 첫 답 선택지("1. …") |
| practice-K1 / practice-E16 | `k1-done` / "깨끗" |
| practice-E9·E10·E11·E17(진행) | `seq-flawless` |
| practice-E17-ready(진행 전) | 이름에 "시작"이 든 조작(키트 기준에는 없음 — 터치 시작 버튼을 더한다) |
| practice-S-paused | `exercise-pause`(이어서) |

이 표는 `tests/e2e/ui-quality.spec.ts`의 `PRIMARY`와 같다. 둘이 다르면 테스트가 기준이다.

- `[data-core-number]`는 연습 화면의 **큰 핵심 숫자**에 단다: 남은 시간(`BigTimer`), 템포(`BigBpm`), 카운트인 숫자. 같은 역할을 새로 그리면 거기에도 단다. 크기 기준을 피하려고 빼지 않는다.
- 제외(달지 않아도 된다): 제목·라벨 속 작은 BPM(예: 시퀀스 제목 "· 80 BPM"), 악보 안 표기, 도구 화면(메트로놈 BPM, 튜너 cents). 도구 화면에 달면 같은 크기 기준을 적용한다.
- 두 표식의 화면별 배치는 `UI_AUDIT.md` §1 표에 적는다.

## 6. UI 감사 (`docs/goal/ui/UI_AUDIT.md`)

- **§1 표식 표**: 화면마다 `data-primary-action`이 감싼 것과 `data-core-number` 위치.
- **§2 검토 범위표**: 화면 37개 × 테마 3 = 111행, 행마다 뷰포트 4칸. 칸에는 마지막으로 검토한 커밋을 적는다. 그 화면을 마지막으로 바꾼 커밋 이후에 검토되어야 한다(fold와 full을 모두 봤을 때만 기록).
- **§3 발견 표**: `ID | 화면 | 뷰포트/테마 | 휴리스틱 | 심각도 | 내용 | 조치 | 상태 | 커밋`. 상태는 OPEN, FIXED, WONTFIX(이유 필수).
- 휴리스틱:
  - H1 다음 할 일이 보인다
  - H2 위계(제목·강조·구획)
  - H3 공통 컴포넌트·토큰 일관성
  - H4 거리에서 읽힘
  - H5 상태가 빠짐없다(로딩·빈·오류·비활성·진행·일시정지·결과)
  - H6 판정과 상태 피드백(아이콘·모양·문구를 색과 함께)
  - H7 실수 방지
  - H8 터치 인체공학(이웃 타깃 간격 ≥ 8 px)
  - H9 한국어 문구의 맞춤(어색한 줄바꿈, 필수 정보 잘림)
  - H10 테마 패리티
  - H11 기기별 밀도
  - H12 모션 절제
- 심각도:
  - **High**: 할 일을 막거나 오도함, 또는 SPEC·WCAG 위반
  - **Medium**: 1순위 기기에서 눈에 띄는 마찰이나 불일치
  - **Low**: 다듬기
- 마감 기준: OPEN인 High·Medium 0개. Low는 WONTFIX도 허용하되 이유를 적는다.

## 7. 마일스톤

| M | 이름 | 끝날 때 0이어야 하는 UQ | 할 일 |
|---|---|---|---|
| U1 | 기반 | UQ-4, UQ-5, UQ-6, UQ-10 (UQ-7·8은 계속 0) | 먼저 `UI_SHOTS_DIR=ui-shots/before npm run ui:shots`로 전 화면 기준 촬영(이후 덮어쓰지 않는다)과 감사 시작(§6 §3에 초기 발견 등록). 그다음 §4.1 |
| U2 | 연습 화면 | + UQ-3, UQ-1(session 제외), 연습 화면의 UQ-9 | §4.2. 연습 화면 감사 High·Medium 해소 |
| U3 | 세션 러너 | + UQ-1 전부 | §4.3. 세션 상태 감사 |
| U4 | 앱 화면 | + UQ-2, UQ-9 전부 | §4.4 |
| U5 | 폼·도구·테마 | 전부 | §4.5, §4.6. 남은 High·Medium 해소 |
| U6 | 마감 | 전부 | 독립 리뷰 서브에이전트(코드·UI), 문서(§8 AC-UD), FINAL_REPORT, 최종 verify |

### 7.1 마일스톤 게이트
1. `npm run typecheck && npm run lint && npm test` 통과.
2. `E2E_PORT=4183 PROD_PORT=4184 npm run test:e2e`에서 `ui-quality*.spec.ts` 밖의 테스트가 모두 통과.
3. `ui-quality*.spec.ts`에서 그 마일스톤까지 배정된 UQ의 문제 수가 0. 나머지 UQ의 문제 수는 직전 마일스톤보다 늘지 않는다. UQ별 문제 수를 PROGRESS의 표에 적는다(출력의 `UQ-n` 접두로 센다).
4. 바꾼 화면을 §2.6 루프로 검토하고 UI_AUDIT를 갱신.
5. 커밋.

## 8. Acceptance Criteria

| AC | 내용 |
|---|---|
| AC-UG1 | `cafaddict/ui`에 키트 커밋 이후 U1–U6 커밋이 있고, `main`은 `9e7eda6` 그대로, upstream 없음, 작업 트리 clean. 실행자는 다른 브랜치에 쓰지 않는다(`feat/practice-feedback`은 다른 체크아웃에서 쓰이므로 값을 비교하지 않는다) |
| AC-UG2 | 고정 파일 7개의 SHA-256이 조건문의 값과 같다 |
| AC-UG3 | HEAD에서 `npm ci && E2E_PORT=4183 PROD_PORT=4184 npm run verify` exit 0, 요약표 전 단계 PASS |
| AC-UQ | 최종 verify의 E2E에서 `ui-quality.spec.ts`의 테스트 1개가 chromium-mic·webkit-ipad·webkit-iphone에서, `ui-quality.chromium.spec.ts`의 테스트 3개가 chromium-mic에서 통과(UQ-1–UQ-10). 단위에서 `ui-rules.test.ts` 통과(UR-1–UR-2) |
| AC-UX1 | UI_AUDIT §2 범위표가 전 화면 × 4뷰포트 × 3테마를 채우고, 각 칸이 그 화면의 마지막 변경 이후 커밋이다 |
| AC-UX2 | UI_AUDIT §3에 OPEN인 High·Medium 0개. 발견 수와 상태별 수를 FINAL_REPORT에 적는다 |
| AC-UX3 | 연습 화면 전부가 §4.2의 뼈대를 따르고, iPad 가로·MacBook에서 2단이다(화면별 근거를 UI_AUDIT §1에) |
| AC-UX4 | 동작 보존: 키 바인딩·autofocus·aria-live·판정 관련 기존 테스트가 단언 그대로 통과. 고친 기존 테스트 파일과 이유 목록이 FINAL_REPORT에 있다 |
| AC-UD1 | DECISIONS D-089부터 각 마일스톤의 주요 결정, README의 화면 구성 문단 갱신, `docs/MANUAL_VALIDATION.md`에 UI 실기기 항목(safe area, 터치, 60–80 cm 가독성, 세 테마) 추가 |
| AC-UD2 | U2와 U6에서 독립 리뷰 서브에이전트를 돌리고, 지적과 처리 결과를 DECISIONS에 적는다 |

## 9. 최종 보고

`docs/goal/ui/FINAL_REPORT.md`에 쓸 절:
1. 요약
2. 영역별 전후 비교(바뀐 점, 대표 스크린샷 경로 `ui-shots/...`, 전: `ui-shots/before/...`)
3. 품질 게이트 결과(UQ·UR 표)
4. UI_AUDIT 통계
5. 고친 기존 테스트 목록
6. 알려진 한계
7. 사용자 다음 할 일(실기기 확인, 병합 결정)

마지막 순서:
1. 문서·PROGRESS(AC 표의 증거 포함)·FINAL_REPORT를 마감하고 커밋한다.
2. 그 HEAD에서 `npm ci && E2E_PORT=4183 PROD_PORT=4184 npm run verify`를 실행한다.
3. 추적 파일을 더 고치지 않고 증거를 출력한다. verify가 실패하면 고치고 1부터 다시 한다. 마지막 증거 턴은 "매 턴 PROGRESS 갱신"의 예외다.

마지막 assistant 메시지 본문에 아래 명령 출력을 **그대로** 붙인다.
1. `git rev-parse --abbrev-ref HEAD`, `git log --oneline <키트 커밋>..HEAD`, `git status --short`, `git rev-parse --short main`, `git rev-parse --abbrev-ref --symbolic-full-name @{u}`(실패해야 정상)
2. `shasum -a 256` 고정 파일 7개
3. `bench-results/verify-summary.txt`
4. E2E 결과 JSON(`test-results/e2e-results.json`)에서 `ui-quality*.spec.ts` 테스트별 프로젝트·상태 목록, 단위 결과(`bench-results/vitest.json`)에서 `ui-rules.test.ts` 테스트별 상태
5. UI_AUDIT §2의 행 수(111)와 빈 칸 수(0), §3의 상태·심각도별 개수
6. `PROGRESS.md`의 AC 표
7. FINAL_REPORT의 1·3·4·6·7절
