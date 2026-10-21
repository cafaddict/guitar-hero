# FINAL_REPORT — guitar-hero UI 마감 goal

> SPEC: `docs/goal/ui/SPEC.md`(고정). 진행 장부: `PROGRESS.md`. 결정: `../DECISIONS.md` D-089–D-094. 화면 감사: `UI_AUDIT.md`.
> 브랜치 `cafaddict/ui`, 키트 커밋 `cae46b0` 이후 U1–U6. 스크린샷은 git 밖(`ui-shots/`, 시작 전 `ui-shots/before/`).

## 1. 요약

- 앱 전체를 "기타를 안은 초보가 보면대 거리에서 흘끗 보는" 기준으로 마감했다. 기능·판정·데이터·키·라우트는 그대로다(`src/domain`·`dsp`·`audio`·`data`·`content` 변경 없음).
- **기반(U1, D-089)**: 한국어 낱말 단위 줄바꿈(keep-all + break-word), 문단 48em, 필드 경계 토큰과 공통 필드(`Select`·`TextInput`·`TextArea`·`Field`·`Choice`), 44 px 슬라이더, 고대비에서도 보이는 포커스 링, 로딩 자리표시.
- **연습 화면(U2, D-090)**: 모든 연습과 시작 화면이 한 뼈대(`PracticeStage`)를 쓴다. iPad 가로·MacBook은 2단(왼쪽 보고 치는 그림, 오른쪽 큰 숫자·상태·다음 조작), iPhone·iPad 세로는 1단에 다음 조작 막대가 화면 아래에 붙는다. 남은 시간 18vh·BPM 16vh, 시퀀스 연습의 터치 "시작", TAB 확대 상한, 퀴즈 답 정렬·✓✗, "중단" 문구. 독립 리뷰로 일시정지 버튼의 포커스 유실(High)을 찾아 고치고 회귀 E2E를 더했다.
- **세션 러너(U3, D-091)**: 실행 뒤 "다음 항목" 하나만 주 조작, 블록 전환 카운트다운 16vh, 일시정지·자가 평가·결과의 위계.
- **앱 화면(U4, D-092)**: 화면마다 첫 화면에 다음 할 일 하나(홈 연습 시작, 단계 "먼저 해 볼 연습", 튜너 켜기, 메트로놈 시작, 루틴 저장 막대, 온보딩 마이크 허용). 라이브러리 격자, 코드 상세, 시험, 진도 표, 스케일 이름.
- **폼·테마(U5, D-093)**: 설정 세 카드, 진단·녹음 키트 카드, 고대비의 칸 경계, 온보딩 단계.
- **마감(U6, D-094)**: 독립 리뷰 두 개(코드 11건·UI 16건)를 처리했다. 실행 중 "나가기"는 Esc처럼 "그만할까요?"를 묻고(전에는 툴팁만 남긴 비활성), 시간 연습은 시작 전에도 계획 길이를 큰 숫자로, 결과 첫 줄은 30–36 px, 항목 제목은 " · " 사이에서만 줄바꿈, 휴대폰의 긴 TAB은 숫자 14 px를 지키며 옆으로 스크롤, 아래 막대 뒤로 키보드 포커스가 숨지 않게(WCAG 2.4.11), 루틴 저장 막대 한 줄, 퀴즈 키 안내·Q1 점 모양·튜너 범위 경계. 그다음 전 화면 888장(37화면 × 4뷰포트 × 3테마 × 첫 화면·전체)을 다시 봤다.
- 품질 게이트 UQ-1–UQ-10, UR-1–UR-2 전부 통과(시작 전 문제 수 합계 1,440개 → 0). 기존 E2E에 회귀 E2E 2개(일시정지 포커스, 실행 중 "나가기" 확인)를 더해 모두 통과.

## 2. 영역별 전후 비교

대표 그림은 `ui-shots/<theme>/<viewport>-<screen>-fold.png`(후), 같은 이름의 `ui-shots/before/...`(전)이다. 상태 그림은 `ui-shots/states/<theme>/`.

| 영역 | 바뀐 점 | 대표 그림(후 / 전) |
|---|---|---|
| 연습: 2단 뼈대 | 다이어그램·TAB·패턴이 왼쪽, 남은 시간·BPM·지시·다음 조작이 오른쪽. 넓은 화면에서 한 줄로 늘어지던 화면이 한눈에 들어온다 | `dark/ipad-landscape-practice-E1-fold.png`, `dark/ipad-landscape-practice-E5-fold.png` / `before/dark/ipad-landscape-practice-E5-fold.png` |
| 연습: 시퀀스 | TAB이 화면을 가득 채우던 것(숫자 100 px)을 확대 상한으로 묶고, 자가 평가·일시정지가 첫 화면에. 준비 상태의 터치 "시작" | `dark/ipad-landscape-practice-E9-fold.png`, `dark/iphone-practice-E17-ready-fold.png` / `before/dark/ipad-landscape-practice-E9-fold.png` |
| 연습: 휴대폰 | 주 버튼이 그림 아래 화면 밖이던 것을 화면 아래에 붙는 막대로 | `dark/iphone-practice-E1-fold.png`, `dark/iphone-practice-S-perform-fold.png` / `before/dark/iphone-practice-S-perform-fold.png` |
| 연습: 퀴즈 | 문제·그림 왼쪽, 왼쪽 정렬 답 오른쪽, 답한 뒤 ✓·✗와 "다음"이 답 아래 | `light/iphone-practice-Q1-fold.png`, `dark/macbook-practice-Q4-fold.png` / `before/light/ipad-landscape-practice-Q4-fold.png` |
| 연습: 시작·결과 | 하는 법 왼쪽, "준비되면 시작해요"와 시작 오른쪽. 결과는 헤더 왼쪽 끝의 한 단, 첫 줄 30–36 px와 뜻 한 줄 | `dark/ipad-landscape-stage-practice-fold.png`, `states/dark/ipad-landscape-practice-E2-result-fold.png` |
| 연습: 시작 전·나가기 | 시간 연습은 시작 전에도 계획 길이(1:00·2:00)를 큰 숫자로(E12·E4·E7은 빈 오른쪽 단이었다). 실행 중 "나가기"는 비활성 대신 "그만할까요?" | `dark/ipad-landscape-practice-E12-fold.png` / `before/dark/ipad-landscape-practice-E12-fold.png` |
| 연습: 휴대폰 TAB | 22음 스케일 TAB의 숫자 약 7 px → 14 px, 옆으로 스크롤하며 현재 음을 따라감 | `dark/iphone-practice-E10-fold.png` / `before/dark/iphone-practice-E10-fold.png` |
| 제목 줄바꿈 | "D D / D D", 줄 앞 "· 60 BPM" 없이 " · " 사이에서만 줄바꿈 | `dark/iphone-home-fold.png`, `states/dark/iphone-session-transition-fold.png` / `before/dark/iphone-home-fold.png` |
| 세션 | 실행 뒤 "다음 항목" 하나만 앰버, 블록 전환 큰 카운트다운, 일시정지 카드, 자가 평가 폼 | `states/dark/ipad-landscape-session-after-run-fold.png`, `states/dark/iphone-session-transition-fold.png` |
| 홈 | 첫 설정 배너 버튼을 보조로 내려 앰버는 "연습 시작" 하나 | `dark/iphone-home-fold.png` / `before/dark/iphone-home-fold.png` |
| 단계 | 요약 바로 아래 "먼저 해 볼 연습"·"바로 하기"(전에는 2,000 px 아래), 목록 이름 칸 | `dark/iphone-stage-fold.png` / `before/dark/iphone-stage-full.png` |
| 튜너·메트로놈 | 튜너 2단(큰 음 이름·눈금 바늘 / 켜기·줄 칩), 메트로놈 16vh BPM과 설정 오른쪽 | `dark/ipad-landscape-tuner-fold.png`, `dark/iphone-metronome-fold.png` / `before/dark/ipad-landscape-tuner-fold.png` |
| 루틴 편집 | 항목 카드, 탭바 위 저장 막대(총 시간), "2 / 분" 줄바꿈 해결 | `dark/iphone-routine-edit-fold.png` / `before/light/iphone-routine-edit-fold.png` |
| 라이브러리·코드 | 한 격자(첫 화면 12개), 코드 상세 칩·주 버튼 | `dark/macbook-library-fold.png`, `dark/ipad-landscape-chord-fold.png` / `before/dark/macbook-library-fold.png` |
| 설정·진단·녹음 | 세 카드로 묶은 설정, 48 px 라디오·체크박스·셀렉트, 진단 카드, 녹음 진행 | `light/ipad-landscape-settings-fold.png`, `dark/iphone-diagnostics-full.png` / `before/light/ipad-landscape-settings-full.png` |
| 필드 | 셀렉트 23 px(WebKit) → 48 px, 시스템 파란 슬라이더 → 토큰 색 44 px, 경계 1.5:1 → 4:1 | `light/ipad-landscape-metronome-fold.png` / `before/light/ipad-landscape-metronome-fold.png` |
| 고대비 | 포커스 링 3 px, 검정 바탕 위 칸의 안쪽 외곽선 | `contrast/ipad-landscape-practice-S-perform-fold.png` / `before/contrast/macbook-practice-Q1-fold.png` |
| 한국어 | 낱말 가운데 줄바꿈("치지 않/는 줄", "튜닝부/터") 없음, 제목 균형 줄바꿈 | `light/ipad-portrait-practice-E1-fold.png` / `before/light/ipad-portrait-practice-E1-fold.png` |

## 3. 품질 게이트 결과

(채움)

## 4. UI_AUDIT 통계

(채움)

## 5. 고친 기존 테스트

| 파일 | 바꾼 것 | 이유 |
|---|---|---|
| `tests/e2e/pause.spec.ts` | 새 테스트 1개 추가: "the focused pause button keeps the focus while the run pauses and resumes (D-090 stage)". 기존 테스트의 단언·타임아웃·대상은 그대로 | U2 독립 리뷰가 찾은 일시정지 포커스 유실(F-33)의 회귀 방지 |
| `tests/e2e/keys.spec.ts` | 새 테스트 1개 추가: "during a run "나가기" asks the same question as Esc instead of staying disabled (D-094)". 기존 테스트(AC-U2의 건너뛰기·끝내기 비활성 단언 포함)는 그대로 | U6 UI 리뷰가 찾은 "나가기" 비활성(F-54)을 확인 질문으로 바꾼 것의 회귀 방지 |

그 밖의 기존 테스트 파일은 고치지 않았다. 고정 파일 7개(SPEC §0.1)도 그대로다(해시 일치).

## 6. 알려진 한계

- **실기기 미확인**: 모든 검사는 Playwright(Chromium·WebKit)의 뷰포트 흉내로 했다. safe area(노치·홈 막대), 실제 손가락 터치, 보면대 거리 가독성, iPad 홈 화면 앱의 sticky 막대 동작은 실기기에서만 확인할 수 있다(`docs/MANUAL_VALIDATION.md` 5d).
- **휴대폰 세로의 긴 TAB**(F-34): 숫자가 14 px 아래로 줄지 않는 대신 옆으로 스크롤한다(현재 음을 따라감). 한 줄 TAB 구조(줄 번호 6개·마디선 수를 세는 기존 테스트)를 지키려고 여러 줄로 나누지 않았다. 스크롤하면 왼쪽 줄 번호가 화면 밖으로 나간다.
- **꼬리 "중단" 버튼**: Esc와 위쪽 "나가기"는 확인을 묻지만 아래 "중단" 버튼은 바로 중단한다(기존 동작, D-090에서 문구만 맞춤). 지금까지 한 것은 기록된다.
- **화면별 키 안내**(F-62, WONTFIX): 연습 화면 꼬리의 키 목록은 전역 바인딩 표라 그 화면에서 쓰지 않는 키도 보인다. 화면별 키는 notes에 따로 있다.
- **안전 문구 말투**(F-65, WONTFIX): "의학적 조언이 아닙니다."는 v1.1 SPEC이 요구하는 문장이라 앱의 해요체와 다르게 남겼다.
- **핵심 숫자 크기는 vh 기준**: 15–25 %(UQ-3)를 네 뷰포트에서 맞췄다. 아주 낮은 창(가로 휴대폰 등)에서는 clamp 하한(3rem)이 먼저 걸린다.
- **dev 서버(StrictMode)와 빌드의 차이**: 촬영은 `vite --mode e2e` dev 서버나 e2e 빌드로 했다. 게이트(E2E·verify)는 빌드로 돈다.

## 7. 사용자 다음 할 일

1. 실기기 확인: `docs/MANUAL_VALIDATION.md` 5d(safe area·sticky 막대·터치·60–80 cm·세 테마·일시정지 포커스·한국어 줄바꿈)를 iPad(가로 우선)·iPhone·MacBook에서.
2. 전후 비교: `ui-shots/before/`와 `ui-shots/`(같은 이름)을 iPad 가로 다크부터 훑어보기. 세션·결과 상태는 `ui-shots/states/`.
3. `cafaddict/ui` 병합 결정: `main`(9e7eda6)은 그대로이고, 이 브랜치는 D-087 UI 개편 위에 U1–U6 커밋이 쌓여 있다. 원격에 올리지 않았다.
4. 남은 v1.1 일(vault TODO): 실기기 판정 검증(5a절), 녹음 키트 fixture → `bench:real`, 배포 후 병합.
