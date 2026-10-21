# UI_AUDIT — guitar-hero UI 마감 goal

> 형식과 기준은 `docs/goal/ui/SPEC.md` §6을 따른다. 그림은 `npm run ui:shots`의 `ui-shots/<theme>/<viewport>-<screen>-{fold,full}.png`이다(git 밖). 시작 전 기준 그림은 `ui-shots/before/`.

## §1 표식 표

화면마다 `[data-primary-action]`이 감싼 것과 `[data-core-number]`의 위치, 그리고 연습 화면이면 iPad 가로·MacBook의 2단 구성(왼쪽 / 오른쪽)을 적는다.

| 화면 | data-primary-action | data-core-number | 2단 구성(연습 화면) |
|---|---|---|---|
| stage-practice | `exercise-start`(마이크 켜고 시작) + 마이크 없이 쓰기 | —(시작 전) | 하는 법 / 준비 안내·시작 |
| practice-E1 | 준비됐어요(배치) · 다음 시도(결과) · 1/2/3 자가 판정(줄) | `BigTimer` 18vh | 다이어그램·모드 / 타이머·지시·줄 상태·판정 |
| practice-E2 | 시작(대기) · 탭(탭 모드) · 확인(리뷰) | `BigTimer` 18vh, 체인지 수 16vh | 다음 코드 다이어그램 / 타이머·체인지 수·상태 |
| practice-E3 | 시작 · 깨끗/안 깨끗(진행) · 확인 | `BigTimer` 18vh | 다음 코드 다이어그램 / 타이머·도착 수·상태 |
| practice-E5 | 시작(준비·대기) · 셈/강약 자가 평가 | `BigBpm` 16vh(+`BigTimer`) | 패턴 칸·박 숫자·셈 안내·마디 결과 / BPM·마디·코드·상태 |
| practice-E6·E8(세션 항목) | 시작 · 자가 평가 | `BigBpm` 16vh | 코드 칸·마디 결과 / BPM·마디·상태 |
| practice-E4·E7·E12 | 시작 · 멈춤 · 확인(리뷰, −/+는 패널) | `BigTimer` 18vh | 하는 법·안전 안내(·다이어그램) / 타이머·n/10 |
| practice-E9·E10·E11·E17 | 시작(준비, `seq-start`) · 실수 없음/있음(진행) · E11 고르기 평가 | —(제목 속 BPM은 제외 대상) | TAB 전폭 위 / 아래 왼쪽 하는 법·말로 읽은 리프, 오른쪽 바퀴 상태·조작·도구 |
| practice-E17-ready | `seq-start` "시작" | — | TAB 전폭 / 말로 읽은 리프 · 준비 안내·시작·들어 보기 |
| practice-E17-how-to | `exercise-start` + 마이크 없이 쓰기 | — | 하는 법 / 준비 안내·시작 |
| practice-E16 | 1 깨끗 · 2 막힘 · 3 버징 | — | 위치 그림·지시 / 소개·비교 표 |
| practice-K1 | `k1-done` + `k1-not-yet` | — | 자세 그림 / 카드 번호·제목·설명 |
| practice-Q1 | 답 1–3(왼쪽 정렬) | — | 문제·다이어그램 / 진행·판정 |
| practice-Q3·Q4·Q5 | 답 1–n | — | 문제 카드(Q4 다시 듣기, Q5 TAB) / 진행·판정 |
| practice-Q2(세션 항목) | 1 맞음 · 2 틀림 | —(코드 이름은 문제 그림) | 코드 이름 / 진행·카운트다운·상태 |
| practice-S-perform | 시작(준비) · 멈춤(진행) · 확인(리뷰) | —(곡 BPM은 제목 줄) | 제목·코드 차트 / 단계·반주 설정·상태 |
| practice-S-paused | `exercise-pause`(이어서) | — | 제목·가린 차트(마디) / 일시정지 배지·멈춘 마디·처음부터 |
| session | 시작 전: `exercise-start` + 마이크 없이 쓰기(항목의 연습 무대) | 항목에 따름 | 세션 머리 / 항목의 연습 무대(위와 같음) |
| session(실행 뒤 · 블록 전환 · 일시정지 · 자가 평가) | `next-item` / `transition-start` / 계속하기 / `report-save` | 전환: 남은 초 16vh | (상태 카드 한 단) |
| onboarding | "마이크 허용" + 마이크 없이 쓰기("나중에 하기"는 밖) | — | (앱 화면) |
| home | `start-session`(분할 이어 하기가 있으면 `resume-session`) | — | (앱 화면) |
| stage, stage-10 | "먼저 해 볼 연습" 카드의 `stage-practice-now` | — | (앱 화면) |
| tuner | 튜너 켜기 / 끄기 | —(cents는 제외 대상, 큰 음 이름은 글자) | (앱 화면: 왼쪽 음·바늘, 오른쪽 조작) |
| metronome | `metronome-toggle`(시작/정지) | BPM 16vh(도구 화면에 달았으니 같은 기준) | (앱 화면: 왼쪽 BPM 카드, 오른쪽 설정·사다리) |
| routine-edit | `editor-save`(탭바 위 sticky 막대) | — | (앱 화면) |

## §2 검토 범위표

칸에는 그 조합을 fold와 full 모두 보고 검토한 커밋(짧은 해시)을 적는다. 그 화면을 마지막으로 바꾼 커밋 이후여야 한다.

| 화면 | 테마 | macbook | ipad-landscape | ipad-portrait | iphone |
|---|---|---|---|---|---|

## §3 발견 표

| ID | 화면 | 뷰포트/테마 | 휴리스틱 | 심각도 | 내용 | 조치 | 상태 | 커밋 |
|---|---|---|---|---|---|---|---|---|
| F-01 | practice-E9·E10·E11·E17 | ipad-landscape, macbook / 3테마 | H1 H11 | High | TAB 그림이 화면 너비 전체로 커져(한 칸 100 px 이상) 진행 중 자가 평가 버튼(`seq-flawless`)이 첫 화면 밖이다 | TAB은 위쪽 전폭 + 확대 상한 2.5배(숫자 약 32 px), 자가 평가는 오른쪽 단 행동 막대(D-090) | FIXED | 14ce3b8 |
| F-02 | practice-E17-ready (시퀀스 준비 상태 E9·E10·E11·E17) | 전 뷰포트 / 3테마 | H1 H7 | High | 준비 상태가 Space로만 시작된다. 터치(iPad·iPhone)로는 시작할 수 없다(SPEC §4.2) | 준비 상태에 터치 "시작"(`seq-start`, Space와 같은 `toggle`)과 안내 "시작 버튼이나 Space로"(D-090) | FIXED | 14ce3b8 |
| F-03 | stage, stage-10 | 전 뷰포트 / 3테마 | H1 H2 | High | 연습을 시작하는 조작(바로 하기·세션 시작)이 배울 것·팁·진급 기준 아래 페이지 맨 끝에 있다. iPhone에서 2,000 px 아래 | 요약 아래 "먼저 해 볼 연습" 카드와 "바로 하기"(`stage-practice-now`), "여러 개 골라 세션으로"는 목록으로(D-092) | FIXED | c909607 |
| F-04 | routine-edit | ipad-landscape, iphone / 3테마 | H1 H9 | High | 저장 버튼이 첫 화면 밖이다. iPhone에서 항목의 분이 "2 / 분"으로 줄바꿈된다 | 항목 카드 + 하단 탭바 위에 붙는 저장 막대(총 시간 포함), 분 줄바꿈 없음(D-092) | FIXED | c909607 |
| F-05 | practice-E1·E2·E3·S-perform | iphone / 3테마 | H1 | High | 주 버튼(준비됐어요·시작)이 첫 화면 밖이다(그림·안내 아래) | 1단 화면에서 행동 막대가 화면 아래에 붙는다(sticky), 다이어그램 192 px(D-090) | FIXED | 14ce3b8 |
| F-06 | practice-E5 | 전 뷰포트 / 3테마 | H4 H2 | High | BPM이 화면 높이의 7–10 %다(기준 15–25 %). 시작 버튼이 안내 문장 사이에 끼어 있다 | BPM 16vh 핵심 숫자, 시작은 오른쪽 단 행동 막대(D-090) | FIXED | 14ce3b8 |
| F-07 | practice-E1 | ipad-portrait / 3테마 | H4 | High | 남은 시간이 화면 높이의 13.6 %다(`BigTimer` 상한 10rem) | `BigTimer` 18vh, clamp 상한 15rem | FIXED | 14ce3b8 |
| F-08 | metronome, settings, routine-edit, progress, diagnostics, onboarding | ipad·iphone(WebKit) / 3테마 | H8 | High | WebKit의 기본 셀렉트가 min-height를 무시해 23 px이다. 메트로놈 BPM 슬라이더는 16 px이다(UQ-4) | `Select`(appearance none + 셰브런, 48 px)로 6개 화면 교체, 슬라이더 44 px 히트 영역(D-089). UQ-4 0 | FIXED | 0a940a8 |
| F-09 | 전 화면 | iphone / 3테마 | H9 | High | `word-break: normal`이라 낱말 가운데서 줄이 바뀐다("튜닝부/터", "치지 않/는 줄") | `body`에 keep-all + break-word, 제목 balance·문단 pretty(D-089). UQ-5 0 | FIXED | 0a940a8 |
| F-10 | 전 화면 | 3뷰포트 / contrast | H10 | High | 고대비 테마의 `button { outline: 1px }`가 포커스 outline을 덮어 포커스가 1 px로 보인다(WCAG 2.4.7, UQ-6) | 고대비 훅을 `:where()`로 낮추고 포커스 링을 `:root :focus-visible`로(D-089). UQ-6 0 | FIXED | 0a940a8 |
| F-11 | settings, metronome, routine-edit, session 자가 평가 등 필드 화면 | 전 뷰포트 / dark·light | H3 | High | 입력·셀렉트 경계가 바탕과 1.4–1.5:1이다(WCAG 1.4.11, UQ-10) | `--field-border` 토큰(다크 4.18:1, 라이트 4.13:1 on surface)과 `FIELD_CLASS`(D-089). UQ-10 0 | FIXED | 0a940a8 |
| F-12 | practice-K1·E9·E11·S-paused 등 | macbook, ipad-landscape / 3테마 | H4 | Medium | 넓은 화면에서 안내 문단 한 줄이 52–55em이다(UQ-9) | `p { max-inline-size: 48em }`(base 레이어). UQ-9 0 | FIXED | 0a940a8 |
| F-13 | metronome, session 자가 평가 | 전 뷰포트 / light | H3 H10 | Medium | 슬라이더가 시스템 파란색이다(팔레트 밖) | 슬라이더를 토큰 색(트랙 field-border, 손잡이 accent)으로 직접 그림 | FIXED | 0a940a8 |
| F-14 | 연습 화면 전부 | ipad-landscape·macbook / ipad-portrait | H11 | Medium | 2단은 E1·E2·E3·Q1뿐이고(`md`), 그마저 iPad 세로(820)에서도 2단이라 좁다. 나머지 연습은 넓은 화면에서 한 줄로 길게 늘어진다(AC-UX3) | 모든 연습이 `PracticeStage`: lg 이상 2단, 미만 1단(iPad 세로 포함) | FIXED | 14ce3b8 |
| F-15 | practice-S-perform | 전 뷰포트 / 3테마 | H2 | Medium | 반주 켜기 토글이 주 버튼(앰버) 모양이라 시작 버튼과 경쟁한다 | 반주·이어폰 토글은 보조 모양 + 눌림 표시(`selected`), 시작만 앰버 | FIXED | 14ce3b8 |
| F-16 | tuner | 전 뷰포트 / 3테마 | H2 H3 | Medium | 선택된 줄 칩(자동)이 주 조작 "튜너 켜기"와 같은 앰버 버튼 모양이다. 켜기 전 cents 표시는 빈 막대뿐이다 | 2단, 줄 칩은 눌림 표시(`selected`), 켜기 전 안내 문장, 큰 음 이름(D-092) | FIXED | c909607 |
| F-17 | 연습 화면 전부 | 전 뷰포트 / 3테마 | H4 | Low | 키 안내가 12 px(`text-xs`)이고 60–80 cm에서 읽기 어렵다 | 연습 화면 키 안내 16 px(꼬리·E5·곡) | FIXED | 14ce3b8 |
| F-18 | stage, stage-10 | iphone / 3테마 | H9 H11 | Medium | 연습 목록의 이름 칸이 좁아 "스트러밍 패턴 사다리 · D DU D D · 60 BPM"이 4–5줄로 쪼개진다 | 이름 칸 최소 폭(basis-48): 좁으면 조작이 이름 아래 줄로 | FIXED | c909607 |
| F-19 | progress | macbook / 3테마 | H11 | Low | 코드 × 줄 표의 코드 이름 칸이 너무 넓어 숫자 칸이 오른쪽으로 밀린다 | 표 `table-fixed` + 이름 칸 3.5rem | FIXED | c909607 |
| F-20 | practice-E5·E1 등 | 전 뷰포트 / 3테마 | H2 | Low | "마이크 없이 진행해요" 같은 상태 안내와 키 안내가 무대와 떨어진 맨 아래에 흩어져 있다 | 상태는 패널, 키·모드 안내는 notes, 마이크 없음 안내는 꼬리 한 줄로 정리 | FIXED | 14ce3b8 |
| F-21 | chord | 전 뷰포트 / 3테마 | H2 H3 | Medium | "코드 목록" 돌아가기 링크가 버튼이 아닌 넓은 회색 막대로 보이고, h1 "C"와 다이어그램 제목 "C"가 겹친다. 기대 음·스트럼 확인 줄은 작은 글자로 흩어져 있다 | 다이어그램 카드 / 칩으로 기대 음·확인 줄, 주 버튼 E1, 뒤로 아이콘 고스트 링크, eyebrow에 단계 | FIXED | c909607 |
| F-22 | practice-K1 | macbook, ipad-landscape / 3테마 | H4 H11 | Medium | 자세 그림이 120 px로 작고, 1,100 px 넓이 카드에 문장 한 줄과 버튼만 있어 휑하다 | 자세 그림을 왼쪽 단 전체(최대 384 px)로, 오른쪽 단에 번호·제목·설명·버튼 | FIXED | 14ce3b8 |
| F-23 | diagnostics, recording | 전 뷰포트 / 3테마 | H2 H3 | Medium | 환경 안내 상자·마이크 상태·레벨·캘리브레이션 카드가 서로 다른 모양(테두리 없는 회색 상자, 카드 밖 맨 줄, 카드)으로 흩어져 있다 | 진단: 환경 안내 info 카드 → 마이크 카드 → 트랙 설정 → 캘리브레이션, 녹음 키트 항목 카드(D-093) | FIXED | U5 |
| F-24 | exam | ipad-landscape, macbook / 3테마 | H11 | Low | 좁은 단(3xl) 안에 항목마다 작은 "시작" 버튼이 따로 놓여 넓은 화면의 오른쪽이 비고 시선이 길다 | 번호(통과 ✓) · 내용 · 시작을 한 줄로, 실행은 아래 전폭 | FIXED | c909607 |
| F-25 | settings | 전 뷰포트 / 3테마 | H2 H8 | Medium | 테마·판정·메트로놈·세션 설정이 한 카드에 섞여 있고, 라디오가 13 px 기본 모양이다. 키 표는 "페달 학습" 밑줄 링크 17개가 같은 무게로 늘어서 있다 | "화면·판정·연습·세션" 세 카드, 라디오·체크박스는 48 px `Choice`, 키 표 정리(D-093) | FIXED | U5 |
| F-26 | practice-Q1·Q3·Q4·Q5 | 전 뷰포트 / 3테마 | H2 | Low | 답 선택지가 가운데 정렬이라 "1. …" 번호가 줄마다 다른 위치에서 시작한다 | 답 버튼 왼쪽 정렬(`align="start"`), 답한 뒤 ✓·✗ 표시 | FIXED | 14ce3b8 |
| F-27 | library | macbook, ipad-landscape / 3테마 | H11 | Medium | 단계마다 코드 카드 1–2장이 한 줄을 차지해 넓은 화면의 3/4가 비고, 첫 화면에 코드 4개만 보인다 | 단계 순 한 격자(최대 6열), 타일에 "Stage n · 수준" | FIXED | c909607 |
| F-28 | recording | 전 뷰포트 / 3테마 | H5 | Low | 14개 녹음 항목의 진행(몇 개 했는지)이 보이지 않는다 | "14개 중 n개 녹음했어요" 진행 줄과 ✓ 아이콘 | FIXED | U5 |
| F-29 | home | 전 뷰포트 / 3테마 | H2 H9 | Medium | 첫 설정 배너의 "처음 설정 시작"과 "연습 시작"이 둘 다 앰버 주 버튼이라 다음 할 일이 둘로 보인다. iPhone에서 "60 / BPM"처럼 숫자와 단위가 갈라진다 | 첫 설정 배너 버튼은 보조 모양, 주 조작은 연습 시작 하나(D-092) | FIXED | c909607 |
| F-30 | stage-10 | 전 뷰포트 / 3테마 | H9 | Medium | 진급 기준에 내부 id "am-pent-pos1"이 그대로 보인다(이름은 "Am 펜타토닉 1포지션") | 진급 기준 문구에 `scaleById(id).name` | FIXED | c909607 |
| F-31 | practice-E9·E10·E11·E17 | 전 뷰포트 / 3테마 | H3 H7 | Medium | 진행 중 "마치기"가 두 개(`seq-finish`, `exercise-finish`) 보이고, "마이크 없이 스스로 판단해요"와 "마이크 없이 진행해요"가 겹친다 | 꼬리 버튼(abort) 문구 "중단", 무대의 시퀀스 "마치기"는 도구 줄로(D-090) | FIXED | 14ce3b8 |
| F-32 | practice-Q4 | 전 뷰포트 / 3테마 | H2 | Low | "다시 듣기"가 답 선택지와 같은 모양·같은 줄에 있어 답처럼 보인다 | "다시 듣기"는 왼쪽 문제 카드 안의 재생 버튼, 답은 오른쪽 | FIXED | 14ce3b8 |
| F-33 | practice-S·E9·E10·E11·E17 (일시정지) | 전 뷰포트 / 3테마 | H7 | High | (U2 독립 리뷰) 일시정지 버튼이 상태마다 다른 부모로 옮겨져 다시 만들어지고 키보드 포커스를 잃었다(D-085 Space 흐름) | 행동 막대의 고정 칸, 표식·보이는 순서만 이동 + 회귀 E2E | FIXED | 14ce3b8 |
| F-34 | practice-E17·E10 | iphone / 3테마 | H4 | Low | 16음 이상 TAB은 휴대폰 폭(358 px)에서 숫자가 약 10 px다 | WONTFIX(Low): 한 줄 TAB은 줄 번호 6개·마디선 개수를 세는 기존 테스트가 기대하는 구조라 여러 줄로 나누지 않는다. 휴대폰은 2순위 기기이고 가로로 돌리면 숫자가 두 배로 커진다. 실기기 확인 항목에 넣었다(MANUAL_VALIDATION 5d) | WONTFIX | — |
| F-35 | practice-Q1·Q3·Q4·Q5 | 전 뷰포트 / 3테마 | H1 H7 | Medium | (U2 독립 리뷰) 답한 뒤 "다음"이 주 영역 밖·답 위에 생겨 답이 밀렸다 | 판정·"다음"을 답 목록 뒤, 같은 주 영역 안에 | FIXED | 14ce3b8 |
| F-36 | practice-S·E5·E1·Q3·Q4·K1·E16, progress, home | 전 뷰포트 / contrast | H10 | Medium | 고대비에서 `--surface`가 바탕과 같은 검정이라 코드 차트 칸·패턴 칸·줄 상태 칸·문제 카드 같은 `bg-surface` 칸의 경계가 사라진다(카드만 외곽선 훅이 있다) | 고대비에서 `bg-surface`·`bg-surface-2` 칸에 안쪽 1 px 외곽선(D-093) | FIXED | U5 |
| F-37 | session(실행 뒤) | 전 뷰포트 / 3테마 | H1 H2 | Medium | 실행이 끝난 뒤 "이어서 한 번 더"와 "다음 항목"이 둘 다 앰버라 다음 할 일이 둘로 보였다(포커스는 "다음 항목") | "다음 항목"만 주 조작(첫 자리), 나머지는 보조 모양(D-091) | FIXED | 1957e09 |
| F-38 | session(블록 전환) | 전 뷰포트 / 3테마 | H4 | Medium | 전환 화면의 남은 초가 작은 회색 글자("5초 뒤 시작")뿐이라 보면대 거리에서 읽히지 않았다 | 16vh 핵심 숫자 + 다음 블록 강조(D-091) | FIXED | 1957e09 |
| F-39 | practice 결과(요약) | macbook, ipad-landscape / 3테마 | H11 | Low | 결과 카드가 넓은 화면 전폭으로 늘어져 결과와 다음 할 일 사이 시선이 멀었다 | 가운데 한 단(`max-w-3xl`) | FIXED | 1957e09 |
