# guitar-hero v1 — 구현 명세 (Goal Spec)

- 작성일: 2026-10-07
- 대상 실행자: Claude Code `/goal` 자율 실행 세션 (사람 개입 없음)
- 상태: **승인된 계획**. 이 문서가 단일 진실 원천(single source of truth)이다.
- 근거 리서치: `docs/research/01-practice-pedagogy.md`, `02-audio-chord-detection.md`, `03-product-and-stack.md`
- 진행 장부: `docs/goal/PROGRESS.md` (실행자가 갱신) · 결정 기록: `docs/goal/DECISIONS.md` (실행자가 추가)

---

## 0. 이 문서를 읽는 법

1. **처음 시작할 때**: §1–§5를 정독하고, §16 마일스톤 순서대로 진행한다. 각 마일스톤에 들어갈 때 그 마일스톤이 참조하는 절(§6–§15)을 다시 읽는다.
2. **매 턴 시작 시**: `docs/goal/PROGRESS.md`를 먼저 읽는다. 컨텍스트가 압축(compaction)된 뒤에도 PROGRESS.md만 보면 이어서 할 수 있어야 한다.
3. **우선순위**: 이 SPEC > `DECISIONS.md`에 기록한 결정 > 리서치 문서 > 일반 관행. 리서치 문서와 SPEC이 다르면 SPEC을 따른다.
4. **"설계값"** 이라고 표시된 수치는 근거가 약한 제안값이다. 앱 설정에서 조정 가능해야 하지만, **§14의 테스트 임계값과 테스트 매트릭스는 설계값이 아니라 고정 계약**이다.
5. 이 문서의 코드 조각은 인터페이스와 의도를 보여 주는 스케치다. 이름과 시그니처는 바꿔도 되지만 **의미(semantics)는 지켜야 한다.** 바꾸면 DECISIONS.md에 기록한다.

---

## 1. 제품 개요

### 1.1 한 문장

**완전 초보 성인이 어쿠스틱 기타를 "체계적으로" 배우도록, 매일의 연습 루틴을 짜 주고, 마이크로 듣고 정직하게 피드백하며, 진도를 숫자로 보여 주는 local-first 웹앱.**

### 1.2 사용자 (단 한 명)

| 항목 | 값 |
|---|---|
| 실력 | 완전 초보 (코드를 거의 모름) |
| 악기 | 스틸 줄 어쿠스틱 기타, 표준 튜닝, 오른손잡이 기본(왼손잡이 옵션 제공) |
| 기기 | MacBook 브라우저(Chrome/Safari), iPad(보면대 위, Safari), iPhone(Safari) |
| 언어 | 한국어 UI. 음악 용어는 관용 표기(코드 이름 `Am`, `D DU UDU` 등)를 그대로 쓴다 |
| 데이터 | 기기별 로컬 저장 + JSON 내보내기/가져오기. 서버·계정·동기화 없음 |
| 콘텐츠 | **앱 자체 커리큘럼**. 특정 강사의 영상·텍스트를 임베드하거나 복사하지 않는다. 연습 방법(1분 코드 체인지 등)은 일반 명칭으로 앱 문구를 새로 쓴다 |

### 1.3 핵심 약속 (모든 설계 판단의 기준)

1. **정직한 피드백**: 확신이 없으면 절대 "틀렸다"고 하지 않는다. 판정은 PASS / FAIL / RETRY 3상태이고, FAIL에는 반드시 "어느 줄이, 왜, 어떻게 고칠지"가 붙는다. 들을 수 없는 것은 "확인 불가"로 표시한다.
2. **체계적 루틴**: 오늘 무엇을 몇 분 할지 앱이 정해 준다. 약점 우선, 교대(interleave) 배치, 안전 상한을 지킨다.
3. **손은 기타 위에**: 핵심 조작은 키보드/블루투스 페달/첫 스트럼 자동 시작으로 가능해야 한다.
4. **자동 판정은 사람이 고칠 수 있다**: 자동 카운트에 ±1 보정, 자동 값·보정 값·자가 보고 값을 모두 저장한다.
5. **데이터는 사용자 것**: 오프라인 동작, 언제든 JSON으로 전부 내보낼 수 있다.

### 1.4 v1 성공 기준 (요약 — 정식 기준은 §17)

- Stage 0–7(초급 1 과정, 8개 개방 코드)의 커리큘럼·루틴·연습·졸업 시험이 처음부터 끝까지 동작한다.
- 마이크 판정(줄별 확인, 1분 코드 체인지 자동 카운트, 스트럼 타이밍, 튜너)이 §14의 합성·실녹음 벤치마크 임계값을 통과한다.
- MacBook/iPad/iPhone 화면 크기에서 깨지지 않고, 키보드만으로 하루 루틴을 끝까지 진행할 수 있다.
- `npm run verify` 한 번으로 타입체크·린트·단위테스트·라이선스·벤치마크·빌드·E2E가 모두 통과한다.

---

## 2. 자율 실행 규칙 (Operating Rules)

이 절은 사용자의 전역 규칙(`~/.claude/CLAUDE.md`)을 **이 goal 실행에 한해** 구체화한다. 충돌하면 이 절이 우선한다(사용자가 이 goal을 위해 명시적으로 승인한 내용이다).

### 2.1 계획과 질문

- 이 SPEC이 승인된 계획이다. **Plan Mode에 들어가지 않는다. `/taskloop`도 쓰지 않는다.**
- **사용자에게 질문하지 않는다**(AskUserQuestion 금지 — 아무도 답하지 않는다). 모호하면 SPEC의 기본값을 따르고, 기본값이 없으면 가장 보수적이고 되돌리기 쉬운 선택을 한 뒤 `DECISIONS.md`에 기록한다.

### 2.2 Git

- 작업 브랜치: **`feat/practice-app-v1`** (`main`의 `9e7eda6`에서 분기). 이미 있으면 그 브랜치에서 이어 간다.
- **마일스톤이 끝나고 `npm run verify`(그 시점에 존재하는 단계들)가 통과했을 때만** 그 브랜치에 커밋한다. 커밋 메시지: `M<n>: <요약>` + 본문에 완료한 AC ID 목록.
- 마일스톤 중간에도 큰 위험 작업 전에는 WIP 커밋(`wip(M<n>): ...`)을 해도 된다. WIP 커밋은 verify가 깨져 있어도 되지만, **마일스톤 종료 커밋은 반드시 verify 통과 상태**여야 한다. 히스토리를 고쳐 WIP를 지우지 않는다.
- **금지**: `git push`, 원격 추가, `main` 수정·병합·리베이스, `--force`, `reset --hard`(자기 WIP를 되돌릴 때 제외), 브랜치 삭제, 태그 push, 히스토리 재작성.
- `git commit` 전에 README 반영 여부를 확인한다(사용자 전역 규칙). 기능/스크립트/설정이 바뀌면 README를 갱신한다.

### 2.3 범위 밖 행동 금지

- 배포 실행 금지(설정 파일과 문서만 만든다). 외부 서비스 계정 생성·로그인 금지.
- 레포 밖 파일 수정 금지. 예외: npm 캐시, Playwright 브라우저 설치(`~/Library/Caches/ms-playwright`), 레포 안 `data/`(gitignore) 다운로드, §2.5의 vault 노트(`~/Documents/vault/` 아래 **새 노트 생성만**, 기존 노트 수정 금지).
- `~/.claude/` 설정, 훅, 스킬, 권한 설정을 바꾸지 않는다.
- 네트워크 사용 허용 범위: npm registry, Playwright 브라우저 다운로드, Zenodo(GuitarSet), 라이브러리 공식 문서 조회. 사용자 데이터나 녹음을 외부로 보내는 코드·요청 금지(앱에 텔레메트리 없음).

### 2.4 품질 무결성 (가장 중요)

- §14의 **임계값, 테스트 매트릭스 최소 차원, split 시드 범위, E2E 단언을 완화하지 않는다.** 이를 지키는 무결성 테스트(§14.6)를 수정하지 않는다.
- DSP 파라미터 튜닝은 **dev split에서만** 한다. test split 결과를 보고 파라미터를 고치는 것은 금지다. test split은 마일스톤 종료 시점과 최종 검증에서만 돌린다(개발 중 반복 실행 금지 — `bench:dsp:dev`를 쓴다). 그래서 전체 `npm run verify`는 마일스톤 종료 때 돌리고, 개발 중에는 개별 스크립트(`test`, `typecheck`, `bench:dsp:dev`, 특정 E2E)를 쓴다.
- 최종 상태에 `.skip`, `.only`, `test.fixme`, `// @ts-ignore`, `// @ts-expect-error`(타입 테스트 제외), `biome-ignore`(사유 주석 없이) 가 없어야 한다.
- 임계값을 도저히 못 맞추면: 원인 분석과 시도한 방법을 `DECISIONS.md`에 쓰고, SPEC 안의 대안 알고리즘(§10)을 시도한다. **임계값을 낮추거나 매트릭스를 줄이는 것은 해결책이 아니다.**
- 의존성 라이선스: MIT/BSD/ISC/Apache-2.0/0BSD/MPL-2.0(수정 없이 사용)/CC0/Unlicense만. **GPL/LGPL/AGPL 금지** (essentia.js, pitchfinder, aubio 등). `npm run licenses`가 강제한다.

### 2.5 진행 관리

- 매 턴 끝에 `PROGRESS.md`를 갱신한다: 현재 마일스톤, 완료한 AC(증거 포함), 다음 할 일 3개 이내, 막힌 점.
- 같은 문제로 5턴 넘게 진전이 없으면: 분석을 DECISIONS.md에 쓰고 접근을 바꾼다(SPEC 범위 안에서 더 단순한 대안).
- 턴을 끝낼 때 백그라운드 프로세스(dev server 등)를 남기지 않는다. E2E 서버는 Playwright `webServer` 설정으로 띄운다.
- **10분 넘는 명령**: 전체 `npm run verify`(15분 이상 예상)와 첫 GuitarSet 다운로드는 Bash 포그라운드 제한(10분)을 넘는다. `run_in_background`로 실행하고 완료 알림을 받은 뒤 결과를 확인한다(백그라운드 작업이 도는 동안 goal 평가는 미뤄지므로 문제없다). verify는 요약표를 `bench-results/verify-summary.txt`에도 쓴다. verify가 도는 동안 작업 트리를 수정하지 않는다.
- 서브에이전트는 써도 된다(독립적인 테스트 작성, 마일스톤 끝의 코드 리뷰). 두 에이전트가 같은 파일을 동시에 고치지 않게 한다. 마일스톤 M2·M5·M8 끝에는 리뷰 서브에이전트(`code-reviewer`)로 변경분을 검토하고, 확인된 결함은 고친다.
- 사용자 전역 규칙의 vault 기록은 **최종 턴 직전 1회**(세션 요약 + 핵심 결정 2–3개)로 한다. 중간 결정은 `DECISIONS.md`에 쓴다. vault 기록이 실패해도 goal 진행을 막지 않는다.

### 2.6 턴 예산 (소프트)

| M0 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | 합계 |
|---|---|---|---|---|---|---|---|---|---|
| 10 | 25 | 50 | 30 | 30 | 60 | 40 | 30 | 25 | 300 |

예산을 넘기면 PROGRESS.md에 사유를 적고 계속한다. 전체 300턴이 상한이다.

---

## 3. 범위

### 3.1 v1에 포함 (In)

- 온보딩: 마이크 권한, 입력 장치 선택, 환경 점검, 튜닝, 줄별 calibration, 지연(RTT) 측정
- 튜너(상시 접근 가능)
- 코드 라이브러리: 시드 보이싱 25개, 세로형 다이어그램, 기대 음, "스트럼 모드에서 확인 가능한 줄" 표시, 합성음으로 코드 들어 보기
- 메트로놈: lookahead 스케줄링, 악센트, 카운트인, 탭 템포, 시각 펄스, 시각 전용 모드, 음소거 마디, 템포 사다리
- 연습 유형(플러그인): §11의 v1 목록 전부
- 커리큘럼 Stage 0–7 전체 + Stage 8–11 미리보기(잠금, "다음 버전" 표시)
- 오늘의 루틴 자동 생성, 세션 러너, 진급 엔진, 간격 반복 복습 큐, 안전 규칙
- 진도 대시보드(차트), 연습 기록, 세션 후 자가 평가(통증·난이도·메모)
- 졸업 시험(Stage 7 → 8)
- local-first 데이터(Dexie), JSON 내보내기/가져오기, 백업 리마인더
- 녹음 키트(실측 fixture 녹음·내보내기)와 `bench:real`
- PWA 오프라인, 반응형(MacBook/iPad/iPhone), 접근성, 다크/라이트 테마
- 정적 호스팅 배포 준비(설정 파일 + 문서), LAN HTTPS 개발 서버

### 3.2 v1에서 제외 (Out → v2 backlog로 `docs/BACKLOG.md`에 기록)

- 정확 빠른 체인지(E3), 크로매틱(E9), 스케일 사다리(E10), 해머온(E11), 새끼손가락 운동(E12), 지판 음이름 확장(6·5번 줄), 인터벌 귀 훈련
- Stage 8–11의 실제 진행(콘텐츠 데이터는 포함, 잠금)
- 클라우드 동기화, 계정, 텔레메트리
- 버징(fret buzz) 판정, 스트럼 방향(업/다운) 판정, 같은 음의 줄 식별
- calibration template 기반 NNLS 분해, basic-pitch(ONNX) second opinion
- 실제 곡(저작권 곡) 콘텐츠, 백킹 트랙 오디오 파일
- WASM DSP 커널(프로파일상 필요가 증명될 때만)

---

## 4. 기술 스택

### 4.1 결정 (근거: 리서치 03 §4, 02 §6)

| 영역 | 선택 | 버전(2026-10-07 npm latest) | 비고 |
|---|---|---|---|
| 빌드 | Vite | ^8.3.3 | Rolldown 기반 |
| UI | React + React DOM | ^19.3.0 | `@vitejs/plugin-react` ^6.1.2. React Compiler는 선택(문제 생기면 끈다) |
| 언어 | TypeScript | ^7.0.2 | strict. 툴링 문제 시 `~6.0.3`으로 내리고 DECISIONS에 기록 |
| 스타일 | Tailwind CSS | ^4.3.3 | `@tailwindcss/vite` |
| 라우팅 | TanStack Router 또는 react-router 8 | latest | 화면 10개 내외. 택1 후 기록 |
| 영속 상태 | Dexie + dexie-react-hooks | ^4.4.6 / ^4.4.0 | `useLiveQuery` |
| UI 상태 | Zustand | ^5.0.15 | 저빈도 상태만 |
| 스키마 | Zod | ^4.6.5 | 콘텐츠 시드, import/export, 플러그인 params/result |
| 다이어그램 | svguitar | ^2.8.0 | 세로형, 손가락 번호, x/o, 바레, 왼손잡이 미러 |
| 음악 이론 | tonal | ^6.5.0 | 코드 구성음 검증용 |
| 차트 | Recharts | ^3.10.1 | 진도 대시보드 |
| PWA | vite-plugin-pwa | ~1.3.0 | 2.0.0은 출시 4일차 → 1.3 고정. `registerType: 'prompt'` |
| 단위 테스트 | Vitest | ^5.0.3 | Node ≥ 22.12 (로컬 Node 24.3 확인됨) |
| E2E | @playwright/test | ^1.63.0 | Chromium + WebKit |
| 접근성 검사 | @axe-core/playwright | latest | |
| Lint/Format | Biome | ^2.5.15 | `noExplicitAny` = error |
| LAN HTTPS | @vitejs/plugin-basic-ssl | ^2.3.0 | `npm run dev:https` |
| 타입 | @types/audioworklet | latest | AudioWorklet 전역 스코프 |
| DSP | **순수 TypeScript 자체 구현** | — | FFT, window, YIN/MPM, onset, salience, 판정기. `pitchy`(MIT)는 써도 되지만 자체 구현 권장 |
| 패키지 매니저 | npm | 11.x | lockfile 커밋 |

### 4.2 DSP 구현 언어 결정: TypeScript (WASM 아님)

- 근거: 계산량이 작다(스트럼당 8192-pt FFT 1–3회, onset용 2048-pt FFT 초당 약 190회). 같은 코드를 Node(Vitest, 벤치마크)와 브라우저(AudioWorklet/Worker)에서 그대로 돌리는 것이 품질에 가장 크게 기여한다. GPL/AGPL C/C++ 라이브러리를 피할 수 있다.
- WASM(C++/Rust)은 v2에서 **프로파일로 필요가 증명된 커널만** 옮긴다(§14.3 성능 임계값을 TS로 못 맞출 때). v1에서는 만들지 않는다.

### 4.3 금지 의존성

`essentia.js`(AGPL), `pitchfinder`(GPL-3.0), `aubio`/`aubiojs`(GPL), `@spotify/basic-pitch`(v1 범위 밖), 대형 UI 키트(MUI 등 — Tailwind로 충분), 상태 관리 대형 프레임워크(Redux 등).

---

## 5. 아키텍처

### 5.1 계층

```
┌──────────────────────────── UI (React, main thread) ────────────────────────────┐
│ routes · screens · exercise Views · canvas 미터(rAF 직결) · i18n(ko)              │
└───────────────▲───────────────────────────────▲───────────────────────────────────┘
                │ 판정 이벤트(초당 수 회)          │ useLiveQuery
┌───────────────┴──────────┐        ┌───────────┴───────────────┐
│ features/ (플러그인 러너, │        │ data/ (Dexie, repo,        │
│ 세션 러너, 진급 엔진)     │───────▶│ export/import, migrations)│
└───────────────▲──────────┘        └───────────────────────────┘
                │ AudioEngine API (start/stop, subscribe)
┌───────────────┴──────────────────────────────────────────────────────────────────┐
│ audio/ AudioEngine(main): AudioContext, MediaStream, 메트로놈 스케줄러, 합성 재생    │
│   ├─ worklet/capture-processor  : ring buffer, RMS/clip, onset ODF(hop 256)         │
│   └─ worker/dsp-worker          : 검증·분류·튜너·RTT (dsp/ 호출)                    │
└───────────────▲──────────────────────────────────────────────────────────────────┘
                │ 순수 함수 호출 (Float32Array, sampleRate, params) → result
┌───────────────┴──────────────────────────────────────────────────────────────────┐
│ dsp/  순수 TS. DOM·Web Audio 타입 import 금지. Node에서 그대로 실행                 │
│ domain/ 순수 TS. 음악 이론, 보이싱→기대음, 충돌 맵, 커리큘럼 규칙, 스케줄링, 지표    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

규칙:
- `src/dsp/**`, `src/domain/**`는 **순수 모듈**이다: `window`, `document`, `AudioContext`, `indexedDB`, React를 import하지 않는다. 시간은 인자로 받는다(`now`를 주입). 이 규칙은 테스트(§14.6)로 강제한다.
- 60fps 시각화(레벨 미터, 줄별 인디케이터, 비트 펄스)는 React state를 거치지 않고 `requestAnimationFrame` + canvas로 그린다. React는 "판정 이벤트" 수준(초당 수 회)만 다룬다.
- `AudioEngine`은 React 바깥의 싱글턴 클래스다. `start()`/`dispose()` 쌍으로 자원을 소유한다(RAII처럼). React는 구독만 한다.
- Worklet ↔ Worker 통신은 v1에서 `MessagePort` + Transferable `Float32Array`로 한다. SharedArrayBuffer는 COOP/COEP가 필요하므로 v1에서 쓰지 않는다.

### 5.2 디렉토리 구조 (권장, 의미가 같으면 조정 가능)

```
/
├─ index.html · package.json · package-lock.json
├─ vite.config.ts · tsconfig*.json · biome.json · vitest.config.ts · playwright.config.ts
├─ public/                      # 아이콘, manifest 자산, _headers
├─ src/
│  ├─ app/                      # 앱 셸, 라우트, 레이아웃, 테마, 키 바인딩 provider
│  ├─ ui/                       # 공용 컴포넌트 (BigButton, BigNumber, LevelMeter(canvas), ChordDiagram, VerdictBadge)
│  ├─ i18n/ko.ts                # 모든 UI 문자열 (하드코딩 금지)
│  ├─ domain/                   # 순수: theory, voicing, partials, curriculum, routine, progression, srs, metrics
│  ├─ content/                  # 시드 JSON + zod 스키마: voicings, curriculum, routines, songs, tips
│  ├─ dsp/                      # 순수: fft, window, pitch(yin/mpm), onset, salience, chroma,
│  │                            #       verify/pluck(Mode A), verify/strum(Mode B), classify(Mode C),
│  │                            #       timing(Mode D), tuner, rtt, synth(KS/additive), version.ts
│  ├─ audio/                    # AudioEngine, metronome scheduler, worklet/, worker/, device, ios-session
│  ├─ features/
│  │  ├─ onboarding/  tuner/  calibration/  library/  metronome/
│  │  ├─ exercises/             # registry + 플러그인별 폴더 (§11)
│  │  ├─ routine/               # 오늘의 루틴, 세션 러너
│  │  ├─ curriculum/            # 단계/레슨 화면, 졸업 시험
│  │  ├─ progress/              # 대시보드, 기록
│  │  └─ settings/              # 장치, 테마, 왼손잡이, 엄격도, 백업, 녹음 키트, 진단
│  └─ data/                     # Dexie db, repositories, export/import, migrations, derive
├─ tools/
│  ├─ bench/                    # 합성 벤치마크(dev/test split), GuitarSet 벤치, real 벤치, 리포트
│  ├─ guitarset/                # 다운로드(체크섬), JAMS 파서, 이벤트 추출
│  ├─ fixtures/                 # E2E용 WAV 생성기 (dsp/synth 재사용)
│  ├─ licenses.ts               # 라이선스 검사
│  └─ verify.ts                 # verify 오케스트레이터(요약표 출력)
├─ tests/
│  ├─ e2e/                      # Playwright 스펙 + support/fakeMic.ts
│  ├─ integrity/                # §14.6 무결성 테스트
│  └─ fixtures/{generated,real}/ # generated는 결정적 생성, real은 사용자가 녹음 키트로 추가
├─ data/                        # (gitignore) GuitarSet 등 대용량
├─ bench-results/               # (gitignore) 벤치마크 JSON
└─ docs/  research/ goal/ ARCHITECTURE.md DSP.md BENCHMARK.md DEPLOY.md MANUAL_VALIDATION.md BACKLOG.md
```

### 5.3 npm scripts (계약)

| script | 내용 |
|---|---|
| `dev` | Vite dev server (localhost) |
| `dev:https` | `--host` + basic-ssl. 같은 Wi-Fi의 iPad/iPhone 접속용 |
| `build` / `preview` | 정적 빌드 / 프리뷰 서버 |
| `typecheck` | `tsc --noEmit` (모든 tsconfig 프로젝트) |
| `lint` | `biome check .` |
| `test` | Vitest 단위·통합 테스트 (Node) |
| `bench:dsp:dev` | 합성 dev split 벤치마크 (개발 중 반복용) |
| `bench:dsp` | 합성 **test split** 벤치마크. 임계값 미달 시 exit 1. `bench-results/dsp-test.json`, `docs/BENCHMARK.md` 생성 |
| `bench:guitarset` | GuitarSet 실녹음 벤치마크 (§14.4). 데이터 없으면 다운로드 시도 |
| `bench:real` | `tests/fixtures/real/**` 실측 녹음 벤치마크. 파일이 없으면 "no fixtures"로 성공 종료 |
| `fixtures:generate` | E2E용 WAV 결정적 생성 |
| `licenses` | 프로덕션 의존성 라이선스 검사 |
| `test:e2e` | Playwright 전체 프로젝트 |
| `verify` | `tools/verify.ts`: licenses → typecheck → lint → test → bench:dsp → bench:guitarset → build → test:e2e 순서로 실행, 단계별 PASS/FAIL/BLOCKED·소요 시간 요약표를 출력, 하나라도 FAIL이면 exit 1 |

---

## 6. 음악 도메인과 콘텐츠

### 6.1 튜닝과 줄 번호 규약

- 내부 배열 인덱스 `i = 0..5`는 **6번 줄(저음 E)부터 1번 줄(고음 E)** 순서다. UI 표기는 기타 관례대로 "6번 줄 … 1번 줄"을 쓴다. 이 변환은 한 곳(`domain/strings.ts`)에서만 한다.
- 표준 튜닝 MIDI: `[40, 45, 50, 55, 59, 64]` (E2 A2 D3 G3 B3 E4). `f = 440 · 2^((m − 69)/12)`.
- 튜닝은 `Tuning { id, name, openMidi: number[6] }`로 표현하고 capo는 `+c`로 처리한다(v1 UI는 표준 튜닝·capo 0만 노출, 모델은 일반형).
- 캘리브레이션에서 측정한 줄별 cents 오프셋 `δ[i]`를 기대 주파수에 반영한다: `f0[i] = 440 · 2^((m[i] − 69)/12) · 2^(δ[i]/1200)`.

### 6.2 보이싱 모델

```ts
type Fret = number | 'x';                 // 'x' = 치지 않는 줄(뮤트), 0 = 개방현
type FingerId = 1 | 2 | 3 | 4 | 'T';
interface ChordVoicing {
  id: string;                             // 'C', 'G-3f' ...
  symbol: string;                         // tonal로 해석 가능한 코드 심볼 ('C', 'G', 'Fmaj7', 'G5')
  nameKo?: string;                        // 선택: 'G (두 손가락)'
  frets: readonly Fret[];                 // 길이 6, 6번→1번 줄
  fingers: readonly (FingerId | 0 | null)[]; // 0 = 개방, null = 뮤트
  barres?: readonly { fret: number; fromIdx: number; toIdx: number; finger: FingerId }[];
  baseFret: number;                       // 다이어그램 시작 프렛(1 = 너트)
  stage: number;                          // 도입 스테이지
  tags: readonly string[];                // ['open', 'beginner1'] ...
}
```

파생 함수(순수, `domain/voicing.ts`):
- `expectedNotes(voicing, tuning, capo, deltaCents?) → { idx, midi, f0 }[]` (x 줄 제외)
- `mutedStrings(voicing) → idx[]`
- `anchors(a, b) → { finger, idx, fret }[]` : 두 보이싱에서 **같은 손가락이 같은 (줄, 프렛)** 에 있으면 앵커. 같은 손가락이 같은 줄에서 프렛만 바뀌면 `slides`로 별도 반환. 앵커/공중 체인지 드릴(§11 E4)이 이것을 쓴다. 손으로 앵커 메타데이터를 쓰지 않는다.
- `partialCollisionMap(voicing, tuning, params) → { idx, verifiable: boolean, independentPartials: number[] }[]` (§6.3)

### 6.3 스트럼 모드 검증 가능성(partial 충돌 맵) — 고정 규칙

스트럼(한 번에 긁기)에서는 줄 하나가 뮤트돼도 다른 줄의 배음이 그 주파수를 채울 수 있다(예: open C의 2번 줄 C4 = 5번 줄 C3의 2배음). 그래서 보이싱마다 "스트럼으로 확인 가능한 줄"을 미리 계산한다.

**기본 규칙(v1 고정)**:
- 줄 `s`의 partial `h = 1..8` (주파수 ≤ 5 kHz, inharmonicity `B = 5e-5` 반영)
- partial이 **다른 모든 연주 줄 `o ≠ s`의 partial `k = 1..16`** 중 하나와 ±35 cents 안이면 "충돌"
- `f0[s] < 120 Hz`인 줄은 `h = 1`을 독립 partial로 세지 않는다(노트북·휴대폰 마이크의 저역 roll-off)
- **독립 partial이 2개 이상이면 `verifiable = true`**

이 규칙을 바꾸려면 DECISIONS.md에 근거를 쓰고, §14.3의 "검증 가능 줄 커버리지"가 기본 규칙보다 **떨어지지 않아야** 한다(커버리지를 줄여 지표를 좋게 만드는 것 금지).

단위 테스트 필수 사례: open C(`x32010`)에서 5번 줄(C3)은 verifiable, 2번 줄(C4)은 verifiable이 아니다. UI(코드 라이브러리, Chord Perfect 화면)는 verifiable이 아닌 줄에 "스트럼으로는 확인 불가 — 한 줄씩 튕겨서 확인" 표시를 한다.

### 6.4 시드 보이싱 (25개)

`frets`와 `fingers`는 6번→1번 줄 순서. 손가락 번호는 교수법 리서치(01 §1.3, §5.2)를 따른 **제안값**이며, 테스트로 물리적 타당성(같은 손가락이 바레 없이 서로 다른 프렛에 동시에 놓이지 않음, 손가락 번호는 프렛 순서와 대체로 단조)을 검사한다.

| id | symbol | frets | fingers | stage | 비고 |
|---|---|---|---|---|---|
| D | D | x x 0 2 3 2 | – – 0 1 3 2 | 1 | |
| A | A | x 0 2 2 2 0 | – 0 2 1 3 0 | 1 | 1번 손가락이 3번 줄 2프렛 → D와 앵커 공유 |
| E | E | 0 2 2 1 0 0 | 0 2 3 1 0 0 | 2 | |
| Em | Em | 0 2 2 0 0 0 | 0 2 3 0 0 0 | 3 | |
| Am | Am | x 0 2 2 1 0 | – 0 2 3 1 0 | 3 | |
| Dm | Dm | x x 0 2 3 1 | – – 0 2 3 1 | 4 | |
| C | C | x 3 2 0 1 0 | – 3 2 0 1 0 | 5 | |
| G-2f | G | 3 x 0 0 0 3 | 2 – 0 0 0 3 | 6 | 두 손가락 G. 5번 줄은 2번 손가락으로 살짝 뮤트 |
| G-3f | G | 3 2 0 0 0 3 | 2 1 0 0 0 3 | 6 | Stage 6 후반 |
| G-4f | G | 3 2 0 0 3 3 | 2 1 0 0 3 4 | 8 | 미리보기 |
| Cadd9 | Cadd9 | x 3 2 0 3 3 | – 2 1 0 3 4 | 8 | 미리보기 |
| Dsus4 | Dsus4 | x x 0 2 3 3 | – – 0 1 3 4 | 8 | 미리보기 |
| A7sus4 | A7sus4 | x 0 2 0 3 3 | – 0 1 0 3 4 | 8 | 미리보기 |
| Em7 | Em7 | 0 2 2 0 3 3 | 0 1 2 0 3 4 | 8 | 미리보기 |
| Fmaj7 | Fmaj7 | x x 3 2 1 0 | – – 3 2 1 0 | 9 | 미리보기 |
| F-small | F | x x 3 2 1 1 | – – 3 2 1 1 | 9 | 1번 손가락 2·1번 줄 미니 바레 |
| F | F | 1 3 3 2 1 1 | 1 3 4 2 1 1 | 9 | 1프렛 풀 바레 |
| G5 | G5 | 3 5 5 x x x | 1 3 4 – – – | 10 | R6 파워코드 |
| C5 | C5 | x 3 5 5 x x | – 1 3 4 – – | 10 | R5 파워코드 |
| A7 | A7 | x 0 2 0 2 0 | – 0 2 0 3 0 | 11 | |
| D7 | D7 | x x 0 2 1 2 | – – 0 2 1 3 | 11 | |
| E7 | E7 | 0 2 0 1 0 0 | 0 2 0 1 0 0 | 11 | |
| G7 | G7 | 3 2 0 0 0 1 | 3 2 0 0 0 1 | 11 | |
| C7 | C7 | x 3 2 3 1 0 | – 3 2 4 1 0 | 11 | |
| B7 | B7 | x 2 1 2 0 2 | – 2 1 3 0 4 | 11 | |

필수 검증 테스트: 모든 보이싱의 기대 음 pitch-class 집합이 `symbol`의 구성음 집합의 부분집합이고, 루트를 포함하며, 3음(파워코드·sus 코드는 제외)을 포함한다(`tonal`로 계산).

### 6.5 핵심 체인지 쌍 25개 (Stage 0–7)

`A–C, A–G, A–E, A–Em, A–D, A–Dm, C–G, C–E, C–D, C–Dm, C–Am, C–Em, G–E, G–D, G–Dm, G–Am, G–Em, E–D, E–Dm, E–Am, D–Am, D–Em, Dm–Am, Dm–Em, Am–Em`

- 쌍 키는 정렬된 문자열 `pair:A|C`. 방향이 있는 항목(1분 체인지 "A→D")은 `pairdir:A>D`.
- G가 들어간 쌍은 사용자가 현재 쓰는 G 보이싱(G-2f 또는 G-3f)을 쓴다(설정/진급 상태에서 결정).

### 6.6 연습곡 (앱 자체 창작, 최소 8곡)

저작권 곡 대신 **앱이 만든 코드 진행 연습곡**을 쓴다. 형식:

```ts
interface PracticeSong {
  id: string; title: string;            // 한국어 제목 (예: '첫걸음 블루스')
  stage: number; timeSignature: '4/4' | '6/8';
  bpmDefault: number; bpmMin: number; patternId: string; // §11 E5 패턴
  sections: { name: string; bars: string[] /* 마디별 보이싱 id */ ; repeat: number }[];
}
```

- Stage 1–7마다 최소 1곡, 총 8곡 이상. 각 곡은 그 스테이지까지 배운 코드만 쓴다(테스트로 검사).
- 예: Stage 1 `| D | D | A | A |` ×4, P0, 60 BPM. Stage 6 `| G | C | D | G |` 계열, P3, 70 BPM.
- 곡 연습 화면은 합성 스트럼으로 "들어 보기"를 제공한다(마이크 판정 중에는 재생하지 않음).

### 6.7 코칭 힌트 (결정적 규칙)

판정 결과에서 힌트를 **규칙으로** 만든다(`domain/coaching.ts`, 단위 테스트 필수). 문구는 `i18n/ko.ts`.

| 판정 | 조건 | 힌트(요지) |
|---|---|---|
| MUTED, 개방현 줄 s | 인접 줄(s±1)에 손가락 f가 있음 | "f번 손가락이 s번 줄에 닿고 있을 수 있어요. 손끝을 세워 보세요" |
| MUTED, 누르는 줄 s(손가락 f) | — | "f번 손가락을 프렛 바로 뒤에 붙이고 손끝으로 눌러 보세요" |
| WRONG_NOTE, +1/−1 반음, 누르는 줄 | — | "한 칸 높은/낮은 프렛을 누르고 있어요" |
| WRONG_NOTE, 개방현 기대인데 더 높음 | — | "s번 줄은 누르지 않아요(개방현)" |
| UNEXPECTED, x 줄 s가 울림 | 최저 연주 줄 r | "s번 줄은 치지 않아요(x). r번 줄부터 스트럼하세요" |
| WEAK | — | "조금 더 세게, 또는 기기를 기타 가까이(30–60cm)" |
| 공통(반복 실패 3회) | — | 일반 팁 순환: 엄지 위치, 손톱 길이, 프렛 가까이, 힘 빼기 |

---

## 7. 커리큘럼, 루틴, 진급

근거: 리서치 01 §5. 수치 중 [근거] 표시가 없는 것은 설계값이며 설정에서 조정 가능하다.

### 7.1 Stage 0–7 (v1에서 진행 가능)

| Stage | 이름 | 신규 내용 | 포함 연습(§11 ID) | 진급 기준 (모두 충족, 최소 4세션 체류) |
|---|---|---|---|---|
| 0 | 준비 | 튜닝, 자세, 피크, 다이어그램 읽기, 프렛 가까이 누르기 | E0 튜너, Q1 다이어그램 퀴즈, E5-P0 뮤트 스트럼(박 세기) | 튜너로 6줄 튜닝 완료 3회, 다이어그램 퀴즈 ≥90% |
| 1 | 첫 두 코드 | D, A | E1(D, A), E4 앵커(D↔A), E2 A→D / D→A, E5-P0, S 곡 | D·A 코드 기억 퀴즈(Q2) 3초 내 통과, E2 A↔D ≥30 [근거] (또는 3주 정체 시 조건부 진급) |
| 2 | 세 번째 코드 + 박 | E | + E6 박1 체인지(A–D–E), E2 A–D·A–E·D–E | E 퀴즈 통과, 세 쌍 각 ≥30, 연습곡 1곡 완주 자가 보고 |
| 3 | 마이너 + 업스트럼 | Em, Am | E5-P1, E5-P2(뮤트), E2 Am–E·Em–D·Am–Em | Em·Am 퀴즈 통과, 학습 쌍 ≥30, P2 뮤트 70 BPM 통과 |
| 4 | 메트로놈 + 표준 패턴 | Dm | E7 스트레칭, E5-P3(뮤트→단일 코드→체인지) | 6코드 퀴즈 통과, P3 뮤트 80 BPM 통과 |
| 5 | C 코드 | C | E2 Am–C·C–Em, 타이밍 중심 E5 | 7코드 퀴즈 통과, 학습 쌍 ≥30, 체인지 포함 P3 70 BPM |
| 6 | G + 교대 피킹 | G-2f → G-3f | E8 교대 피킹, E2 G–C·G–D·C–D, E5-P5(6/8), Q3 개방현 음이름 | 8코드 퀴즈 통과, ≥30, E8 8분음표 70 BPM, P5 시도 기록 |
| 7 | 통합 | 8코드 정리 | E4 공중 체인지, 25쌍 순환, Q4 메이저/마이너 귀 훈련, 곡 암기 | **졸업 시험**(§7.6) |

"학습 쌍 ≥30" = 그 스테이지까지 해금된 코드로 이루어진 25쌍 부분집합의 **모든 쌍이 서로 다른 2일에 ≥30**(양방향 중 하나라도). [근거: 01 §5.4 E2]

### 7.2 Stage 8–11 (미리보기, 잠금)

01 §5.2 표의 Stage 8–11 내용을 콘텐츠 데이터로 넣고, 화면에서는 "다음 버전에서 열립니다"와 함께 내용 요약만 보여 준다. 진급 엔진은 Stage 7 졸업 후 "초급 1 수료" 상태로 멈춘다.

### 7.3 오늘의 루틴 생성 (`domain/routine.ts`, 순수·결정적)

입력: 현재 스테이지, 스킬 상태(지표), 마지막 연습일, 오늘 날짜, 통증 보고, 설정(세션 길이), 시드. 출력: `RoutineItem[]`(연습 ID, 파라미터, 시간).

규칙:
1. 세션 길이 기본 20분(Stage 0–7). 첫 4주는 20분 상한(초과 시 확인 대화상자). [근거]
2. 순서: 튜닝(1분) → 워밍업(1–2분, Stage 4+는 E7, 그 전은 가벼운 뮤트 스트럼) → 코드 정밀(신규 코드 1–2분 + 정확도 최저 코드 1분) → 1분 체인지 2–3쌍(쌍 사이 30초 휴식) → 리듬/스트럼 2분 → 기술(E4/E8 등) 1–2분 → **연습곡 9–10분(항상 마지막)**. [근거: 01 §5.3]
3. 1분 체인지 쌍 우선순위: 신규 코드 포함 > 최근 3회 중앙값 최저 > 마지막 연습일 오래됨. 하루 1분 체인지 총 6회 상한. [설계값]
4. 같은 연습 항목을 연속 배치하지 않는다(interleave). 단 신규 코드의 첫 노출은 짧은 blocked 연습 후 교대.
5. 마지막 연습 후 3일 초과 공백이면 첫 블록을 직전 스테이지 복습으로 바꾼다. [근거]
6. 복습 큐(§7.5)에서 오늘 due인 항목을 "복습 슬롯"(최대 3분)으로 넣는다.
7. 직전 세션 통증 ≥5/10이면 손끝 부하 항목(E1, E2) 시간을 50% 줄이고 안내한다. "날카로운 통증·저림·관절/손목 통증" 보고 시 오늘 루틴 대신 휴식 안내(의학적 조언 아님 고지). [근거]
8. 연속 30분 연습 시 휴식 알림. [근거]
9. 사용자가 루틴을 편집(항목 추가/삭제/시간 변경)할 수 있고, 편집본은 템플릿으로 저장된다.
10. 같은 입력(시드 포함) → 같은 출력. 단위 테스트로 규칙 1–8을 각각 검증한다.

### 7.4 진급 엔진 (`domain/progression.ts`)

- 스테이지 진급 기준(§7.1)을 **데이터로 표현**한다(`UnlockRule[]`: metricAtLeast, quizPassed, selfReport, sessionsAtLeast, daysDistinct ...). 코드에 스테이지별 if문을 쓰지 않는다.
- 조건부 진급: 어떤 쌍의 1분 체인지 중앙값이 3주 동안 +2 미만으로만 오르면 "조건부 진급 가능"을 제안하고, 다음 스테이지 루틴에 앵커/공중 체인지 드릴을 처방한다. [근거: 01 §1.2 "after a few weeks, you can move"]
- 정체 감지: 2주 동안 핵심 지표 개선 없음 → 대체 연습 처방 또는 조건부 진급 제안.
- 코드 습득/숙달: 해당 코드 최근 10회 Chord Perfect 시도 중 clean ≥5 → 습득, ≥8 → 숙달. clean은 **Mode A(한 줄씩) 전부 OK**이거나 수동 줄별 체크 전부 clean인 시도다. Mode B(스트럼 베타) PASS는 참고 지표로만 집계한다.

### 7.5 복습 큐 (간격 반복)

- 졸업한 항목(코드, 쌍, 패턴, 연습곡)은 복습 큐로 간다. 간격: 1 → 3 → 7 → 14 → 30 → 90일. 복습 실패 시 한 단계 후퇴. [설계값, 근거 변형]
- 연습곡은 1주 → 2주 → 1개월 → 3개월 → 6개월 → 1년. [근거]
- 스트릭은 **주 단위**(주 4회 이상 연습한 주의 연속 수). [03 §2.5]

### 7.6 초급 1 졸업 시험 (Stage 7 → 수료)

01 §5.5를 측정 가능하게 구현한다. 한 번에 다 할 필요 없이 항목별로 통과 기록이 남는다.
1. 튜너로 6줄 튜닝 완료(튜너 판정 ±5 cents 이내 6줄).
2. 무작위 순서 8코드: 이름 제시 → 3초 내 스트럼, 코드 기억 퀴즈(Q2) 정답 + 코드별 Chord Perfect clean ≥50%(최근 10회). [근거: "at least 50%"]
3. 25쌍 중 무작위 5쌍 각각 1분 체인지 ≥30. [근거]
4. 표준 패턴 `D DU UDU` 80 BPM 8마디 hit_rate ≥90%, **시각 큐 숨김 모드**에서도. [근거: 80 BPM]
5. 연습곡 5곡 "악보 숨김" 완주 자가 보고.

---

## 8. 오디오 엔진

근거: 리서치 02 §1, 03 §2.1–2.4.

### 8.1 캡처

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    channelCount: { ideal: 1 },
    deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
  },
});
```
- `sampleRate`는 지정하지 않는다. `AudioContext`는 `{ latencyHint: 'interactive' }`로 만들고, DSP 파라미터는 모두 ms/Hz로 정의해 `ctx.sampleRate`로 변환한다. **모든 DSP 코드와 테스트는 44.1 kHz와 48 kHz 둘 다**에서 동작해야 한다.
- `track.getSettings()` 결과(echoCancellation/noiseSuppression/autoGainControl/sampleRate/deviceId/label)를 세션 진단 정보로 저장하고, 설정 > 진단 화면에 보여 준다. 처리가 꺼지지 않았으면 경고한다.
- iOS/iPadOS: `getUserMedia` 전에 `if ('audioSession' in navigator) navigator.audioSession.type = 'play-and-record'`. `AudioContext.resume()`은 사용자 탭 이벤트 안에서 호출한다.
- Bluetooth 입력 장치(이름에 AirPods/Bluetooth/BT 등)가 선택되면 "내장 마이크를 권장" 경고를 띄운다.
- 마이크는 연습 화면에 들어갈 때 켜고 나갈 때 끈다(배터리, 프라이버시 표시등). 권한 거부·장치 분리·`AudioContext` interrupted 상태를 처리하고 사용자에게 복구 방법을 보여 준다.

### 8.2 AudioWorklet (capture-processor)

- 128-sample 블록마다: 4초 ring buffer 적재, 블록 RMS/peak, 클리핑(|x| > 0.98) 감시, onset ODF 계산(§10.4, hop 256 @48k에 해당하는 샘플 수, 비정수는 누적 처리).
- 레벨 미터용 값(RMS dBFS, peak)은 약 30 Hz로 main에 보낸다.
- onset 후보가 나오면 `{ frame, time, strength }`와 해당 구간 샘플(onset −500 ms ~ +400 ms, Transferable)을 Worker로 보낸다.
- hot path에서 메모리 할당 금지(사전 할당 버퍼). 블록당 평균 처리 시간 ≤ 0.3 ms(Node 마이크로벤치, §14.3).
- TS로 작성하고 Vite 8에서 dev/build 양쪽에 번들되는지 M0 스파이크에서 확인한다(`?worker&url` 또는 `new URL(..., import.meta.url)` — 확인된 방법을 DECISIONS에 기록).

### 8.3 DSP Worker

- `dsp/`의 순수 함수를 호출하는 얇은 어댑터. 메시지 프로토콜은 판별 유니온 + zod 검증.
- 요청: `verifyPluck`, `verifyStrum`, `classifyPair`, `classifySet`, `tune`, `estimateRtt`, `analyzeTiming`. 응답에는 항상 `detectorVersion`과 처리 시간이 들어간다.

### 8.4 메트로놈 (`audio/metronome.ts`)

- "A Tale of Two Clocks" lookahead: 타이머(가능하면 Worker 안의 `setInterval` 25 ms)가 깨어날 때마다 `ctx.currentTime + 0.1 s` 안에 들어오는 클릭을 오디오 클럭 기준으로 예약한다. 메인 스레드가 끊길 수 있으면 lookahead 0.25 s / 주기 0.2 s.
- 클릭 음색: 2–4 kHz 대역의 짧은(≤ 15 ms) 합성음. 1박 악센트는 다른 음높이 + 큰 시각 표시. 오디오 파일 없이 합성.
- 기능: 시작/정지, BPM 30–240, ±1/±5, 탭 템포(최근 4간격 평균, 2초 무입력 리셋), 박자 4/4·3/4·6/8, 서브디비전, 카운트인 1–2마디(측정에서 제외), 음소거 마디(N마디마다 M마디 무음), 템포 사다리(시작/목표/증분/조건), 시간·마디 제한 자동 정지, **시각 전용 모드**(소리 없이 펄스만 — 클릭이 마이크로 새는 것을 원천 차단).
- 예약한 클릭 시각 목록은 판정기(Mode D)와 공유한다: 클릭 누출 마스킹, 그리드 기준 시각.
- 시각 펄스는 rAF에서 `currentTime`과 비교해 이미 지난 클릭만 그린다.
- 단위 테스트: 가짜 AudioContext 클럭 + 지터가 있는 타이머 콜백(0–150 ms 지연, 가끔 1 s 정지)으로 10분을 시뮬레이션해도 모든 클릭이 그리드 시각에 정확히(부동소수점 오차 내) 예약되고, 누락·중복이 없다. 템포 변경은 다음 박부터 적용된다.

### 8.5 타이머

- 경과 시간은 항상 **시계 차이**(`performance.now()` 또는 `ctx.currentTime`)로 계산한다. 틱 횟수를 누적하지 않는다. 틱은 화면 갱신에만 쓴다.
- 단위 테스트: 틱 콜백이 불규칙하게 늦어져도(백그라운드 탭 스로틀링 시뮬레이션) 60초 타이머의 종료 시각 오차 ≤ 1 tick 주기.
- 연습 중 화면 꺼짐 방지: Screen Wake Lock API(지원 시). 해제/재획득을 visibilitychange에서 처리.

### 8.6 합성 재생 (`dsp/synth` 재사용)

- 코드 라이브러리 "들어 보기", 연습곡 "들어 보기", 귀 훈련(Q4)은 **테스트 fixture 생성기와 같은 합성기**(Karplus-Strong/additive)로 소리를 만든다(`AudioBuffer`로 렌더).
- 마이크 판정이 켜져 있는 동안에는 합성 재생을 막는다(자기 소리를 듣는 문제).

---

## 9. 캘리브레이션과 튜너

### 9.1 온보딩/캘리브레이션 마법사 (처음 1회, 이후 설정에서 다시 실행)

1. **권한·장치**: 마이크 권한 요청 → 장치 선택(내장 마이크 권장) → getSettings 확인 표시. 거부 시 "마이크 없이 쓰기"(수동 카운트·자가 판정 모드)로 계속할 수 있다.
2. **환경 점검(2초 무음)**: bin별 noise floor(median)와 전체 dBFS. noise RMS > −45 dBFS(설계값)이면 "주변이 시끄러워요" 경고와 함께 계속 가능.
3. **튜닝**: 6줄 순서대로 튜너(§9.2). |δ| ≤ 15 cents면 통과하고 δ를 저장(검증 기대 주파수에 반영), 아니면 조율을 안내한다. 측정 주파수로 sample-rate sanity check(기대 대비 ±1% 밖이면 경고·진단 기록).
4. **줄별 템플릿**: 개방현을 하나씩 3회 튕긴다 → 줄별 harmonic 상대 크기(h=1..8)와 정상 decay 비율(`RMS[+250..350ms]/RMS[+30..80ms]`) 저장. Mode A 뮤트 판정의 기준이 된다.
5. **지연(RTT)**: 기본은 스피커 loopback(§10.8). 실패하거나 출력 장치가 Bluetooth로 보이면 "클릭에 맞춰 8번 치기" 보정으로 전환. 결과는 (입력 장치, 출력 장치 라벨)별로 저장.
6. 결과 `Calibration`을 저장하고 요약(노이즈, 튜닝, RTT, 경고)을 보여 준다.

```ts
interface Calibration {
  id: string; createdAt: number; inputDeviceLabel: string; outputDeviceLabel: string;
  sampleRate: number; trackSettings: Record<string, unknown>;
  noiseFloorDbfs: number; noiseThirdOctaveDb?: number[]; // 1/3옥타브 요약 (JSON 직렬화 가능)
  tuningCents: number[];           // 6
  stringTemplates: { harmonics: number[]; decayRatio: number }[]; // 6
  rttMs: number; rttMethod: 'loopback' | 'tap'; rttMadMs: number;
}
```

### 9.2 튜너

- MPM(또는 YIN) 기반, window 2048–4096(최저 E2 주기 12.1 ms의 3배 이상), 줄 모드(기대 음 범위로 탐색 제한)와 크로매틱 모드.
- 표시: 음 이름, cents 바늘(±50), 안정 표시(연속 5프레임 ±3 cents 이내 = "맞음").
- 사용자가 튜너 화면을 열어 둔 동안 마이크 판정 기능은 쓰지 않는다.

---

## 10. DSP 명세

근거: 리서치 02 §2, §7, §8. 모든 모듈은 `src/dsp/`의 순수 TS이며 Node에서 테스트된다.

### 10.1 공통 규약

```ts
type StringStatus = 'OK' | 'MUTED' | 'WRONG_NOTE' | 'UNEXPECTED' | 'WEAK' | 'UNVERIFIABLE' | 'NOT_PLAYED';
type Verdict = 'PASS' | 'FAIL' | 'RETRY';
type RetryReason = 'LOW_LEVEL' | 'CLIPPING' | 'NOISY' | 'AMBIGUOUS' | 'NO_ONSET' | 'MULTIPLE_ONSETS' | 'DETUNED';
interface DspResultBase { detectorVersion: string; confidence: number /*0..1*/; reasons: RetryReason[]; processingMs: number }
```
- `detectorVersion`은 `src/dsp/version.ts`의 semver 문자열. 알고리즘·파라미터가 바뀌면 올린다. 모든 Attempt에 저장된다(나중에 재해석 가능).
- 모든 판정은 **onset 직전 noise 대비 SNR**로 한다(절대 레벨 사용 금지).
- 클리핑이 있으면 판정하지 않고 RETRY(CLIPPING).
- **확신이 없으면 RETRY**. FAIL은 확신이 있을 때만 낸다. 엄격도 설정(관대/보통/엄격, 기본 관대)은 PRESENT/ABSENT 임계값과 cents 허용폭을 바꾸지만, §14 벤치마크는 기본값(관대)으로 평가한다.

### 10.2 FFT·윈도우·스펙트럼

- 자체 radix-2 real FFT(사전 계산 twiddle, 사전 할당 버퍼). naive DFT와 비교 테스트(상대 오차 ≤ 1e-6).
- Hann window, zero-padding ×2, 피크 parabolic interpolation. `partialPeak(X, f, tolCents)`.

### 10.3 피치 (YIN 또는 MPM)

- 직접 구현(50–100줄) 권장. 출력 `{ f0, clarity }`. 기대 f0를 아는 경우 탐색 범위를 `[f0/1.5, f0·1.5]`로 제한한다(옥타브 오류 방지).

### 10.4 Onset (Mode D와 Mode C의 기반)

- log-compressed spectral flux: `SF[n] = Σ_k max(0, log(1+γ|X_n[k]|) − log(1+γ|X_{n−1}[k]|))`, γ = 100, N = 2048, hop ≈ 5.3 ms.
- SuperFlux식 주파수 방향 max-filter(폭 3 bin)로 지속음 위 미세 변동 오탐 억제.
- 적응형 threshold: 최근 W(≈ 100 ms) 구간 median + δ, local max, 최소 간격 60 ms.
- **broadband 조건**: onset 후보 시점에 2 kHz 이상 대역 에너지가 직전 대비 급증해야 한다(피크/손톱 attack). 지속 코드를 여러 스트럼으로 오인하는 문제의 핵심 방어.
- 스트럼 그룹화: 첫 onset 이후 60 ms 안의 onset은 하나의 스트럼 이벤트로 묶고, 이벤트 시각은 첫 onset.
- 메트로놈 클릭 마스킹: `예약 시각 + RTT ± 10 ms` 구간의 onset 후보는, 에너지 증가가 클릭 대역(2–4 kHz)에 몰려 클릭 템플릿과 일치할 때만 버린다. 저역(< 1 kHz) 에너지도 함께 늘면 박자에 정확히 맞춘 스트럼이므로 유지한다(정박 스트럼을 버리는 것 금지).
- 시각 정밀화: ODF 피크 parabolic interpolation.

### 10.5 Mode A — 한 줄씩 튕기기 검증 (`verifyPluck`) · v1 핵심

입력: onset 주변 샘플, 기대 줄 `idx`와 기대 f0, calibration(템플릿, δ). 절차:
1. onset 후 `[+30, +130 ms]`에서 피치(N = 2048, hop 512), 탐색 범위 제한.
2. `cents = 1200·log2(f_meas / f0)`. |cents| ≤ 35 → 음 맞음. 그 밖 → `WRONG_NOTE`(측정 반음 차이를 결과에 포함). ±1200 근처는 옥타브 함정 — 탐색 제한으로 막고, 그래도 나오면 RETRY(AMBIGUOUS).
3. clarity < 0.85 또는 RMS < noise + 10 dB(초기값, dev 튜닝) → `WEAK` (RETRY 성격, 점수 제외).
4. decay 비율 `RMS[+250..350]/RMS[+30..80]`이 그 줄 calibration 기준 대비 크게 낮으면(기본: 기준의 0.25배 미만, dev split에서 튜닝) `MUTED`. calibration이 없으면 dev split에서 정한 전역 기본값을 쓴다.
5. 결과: `{ status, f0, cents, clarity, decayRatio, confidence }`.

x 줄 차례: 기본은 건너뛴다. 옵션 "x 줄도 쳐서 소리가 안 나는지 확인"이 켜져 있으면, 그 줄을 쳤을 때 기대 밖 음이 울리면 `UNEXPECTED`.

### 10.6 Mode B — 스트럼 검증 (`verifyStrum`) · 베타 라벨

입력: 스트럼 이벤트 샘플, 보이싱, partial 충돌 맵(§6.3), calibration.
1. 관측 window: onset 후 `[+40, +210 ms]`(N = 8192 @48k에 해당), Hann, zero-pad ×2. noise spectrum = onset 직전 0.5 s의 bin별 median.
2. 줄별 salience: 독립 partial만 써서 Klapuri식 harmonic summation(가중치 `h^-0.5`, f0 < 120 Hz는 h=1 가중치 ×0.5, tol ±30 cents, B = 5e-5) → 가중 평균 harmonic SNR(dB).
3. 판정: verifiable이 아니면 `UNVERIFIABLE`. salience ≥ T_PRESENT(초기 12 dB) → `OK`, ≤ T_ABSENT(초기 4 dB) → `MUTED`, 사이 → 불확실.
4. 기대 밖 음 탐지: 기대 partial을 모두 제외한 스펙트럼에서 상위 피크를 MIDI 후보(E2–E6)로 harmonic sum → salience가 임계값(dev 튜닝)을 넘으면 `UNEXPECTED(note, 추정 줄)`. x 줄의 개방현 음(예: C 코드에서 6번 줄 E2)은 명시적으로 검사한다(3·5배음 위주).
5. 코드 판정: 모든 verifiable 줄 OK + UNEXPECTED 없음 → PASS(UNVERIFIABLE 줄은 "확인 불가"로 표시). verifiable 줄 하나라도 확실히 MUTED 또는 확실한 UNEXPECTED → FAIL(줄 지목). 그 밖 → RETRY.
6. 같은 RETRY가 2번 연속이면 UI가 Mode A(한 줄씩)로 유도한다.

### 10.7 Mode C — 닫힌 집합 코드 분류 (`classifyPair`, `classifySet`)

- 1분 체인지는 두 후보 중 하나를 고르는 문제다. 스트럼 이벤트마다 각 후보 보이싱의 **기대 partial 전체**에 대한 log-salience 점수(또는 chroma cosine)를 계산하고 `margin = score_A − score_B`(정규화)를 낸다.
- |margin| < m_min(dev 튜닝)이면 "보류"(카운트 안 함).
- 카운트 상태 머신: 현재 코드 상태에서 **확신 있는 다른 코드 분류**가 나오면 +1 하고 상태 전환. 같은 코드 반복 스트럼·보류·열린 줄만 친 스트럼은 무시. 체인지 간 최소 간격 300 ms. **과소 집계 쪽으로 치우치게**(과대 집계가 신뢰를 더 해친다).
- `classifySet`: 해금된 코드 집합(최대 9개)에서 top-1과 margin. 코드 기억 퀴즈(Q2)가 쓴다.

### 10.8 Mode D — 타이밍 (`analyzeTiming`)과 RTT (`estimateRtt`)

- 앱이 사용자에게 보여 주는 **연주 타이밍 오차** = 스트럼 이벤트 시각 − (예약 그리드 시각 + RTT). 가장 가까운 기대 슬롯에 매칭(탐욕 매칭 + 창 제한). 이 값에는 사람의 흔들림이 들어 있는 것이 정상이다(그것을 재는 것이 목적). **검출기 정확도**(§14.3 벤치마크)는 이와 다르다: 검출 시각을 합성기의 정답 스트럼 시각과 비교한다.
- 지표: hit_rate, mean_offset_ms(앞/뒤 쏠림), sd_offset_ms(일관성), 누락·추가 스트럼 수, 쉼표 슬롯의 추가 스트럼. 개인의 일정한 선행(최근 3회 이상 평균)은 보정한 hit_rate도 함께 낸다. [근거: Repp]
- 창(설계값): 60–80 BPM ±60 ms, 80–100 BPM ±50 ms, 100+ BPM ±40 ms.
- RTT loopback: 불규칙 간격 broadband click(또는 짧은 chirp) 8개 예약 → 녹음에서 matched filter(cross-correlation)로 도착 시각 → `RTT = median(t_detect − t_sched)`, MAD ≤ 2 ms면 성공. 신호가 안 들리면 **실패를 보고**(가짜 값 금지). tap 보정은 클릭 8개에 맞춰 친 onset의 median 오프셋.

### 10.9 기본 파라미터 표 (fs = 48 kHz 기준, ms/Hz로 정의해 스케일)

| 용도 | 값 |
|---|---|
| onset | N 2048, hop 256, γ 100, max-filter 3 bin, median W ≈ 100 ms, 최소 IOI 60 ms, 스트럼 그룹 60 ms |
| 스트럼 검증 | onset+40 ms부터 N 8192 Hann, zero-pad ×2, H 6(salience)/8(충돌 맵), tol ±30 cents, B 5e-5 |
| 한 줄 판정 | N 2048 피치, 범위 [f0/1.5, f0·1.5], clarity ≥ 0.85, 음 허용 ±35 cents |
| 임계값(초기) | T_PRESENT 12 dB, T_ABSENT 4 dB, WEAK = noise + 10 dB — dev split에서 튜닝 후 고정 |
| 튜너 | N 4096, 안정 판정 연속 5프레임 ±3 cents |

이 절의 수치는 모두 **초기값**이며 dev split에서 바꿀 수 있다(§6.3 충돌 맵 규칙과 §14 임계값은 예외 — 고정). 튜닝한 최종 값과 근거는 `docs/DSP.md`에 기록한다.

---

## 11. 연습 유형 (플러그인)

### 11.1 플러그인 인터페이스

코어(세션 러너, 기록, 차트, 루틴 생성)는 연습 유형을 모른다. 새 유형은 플러그인 등록만으로 추가된다.

```ts
interface ExercisePlugin<P, R> {
  type: string; version: number;
  titleKey: string;                         // i18n 키
  paramsSchema: z.ZodType<P>; resultSchema: z.ZodType<R>;
  defaultParams(ctx: ContentContext): P;
  createRunner(ctx: ExerciseContext, params: P): ExerciseRunner<R>;
  View: React.ComponentType<{ runner: ExerciseRunner<R>; params: P }>;
  Summary: React.ComponentType<{ result: R; params: P }>;
  toMetrics(result: R, params: P): MetricSampleInput[];   // subjectKey 기반
  usesMicrophone: boolean;
  migrateResult?(raw: unknown, fromVersion: number): R;
}
interface ExerciseRunner<R> {
  start(): void;
  command(cmd: 'toggle' | 'next' | 'prev' | 'inc' | 'dec' | 'abort' | 'mark'): void; // 키/페달
  subscribe(listener: (s: RunnerSnapshot) => void): () => void;
  finish(): R; dispose(): void;
}
interface ExerciseContext {
  audio: AudioEngineApi | null;             // null = 마이크 없이 모드
  clock: { now(): number };                 // 테스트에서 가짜 주입
  content: ContentContext; calibration?: Calibration;
}
```
- 러너는 **오디오 없이도 동작**해야 한다(수동 모드). 모든 러너는 가짜 clock + 스크립트된 판정 이벤트로 단위 테스트한다.
- 테스트 전용 가속·훅: E2E 빌드 플래그(예: `vite build --mode e2e` → `import.meta.env.VITE_E2E === '1'`)일 때만 URL 파라미터 `?timeScale=0.25`로 타이머를 빠르게 하고, `window.__gh_test`(메트로놈 그리드 시작 시각, 현재 러너 스냅샷 등 읽기 전용 훅)를 노출한다. 기본 프로덕션 빌드에서는 둘 다 제거된다(dead-code elimination, E2E-14와 §14.6으로 확인).

### 11.2 v1 연습 목록

| ID | 이름(UI) | 마이크 | DSP | 핵심 지표(subjectKey) |
|---|---|---|---|---|
| E0 | 튜닝 | 필수 | 튜너 | `tuning:session` 완료 여부 |
| E1 | 코드 정밀 체크 | 권장 | Mode A(+B 베타) | `chord:<id>` clean, 줄별 상태 |
| E2 | 1분 코드 체인지 | 선택 | Mode C | `pairdir:<a>><b>` changes/min |
| E4 | 앵커·공중 체인지 드릴 | 없음 | — | `pair:<a>|<b>` 완료, 자가 보고 |
| E5 | 스트러밍 패턴 사다리 | 권장 | Mode D | `strum:<pattern>` 최고 통과 BPM, hit_rate, sd |
| E6 | 박 1 체인지 | 권장 | Mode D(+C) | `onebeat:<progression>` 마디 성공률 |
| E7 | 손가락 스트레칭 | 없음 | — | `stretch` 시작 프렛 |
| E8 | 한 줄 교대 피킹 | 권장 | Mode D | `altpick:<string>` BPM, ioi_cv |
| Q1 | 다이어그램 읽기 퀴즈 | 없음 | — | `quiz:diagram` 정답률 |
| Q2 | 코드 기억 퀴즈 | 권장 | Mode C(set) | `recall:<id>` 정답·반응 시간 |
| Q3 | 개방현 음이름 퀴즈 | 선택 | 튜너(피치) | `quiz:opennotes` |
| Q4 | 메이저/마이너 귀 훈련 | 없음(재생) | 합성 재생 | `ear:majmin` |
| S | 연습곡 | 선택 | Mode D(선택) | `song:<id>` 완주, 멈춤, 암기 |

### 11.3 E1 코드 정밀 체크 (Chord Perfect 방식)

- 입력: 보이싱, 블록 시간(1–3분), 모드(한 줄씩 기본 / 스트럼 베타 / 수동).
- 흐름(블록 시간 동안 반복): ① 다이어그램 보고 **손가락 번호 순서대로** 놓기 ② (선택) 전체 스트럼 → Mode B 베타 결과 ③ 앱이 연주 줄을 저음부터 차례로 하이라이트 → 줄마다 Mode A 판정, x 줄은 건너뜀 ④ 마지막 전체 스트럼 ⑤ "손 떼고 다시" 안내 → 다음 시도.
- 줄별 인디케이터: 대기/OK/MUTED/WRONG_NOTE/UNEXPECTED/WEAK/확인 불가를 **아이콘+색+텍스트**로. 줄이 판정되면 해당 줄 위에 코칭 힌트(§6.7).
- "귀 먼저" 옵션: 사용자가 먼저 줄별 자가 판정(울림/막힘)을 누르고 나서 앱 판정이 공개된다. 자가-앱 일치율을 지표로 기록.
- 수동 모드(마이크 없음/거부): 줄마다 "깨끗/막힘/버징" 버튼(또는 키 1/2/3).
- 결과: `{ voicingId, mode, attempts: { perString: {idx, status, cents?, confidence}[], clean: boolean, selfReport? }[], cleanRatio }`.

### 11.4 E2 1분 코드 체인지

- 입력: 방향 있는 쌍(A→B), 60초(설정 30–120), 카운트 방식(자동/탭/수동 입력).
- 흐름: "준비" 상태에서 A를 잡고 대기 → **첫 스트럼(onset)으로 타이머 자동 시작**(Space로도 시작) → B에 도착해 1회 스트럼, A로 돌아와 1회 스트럼 … → 60초 종료음.
- 카운트: 다른 코드에 **도착할 때마다 1**(첫 A 스트럼은 세지 않음). 자동 모드는 Mode C 상태 머신. 진행 중 `↑`/`+`/페달 = +1, `↓`/`-` = −1 보정. 탭 모드는 Enter/페달 누를 때마다 +1.
- 화면: 남은 시간(화면 높이의 20% 이상 크기), 현재 카운트, 보류(낮은 확신) 카운트 작게, 다음 코드 다이어그램.
- 결과: `{ pair, direction, durationMs, detectedChanges, correctedChanges, tapChanges?, lowConfidenceEvents, changeTimestampsMs[] }`. 지표는 `correctedChanges ?? detectedChanges`를 분당으로 환산.
- 소리 품질은 채점하지 않는다는 안내 문구를 보여 준다. [근거]

### 11.5 E4 앵커·공중 체인지 드릴

- `anchors(a, b)`가 비어 있지 않으면 앵커형: "앵커 손가락(f번, s번 줄 n프렛)은 떼지 마세요" 강조, 나머지 손가락만 이동, 스트럼 없음, 느리게. 비어 있으면 공중형: 손 모양을 줄 위에서 먼저 만들고 동시에 착지.
- 타이머(1–2분) + 종료 후 자가 보고("동시 착지 성공 n/10"). 점수 없음.

### 11.6 E5 스트러밍 패턴 사다리

- 패턴(8분음표 슬롯 기준, `D`/`U`/`-` = 쉼, 손은 계속 움직임):
  - P0 `D - D - D - D -` (4분 다운) · P1 `D - D U D - D -` (`D DU D D`) · P2 `D - D U D U D -` (`D DU DU D`) · P3 `D - D U - U D U` (표준 `D DU UDU`) · P4 8분 전부 다운 + 2·4박 악센트 · P5 6/8 `D D U D D U`(1·4박 악센트)
- 입력: 패턴, BPM(시작 60), 마디 수(기본 8), 모드(뮤트 → 단일 코드 → 코드 진행), 시각 큐 숨김 여부.
- 흐름: 카운트인 1마디 → 메트로놈에 맞춰 연주. 놓쳐도 계속.
- 채점: Mode D. 쉼 슬롯의 스트럼은 "추가"로 센다. 방향(D/U)은 판정하지 않는다(v2).
- 사다리 규칙(설계값): 8마디 hit_rate ≥ 90% & 누락 0 → +5 BPM, 2회 연속 < 70% → −5 BPM. 패턴 졸업 = 목표 BPM(P3 80, P4 80 [근거])에서 서로 다른 2일 통과.
- 결과: `{ patternId, bpm, bars, hits, misses, extras, meanOffsetMs, sdOffsetMs, hitRate, hitRateCorrected, cuesHidden }`.

### 11.7 E6 박 1 체인지

- 입력: 코드 진행(마디당 1코드), 패턴, BPM. 마디 첫 박 스트럼의 지연 `beat1DelayMs`와 누락 마디 비율. (선택) Mode C로 그 마디 코드가 맞는지.
- 규칙(설계값): 16마디 중 ≥ 14마디가 창 안이고 멈춤 0 → +5 BPM.

### 11.8 E7 손가락 스트레칭 / E8 한 줄 교대 피킹

- E7: 시작 프렛(기본 5) 표시, 1–2분 타이머, "스트레칭이지 통증 운동이 아님" 상시 표시, 종료 후 통증 0–10. 통증 ≤ 2로 3세션 → 시작 프렛 1칸 낮춤. [근거]
- E8: 줄 선택, 8분음표, BPM 시작 60. Mode D로 hit_rate와 `ioi_cv = sd(IOI)/mean(IOI)`. hit_rate ≥ 90% & ioi_cv ≤ 0.10(8마디) → +5 BPM. [설계값]

### 11.9 퀴즈와 귀 훈련

- Q1 다이어그램 퀴즈: 다이어그램의 특정 점을 보여 주고 "몇 번 줄, 몇 프렛, 몇 번 손가락?" 3지선다, 또는 x/o 의미. 10문항, 정답률.
- Q2 코드 기억 퀴즈: 해금된 코드 중 무작위 이름 제시 → 3초 카운트다운 → 첫 스트럼을 `classifySet`으로 분류 → 정답 여부 + 반응 시간. 마이크 없으면 자가 보고. 졸업 시험 2번 항목이 사용.
- Q3 개방현 음이름: 줄 번호 → 음이름 선택, 또는 음이름 → 그 줄을 튕기기(튜너로 확인).
- Q4 메이저/마이너: 합성 코드 재생 → 메이저/마이너 선택. 정답률·반응 시간.

### 11.10 S 연습곡

- 코드 차트(마디 그리드), 현재 마디 하이라이트, 카운트인, 메트로놈, 템포 조절, 구간 반복, "악보 숨김" 모드, 합성 들어 보기.
- 학습 모드(멈추고 다시)와 연주 모드(멈추지 않기) 구분. 연주 모드에서 선택적으로 Mode D 박 1 지표.
- 종료 후 자가 보고: 완주 여부, 멈춤 횟수, 암기 여부.

---

## 12. UI/UX

### 12.1 화면

| 화면 | 핵심 내용 |
|---|---|
| 홈(오늘) | 오늘의 루틴 카드(항목·총 시간), 큰 "연습 시작" 버튼, 현재 스테이지 진급 체크리스트 진행률, 약한 쌍 Top 3, 이번 주 연습 시간, 주간 스트릭, 백업 리마인더 |
| 세션 러너 | 현재 항목 View, 항목 남은 시간, 다음 항목 미리보기, 키 힌트 바, 일시정지/건너뛰기, 30분 휴식 알림, 세션 종료 후 자가 평가(통증 0–10, 난이도 1–5, 메모) |
| 연습 화면 | 플러그인 View (전체 화면, 큰 숫자) |
| 커리큘럼 | 스테이지 0–11 목록(8–11 잠금), 스테이지 상세(배울 것, 팁, 진급 기준과 현재 상태), 졸업 시험 |
| 코드 라이브러리 | 보이싱 그리드 → 상세(다이어그램, 기대 음, 스트럼 확인 가능 줄, 들어 보기, 이 코드로 E1 시작) |
| 튜너 | §9.2 |
| 메트로놈 | 단독 메트로놈 |
| 진도 | 주간 연습 시간 막대, 쌍별 1분 체인지 추이(점 + 이동 중앙값), 코드×줄 clean 히트맵, 패턴별 최고 BPM, 타이밍 mean/sd 추이, 복습 대기 수, 세션 기록 목록 |
| 설정 | 입력/출력 장치, 캘리브레이션 다시 하기, 테마(다크 기본/라이트/고대비), 왼손잡이, 엄격도, 시각 전용 메트로놈, 키·페달 매핑, 백업(내보내기/가져오기), 녹음 키트, 진단(getSettings, RTT, sampleRate, detectorVersion), 데이터 초기화(2단계 확인) |

### 12.2 레이아웃

- **iPad 가로가 1순위**: 왼쪽 다이어그램, 오른쪽 타이머/카운트/줄별 인디케이터. iPad 세로·iPhone 세로는 단일 컬럼. MacBook은 iPad 가로와 같은 2단.
- 연습 중 핵심 숫자(남은 시간, 카운트, BPM)는 화면 높이의 15–25%. 연습 화면의 주요 버튼은 최소 64×64 px. 그 밖 터치 타깃 최소 44×44 px.
- 가로 스크롤 금지(모든 화면, 모든 뷰포트). safe-area inset 반영.
- `prefers-reduced-motion` 존중. 다크 모드 기본.

### 12.3 손이 기타 위에 있을 때의 조작

| 키 | 동작 |
|---|---|
| Space | 시작/정지(toggle) |
| Enter, PageDown, → | 다음 항목/확인 |
| PageUp, ← | 이전 |
| ↑ / ↓, + / − | BPM ± 또는 카운트 보정(화면 문맥에 따라) |
| Esc | 중단(확인 필요) |
| 1/2/3 | 수동 줄 판정(깨끗/막힘/버징) |

- 블루투스 페이지 터너 페달은 키보드를 흉내 내므로 위 키에 이미 매핑된다. 추가로 **"페달 학습 모드"**: 아무 키나 눌러 특정 동작에 바인딩(저장).
- **첫 스트럼 자동 시작**: "준비(armed)" 상태에서 noise + 임계값을 넘는 첫 onset이 타이머를 시작한다(E2, E5, E6, S).
- 음성 명령은 넣지 않는다.

### 12.4 문구 규칙 (한국어)

- 존댓말, 짧게, 행동 중심. 모든 문자열은 `src/i18n/ko.ts`에 둔다(컴포넌트에 한국어 하드코딩 금지 — 린트 또는 테스트로 검사).
- 판정 문구: FAIL은 "무엇이 + 어떻게"("2번 줄이 막혔어요 — 1번 손가락 끝을 세워 보세요"). RETRY는 원인별("잘 안 들렸어요. 조금 더 크게 한 번 더", "주변 소리가 커요", "소리가 너무 커서 찌그러졌어요"). "틀렸습니다" 단독 사용 금지.
- 마이크 판정에는 항상 "마이크 판정은 보조 수단이에요. 내 귀가 먼저예요" 성격의 안내를 온보딩에 1회, 설정에 상시 둔다.
- 안전 문구: 통증 관련 안내에는 "의학적 조언이 아닙니다"를 붙인다.

### 12.5 접근성

- 판정 결과는 `aria-live="polite"`로 읽힌다. 색만으로 상태를 구분하지 않는다(아이콘·모양·텍스트 병행).
- 키보드만으로 모든 화면 사용 가능, 포커스 표시 명확.
- axe 검사에서 serious/critical 위반 0(§14.5).

---

## 13. 데이터

### 13.1 원칙

1. **콘텐츠(정의)와 기록(사실)을 분리**: 보이싱·커리큘럼·연습곡은 번들 시드(읽기 전용) + 사용자 커스텀. 세션·시도는 사용자 데이터.
2. **Attempt는 append-only**: 파라미터 스냅샷, `detectorVersion`, 자동 값·보정 값·자가 보고를 함께 저장. 수정·삭제 API를 만들지 않는다(데이터 초기화만 예외).
3. **지표(MetricSample)와 스킬 상태(SkillState)는 Attempt에서 언제든 재계산 가능한 캐시**다. `rebuildDerived()`를 제공하고, "재계산 결과 = 증분 갱신 결과"를 테스트한다.
4. `subjectKey`로 지표를 묶는다(`chord:C`, `pair:A|D`, `pairdir:A>D`, `strum:P3`, `song:s01` ...).

### 13.2 Dexie 스키마 (v1)

```ts
db.version(1).stores({
  voicings: 'id, symbol, stage, *tags',          // 사용자 커스텀만 (시드는 번들)
  routines: 'id, source',
  sessions: 'id, startedAt',
  attempts: 'id, sessionId, exerciseType, startedAt, [exerciseType+startedAt]',
  metrics: '++seq, [subjectKey+metric+at], attemptId',
  skills: 'subjectKey, due, lastPracticedAt',
  progression: 'key',                             // 현재 스테이지, 진급 기록, 졸업 시험 항목
  reviews: 'subjectKey, due',
  calibrations: 'id, createdAt, [inputDeviceLabel+outputDeviceLabel]',
  recordings: 'id, createdAt, label',             // 녹음 키트 메타(오디오는 OPFS)
  meta: 'key',                                    // schemaVersion, lastBackupAt, settings
});
```

### 13.3 내보내기/가져오기

- `exportAll()` → `{ app: 'guitar-hero', schemaVersion, exportedAt, tables: {...} }` JSON 파일 다운로드(파일명에 날짜). 녹음 오디오는 포함하지 않는다(별도 내보내기).
- `importAll(file)`: zod로 검증 → schemaVersion 마이그레이션 → **미리보기(테이블별 건수) 후 확인** → 병합(같은 id는 건너뜀) 또는 교체(2단계 확인).
- 왕복 테스트: 임의 데이터 생성 → export → 빈 DB에 import → 모든 테이블 deep-equal.
- 시작 시 `navigator.storage.persist()` 요청. 마지막 백업 후 7일이 지나면 홈에 리마인더. iPad/iPhone에서는 홈 화면 추가(PWA)를 안내한다(Safari 저장소 정책).

### 13.4 녹음 키트 (실측 fixture)

- 설정 > 녹음 키트: 안내된 순서로 라벨 붙은 클립을 녹음한다. 예: 코드별 {깨끗한 스트럼, 한 줄씩 튕기기, 특정 줄 일부러 뮤트, x 줄 울림}, 1분 체인지 30초(사용자가 직접 센 횟수 입력), 메트로놈에 맞춘 스트럼 8마디(RTT 함께 기록).
- 오디오는 OPFS에 16-bit PCM WAV로 저장, 메타는 Dexie. 내보내기: WAV 파일들 + `labels.json`(보이싱, 라벨, 기대 결과, 기기, sampleRate, calibration 요약)을 하나씩 다운로드하거나 zip(의존성 없이 store 방식 zip 직접 구현 또는 permissive 라이브러리).
- 사용자가 내보낸 파일을 `tests/fixtures/real/<기기명>/`에 넣으면 `npm run bench:real`이 Mode A/B/C/D를 돌려 리포트한다(파일 없으면 "no fixtures"로 성공).

---

## 14. 테스트와 품질 게이트

**모든 수치 임계값과 매트릭스 최소 차원은 `docs/goal/thresholds.json`에 기계가 읽을 수 있는 형태로 고정되어 있다.** 실행자는 이 파일과 이 SPEC을 수정하지 않는다(최종 검증에서 SHA-256을 대조한다). 벤치마크 코드는 이 파일을 직접 읽어 판정한다.

### 14.1 테스트 피라미드

1. **순수 단위 테스트(Vitest, Node)**: `domain/`, `dsp/`, 데이터 변환, 러너(가짜 clock), 메트로놈 스케줄러, 타이머, 루틴 생성, 진급 엔진, 코칭 규칙, export/import.
2. **합성 벤치마크(§14.3)**: 정답이 확실한 합성 신호로 DSP 판정기의 경계 조건을 체계적으로 시험.
3. **실녹음 벤치마크(§14.4)**: GuitarSet(CC BY 4.0, 어쿠스틱, 줄별 주석).
4. **실측 fixture(`bench:real`)**: 사용자가 녹음 키트로 추가(goal 범위에서는 하네스만, 데이터는 사후).
5. **E2E(Playwright, §14.5)**: 가짜 마이크로 전체 흐름.
6. **무결성 테스트(§14.6)**: 규칙 위반 자동 탐지.

### 14.2 합성기 (`src/dsp/synth/`, 테스트·앱 공용)

- **확장 Karplus-Strong**: 분수 지연 allpass 보정, 손실 필터(sustain/뮤트), 초기 excitation lowpass(밝기), pick position comb, 선택적 buzz(soft-clip + 짧은 noise burst — v1 판정 대상은 아니지만 생성은 가능).
- **Additive**: `f_h = h·f0·sqrt(1 + B·h²)`, partial별 지수 decay, 몸통 공진을 흉내 낸 고정 EQ 몇 개.
- **스트럼**: 줄별 신호를 다운(6→1)/업(1→6) 순서 지연(0–40 ms)으로 합성, 줄별 gain jitter.
- **채널 모델**: 마이크 HPF(2차, 0/100/150 Hz), 선택 LPF 8 kHz, 잡음(white/pink, 지정 SNR), 작은 방 잔향(지수 감쇠 noise IR, RT60 ≈ 0.3 s), 메트로놈 클릭 누출(예약 시각 + RTT, 상대 −20 dB).
- **난수**: 시드 PRNG(mulberry32 등)만 사용. `Math.random` 금지(`dsp/`, `tools/`).
- WAV writer/reader(16-bit PCM, 32-bit float)를 포함한다.

### 14.3 합성 벤치마크 (`bench:dsp:dev`, `bench:dsp`)

**Split**: dev 시드 1000–1999(튜닝용, 마음대로 반복), test 시드 9000–9999(마일스톤 종료와 최종 검증에서만). 두 split은 같은 생성기·같은 매트릭스, 다른 시드.

**매트릭스 최소 차원**(`thresholds.json.matrix`): sampleRate {44100, 48000} × 합성 모델 {KS, additive(B ∈ [1e-5, 1.5e-4])} × SNR {15, 25, 40} dB × 마이크 HPF {0, 100, 150} Hz × 잔향 {없음, 작은 방}, 줄 gain jitter ±6 dB, 줄별 detune ±15 cents(판정기에는 잔차 ±3 cents의 calibration δ 제공), 스트럼 퍼짐 0–40 ms. 보이싱: Stage 0–7 전부 + F-small, C7, B7, G5. 조합이 너무 많으면 각 차원 값이 고르게 나오도록 층화 표본추출(stratified sampling)하되, **최소 표본 수**(`minimumTestSizes`)를 지킨다.

**지표와 임계값** (모두 test split, 기본 엄격도 '관대'):

| 영역 | 조건 | 지표 | 임계값 |
|---|---|---|---|
| Mode A | 정상 음 | false reject(OK가 아닌 확정 판정) | ≤ 3% |
| Mode A | 정상 음 | RETRY 비율 | ≤ 10% |
| Mode A | 잘못된 음(±1, ±2 반음) | false accept(OK) | ≤ 2% |
| Mode A | 뮤트(120 ms 안에 −30 dB) | false accept(OK) | ≤ 5% |
| Mode A | 기본음 −20 dB(저역 roll-off) | OK 비율 | ≥ 95% |
| Mode A | 뮤트 | MUTED 검출률 | ≥ 80% |
| Mode A | 잘못된 음 | WRONG_NOTE(반음 차이까지 정확) 검출률 | ≥ 90% |
| Mode B | 깨끗한 스트럼 | 코드 FAIL | ≤ 3% |
| Mode B | 깨끗한 스트럼 | RETRY | ≤ 15% |
| Mode B | verifiable 줄 하나 뮤트 | PASS | ≤ 10% |
| Mode B | verifiable 줄 하나 뮤트 | 그 줄을 정확히 지목한 FAIL | ≥ 85% |
| Mode B | x 줄 울림 | UNEXPECTED로 FAIL | ≥ 85% |
| Mode B | x 줄 울림 | PASS | ≤ 10% |
| Mode B | verifiable 줄 프렛 +1/+2 | PASS | ≤ 10% |
| Mode B | 종속(비verifiable) 줄 뮤트 | 다른 줄을 잘못 지목 | ≤ 5% |
| Mode C | 60초 시퀀스(10–45회/분, 30% 같은 코드 추가 스트럼, 10% 줄 하나 뮤트, 20% 체인지 사이 개방현 스트럼) | \|오차\| ≤ 1 비율 | ≥ 95% |
| Mode C | 〃 | 2 이상 과대 집계 비율 | ≤ 1% |
| Mode C | 〃 | 평균 절대 오차 | ≤ 0.6 |
| Mode C | 코드 집합 분류(`classifySet`, 8코드, 깨끗한 스트럼) | top-1 정확도 | ≥ 90% |
| Mode D | 스트럼 패턴(60–120 BPM, 사람 지터 sd 12 ms, 평균 선행 −30…+10 ms, RTT 10–300 ms) | onset F1 @±25 ms | ≥ 0.95 |
| Mode D | 〃 (RTT 보정 후) | \|타이밍 오차\| p95 / median | ≤ 15 ms / ≤ 6 ms |
| Mode D | 3초 지속 코드 | 가짜 onset 비율 | ≤ 2% |
| Mode D | 클릭 누출 | 클릭을 스트럼으로 세지 않은 비율 | ≥ 98% |
| Mode D | 패턴 | 누락·추가 스트럼 판정 정확도 | ≥ 95% |
| 튜너 | E2–E5 ±50 cents, SNR ≥ 20 | \|오차\| median / p95 | ≤ 1 / ≤ 3 cents |
| 튜너 | 〃 | 옥타브 오류 | ≤ 0.5% |
| 튜너 | 〃 | 안정 판정까지 시간 p95 | ≤ 300 ms |
| RTT | 10–300 ms, SNR ≥ 20, 잔향 유무 | \|오차\| p95 | ≤ 2 ms |
| RTT | loopback 신호 없음 | 실패를 보고한 비율 | 100% |
| 성능 | Node, 이 Mac | verifyStrum median / verifyPluck median | ≤ 20 ms / ≤ 10 ms |
| 성능 | 〃 | worklet 블록(128 샘플) 평균 | ≤ 0.3 ms |
| 커버리지 | Stage 0–7 보이싱 | Mode B verifiable 줄 비율 | §6.3 기본 규칙 값 이상 |

- 각 지표는 조건별(SNR, HPF, 모델, sampleRate, 보이싱) 분해표와 함께 `bench-results/dsp-test.json`과 `docs/BENCHMARK.md`(생성 파일)에 남는다. 콘솔에는 요약표를 출력한다.
- 실행 시간 목표 ≤ 5분(`worker_threads` 병렬화 허용).

**지표 정의 (고정 — 해석 여지 없음)**:
1. **매트릭스 값의 의미**: `sampleRates`, `synthModels`, `snrDb`, `micHighpassHz`, `reverb`, `voicings`, `*Conditions`는 **집합**이다(모든 원소가 test split에 나와야 한다). 그 밖의 길이 2 숫자 배열(`additiveInharmonicityB`, `strumSpreadMs`, `changesPerMin`, `bpm`, `humanMeanOffsetMs`, `rttMs`, `latencyMs`)은 **[min, max] 연속 구간**이고 균등 추출한다(B는 로그 균등). 무결성 테스트는 구간마다 양 끝 10% 안의 표본이 각각 존재함을 확인한다.
2. **SNR** = 신호 RMS(onset 후 0–500 ms, 모든 줄 합) ÷ 정상 잡음 RMS(dB). **작은 방 잔향** = 지수 감쇠 noise IR, RT60 0.3 s, DRR +3 dB.
3. **뮤트 줄 모델**: Mode A/B/C 모두 `modeAMutedDecayDbIn120ms`(120 ms 안에 −30 dB)를 쓴다. 줄을 빼는 방식으로 뮤트를 흉내 내지 않는다. **x 줄 울림** = 그 줄의 개방현을 정상 sustain으로 합성. 합성기 자체 테스트: 생성음의 f0와 명목 f0 차이 ≤ 0.5 cent(KS 분수 지연 보정 검증).
4. **표본 추출**: 조건 안의 대상(뮤트할 줄, 틀릴 줄, 쌍, 보이싱)은 후보 중 시드 균등 추출한다. 쌍은 §6.5의 25쌍 × G 보이싱 2종(G-2f, G-3f) 중 균등. 조건별 최소 표본 = `minimumTestSizes[mode]` ÷ 조건 수(올림).
5. **불가능한 조합 제외**: `x-string-ringing`은 x 줄이 있는 보이싱만, 그리고 그 줄을 울린 보이싱에 §6.3 규칙을 적용했을 때 그 줄이 verifiable인 경우만. `verifiable-muted`·`wrong-fret-verifiable`은 verifiable 줄이 있는 보이싱만, `dependent-muted`는 비verifiable 줄이 있는 보이싱만. 같은 음을 다른 줄에서 내는 경우(예: G5에서 개방 3번 줄 G3 = 4번 줄 5프렛 G3)는 v1 범위 밖이라 제외. 제외한 조합 수를 리포트한다.
6. **분모**: false reject = 정상 조건 표본 중 확정 부정 판정(MUTED·WRONG_NOTE·UNEXPECTED·FAIL)의 비율. RETRY 비율 = RETRY/WEAK 판정 비율. false accept = 결함 조건 표본 중 OK/PASS 비율. 검출률 = 결함 조건 표본 중 그 결함을 정확히 판정한 비율(Mode A 뮤트 → MUTED, 잘못된 음 → WRONG_NOTE이면서 반음 차이 일치).
7. **Mode B 층**: `modeB.cleanFailMax`는 모든 SNR 층에서, 나머지 Mode B 지표는 `modeB.detectionStrataSnrDbMin`(25 dB) 이상 층에서 판정한다. SNR 15 층의 나머지 값은 보고만 한다(베타 기능, 조용한 방 전제).
8. **Mode C 정답**: 다른 코드에 도착해서 친 스트럼마다 1(그 스트럼에 뮤트 줄이 있어도 1). 같은 코드 추가 스트럼, 개방현 스트럼, 시작 코드의 첫 스트럼은 0. `classifySet`은 Stage 0–7의 8코드(G 두 보이싱은 같은 클래스) 중 깨끗한 스트럼의 top-1, SNR ≥ 25 층.
9. **Mode D 정답**: 검출기 타이밍 오차 = 검출 스트럼 시각 − **합성기의 정답 스트럼 시각**(그 스트럼 첫 줄 onset, 녹음 시간축). 사람 지터·평균 선행은 정답에 이미 들어 있으므로 오차가 아니다. 판정기에는 실제 RTT + U(−2, +2) ms를 준다. F1 정답 = 합성한 모든 스트럼. 누락·추가 정답 = 정답 시각에 §10.8 창 규칙을 적용한 슬롯 판정이고, 판정기의 슬롯 판정과 비교한다. F1 시퀀스의 50%에는 클릭 누출을 넣는다.
10. **튜너 정답** = 명목 기본음(h=1) f0. 튜너 지표는 SNR 25·40 층(`tuner.snrDbMin` 20 이상)에서 판정한다.
11. **test split이 마일스톤 종료 때 실패하면**: DECISIONS에 기록 → 같은 조건 분해로 dev split에서 재현·수정 → test 재실행. 모든 test 실행(시각, detectorVersion, 결과)을 `docs/BENCHMARK.md`의 "test-run log"에 남긴다.

### 14.4 GuitarSet 실녹음 벤치마크 (`bench:guitarset`)

- 데이터: Zenodo record **3371780**(GuitarSet 1.1.0, **CC BY 4.0**)의 `audio_mono-mic.zip`(≈657 MB)과 `annotation.zip`(≈39 MB)만 받는다. Zenodo API의 체크섬으로 검증한다. 위치: `data/guitarset/`(gitignore). 레포에는 다운로드 스크립트와 출처 표기만 커밋한다.
- 다운로드 실패 처리: 지수 백오프로 최대 3회. 3회 모두 실패하면 다운로드 스크립트가 `data/guitarset/.download-blocked`에 **시도별 URL, HTTP 상태 또는 curl exit code, 시각**을 JSON으로 기록하고 벤치마크는 **BLOCKED**를 반환한다. 마커는 다운로드 스크립트만 쓴다(손으로 만들지 않는다). verify는 마커 내용을 출력하고, 이 마커가 있을 때만 BLOCKED를 허용한다. 마커 없이 데이터가 없으면 FAIL이다.
- 클립 구분: 파일명에 `_comp`가 있으면 comp, `_solo`가 있으면 solo. 장르는 파일명 `<player>_<장르><n>-...`의 장르 코드(BN, Funk, Jazz, Rock, SS).
- JAMS 파싱: 줄별 `note_midi` 주석(data_source 0–5 = 6번→1번 줄)에서 이벤트를 만든다.
  - **스트럼 이벤트**(comp 클립): 60 ms 안에 시작하는 노트 ≥ 3개를 묶는다. 필터: 울리는 줄 ≥ 4, 모든 노트 지속 ≥ 250 ms, 이후 300 ms 안에 다른 onset 없음. 기대 보이싱 = 이벤트에서 울린 줄별 MIDI(나머지 줄은 x).
  - **단음 이벤트**(solo 클립): 주석 지속 ≥ 400 ms, 다음 노트 onset까지 ≥ 400 ms, 앞 150 ms 안에 다른 노트 없음. 노트 구간의 `pitch_contour` 편차가 ±35 cents를 넘는 노트(벤딩·슬라이드·비브라토)는 제외. (Mode A decay window가 +350 ms까지이므로 그보다 짧은 노트는 쓰지 않는다.)
- 지표:

| 구분 | 지표 | 임계값 |
|---|---|---|
| **하드** | Mode A: 단음 이벤트를 기대 음으로 검증 → OK 비율 | ≥ 95% |
| **하드** | Mode A: 기대 음을 ±1 반음 바꿨을 때 OK(false accept) | ≤ 3% |
| **하드** | Mode C: 스트럼 이벤트의 실제 보이싱 vs **같은 클립의 다른 스트럼 이벤트 중 pitch-class 집합이 다른 것**(시드 균등 추출)의 보이싱, 2지선다 분류 정확도 | ≥ 90% |
| **하드** | 스트럼 수준 onset F1 @±50 ms. 정답 = comp 클립의 모든 note onset을 60 ms로 묶은 그룹(크기 무관). Funk comp 클립은 주석 없는 뮤트 '칙' 소리가 많아 제외(BENCHMARK.md에 명시) | ≥ 0.85 |
| 소프트 | Mode B: 실제 보이싱으로 검증 시 FAIL(false reject) | ≤ 10% |
| 소프트 | Mode B: verifiable 줄 하나의 기대 프렛을 +1/+2 바꿨을 때 그 줄 OK | ≤ 15% |

- **하드** 미달은 verify FAIL이다. **소프트** 미달은 verify를 막지 않지만, 최소 한 번의 개선 시도와 원인 분석(이벤트 예시, 조건별 분해)을 `docs/DSP.md`에 써야 AC-G3이 DONE이 된다.
- GuitarSet 마이크는 스튜디오 콘덴서라 휴대폰보다 깨끗하다는 한계를 `docs/BENCHMARK.md`에 명시한다.
- 튜닝 규칙: GuitarSet도 dev/test로 나눈다(플레이어 00–03 = dev, 04–05 = test). 파라미터는 dev로만 조정하고 지표는 test로 보고한다.

### 14.5 E2E (Playwright)

**프로젝트**:
- `chromium-mic`: `page.addInitScript`로 주입하는 가짜 마이크 하네스(`tests/e2e/support/fakeMic.ts`). 설계:
  - 앱의 AudioEngine은 **AudioContext를 먼저 만들고 그다음 `getUserMedia`를 호출**한다(iOS 제스처 요구와도 맞음). 하네스는 `AudioContext` 생성자를 감싸 앱의 컨텍스트를 붙잡고, `getUserMedia` override가 **같은 컨텍스트**의 `MediaStreamAudioDestinationNode.stream`을 돌려준다(같은 시계 → 시각 통제 가능).
  - fixture 재생: 테스트가 `__fakeMic.play(wavUrl, { at: contextTime })`로 WAV를 지정 시각에 그 destination으로 흘려보낸다. 예: E5는 `window.__gh_test`에서 그리드 시작 시각을 읽어 `그리드 시작 + 시뮬레이션 RTT`에 재생.
  - loopback 시뮬레이션: `AudioNode.prototype.connect`를 감싸 앱 출력(`ctx.destination` 연결)을 `DelayNode(지정 ms)`를 거쳐 가짜 마이크로 되돌린다(E2E-01 RTT 측정용).
  - Playwright `globalSetup`이 `npm run fixtures:generate`를 실행한다.
- `chromium-fake-capture`: 실제 `getUserMedia` 경로 검증용 1–2개 테스트. 실행 인자 `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<abs>.wav%noloop`.
- `webkit-ipad`(가로 1180×820), `webkit-iphone`(390×844): UI 레이아웃·키보드 흐름. WebKit에서 override 하네스가 동작하면 마이크 시나리오 일부도 실행한다. 동작하지 않는 시나리오는 `.skip`이 아니라 playwright.config의 프로젝트별 `testIgnore`로 빼고 사유를 DECISIONS에 기록한다. WebKit 자체가 이 macOS에서 실행되지 않으면 Chromium 디바이스 에뮬레이션(iPad/iPhone 프리셋)으로 대체하고 DECISIONS에 기록한다.
- fixture WAV는 `npm run fixtures:generate`가 합성기로 결정적으로 만든다(`tests/fixtures/generated/`, 작으면 커밋 가능).

**필수 시나리오** (각각 독립 테스트):

| ID | 시나리오 | 핵심 단언 |
|---|---|---|
| E2E-01 | 첫 실행 → 온보딩(권한, 환경 점검, 튜닝: 개방현 fixture, 템플릿, RTT: loopback fixture) | Calibration 저장, 튜닝 6줄 통과, RTT ≥ 시뮬레이션 지연이고 ≤ 시뮬레이션 지연 + 30 ms(브라우저 내부 버퍼링 여유), 같은 조건 2회 측정 차이 ≤ 3 ms |
| E2E-02 | E1 C 코드, 한 줄씩 깨끗한 fixture | 5줄 OK, 6번 줄 건너뜀, Attempt가 IndexedDB에 저장 |
| E2E-03 | E1 C 코드, 2번 줄(B) 뮤트 fixture(한 줄씩) | 2번 줄 MUTED + 코칭 힌트 문구 표시 |
| E2E-04 | E1 스트럼 베타, 6번 줄이 울린 C | UNEXPECTED(6번 줄) FAIL 표시, "베타" 라벨 |
| E2E-05 | E2 A→D, timeScale 0.25(15초), 교대 스트럼 fixture | 첫 스트럼으로 자동 시작, 자동 카운트가 정답 ±1, `↑` 2회·`↓` 1회 보정 반영, detected/corrected 둘 다 저장 |
| E2E-06 | E5 P3 80 BPM, 그리드 정렬 fixture(+시뮬레이션 RTT; 테스트 전에 같은 RTT의 Calibration을 IndexedDB에 시드) | hit_rate ≥ 0.9 표시, mean/sd 표시, 사다리 +5 BPM 제안 |
| E2E-07 | 오늘의 루틴을 **키보드만으로** 끝까지(수동 모드 항목 포함, timeScale) | 세션 1개·Attempt N개 저장, 자가 평가 저장, 홈 갱신 |
| E2E-08 | 내보내기 → 데이터 초기화 → 가져오기 | 테이블별 건수 동일, 진도 화면 동일 |
| E2E-09 | preview 빌드 로드 → 오프라인 전환 → 새로고침 | 앱 셸과 라이브러리 화면 동작 |
| E2E-10 | 모든 주요 화면 × (MacBook 1440×900, iPad 가로/세로, iPhone) | `scrollWidth ≤ innerWidth`, 연습 화면 주요 버튼 ≥ 64 px, 스크린샷 저장 |
| E2E-11 | 주요 화면 axe 검사 | serious/critical 0 |
| E2E-12 | 마이크 권한 거부 | "마이크 없이 쓰기" 안내, E2 탭 모드·E1 수동 모드로 진행 가능 |
| E2E-13 | `chromium-fake-capture`로 실제 getUserMedia 경로 | 요청 constraint에 EC/NS/AGC false, 진단 화면에 getSettings 표시 |
| E2E-14 | 기본 프로덕션 빌드(`dist/`)에서 `?timeScale=0.25` | 무시됨(타이머 정상 속도), `window.__gh_test` 없음, `dist/` 번들 문자열 스캔에 `timeScale`·`__gh_test` 없음 |

- 마이크 시나리오(E2E-02~06)는 저장된 Attempt의 `detectorVersion`이 `src/dsp/version.ts` 값과 같고 `processingMs > 0`임을 단언한다(DSP를 우회한 가짜 통과 방지).
- E2E용 빌드는 `dist-e2e/`로 출력해 `dist/`를 덮어쓰지 않는다.

### 14.6 무결성 테스트 (`tests/integrity/`, Vitest)

1. `src/dsp/**`, `src/domain/**`가 DOM/Web Audio/React/Dexie를 import하지 않는다(소스 정적 스캔).
2. 벤치마크 생성기의 실제 매트릭스 설정이 `thresholds.json.matrix`의 모든 값을 포함한다. split 시드 범위가 `thresholds.json.splitSeeds`와 같다. 벤치마크가 판정에 쓰는 임계값 객체가 `thresholds.json`에서 로드된 것과 deep-equal이다.
3. 테스트 코드에 `.skip(`, `.only(`, `.fixme(` 호출이 없다(주석 속 단어는 무관). 소스에 `@ts-ignore`와 `@ts-expect-error`(타입 테스트 파일 `*.test-d.ts` 제외)가 없고, `biome-ignore`에는 사유 주석이 있다.
4. 컴포넌트 TSX에 한글 문자열 리터럴이 없다(`i18n/ko.ts`만 허용).
5. `window.__gh_test` 훅 객체는 `Object.freeze`된 읽기 전용 getter만 가진다(소스 검사). 빌드 산출물 스캔은 빌드 이후에 도는 E2E-14가 맡는다.
6. `dsp/`와 `tools/`에서 `Math.random` 사용 금지.

### 14.7 verify 요약표 형식 (최종 출력에 그대로 사용)

```
VERIFY SUMMARY (guitar-hero @ <git short sha>)
step              status    time
licenses          PASS      2s
typecheck         PASS      14s
lint              PASS      3s
test              PASS      41s   (n tests)
bench:dsp         PASS      3m12s (all thresholds met)
bench:guitarset   PASS      2m40s (hard 4/4, soft 2/2)
build             PASS      9s
test:e2e          PASS      4m05s (n tests, 4 projects)
RESULT: PASS
```

- 단계 상태는 PASS / FAIL / BLOCKED / NOT_YET이다. NOT_YET은 아직 해당 마일스톤 전인 단계(예: M1 시점의 bench:guitarset)이고, **최종 verify에서는 FAIL로 취급**한다. BLOCKED는 bench:guitarset에만, §14.4 마커가 있을 때만 허용한다. 그 경우 마지막 줄은 `RESULT: PASS (BLOCKED: bench:guitarset)`이고 마커 내용을 함께 출력한다.

---

## 15. PWA와 배포 준비

- `vite-plugin-pwa`(~1.3): manifest(이름 "기타 연습", 짧은 이름 "기타", 테마색, 아이콘 192/512 + maskable — 단순한 자체 SVG에서 생성), 앱 셸·시드 콘텐츠 precache, `registerType: 'prompt'`(연습 중 강제 새로고침 금지, 홈 화면에서만 "업데이트 있음" 토스트).
- `public/_headers`(Cloudflare Pages/Netlify): `Permissions-Policy: microphone=(self)`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, 엄격한 CSP(`default-src 'self'`; worker/worklet 동작 확인). `vercel.json`에 같은 헤더. GitHub Pages용 하위 경로 빌드(`VITE_BASE`) 지원.
- `docs/DEPLOY.md`: Cloudflare Pages / Netlify / Vercel / GitHub Pages 단계별 절차, HTTPS가 필요한 이유(getUserMedia·Wake Lock), iPad/iPhone에서 홈 화면 추가 방법, `npm run dev:https`로 같은 Wi-Fi에서 테스트하는 법(자체 서명 인증서 경고 통과 방법).
- **배포 명령은 실행하지 않는다.**

---

## 16. 마일스톤

각 마일스톤 종료 조건: 표의 AC가 모두 DONE(증거 기록) + 그 시점의 `npm run verify` 통과 + PROGRESS.md 갱신 + 커밋.

| M | 이름 | 내용 | 종료 시 AC |
|---|---|---|---|
| M0 | 부트스트랩·스파이크 | 브랜치 생성, 리서치·goal 문서를 첫 커밋으로 포함, Vite+React+TS 스캐폴드, Biome/Vitest/Playwright 설정, `npx playwright install chromium webkit`, `tools/verify.ts` 골격, `licenses` 스크립트. **스파이크**: (1) TS AudioWorklet이 dev/build 양쪽에서 로드됨, (2) fakeMic override로 WAV를 worklet RMS로 관측하는 E2E smoke, (3) `--use-file-for-fake-audio-capture` smoke. 결과를 DECISIONS에 기록 | P2(부분), P3, P5(부분) |
| M1 | 도메인·콘텐츠·데이터 | 튜닝/보이싱/기대음/충돌 맵/앵커, 시드 25 보이싱·커리큘럼(0–11)·루틴 템플릿·연습곡 8곡·코칭 규칙(+zod 검증), Dexie 스키마·저장소·export/import·rebuildDerived, 루틴 생성기, 진급 엔진, 복습 큐, 안전 규칙 | D1–D5, R1–R4, T1, T2 |
| M2 | DSP 코어·합성기·벤치마크 | synth, WAV I/O, FFT, 피치, onset, salience, Mode A/B/C/D, 튜너, RTT, 벤치마크 하네스(dev/test), 무결성 테스트, `docs/DSP.md` 초안 | S1–S8, P4(부분) |
| M3 | 실녹음 벤치마크 | GuitarSet 다운로드·체크섬·JAMS 파서·이벤트 추출·`bench:guitarset`, dev split로 개선, 결과 문서화, `bench:real` 하네스 | G1–G3 |
| M4 | 오디오 엔진·캘리브레이션 | AudioEngine, worklet, worker, 장치 처리, iOS audioSession, 메트로놈(+단독 화면), 타이머, Wake Lock, 튜너 화면, 온보딩/캘리브레이션 마법사, 진단 화면 | A1–A5 (E2E-01 포함) |
| M5 | 연습 플러그인 | 플러그인 레지스트리 + E0, E1, E2, E4, E5, E6, E7, E8, Q1–Q4, S(연습곡) + 각 러너 단위 테스트 + E2E-02~06, 12, 13 | X1–X8, X10 |
| M6 | 커리큘럼·루틴·진도 | 홈, 세션 러너, 커리큘럼 화면, 졸업 시험, 진도 대시보드, 코드 라이브러리, 백업 UI·백업 리마인더, 녹음 키트, E2E-07, 08 | R5, U1, T3, T4, X9 |
| M7 | PWA·반응형·접근성·배포 준비 | PWA, 레이아웃 다듬기, 키·페달 매핑/학습 모드, 테마, axe, E2E-09~11, 14, `_headers`, `vercel.json`, `docs/DEPLOY.md` | U2–U6, W1–W3 |
| M8 | 하드닝·최종 검증 | 리뷰 서브에이전트 지적 사항 수정, README·ARCHITECTURE·DSP·BENCHMARK·MANUAL_VALIDATION·BACKLOG 완성, `npm ci && npm run verify` 최종, FINAL_REPORT | P1, P2, P6, F1–F3 |

### 16.1 수렴을 위한 축소 허용 목록 (DEFERRABLE)

턴 240을 넘겼고 남은 작업이 남은 예산을 넘을 것으로 보이면, 아래 하위 항목**만** v2로 미룰 수 있다. 미룬 항목은 `docs/BACKLOG.md`에 `DEFERRED (턴 n, 사유)`로 적고, 해당 AC의 증거 칸에 `DONE (deferred: <항목>)`으로 표시한다. **이 목록 밖의 항목은 미룰 수 없다.** 미룬 연습이 진급 기준(§7.1)에 쓰이면 그 기준은 자가 보고 항목으로 바꾼다.
- Q3 개방현 음이름 퀴즈, Q4 메이저/마이너 귀 훈련 (AC-X7의 일부)
- E6 박 1 체인지, E8 한 줄 교대 피킹 (AC-X6의 일부)
- 녹음 키트의 OPFS 저장·zip 내보내기 (AC-T4의 일부. `bench:real` 하네스는 유지)
- 페달 학습 모드 (AC-U2의 일부. 기본 키 매핑은 유지)
- 고대비 테마 (AC-U6의 일부)
- RTT tap 보정 대체 경로 (AC-A4의 일부. loopback은 유지)
- WebKit 프로젝트의 마이크 시나리오 (UI 시나리오는 유지)

### 16.2 마지막 순서 (M8)

1. 모든 AC가 DONE → FINAL_REPORT.md(verify 표는 직전 verify 결과)·PROGRESS.md·README 갱신 → M8 커밋.
2. HEAD(M8 커밋)에서 `npm ci && npm run verify`를 백그라운드로 실행하고 완료를 기다린다. 실패하면 고치고 다시 커밋한 뒤 반복한다.
3. 통과하면 §18.2를 출력한다. 이 시점 이후에는 파일을 수정하거나 커밋하지 않는다(§2.5 "매 턴 PROGRESS 갱신"의 예외). FINAL_REPORT의 verify 표와 최종 실행 결과가 다르면 최종 출력이 우선이고, 그 차이를 출력에 한 줄로 밝힌다.

---

## 17. Acceptance Criteria

PROGRESS.md의 AC 표는 아래 ID를 그대로 쓴다. 상태: TODO / DOING / DONE / BLOCKED(§14.4의 GuitarSet 다운로드 실패에 한해 AC-G1·G2·G3만 허용). DONE에는 증거(테스트 파일·테스트 이름·명령·산출물 경로)를 적는다.

**프로세스·품질**
- AC-P1: `feat/practice-app-v1`에 M0–M8 커밋 존재, `main`은 `9e7eda6` 그대로, 원격 push 없음(`git branch -vv`에 upstream 없음), 작업 트리 clean.
- AC-P2: `npm ci && npm run verify` exit 0, §14.7 형식 요약표.
- AC-P3: `npm run licenses` 통과(프로덕션 의존성에 GPL/LGPL/AGPL 없음), 결과표에 패키지·라이선스 목록.
- AC-P4: §14.6 무결성 테스트 전부 통과.
- AC-P5: TypeScript strict(+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Biome `noExplicitAny` error, 린트 경고 0.
- AC-P6: `docs/goal/SPEC.md`와 `docs/goal/thresholds.json`의 SHA-256이 goal 조건문에 적힌 값과 같다.

**도메인·콘텐츠**
- AC-D1: 시드 보이싱 25개 zod 검증, pitch-class·루트·3음 테스트, 손가락 물리 타당성 테스트 통과.
- AC-D2: partial 충돌 맵 구현, open C 사례 테스트, Stage 0–7 보이싱별 verifiable 줄 커버리지 리포트 생성.
- AC-D3: 커리큘럼 Stage 0–7(진행)·8–11(미리보기) 데이터, 진급 규칙이 데이터로 표현됨, 연습곡 8곡 이상(스테이지 코드 제약 테스트).
- AC-D4: `anchors()` 테스트(D↔A에서 1번 손가락 3번 줄 2프렛 앵커 검출, G↔C 앵커 없음).
- AC-D5: 코칭 힌트 규칙 테스트(§6.7 표의 각 행).

**오디오**
- AC-A1: 캡처 constraint(EC/NS/AGC false), getSettings 진단 저장·표시, 장치 분리·권한 거부 처리.
- AC-A2: 메트로놈 lookahead 스케줄러 10분 지터 시뮬레이션 테스트, 템포 변경, 카운트인, 음소거 마디, 시각 전용 모드.
- AC-A3: 시계 차이 기반 타이머 테스트(불규칙 틱), Wake Lock 처리.
- AC-A4: 온보딩/캘리브레이션 마법사(환경 점검·튜닝·템플릿·RTT loopback + tap 대체) 저장, E2E-01.
- AC-A5: AudioWorklet TS 번들 dev/build 동작, worklet 블록 처리 무할당(코드 리뷰 + 마이크로벤치).

**DSP(합성 test split, `thresholds.json` 기준)**
- AC-S1: Mode A 지표 전부 통과.
- AC-S2: Mode B 지표 전부 통과(베타 라벨 유지).
- AC-S3: Mode C 지표 전부 통과.
- AC-S4: Mode D 지표 전부 통과.
- AC-S5: 튜너 지표 통과.
- AC-S6: RTT 지표 통과(무신호 시 실패 보고 100%).
- AC-S7: 성능 지표 통과.
- AC-S8: 커버리지 지표 통과, 매트릭스 최소 차원·최소 표본 수 충족(무결성 테스트).

**실녹음**
- AC-G1: GuitarSet 다운로드(체크섬 검증)·JAMS 파서·이벤트 추출·dev/test 분할 구현.
- AC-G2: 하드 지표 4개 통과.
- AC-G3: 소프트 지표 보고, 미달 시 개선 시도와 원인 분석을 `docs/DSP.md`에 기록.

**연습**
- AC-X1: 플러그인 레지스트리, 모든 러너가 오디오 없이 동작, 가짜 clock 단위 테스트.
- AC-X2: E1(한 줄씩·스트럼 베타·수동·귀 먼저), E2E-02·03·04.
- AC-X3: E2(첫 스트럼 자동 시작, 자동/탭/수동, ±1 보정, 3값 저장), E2E-05.
- AC-X4: E4(앵커/공중 자동 판별).
- AC-X5: E5(P0–P5, 사다리, 시각 큐 숨김, 개인 선행 보정), E2E-06.
- AC-X6: E6, E7, E8.
- AC-X7: Q1–Q4.
- AC-X8: S 연습곡(학습/연주 모드, 악보 숨김, 들어 보기).
- AC-X9: 졸업 시험 5개 항목 흐름과 기록.
- AC-X10: 마이크 권한 거부 시 대체 흐름, E2E-12·13.

**루틴·진급**
- AC-R1: 루틴 생성 규칙 1–8 각각의 단위 테스트, 결정성 테스트.
- AC-R2: 진급 엔진(데이터 규칙, 조건부 진급, 정체 감지) 테스트.
- AC-R3: 복습 큐 간격·후퇴 테스트, 주간 스트릭 테스트.
- AC-R4: 안전 규칙(20분 상한 4주, 30분 휴식, 통증 감량, 위험 통증 시 휴식 안내) 테스트.
- AC-R5: 홈·세션 러너·커리큘럼·진도 화면 동작, E2E-07.

**UX**
- AC-U1: §12.1 화면 전부, 문자열은 `i18n/ko.ts`.
- AC-U2: 키 매핑(§12.3) + 페달 학습 모드 + 첫 스트럼 자동 시작.
- AC-U3: 반응형 E2E-10(4개 뷰포트, 가로 스크롤 0, 버튼 크기).
- AC-U4: 접근성 E2E-11, aria-live 판정.
- AC-U5: 판정 문구 규칙(FAIL에 원인+행동, RETRY 원인별, "틀렸습니다" 단독 금지) 테스트.
- AC-U6: 다크(기본)/라이트/고대비 테마, 왼손잡이 다이어그램 미러.

**데이터**
- AC-T1: Dexie 스키마, append-only Attempt, `rebuildDerived()` = 증분 결과 테스트.
- AC-T2: export/import 왕복 테스트, zod 검증, 미리보기, 마이그레이션 골격.
- AC-T3: `storage.persist()` 요청, 7일 백업 리마인더.
- AC-T4: 녹음 키트(OPFS WAV + labels.json 내보내기), `bench:real` 하네스(no fixtures 시 성공 종료).

**PWA·배포 준비**
- AC-W1: PWA 오프라인 E2E-09, `registerType: 'prompt'`.
- AC-W2: `_headers`, `vercel.json`, `VITE_BASE`, `dev:https`.
- AC-W3: `docs/DEPLOY.md`(4개 호스트, iPad 설치, LAN 테스트).

**문서·보고**
- AC-F1: README(소개, 요구 사항, 스크립트, 아이패드에서 쓰는 법, 아키텍처 요약, 데이터 백업), `docs/ARCHITECTURE.md`, `docs/DSP.md`(최종 파라미터와 근거), `docs/BENCHMARK.md`(생성), `docs/BACKLOG.md`(v2).
- AC-F2: `docs/MANUAL_VALIDATION.md` — 사용자가 실기기(MacBook Chrome·Safari, iPad Safari PWA, iPhone Safari)에서 할 체크리스트: 튜너를 다른 튜너와 비교, 일부러 줄 뮤트한 Chord Perfect, 1분 체인지 자동 vs 직접 센 값, 스트럼 타이밍, 녹음 키트로 fixture 만들기 → `bench:real`, 결과 기록 양식.
- AC-F3: `docs/goal/FINAL_REPORT.md`(§18) 작성.

---

## 18. 최종 보고

### 18.1 `docs/goal/FINAL_REPORT.md` 구성

1. 요약(무엇을 만들었나, 5줄)
2. verify 요약표(§14.7)
3. 합성 벤치마크 지표표(임계값 대비) + GuitarSet 지표표(하드/소프트)
4. AC 표(PROGRESS.md와 같음)
5. 마일스톤 커밋 목록(`git log --oneline main..HEAD`)
6. 주요 결정 요약(DECISIONS.md 링크)
7. 알려진 한계(예: 합성·스튜디오 마이크와 휴대폰 마이크의 차이, 스트럼 모드의 확인 불가 줄, iOS 재생 품질 버그)
8. 사용자가 다음에 할 일: `docs/MANUAL_VALIDATION.md` 순서대로 실기기 검증 → 녹음 키트 fixture로 `bench:real` → 배포(`docs/DEPLOY.md`) → `main` 병합 여부 결정

### 18.2 마지막 턴에 대화창에 출력할 것 (evaluator는 대화만 본다)

아래 1–6을 도구 출력으로만 두지 말고 **마지막 assistant 메시지 본문에 그대로 붙여 넣는다**(evaluator가 확실히 볼 수 있도록).

1. `git rev-parse --short main`, `git log --oneline main..HEAD`, `git status --short`(비어 있어야 함), `git branch -vv | grep feat/practice-app-v1`
2. `shasum -a 256 docs/goal/SPEC.md docs/goal/thresholds.json`
3. `npm ci && npm run verify`의 요약표 전체
4. 합성·GuitarSet 지표표(임계값 열 포함)
5. PROGRESS.md의 AC 표 전체
6. FINAL_REPORT.md의 1·7·8절

---

## 부록 A. 리서치 문서 매핑

| SPEC 절 | 리서치 근거 |
|---|---|
| §6–§7 커리큘럼·루틴·연습 수치 | 01 §1.2–1.6, §5 |
| §8 오디오 캡처·iOS | 02 §1, 03 §2.1, §2.4 |
| §10 DSP | 02 §2, §7, §8 |
| §11 연습 UX, §12 | 01 §5.4, 03 §1.3, §2 |
| §13 데이터 | 03 §5 |
| §14 테스트 | 02 §5, 03 §4.3 |
| §4 스택 | 03 §4, §6.2 |

## 부록 B. 용어

- **Mode A**: 한 줄씩 튕겨 줄마다 확인(가장 신뢰도 높음). **Mode B**: 한 번에 긁은 소리로 확인(베타, 확인 가능한 줄만). **Mode C**: 정해진 후보 코드 중 어느 것인지 분류(1분 체인지·퀴즈). **Mode D**: 메트로놈 대비 타이밍.
- **verifiable 줄**: 스트럼 소리에서 다른 줄 배음과 겹치지 않는 partial이 2개 이상이라 단독으로 판정할 수 있는 줄(§6.3).
- **RTT**: 출력 지연 + 입력 지연. 메트로놈 대비 타이밍 보정에 이 값 하나만 필요하다.
- **dev/test split**: 파라미터를 맞추는 데이터(dev)와 최종 성적을 재는 데이터(test). test로 파라미터를 고치면 성적이 부풀려진다.
