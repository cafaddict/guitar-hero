# 03. 제품/UX 및 엔지니어링 스택 리서치

- 작성일: 2026-10-07
- 범위: 경쟁 앱 기능 분석, 연습 도구 UX 패턴, 렌더링/오디오 라이브러리, 2026년 기준 local-first 웹앱 기술 스택, 데이터 모델
- 범위 밖: 교수법(pedagogy) 자체 → 별도 문서, DSP/코드 인식 알고리즘 → 별도 문서. 이 문서는 DSP 모듈을 "인터페이스"로만 다룬다.
- 표기 규칙: 출처로 확인하지 못한 주장은 **(미확인)** 으로 표시. npm 버전은 2026-10-07에 `registry.npmjs.org`에서 직접 조회한 값이다.

---

## 핵심 요약 (TL;DR)

1. 기존 앱들의 공통 약점은 **마이크 기반 피드백의 신뢰성**이다. JustinGuitar 앱의 One Minute Changes(OMC) 자동 카운트는 "1~5회 틀린다", "업데이트 후 아예 인식 안 됨"이라는 불만이 반복되고, 공식 답변이 "수동으로 세라"였다. Yousician/Simply Guitar/Fender Play도 "맞게 쳤는데 틀렸다고 한다", "피드백이 이진(맞음/틀림)이다"라는 불만이 핵심이다.
2. 개인용 도구가 이길 수 있는 틈새는 콘텐츠 양이 아니라 **(a) 설명 가능한·정직한 피드백**(줄별 원인, confidence, "모르겠음" 상태), **(b) 자동+수동 하이브리드 카운트와 원시 로그**, **(c) 드리프트 없는 타이머/메트로놈**, **(d) 손을 쓰지 않는 조작(스페이스바/풋페달/첫 스트럼 자동 시작)**, **(e) 구독 없는 local-first 데이터 소유**다.
3. 권장 스택: **Vite 8.3 + React 19.3 + TypeScript (7.0, 문제 시 6.0) + Tailwind 4.3 + Dexie 4.4 + vite-plugin-pwa 1.3/2.0 + Vitest 5 + Playwright 1.63**. 실시간 시각화(레벨 미터, 줄별 표시)는 React state를 거치지 않고 canvas + `requestAnimationFrame`으로 직접 그린다.
4. 데이터 모델은 **불변(append-only) Attempt 로그 + 재계산 가능한 파생 지표** 구조로 만들고, 연습 유형은 `ExercisePlugin` 인터페이스(파라미터 스키마/결과 스키마/러너/뷰/지표 요약)로 확장한다.

---

## 1. 경쟁 앱 기능 분석

### 1.1 앱별 요약 표

| 앱 | 핵심 연습 루프 | 무엇을 측정하나 | 피드백 방식 | 게임화 / 진도 / 리마인더 | 칭찬 | 불만 |
|---|---|---|---|---|---|---|
| **JustinGuitar (Lessons & Songs 앱, Musopia 개발)** | 그레이드별 레슨 영상 → 연습 항목(OMC, Chord Perfect) → 노래 play-along | OMC 1분간 코드 전환 횟수, Chord Perfect 시 줄별 울림 | OMC: 마이크로 전환 자동 카운트(수동 입력 폴백). Chord Perfect: 줄별로 튕기면 미터가 녹색으로 변함 → 실시간 | 레슨 진도, play-along 템포 조절 | 커리큘럼 품질, 노래 템포 감속, 정돈된 UI | OMC 카운트 부정확("1~5회 오차"), 업데이트 후 인식 중단, 외부 튜너로 튜닝하면 인식 실패, 공식 답변이 "수동으로 세라" |
| **One Minute Changes (JustinGuitar 구버전 단독 앱)** | 코드 쌍 선택 → 1분 → 횟수 기록 | 쌍별 횟수, 통계 | 사후(통계) | "가장 어려워하는 코드 쌍을 자동 선택" | 단순함 | 평점 4.27/113개 리뷰 수준의 소규모 앱 |
| **JustinGuitar 웹 Practice Assistant** | 저장한 루틴 항목별 타이머 + OMC 기록 | 시간, OMC 횟수 → 그래프 | 사후 | 대시보드 진도 | 무료, OMC 그래프 | **탭이 비활성화되면 타이머가 느려짐**(54분 실제 → 19분 표시) |
| **Yousician** | 미션/레슨 → 스크롤 노트 하이웨이 연주 → 별점 | 노트/코드 적중, 타이밍 | 실시간(색상 적/녹) + 별 1~3개 | 별, 주간 streak, 일일 목표(별 또는 분), Workouts(코드 모양, 귀 훈련, 스케일) | 게임 몰입감, 즉각 피드백 | 정확하게 쳐도 오답 처리, Am·D 인식 지연, 코드 전환 챌린지 1~5회 오차, 튜닝을 앱 튜너로 해야 함, 구독/해지 문제, 커뮤니티 기능 삭제 |
| **Fender Play** | 목표/장르 기반 learning path → 짧은 영상 → Practice Mode(메트로놈·템포 조절) | Feedback Mode(베타)에서 정확도 점수 | Feedback Mode: 연주 후 통계 + 하이스코어 | 연습 리마인더, 주간 streak, 스킬 평가, 강사 office hours | 영상 품질, 체계적 경로 | Feedback Mode가 베타이고 일부 레슨만 지원, 기기별 오작동, 결제/해지 불만 |
| **Simply Guitar (JoyTunes/Simply)** | 단계별 레슨 → 노래 연주 → 마이크 판정 | 노트/코드 적중 | 실시간이지만 **거의 이진** — 끝나면 놓친 개수만 표시 | 게임화된 진도 | 진입장벽 낮음, 빠른 초기 성취감 | 스트럼 인식 부정확("커피 그라인더와 기타를 구분 못함"), 정답인데 오답 처리, 구독 비용 |
| **Guitar Tricks** | Core Learning System(플로차트형 Fundamentals 1→2→장르) 영상 레슨 | 레슨 완료 | 없음(자가 평가) | Progress System | 체계적 순서, 슬로모션·루프, 탭/악보 다운로드, 코드/스케일 파인더 | 자동 피드백 없음 (미확인: 커뮤니티 불만 데이터 미수집) |
| **GuitarTuna (Yousician 계열)** | 튜너 → 커스터마이즈 가능한 코드 게임 → 코스 | 코드 인식 적중 | 실시간 | 게임, 코스(기초/필수 코드/스트럼/바레) | 튜너 정확도, 노이즈 캔슬링, 왼손잡이 모드, 코드 라이브러리+오디오 | 코드 게임의 상세 판정 방식은 공개 문서 부족 (미확인) |
| **Ultimate Guitar (Tabs/Pro/Courses)** | 탭 검색 → 오토스크롤/플레이백 → 코스 | Practice mode 구독자 한정 "AI music coach" | (미확인: 판정 방식 상세 미확인) | 구독 번들(UG Pro + Courses + Sing) | 최대 규모 탭/코드 라이브러리, 코드 변형 선택, 단순화, 전조 | 사용자 제출 탭 품질 편차 (미확인) |
| **Songsterr** | 탭 + 동기화된 원곡 오디오 → 속도·루프 | 측정 없음 | 없음 | 없음 | 정확한 탭, 루프, 속도 조절, pitch shift, 백킹 트랙 | 학습 커리큘럼 없음, 구독 $9.99/월 |
| **Rocksmith+ (Ubisoft)** | 곡 기반 하이웨이, 동적 난이도 | 노트/코드 적중 | 실시간 | 곡 라이브러리 지속 추가(2026-09 기준 업데이트 중, 4주년) | 실제 기타 입력, 어쿠스틱은 모바일 Connect 앱 마이크로 | Bluetooth 오디오는 지연 때문에 비권장(공식), 레이턴시가 출력 경로 의존 |
| **Chordify** | 임의 곡 → 자동 코드 추출 → 애니메이션 코드 다이어그램 | 측정 없음(2025년 Guitar Toolkit에 라이브 코드 감지 추가) | 라이브 감지는 "무슨 코드가 들리나" 표시 | 없음 | 3,600만 곡, 감속/루프/전조 | 자동 추출 정확도 편차 (미확인) |
| **Uberchord** | 실시간 코드 인식 트레이너 | 코드 정확도 | 실시간 | — | 2016~17년 "실시간 코드 인식"으로 주목 | **2026-10 현재 미국 App Store 검색에 나오지 않음** — 사실상 단종으로 추정 (미확인, 웹사이트는 응답함) |

### 1.2 세부 관찰

**JustinGuitar의 OMC 자동 카운트는 신뢰 문제를 그대로 보여 준다.** 커뮤니티 스레드에서 Musopia는 "재현하지 못했다", "정확도 개선을 조사 중"이라고만 답하고, 공식 우회책으로 "수동으로 전환 횟수를 세라", "마이크 먼지 제거, 사운드홀 가까이, 클린 톤"을 제시했다. 사용자들은 휴대폰 타이머와 메트로놈으로 돌아갔고, "돈 내고 쓰는 기능인데"라는 불만이 나왔다. 교훈: **자동 판정은 반드시 사람이 고칠 수 있어야 하고, 두 값(자동/자가)을 모두 기록해야 한다.**

**Chord Perfect는 '줄별 확인' UX의 좋은 원형이다.** 손가락 배치 → 각 줄을 하나씩 튕김 → 미터가 녹색이면 그 줄은 OK → 안 울리는 줄은 손가락 조정 → 전체 스트럼 → 손 떼고 반복. 다만 "외부 튜너로 튜닝했더니 인식이 안 되고, 앱 튜너로 맞추니 됐다"는 보고가 있어, 판정기가 **기준 피치(A4)와 튜닝 편차를 사용자 기타에 맞춰 보정하지 않는다**는 정황이 있다. Yousician 지원 문서도 "앱 튜너로 튜닝하라"고 권한다. 교훈: **세션 시작 시 튜닝 확인/보정 단계를 넣고, 판정기는 측정된 개방현 피치를 기준으로 삼는다.**

**JustinGuitar 커뮤니티의 교육 철학적 반론도 제품 설계에 중요하다.** "기계가 알려 주는 대신 손과 귀가 알려 줘야 한다", "시각적 접근은 귀 대신 눈으로 치게 만들어 장기적으로 방해했다"는 의견이 있다. 교훈: 피드백은 **보조 바퀴**로 설계하고, "귀 먼저(self-assess first)" 모드 — 사용자가 먼저 자가 판정 후 앱 판정을 공개 — 를 제공하면 철학과 기능이 양립한다.

**연습 기록 방식에 대한 실제 목소리.** JustinGuitar 포럼의 "연습을 어떻게 기록하나" 스레드에서 사람들은 스프레드시트, 메모앱, Notion, 종이 노트를 쓴다. 이유는 "마찰이 적어서", 그리고 "폰/PC에 또 업데이트할 게 생기는 건 방해"라는 것. 원하는 것은 레슨 흐름에 자연스럽게 녹아든 기록, 시간에 따른 진도 시각화, 가벼운 리마인더/streak, 다음 단계로 넘어갈 기준, 메모/일지. 교훈: **기록은 연습의 부산물로 자동 생성**되어야 하고, 입력은 연습 직후 1~2탭(또는 페달)으로 끝나야 한다.

**메트로놈 앱의 "Speed trainer"는 표준 기능이다.** Frozen Ape Tempo의 Automator(N마디/N초마다 템포 변경, 제한 도달 시 자동 정지), Metronome Step(시작/목표 BPM, 4~64마디마다 1~5 BPM 증가), Metronome Beats(점진 가속, 몇 마디마다 음소거해 내부 박자 테스트), Soundbrenner(구독 시 자동 증가). JustinGuitar 포럼에도 "메트로놈 자동 템포 증가" 요청이 있다.

**Modacity는 '의도적 연습(deliberate practice)' 도구의 참고 모델이다.** 항목별 타이머, 녹음 후 재청취 → 자기 평가, 개선 카테고리 선택 → 전략 제시, 세션 자동 로그·streak·마일스톤, 연습 휴식 리마인더.

### 1.3 개인용 도구가 채울 수 있는 빈틈 (Gap 분석)

| # | 빈틈 | 기존 앱 상태 | 이 앱의 대응 |
|---|---|---|---|
| G1 | 정직하고 설명 가능한 피드백 | 이진 판정, 이유 없음, 오탐 시 사용자 불신 | 줄별 상태(울림/뮤트/버징/틀린 음) + confidence + "판정 불가(소음/레벨 부족)" 상태를 명시 |
| G2 | OMC 카운트 신뢰성 | 자동 카운트 오차, 수동 폴백 | 자동 카운트 + 페달/키로 ±1 보정, 자동값·보정값·자가값 모두 저장 |
| G3 | 약한 코드 쌍 우선 스케줄링 | 구 OMC 앱에만 존재 | 쌍별 최근 점수/추세 기반 우선순위 큐 |
| G4 | 루틴 빌더 + 시간 배분 | JG 웹에 있으나 타이머 드리프트 버그 | 커리큘럼 템플릿 → 사용자 편집, 오디오 클럭/`performance.now()` 기반 타이머 |
| G5 | 템포 래더 + 자동 진급 | 메트로놈 앱에 분리되어 존재 | 연습 항목과 통합: "깨끗한 통과 N회 → +BPM"(earned tempo) |
| G6 | 손을 쓰지 않는 조작 | 대부분 터치 전제 | 스페이스바/페달/첫 스트럼 자동 시작, 큰 타깃 |
| G7 | 튜닝·입력 보정 | "앱 튜너로 맞춰라"는 우회 | 세션 시작 시 튜닝 확인 + 노이즈 플로어/입력 레벨/레이턴시 보정 저장 |
| G8 | 데이터 소유 | 구독, 해지 불만, 기능 삭제(Yousician 커뮤니티) | local-first, JSON export/import, 오프라인 PWA |
| G9 | 귀 훈련과의 양립 | 앱 의존 비판 | "자가 판정 먼저 → 앱 판정 공개" 모드, 자가/앱 일치율 지표 |

---

## 2. 연습 도구 UX 패턴

### 2.1 메트로놈

- **스케줄링**: "A Tale of Two Clocks" 패턴 — `setTimeout` 타이머(예: 25ms 간격)가 깨어날 때마다 `audioContext.currentTime + scheduleAheadTime`(예: 100ms) 안에 들어오는 클릭을 오디오 클럭 기준 시각으로 미리 예약한다. 메인 스레드가 끊기는 환경이면 lookahead 250ms / 간격 200ms 같은 보수적 값을 쓴다. JS 타이머는 레이아웃·GC로 수십 ms 흔들리지만, 오디오 클럭으로 예약된 소리는 흔들리지 않는다는 것이 핵심이다. (web.dev)
- **시각 동기화**: 예약한 클릭을 큐에 넣고, `requestAnimationFrame` 루프에서 `currentTime`과 비교해 이미 지난 클릭만 화면에 반영한다. 화면 깜빡임이 rAF 타이밍에 의존하지 않고 오디오 시각을 따른다.
- **타이머 위치**: 백그라운드 탭에서 메인 스레드 타이머는 크게 스로틀링되므로 lookahead 타이머 자체는 Web Worker에서 돌리고 메시지로 "tick"만 받는 구성이 흔하다. (원문 패턴의 변형 — 스로틀링 정도는 브라우저별로 다름 (미확인))
- **기능 체크리스트**: 시작/정지(스페이스바), BPM ±1/±5, 탭 템포(최근 4개 간격 평균, 2초 무입력 시 리셋), 박자표, 첫 박 악센트(다른 음색 + 더 큰 시각 표시), 서브디비전(8분/16분/셋잇단), 카운트인(1~2마디, 연습 결과 측정에서 제외), 음소거 마디(몇 마디마다 소리 끄기 → 내부 박자 테스트), 템포 래더(시작/목표/증분/N마디마다 또는 "깨끗한 통과 시"), 시간/마디 제한 후 자동 정지.
- **마이크 블리드 문제 (중요)**: 스피커에서 나는 클릭을 마이크가 그대로 잡으면 코드/온셋 판정을 오염시킨다. 대응: (1) 유선 이어폰 권장, (2) 시각 전용 메트로놈 모드, (3) 판정기에 "알려진 클릭 시각 ± 수 ms 구간의 온셋 무시" 게이팅을 제공. Bluetooth 오디오는 Rocksmith+ 공식 문서도 지연 때문에 비권장한다.
- **레이턴시 보정**: `AudioContext.outputLatency`/`baseLatency`는 참고값일 뿐이므로, "클릭에 맞춰 줄을 8번 튕기기" 보정 테스트로 입력+출력 왕복 오프셋을 측정해 저장하는 방식을 권장한다 (구체 구현은 DSP 문서와 연계).
- **Tone.js 대안**: Tone.js의 `Transport`는 동일한 lookahead 원리를 내장하고(콜백에 정확한 예약 시각을 넘겨줌), `latencyHint`("interactive"/"playback"/"balanced")와 `lookAhead`를 조정할 수 있으며, 화면 갱신용 `Draw` 유틸이 있다. 메트로놈 하나만 필요하면 직접 구현(약 100줄)이 의존성 대비 이득이고, 백킹 트랙·패턴 시퀀싱까지 갈 경우 Tone.js가 낫다.

### 2.2 코드 다이어그램 렌더링 관례

- **세로형 다이어그램**이 교본/앱의 표준: 위쪽이 너트(굵은 선), 세로선 6개가 줄(왼쪽이 6번 저음 E), 가로선이 프렛.
- 너트 위 기호: **x = 치지 않는 줄(뮤트)**, **o = 개방현**.
- 점 안 숫자 = 왼손 손가락 번호(1 검지 ~ 4 새끼, T 엄지).
- **바레**: 여러 줄을 가로지르는 막대 또는 호(arc). 너트에서 떨어진 포지션이면 첫 프렛 옆에 "5fr" 같은 프렛 번호 라벨, 너트는 얇게.
- 루트음 강조(다른 색/모양), 왼손잡이 좌우 반전 옵션.
- svguitar는 위 관례를 모두 지원: 바레(사각/호), 손가락 텍스트, x/o, 세로/가로, 왼손잡이 미러, 프렛 위치 라벨, "normal/handdrawn" 스타일, 40개 이상 옵션.

### 2.3 실시간 피드백 시각화

- **줄별 인디케이터 6개**(다이어그램의 각 줄 위/아래): 상태 = 대기 / 울림 OK / 뮤트됨(울려야 하는데 안 울림) / 버징(미확인: 버징 검출 가능 여부는 DSP 문서 참조) / 틀린 음 / 판정 불가. **색만으로 구분하지 말고 아이콘·모양을 함께** 쓴다(색각 이상 대응).
- **입력 레벨 미터**: 노이즈 플로어 선과 "판정 가능 최소 레벨" 선을 같이 표시해, "왜 인식이 안 되는가"를 사용자가 스스로 이해하게 한다(JG/Yousician 불만의 상당수가 이 불투명성에서 나온다).
- **Confidence 표시**: 0~1 값을 막대나 "확실/아마도/불확실" 3단계로. 낮은 confidence 판정은 점수에 반영하지 않거나 별도 집계.
- **결과 화면**: 이진 결과 대신 "6줄 중 5줄 OK, 2번 줄(B)이 3번 시도 중 2번 뮤트 → 검지가 B줄에 닿는 경향" 같은 패턴 요약.
- **성능 원칙**: 미터·인디케이터는 초당 60회 갱신되므로 React/Svelte 상태를 거치지 않고, AudioWorklet/Worker → (SharedArrayBuffer 링버퍼 또는 postMessage) → rAF 루프 → canvas 직접 그리기. 프레임워크 상태는 "판정 이벤트"(초당 수 회) 수준만 다룬다.

### 2.4 세션 타이머

- JustinGuitar 웹 타이머가 비활성 탭에서 느려진 버그의 원인은 "틱 횟수 누적" 방식으로 추정된다(미확인: 구현 미공개, 증상상 추정). **경과 시간은 항상 `performance.now()`(또는 `audioContext.currentTime`) 차이로 계산**하고, 틱은 화면 갱신에만 쓴다.
- 항목 종료 알림은 소리 + 큰 시각 표시 + (가능하면) 진동. 다음 항목으로 자동 진행 여부는 설정.
- 화면 꺼짐 방지: Screen Wake Lock API(HTTPS 필요). iOS Safari 16.4+에서 지원되며, 홈 화면 설치 PWA에서 동작하지 않던 버그는 iOS 18.4에서 수정되었다.

### 2.5 연습 로그와 진도 차트

- 자동 기록: 세션 시작/종료, 항목별 실제 시간, 시도(attempt) 결과. 수동 입력은 연습 후 "기분/난이도 1~5 + 한 줄 메모" 정도로 최소화.
- 차트: OMC 쌍별 전환 횟수 추이(점 + 이동평균), 템포 래더 최고 BPM 추이, 주간 연습 시간 막대, 코드별 줄 청결도(clean ratio) 히트맵(코드 × 줄).
- Streak은 "일 단위"보다 Yousician처럼 **주 단위**가 성인 학습자에게 덜 압박적이다(Yousician은 주간 streak 사용).

### 2.6 간격 반복(Spaced repetition) 리뷰 큐

- 운동 기능(코드 전환 속도)은 "기억/망각" 모델보다 "약한 것 우선 + 최근성" 휴리스틱이 더 맞다: 우선순위 = (목표 대비 부족분) × (마지막 연습 이후 경과일 가중치) × (최근 추세가 하락이면 가산). 구 OMC 앱의 "가장 어려워하는 쌍 자동 선택"과 같은 발상.
- 지식형 항목(코드 이름 ↔ 모양 회상, 지판 음 이름)은 FSRS가 적합하다. `ts-fsrs`(MIT, 5.4.2)를 쓰면 Anki 계열 FSRS 스케줄러를 그대로 쓸 수 있다.
- 리뷰 큐를 오늘의 루틴에 "복습 슬롯 5분"으로 자동 삽입.

### 2.7 손이 기타 위에 있다: 조작 설계

- **키 매핑**: Space = 시작/정지, Enter = 다음 항목, ←/→ = 이전/다음, ↑/↓ = BPM ±, `+`/`-` = OMC 카운트 보정, Esc = 중단. 상용 Bluetooth 페이지 터너 페달(PageFlip Butterfly/Cicada 등)은 키보드를 에뮬레이트해 **PageUp/PageDown, 화살표, Space/Enter** 중 하나를 보내므로, 이 키들을 모두 동일 액션에 매핑하고 "페달 학습 모드"(아무 키나 눌러서 액션에 바인딩)를 제공한다.
- **첫 스트럼 자동 시작**: "준비(armed)" 상태에서 입력 레벨이 노이즈 플로어 + 임계값을 넘는 첫 온셋에 타이머 시작. OMC에서 특히 유용(손을 떼지 않고 시작).
- **음성 명령은 넣지 않는다**: 기타 소리와 섞여 오인식 위험이 크고, 마이크를 판정기가 이미 쓰고 있다.
- **큰 타깃**: 보면대 위 태블릿을 팔 길이 거리에서 조작하므로 최소 64px 이상 버튼, 핵심 숫자(남은 시간, 카운트, BPM)는 화면 높이의 15~25%.
- **레이아웃**: 태블릿 가로 모드 우선 — 왼쪽 다이어그램, 오른쪽 타이머/카운트/줄별 인디케이터. 휴대폰 세로 모드는 단일 컬럼.
- **다크 모드 기본** + 고대비 테마, `prefers-reduced-motion` 존중, 판정 결과는 `aria-live`로 낭독 가능하게.

---

## 3. 라이브러리 조사 (2026-10-07 npm 기준)

### 3.1 코드 다이어그램 / 악보·탭

| 라이브러리 | 최신 버전 (게시일) | 라이선스 | 평가 |
|---|---|---|---|
| **svguitar** (`svguitar`, 신규 스코프 `@svguitar/core`) | 2.8.0 (2026-10-07) | MIT | **1순위.** 활발히 유지(GitHub ★824, 오늘도 push), TypeScript, 프레임워크 무관, 바레·손가락 번호·x/o·세로/가로·왼손잡이·프렛 라벨 지원, Node에서 헤드리스 SVG 생성 가능 |
| vexchords | 1.2.0 (2019-03-31) | MIT | 6년 이상 릴리스 없음. 비권장 |
| @tombatossals/react-chords | 0.2.10 (2019-10-23) | MIT | 미유지. chords-db 포맷을 그대로 그린다는 장점뿐 |
| chordictionary | 0.1.0-beta.4 (2019-09-11) | MIT | 코드 인식/생성/그리기, 베타에서 멈춤. 비권장 |
| fretzee, chordproject-diagrammer | — | — | 경량 대안 (유지 상태 미확인) |
| **alphaTab** (`@coderline/alphatab`) | 1.8.4 (2026-07-05), 1.9 alpha 진행 중 | **MPL-2.0** | 탭+오선 렌더링, Guitar Pro 3~7/MusicXML/alphaTex 로드, 재생·커서 동기화. 노래/리프 연습 단계에서 필요. MPL-2.0은 파일 단위 copyleft — 라이브러리 파일을 수정하지 않고 쓰면 앱 코드 공개 의무 없음 |
| VexFlow | 5.0.0 (2025-03-05) | MIT | 저수준 오선/탭 렌더러. 직접 레이아웃을 짜야 함. 단순 리듬 패턴(스트럼 패턴) 표시용으로는 적합 |

**결론**: 코드 다이어그램은 svguitar, 스트럼 패턴은 간단한 자체 SVG 또는 VexFlow, 탭/노래는 나중 단계에서 alphaTab.

### 3.2 음악 이론 / 코드 데이터

| 라이브러리 | 최신 버전 (게시일) | 라이선스 | 평가 |
|---|---|---|---|
| **tonal** (`tonal`) | 6.5.0 (2026-09-28) | MIT | 음정·스케일·코드 이론, `Chord.detect`(음 이름 → 코드 이름). 현재 메인 패키지는 `tonal`이며 `@tonaljs/tonal`(4.10.0, 2023)은 구 경로. 개별 모듈 `@tonaljs/chord`(6.2.0) 등도 동시 갱신 |
| **@tombatossals/chords-db** | 0.5.1 (npm 2019), GitHub 마지막 push 2026-05 | MIT | 기타 코드 보이싱 DB. 포맷: `{key, suffix, positions:[{frets:'x32010', fingers:'032010', barres?, capo?, baseFret?}]}`. 10 이상 프렛은 `a`,`b` 문자로 인코딩. **npm 패키지는 오래되었으므로 GitHub에서 필요한 코드만 추출해 자체 JSON으로 변환·고정(vendoring)** 권장 |
| ts-fsrs | 5.4.2 (2026-09-01) | MIT | FSRS 간격 반복 스케줄러 |

초보 커리큘럼에 필요한 코드는 수십 개 수준(E, A, D, Am, Em, Dm, G, C, A7, D7, E7, G7, C7, B7, F/Fmaj7, 파워코드, 바레 E/A 모양)이므로, **자체 큐레이션 JSON(손가락 번호까지 교수법 문서 기준으로 검수)** 이 외부 DB 의존보다 안전하다. 각 보이싱에서 "울려야 할 줄과 기대 피치"를 계산하는 함수(tuning + frets → MIDI 노트)는 DSP 판정기 입력이 된다.

### 3.3 오디오/스케줄링

| 항목 | 버전 | 라이선스 | 메모 |
|---|---|---|---|
| Web Audio API + AudioWorklet | 브라우저 내장 | — | 기본. 마이크는 `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}})` — 기본값이 모두 true라 음악 신호를 훼손함 |
| Tone.js (`tone`) | 15.1.22 latest (2025-04), `next` 15.5.x | MIT | Transport/Draw. 메트로놈+백킹 트랙이 필요할 때 |
| pitchy | 4.1.0 (2024-01) | MIT | McLeod pitch method, 튜너용 (상세는 DSP 문서) |
| meyda | 5.6.3 | MIT | chroma 등 특징 추출 (상세는 DSP 문서) |
| essentia.js | 0.1.3 | **AGPL-3.0** | 강력하지만 AGPL — 웹 배포 시 소스 공개 의무 범위 주의. 개인용이면 문제 적으나 공개 배포 계획이 있으면 회피 |
| @types/audioworklet | 0.0.100 | Apache-2.0 | AudioWorklet 전역 스코프 타입 |

**Vite에서 AudioWorklet 번들링**: `audioContext.audioWorklet.addModule(url)`은 독립 모듈 URL이 필요하다. Vite 공식 문서는 `?url` 접미사를 "Houdini Paint Worklet 같은 워클릿을 URL로 가져올 때" 쓰라고 안내하고, `new URL('./x.js', import.meta.url)` 패턴도 지원한다. TypeScript로 작성한 프로세서를 트랜스파일·번들까지 하려면 커뮤니티에서 `import url from './processor.ts?worker&url'` 조합(워커로 번들한 결과의 URL만 받기)을 흔히 쓴다 (미확인: 공식 문서에 워클릿 용도로 명시되지는 않음 — 초기 스파이크에서 dev/build 양쪽 검증 필요). 대안: `vite-plugin-worker`의 `audioworklet:` 접두사(마지막 릴리스 2021, 비권장), `unworklet`(신생, 미확인).

### 3.4 차트

| 라이브러리 | 버전 | 라이선스 | 적합 용도 |
|---|---|---|---|
| uPlot | 1.6.32 (2025-03) | MIT | 초경량·초고속 시계열. 실시간/대량 포인트. React 래퍼 `uplot-react` 1.2.4 |
| Recharts | 3.10.1 (2026-07) | MIT | React 컴포넌트형 선언적 차트. 진도 대시보드에 생산성 최고 |
| Observable Plot | 0.6.17 (2025-02) | ISC | 문법형(grammar of graphics), 히트맵·패싯이 쉬움. 프레임워크 무관 |
| Chart.js / ECharts | 4.5.1 / 6.1.0 | MIT / Apache-2.0 | 범용. 번들이 큼(특히 ECharts) |

개인 앱의 데이터 양(수천~수만 attempt)은 작으므로 **진도 차트는 Recharts 또는 Observable Plot**, 실시간 미터는 **직접 canvas**가 합리적이다.

---

## 4. 기술 스택 (2026-10 기준)

### 4.1 핵심 패키지 현재 버전 (npm registry, 2026-10-07 조회)

| 패키지 | latest | 게시일 | 비고 |
|---|---|---|---|
| vite | **8.3.3** | 2026-10-06 | Vite 8 정식 2026-03-12, 번들러가 Rust 기반 **Rolldown** 단일화 |
| react / react-dom | **19.3.0** | 2026-09-09 | |
| @vitejs/plugin-react | 6.1.2 | 2026-10-05 | peer: vite ^8, babel-plugin-react-compiler ^1.0.0 (React Compiler 1.0) |
| typescript | **7.0.2** | 2026-07-08 | Go 네이티브 컴파일러, 8~12배 빠름. 단 **Vue/Svelte/Astro/MDX/Angular 템플릿 타입체크는 안정 API가 나올 때까지 TS 6 유지**(Microsoft). 6.0.3(2026-04)이 6.x 최신 |
| tailwindcss / @tailwindcss/vite | **4.3.3** | 2026-07-16 | peer vite ^5~^8 |
| svelte | 5.57.2 | 2026-10-06 | |
| @sveltejs/kit | **3.0.1** | 2026-10-06 | 갓 나온 메이저. peer: vite ^8.0.12, svelte ^5.57.1, **typescript ^6.0.0** |
| solid-js | 1.9.16 (2.0.0-rc.13 진행 중) | 2026-10-06 | 2.0 전환 임박 |
| dexie | **4.4.6** | 2026-09-10 | dexie-react-hooks 4.4.0, dexie-export-import 4.4.1 |
| vite-plugin-pwa | 2.0.0 (2026-10-03) / 1.3.0 (2026-05-05) | | 둘 다 peer vite ^8 지원. 2.0은 4일 전 출시 → 초기엔 1.3.0 고정도 합리적 |
| vitest | **5.0.3** | 2026-09-30 | Node ≥ 22.12 필요, Browser Mode Trace View. `@vitest/browser-playwright` 5.0.3 |
| @playwright/test | **1.63.0** | 2026-09-04 | |
| zustand / jotai | 5.0.15 / 3.0.1 | | |
| @tanstack/react-router / react-router | 1.170.41 / 8.4.0 | | react-router 8은 peer react ≥ 19.2.7 |
| xstate | 5.33.2 | | 상태 기계 |
| zod / valibot | 4.6.5 / 1.5.0 | | import/export 스키마 검증 |
| @biomejs/biome / eslint | 2.5.15 / 10.12.0 | | |
| @vitejs/plugin-basic-ssl | 2.3.0 | | LAN의 iPad에서 HTTPS 테스트용 |

> [!note] 원 질문의 "React 19? Vite 7? Tailwind 4? Dexie 4? Vitest 3/4?"에 대한 답: React 19(19.3), **Vite는 이미 8**, Tailwind 4(4.3), Dexie 4(4.4), **Vitest는 5**, Playwright 1.63, **TypeScript는 7.0**이 latest.

### 4.2 세 가지 옵션 비교

| 항목 | A. Vite 8 + React 19 + TS | B. SvelteKit 3 (adapter-static) 또는 Vite + Svelte 5 | C. Vite + SolidJS 1.9 |
|---|---|---|---|
| 생태계/예제 | 최대. dexie-react-hooks, Recharts, uplot-react, 대부분의 오디오 예제 | 충분. layerchart(2.5.2), Dexie `liveQuery`는 Svelte store 계약과 호환 | 작음 |
| 코드량/보일러플레이트 | 중간(hooks, ref 관리) | 가장 적음(runes `$state/$derived/$effect`) | 적음 |
| 런타임 크기 | 큼(~46KB, 비교 글 기준) | 작음(~5KB) | 작음 |
| 실시간 UI 성능 | 상태를 우회하면 충분 | 세밀한 반응성 | 세밀한 반응성 |
| TypeScript 7 | **바로 사용 가능**(`tsc` = TS7, .tsx 지원) | svelte-check/Kit가 **TS 6 필요** | 사용 가능 (JSX) |
| 메이저 버전 안정성 | React 19.x 성숙, Vite 8 7개월차 | **SvelteKit 3.0이 하루 전 출시** → 초기 이슈 가능 | **Solid 2.0 RC** → 곧 마이그레이션 부담 |
| AI 코딩 보조 정확도 | 가장 높음 (학습 데이터 최다) (미확인: 정량 근거 없음) | runes 이전(Svelte 4) 문법이 섞여 나오기 쉬움 (미확인) | 낮음 |
| PWA | vite-plugin-pwa | `@vite-pwa/sveltekit` 1.1.0 | vite-plugin-pwa |

**권고: A (Vite 8 + React 19 + TypeScript strict).**
근거: (1) 이 앱의 성능 병목은 프레임워크가 아니라 오디오 파이프라인이고, 고빈도 렌더링은 어차피 canvas로 우회하므로 Svelte/Solid의 성능 이점이 결정적이지 않다. (2) SvelteKit 3.0과 Solid 2.0이 모두 메이저 전환 직후/직전이라 1인 개발자에게 churn 리스크가 있다. (3) TS 7을 즉시 쓸 수 있다. (4) 레퍼런스·라이브러리가 가장 많다.
Svelte를 고른다면 SvelteKit 대신 **Vite + Svelte 5 단독(SPA)** 으로 시작하고 TS 6.0.3에 고정하는 편이 단순하다.

### 4.3 권장 구성 상세

- **빌드/언어**: Vite 8, TypeScript 7 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). 툴링 호환 문제가 나오면 6.0.3으로 내리는 것이 탈출구. Lint/format은 Biome 2(속도·단일 도구).
- **UI**: React 19.3 + React Compiler(babel-plugin-react-compiler 1.0, plugin-react 6 경유) + Tailwind 4.3. 라우팅은 화면이 5~8개뿐이므로 TanStack Router(타입 안전) 또는 react-router 8 중 택1.
- **상태**:
  - 영속 데이터 → Dexie 4 + `useLiveQuery`(DB가 단일 진실 원천, 쓰기 즉시 UI 반영).
  - 일시 UI 상태 → Zustand 5.
  - 연습 세션 진행(idle → armed → countIn → running → review) → 판별 유니온 + reducer로 시작하고, 상태가 늘면 XState 5로 승격.
  - 오디오 그래프 → React 바깥의 싱글턴 `AudioEngine` 클래스(AudioContext, MediaStream, Worklet 노드 소유; RAII처럼 `start()/dispose()` 쌍). React는 구독만 한다.
- **DSP 배치**: AudioWorklet(프레임 수집, 가벼운 레벨/온셋) → SharedArrayBuffer 링버퍼 또는 MessagePort → Web Worker(무거운 분석, 필요시 WASM) → 판정 이벤트. SharedArrayBuffer는 **cross-origin isolation(COOP/COEP 헤더)** 이 필요하므로 정적 호스팅에서 헤더 설정 가능 여부를 먼저 확인(Cloudflare Pages/Netlify는 `_headers` 파일, GitHub Pages는 불가 → `coi-serviceworker` 같은 우회 필요 (미확인: 우회책의 PWA 공존성)).
- **저장소**: IndexedDB(Dexie) — 구조화 데이터. OPFS — 녹음 클립(Blob) 등 큰 바이너리, DB에는 경로만. 시작 시 `navigator.storage.persist()` 요청(Safari/Chromium은 프롬프트 없이 사용 이력 기반 자동 승인/거부). Safari의 "7일 스크립트 저장소 상한"은 브라우저 탭 사용에 적용되고 **홈 화면에 추가한 웹앱은 자체 사용일 카운터**를 가짐 → iPad에서는 홈 화면 설치 권장 + 주기적 JSON 백업 알림.
- **백업**: 자체 `exportAll()` → `{schemaVersion, exportedAt, tables:{...}}` JSON, import 시 Zod로 검증 + 버전 마이그레이션. 빠른 구현은 `dexie-export-import`(4.4.1)로 시작 가능하나 스키마 검증은 직접 추가.
- **PWA**: vite-plugin-pwa(`registerType: 'prompt'` — 연습 도중 강제 새로고침 방지). 오프라인 프리캐시에 오디오 샘플(클릭음) 포함.
- **배포**: 정적 호스팅(Cloudflare Pages/Netlify 권장 — COOP/COEP 헤더 설정 가능). `getUserMedia`와 Wake Lock은 secure context 필요: `localhost`는 예외적으로 허용, LAN의 iPad 테스트는 `@vitejs/plugin-basic-ssl` 또는 mkcert로 HTTPS.
- **테스트**:
  - 순수 로직(스케줄러 수학, 우선순위 큐, 지표 계산, 마이그레이션) → Vitest 5 (node 환경).
  - 오디오/워클릿 통합 → Vitest Browser Mode + Playwright provider, 또는 Playwright E2E.
  - **가짜 마이크**: Chromium 실행 인자 `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--use-file-for-fake-audio-capture=/abs/path/clip.wav`. Firefox는 `firefoxUserPrefs`의 `media.navigator.streams.fake: true`, `media.navigator.permission.disabled: true`(사인파 등 합성 신호만). WebKit은 알려진 우회책 없음. 녹음해 둔 "깨끗한 C 코드", "B줄 뮤트된 C 코드", "C→G 전환 30회/분" 같은 WAV 픽스처로 회귀 테스트를 만든다. (기본적으로 파일이 반복 재생되며, 경로 뒤 `%noloop` 옵션이 있다는 보고가 있음 (미확인))
  - 오프라인 결정적 테스트: `OfflineAudioContext`로 WAV를 렌더링해 판정기 출력을 스냅샷 비교 (워클릿 지원 여부는 브라우저별 확인 필요 (미확인)).

```ts
// playwright.config.ts (발췌) — 가짜 마이크로 WAV 픽스처 주입
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  projects: [{
    name: 'chromium-fake-mic',
    use: {
      ...devices['Desktop Chrome'],
      permissions: ['microphone'],
      launchOptions: {
        args: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          `--use-file-for-fake-audio-capture=${path.resolve('tests/fixtures/c-major-clean.wav')}`,
        ],
      },
    },
  }],
});
```

---

## 5. 데이터 모델

### 5.1 설계 원칙

1. **콘텐츠(정의)와 기록(사실)을 분리**: 커리큘럼·연습 정의·코드 보이싱은 앱 번들에 포함된 읽기 전용 시드 + 사용자 커스텀. 세션·시도는 사용자 데이터.
2. **Attempt는 불변(append-only)**: 판정기 버전, 파라미터 스냅샷, 원시 카운트를 함께 저장. 지표(Metric)·진도(SkillState)는 Attempt에서 **언제든 재계산 가능한 캐시**. 판정 알고리즘을 개선하면 과거 데이터를 재해석할 수 있다(이벤트 소싱 라이트).
3. **자동 판정과 사람의 판단을 분리 저장**: `detected`, `corrected`, `selfReported` 3값.
4. **연습 유형은 플러그인**: 코어는 유형을 모른다. 유형별 params/result는 플러그인의 Zod 스키마로 검증된 JSON.
5. **subjectKey로 지표를 묶는다**: `chord:C`, `pair:C|G`(정렬된 쌍), `strum:DDUUDU@80` 같은 문자열 키 — 차트·우선순위 큐·리뷰 큐가 모두 이 키를 공유.

### 5.2 엔티티 스케치 (TypeScript)

```ts
// ---- 콘텐츠 ----
type StringIndex = 0 | 1 | 2 | 3 | 4 | 5;          // 0 = 6번줄(저음 E)
type Finger = 1 | 2 | 3 | 4 | 'T';

interface ChordVoicing {
  id: string;                    // 'C-open'
  symbol: string;                // 'C'
  tuning: readonly number[];     // MIDI, 표준 [40,45,50,55,59,64]
  frets: readonly (number | null)[]; // 길이 6, null = 뮤트(x), 0 = 개방(o)
  fingers: readonly (Finger | null)[];
  barres: readonly { fret: number; fromString: StringIndex; toString: StringIndex; finger: Finger }[];
  baseFret: number;              // 다이어그램 시작 프렛
  tags: readonly string[];       // ['open', 'grade1']
  source: 'seed' | 'user';
}
// 파생: expectedNotes(voicing) => { string, midi }[]  → DSP 판정기 입력

interface ExerciseDef<P = unknown> {
  id: string;
  type: string;                  // 플러그인 키: 'one-minute-changes' | 'chord-perfect' | ...
  typeVersion: number;
  title: string;
  params: P;                     // 플러그인 paramsSchema로 검증
  lessonId?: string;
}

interface Lesson { id: string; stageId: string; order: number; title: string;
  exerciseIds: string[]; unlock?: UnlockRule[] }
type UnlockRule =
  | { kind: 'metricAtLeast'; subjectKey: string; metric: string; value: number; windowDays?: number }
  | { kind: 'lessonDone'; lessonId: string };

interface Routine { id: string; name: string; source: 'template' | 'user';
  items: { exerciseId: string; durationSec: number; paramsOverride?: unknown }[] }

// ---- 기록 (append-only) ----
interface Session { id: string; startedAt: number; endedAt?: number; routineId?: string;
  calibrationId?: string; note?: string; perceivedEffort?: 1 | 2 | 3 | 4 | 5 }

interface Attempt<R = unknown> {
  id: string; sessionId: string; exerciseId: string;
  exerciseType: string; exerciseTypeVersion: number;
  paramsSnapshot: unknown;       // 실행 당시 파라미터 그대로
  startedAt: number; durationMs: number;
  detectorVersion?: string;      // 예: 'chord-v0.3.1'
  result: R;                     // 플러그인 resultSchema로 검증
  selfReport?: { rating?: 1 | 2 | 3 | 4 | 5; note?: string };
  recordingRef?: string;         // OPFS 경로
}

// 예: OMC 결과 — 자동/보정/자가 3값 분리
interface OmcResult {
  pair: [string, string];        // voicing id
  bpm?: number;
  detectedChanges: number;
  correctedChanges?: number;     // 페달 ±1 보정 반영
  lowConfidenceChanges: number;
  changeTimestampsMs: number[];  // 재분석·리듬 안정성 계산용
}

// 예: Chord Perfect 결과 — 줄별 원인
interface ChordPerfectResult {
  voicingId: string;
  perString: { string: StringIndex;
    status: 'ok' | 'muted' | 'buzz' | 'wrongPitch' | 'shouldBeMuted' | 'unknown';
    centsOff?: number; confidence: number }[];
  strumCleanRatio: number;       // 울려야 할 줄 중 OK 비율
}

// ---- 파생 (재계산 가능) ----
interface MetricSample { subjectKey: string; metric: string; value: number; at: number; attemptId: string }
interface SkillState { subjectKey: string; best: number; ema: number; trend: number;
  lastPracticedAt: number; due?: number; fsrs?: unknown /* ts-fsrs Card */ }

interface Calibration { id: string; createdAt: number; deviceLabel: string;
  noiseFloorDb: number; inputGainHint?: number; roundTripLatencyMs: number;
  openStringHz: number[] }       // 실측 개방현 → 튜닝 편차 보정
```

Dexie 스키마 예시(인덱스만 선언, 나머지 필드는 자유):

```ts
db.version(1).stores({
  voicings: 'id, symbol, *tags',
  exercises: 'id, type, lessonId',
  lessons: 'id, stageId, order',
  routines: 'id',
  sessions: 'id, startedAt',
  attempts: 'id, sessionId, exerciseId, exerciseType, startedAt',
  metrics: '++, [subjectKey+metric+at], attemptId',
  skills: 'subjectKey, due, lastPracticedAt',
  calibrations: 'id, createdAt',
  meta: 'key',                   // schemaVersion, lastBackupAt 등
});
```

### 5.3 연습 유형 플러그인 인터페이스

```ts
interface ExerciseContext {
  audio: AudioEngine;            // 마이크 스트림, 메트로놈, 판정기 구독
  clock: { now(): number };      // performance.now 기반, 테스트에서 가짜 주입
  voicings: (id: string) => ChordVoicing;
  calibration?: Calibration;
}

interface ExerciseRunner<R> {
  start(): void;
  handleCommand(cmd: 'toggle' | 'next' | 'inc' | 'dec' | 'abort'): void; // 키/페달
  subscribe(listener: (s: RunnerSnapshot) => void): () => void;
  finish(): R;
  dispose(): void;
}

interface ExercisePlugin<P, R> {
  type: string;
  version: number;
  paramsSchema: z.ZodType<P>;
  resultSchema: z.ZodType<R>;
  defaultParams(): P;
  createRunner(ctx: ExerciseContext, params: P): ExerciseRunner<R>;
  View: React.ComponentType<{ runner: ExerciseRunner<R>; params: P }>;
  Summary: React.ComponentType<{ result: R }>;
  toMetrics(result: R, params: P): Omit<MetricSample, 'at' | 'attemptId'>[];
  migrateResult?(raw: unknown, fromVersion: number): R;
}

const registry = new Map<string, ExercisePlugin<any, any>>();
```

초기 플러그인: `one-minute-changes`, `chord-perfect`, `metronome-drill`(템포 래더), `strum-pattern`, `free-timer`(판정 없는 시간 기록 — 노래 연습 등). 새 유형 추가 시 코어(세션 러너, 기록, 차트, 큐)는 수정하지 않는다.

---

## 6. 앱 설계 시사점

### 6.1 MVP 기능 목록 (우선순위 순)

1. **입력 설정 & 보정 마법사**: 마이크 선택, `echoCancellation/noiseSuppression/autoGainControl` 끔, 노이즈 플로어 측정, 개방현 튜닝 확인(내장 튜너), 레이턴시 탭 테스트. 결과를 `Calibration`으로 저장. (G7)
2. **코드 라이브러리**: 큐레이션된 시드 보이싱 JSON(초급 코드 ~20개) + svguitar 세로 다이어그램(손가락 번호·x/o·바레·왼손잡이).
3. **메트로놈**: lookahead 스케줄러(Worker 타이머 + `currentTime`), 악센트, 탭 템포, 카운트인, 시각 펄스, 템포 래더, 시각 전용 모드. (G5)
4. **One Minute Changes**: 쌍 선택 또는 "약한 쌍 자동 추천" → 첫 스트럼 자동 시작 → 60초(드리프트 없는 타이머) → 자동 카운트 + `+`/`-`(페달) 보정 → 자동/보정 값 모두 저장 → 쌍별 추이 차트. **판정기가 준비되기 전에도 수동 카운트 모드로 먼저 출시 가능.** (G2, G3)
5. **Chord Perfect**: 줄별 순차 가이드(뮤트 줄 건너뜀) → 줄별 인디케이터(아이콘+색) → 전체 스트럼 → 줄별 원인 요약, "자가 판정 먼저" 옵션. (G1, G9)
6. **루틴 빌더 & 세션 러너**: 커리큘럼 템플릿(예: 모듈별 루틴)을 복제해 편집, 항목별 시간, 스페이스/엔터/페달로 진행, Wake Lock. (G4, G6)
7. **기록 & 대시보드**: 주간 연습 시간, OMC 쌍별 추이, 코드×줄 청결도 히트맵, 주간 streak. 세션 후 1탭 자가평가 + 메모.
8. **local-first 인프라**: Dexie, PWA 오프라인, JSON export/import(스키마 버전 + Zod 검증), 백업 리마인더. (G8)

MVP 이후: strum-pattern 판정(온셋 vs 메트로놈 그리드), 리듬 정확도, 녹음/재청취(OPFS), FSRS 지식 카드(코드 이름↔모양, 지판), alphaTab 노래 연습, 커리큘럼 잠금 해제 규칙.

### 6.2 스택 결정 (버전 고정 제안)

```jsonc
{
  "vite": "^8.3.3",
  "react": "^19.3.0", "react-dom": "^19.3.0",
  "@vitejs/plugin-react": "^6.1.2", "babel-plugin-react-compiler": "^1.0.0",
  "typescript": "^7.0.2",            // 툴링 문제 시 ~6.0.3
  "tailwindcss": "^4.3.3", "@tailwindcss/vite": "^4.3.3",
  "dexie": "^4.4.6", "dexie-react-hooks": "^4.4.0",
  "zustand": "^5.0.15", "zod": "^4.6.5",
  "svguitar": "^2.8.0", "tonal": "^6.5.0",
  "recharts": "^3.10.1",             // 또는 @observablehq/plot ^0.6.17
  "ts-fsrs": "^5.4.2",               // MVP 이후
  "vite-plugin-pwa": "~1.3.0",       // 2.0.0은 2026-10-03 출시, 안정화 후 이동
  "vitest": "^5.0.3", "@vitest/browser-playwright": "^5.0.3",
  "@playwright/test": "^1.63.0",
  "@biomejs/biome": "^2.5.15",
  "@vitejs/plugin-basic-ssl": "^2.3.0",
  "@types/audioworklet": "^0.0.100"
}
```
요구 런타임: Node ≥ 22.12 (Vitest 5).

### 6.3 아키텍처 스케치

```
[Mic] → getUserMedia(EC/NS/AGC off)
      → AudioWorkletNode (프레임 수집, RMS, 온셋)  ──SAB 링버퍼──▶ [DSP Worker (TS/WASM)]
                                                                      │ 판정 이벤트 (chord, perString, confidence, detectorVersion)
[Metronome Scheduler Worker] ─tick─▶ AudioEngine(main) ──click 예약──▶ AudioContext
                                       │
                                       ├─ rAF 루프 → canvas (레벨 미터, 줄별 인디케이터, 비트 펄스)
                                       └─ 이벤트 → ExerciseRunner(플러그인) → Zustand(UI) / Dexie(Attempt append)
                                                                                    │
                                                         derive → MetricSample / SkillState → 차트, 추천 큐
```

### 6.4 설계 원칙 요약

- **"모르겠음"을 정직하게**: 판정 불가 상태를 1급 시민으로. 점수에서 제외하고 이유(레벨 부족/소음/튜닝 편차)를 보여 준다.
- **자동 판정은 항상 사람이 고칠 수 있게**, 그리고 원시값을 남겨 나중에 재계산.
- **경과 시간은 시계 차이로, 오디오는 오디오 클럭으로** — 틱 카운트 금지.
- **손은 기타에**: 모든 핵심 액션이 Space/Enter/화살표/PageUp·Down 및 페달로 가능, 첫 스트럼 자동 시작.
- **프레임워크는 저빈도 상태만**: 60fps 시각화는 canvas 직결.
- **스파이크 우선순위**: (1) Vite 8에서 TS AudioWorklet 번들링(dev/build), (2) COOP/COEP + PWA 공존, (3) Playwright 가짜 마이크로 WAV 픽스처 E2E — 이 세 가지를 첫 주에 검증하면 이후 리스크가 크게 줄어든다.

---

## Sources

### 경쟁 앱
- JustinGuitar 커뮤니티 — OMC 인식 불만: https://community.justinguitar.com/t/frustrated-with-the-lesson-app-1-minute-changes-no-longer-recognises-my-chords/314552
- JustinGuitar 커뮤니티 — OMC 카운트 부정확 및 Musopia 답변: https://community.justinguitar.com/t/i-m-finding-the-changes-aren-t-counting-correctly-even-though-i-m-sure-i-ve-hit-the-chord-cleanly/394347
- JustinGuitar 커뮤니티 — OMC 미등록: https://community.justinguitar.com/t/my-1-minute-changes-on-the-app-isn-t-registering-anything/404196?page=2
- JustinGuitar 커뮤니티 — Chord Perfect 사용법: https://community.justinguitar.com/t/how-do-i-properly-use-the-chord-perfect-practice-on-the-app/200534
- JustinGuitar 커뮤니티 — Chord Perfect 오작동: https://community.justinguitar.com/t/chord-perfect-exercises-dont-work/409028
- JustinGuitar 커뮤니티 — 앱 방식에 대한 우려(귀 vs 기계): https://community.justinguitar.com/t/my-concern-with-the-way-the-app-works/75193
- JustinGuitar 커뮤니티 — Practice timer 느려짐: https://community.justinguitar.com/t/practice-timer-oddness-slower-than-real-time/38568
- JustinGuitar 커뮤니티 — 연습 기록 방법: https://community.justinguitar.com/t/how-do-you-track-your-guitar-practice/409931
- JustinGuitar 커뮤니티 — 메트로놈 자동 템포 증가 요청: https://community.justinguitar.com/t/can-you-adapt-the-metronome-app-to-auto-increase-the-tempo/397148
- One Minute Changes 앱 (App Store): https://apps.apple.com/app/id778908544
- One Minute Changes 평점 요약: https://marlvel.ai/api/llm/apps/education/one-minute-changes
- Yousician 지원 — Guitar sound recognition issues (403으로 본문 직접 확인 불가, 검색 요약 기반): https://support.yousician.com/hc/en-us/articles/46277332028817-Guitar-sound-recognition-issues
- Yousician 지원 — 탭 내비게이션(Activity/Streaks/Workouts): https://support.yousician.com/hc/en-us/articles/201558312-How-to-navigate-through-the-main-tabs
- Yousician 리뷰(TapSmart): https://www.tapsmart.com/apps/review-yousician-guitar-gamifies-learning-chords-and-riffs/
- Yousician 리뷰 모음(justuseapp): https://justuseapp.com/en/app/959883039/yousician-gitarre-lernen/reviews
- Fender Play App Store: https://apps.apple.com/dk/app/id1226057939
- Fender Play 리뷰(Guitar World 2025): https://guitarworld.com/reviews/fender-play-review
- Fender Play 리뷰(Learnopoly): https://learnopoly.com/fender-play-review/
- Simply Guitar 리뷰(guitar.com): https://guitar.com/reviews/accessories/simply-guitar-review/
- Simply Guitar 리뷰(Guitar Chalk): https://www.guitarchalk.com/simply-guitar-review/
- Simply Guitar 리뷰 분석(Kimola): https://kimola.com/reports/unlock-insights-into-simply-guitar-with-our-exclusive-report-app-store-us-148147
- Guitar Tricks 리뷰(American Songwriter): https://americansongwriter.com/guitar-tricks-review
- GuitarTuna App Store: https://apps.apple.com/us/app/-/id527588389
- GuitarTuna 소개(screensdesign): https://screensdesign.com/showcase/guitartuna-tune-play-guitar
- Ultimate Guitar 앱 소개: https://screensdesign.com/apps/ultimate-guitar-chords-tabs/
- Songsterr App Store: https://apps.apple.com/us/app/songsterr-tabs-chords/id399211291
- Rocksmith+ 공식: https://www.ubisoft.com/en-US/game/rocksmith/
- Rocksmith+ 레이턴시 가이드(Bluetooth 비권장): https://www.ubisoft.com/es-mx/game/rocksmith/plus/news-updates/0ObO0tPaR4kiGmmgpkeJZ/minimizing-audio-latency-on-console
- Rocksmith+ 오디오 개발 일지: https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/1Zcwvdcw0IwhBEYoCGCQtt/rocksmith-dev-diary-february-2022-audio-updates
- Chordify 라이브 코드 감지(MusicRadar): https://www.musicradar.com/news/chordify-lyrics-live-chord-detection
- Uberchord(Guitar Player): https://guitarplayer.com/gear/the-uberchord-guitar-chord-recognition-app-works-in-real-time
- Uberchord 대안(AlternativeTo): https://alternativeto.net/software/uberchord
- Modacity App Store: https://apps.apple.com/us/app/-/id1351617981
- Metronome Step: https://apps.apple.com/us/app/-/id789603886
- Tempo Lite(Frozen Ape): https://apps.apple.com/us/app/-/id599833596

### UX / 웹 플랫폼
- A Tale of Two Clocks (web.dev): https://web.dev/articles/audio-scheduling
- getUserMedia 오디오 제약(addpipe): https://blog.addpipe.com/audio-constraints-getusermedia/
- Screen Wake Lock 지원(What PWA Can Do Today): https://whatpwacando.today/wake-lock
- WebKit 버그 254545(설치 PWA Wake Lock): https://bugs.webkit.org/show_bug.cgi?id=254545
- MDN Storage quotas and eviction: https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- WebKit Storage Policy 업데이트: https://webkit.org/?p=14403
- Bluetooth 페이지 터너 페달(Soundhouse 칼럼): https://www.soundhouse.co.jp/en/contents/column/index?post=4114
- PageFlip Butterfly: https://www.musicstore.de/en_GB/GBP/Pageflip-Butterfly/art-PCM0014313-000

### 라이브러리 / 스택
- npm registry (버전·게시일·peer deps 직접 조회): https://registry.npmjs.org/
- svguitar: https://github.com/omnibrain/svguitar , https://www.npmjs.com/package/svguitar
- chords-db: https://github.com/tombatossals/chords-db
- vexchords: https://github.com/0xfe/vexchords
- react-chords 포크: https://github.com/techies23/react-chords
- alphaTab (NuGet/npm): https://www-0.nuget.org/packages/AlphaTab
- Vite 정적 자산(?url, ?worker, new URL): https://vite.dev/guide/assets
- Vite 8 발표: https://vite.dev/blog/announcing-vite8
- TypeScript 7.0 RC: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0-rc/
- TypeScript 7 출시(InfoQ): https://infoq.com/news/2026/08/typescript-7-released/
- TypeScript 7 네이티브 컴파일러(ADTmag): https://adtmag.com/articles/2026/07/10/microsoft-bets-typescript-future-on-a-native-compiler.aspx
- Vitest 4 발표: https://voidzero.dev/posts/announcing-vitest-4
- Vitest 릴리스 개요: https://releases.sh/vitest/overview
- Playwright 가짜 오디오 설정(TIL): https://omarelb.substack.com/p/til-2-set-up-playwright-with-fake
- Chrome 가짜 웹캠/마이크(TestingBot): https://testingbot.com/resources/articles/fake-webcam-microphone-chrome
- vite-plugin-worker (audioworklet 접두사): https://cdn.jsdelivr.net/npm/vite-plugin-worker@1.0.5/README.md
- MDN Worklet.addModule: https://developer.mozilla.org/docs/Web/API/Worklet/addModule
- Tone.js Context 타입 정의(lookAhead/latencyHint): https://unpkg.com/browse/tone@15.1.22/build/esm/core/context/Context.d.ts
- Svelte 5 vs React 2026 비교: https://alexcloudstar.com/blog/svelte-5-vs-react-2026/
- React 19 Compiler vs Svelte 5 Compiler: https://www.pkgpulse.com/guides/react-19-compiler-vs-svelte-5-compiler-2026
