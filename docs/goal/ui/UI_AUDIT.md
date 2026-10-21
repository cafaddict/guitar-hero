# UI_AUDIT — guitar-hero UI 마감 goal

> 형식과 기준은 `docs/goal/ui/SPEC.md` §6을 따른다. 그림은 `npm run ui:shots`의 `ui-shots/<theme>/<viewport>-<screen>-{fold,full}.png`이다(git 밖). 시작 전 기준 그림은 `ui-shots/before/`.

## §1 표식 표

화면마다 `[data-primary-action]`이 감싼 것과 `[data-core-number]`의 위치, 그리고 연습 화면이면 iPad 가로·MacBook의 2단 구성(왼쪽 / 오른쪽)을 적는다.

| 화면 | data-primary-action | data-core-number | 2단 구성(연습 화면) |
|---|---|---|---|
| stage-practice | `exercise-start`(마이크 켜고 시작) + 마이크 없이 쓰기 | —(시작 전) | 하는 법 / 준비 안내·시작 |
| practice-E1 | 준비됐어요(배치) · 다음 시도(결과) · 1/2/3 자가 판정(줄) | `BigTimer` 18vh | 다이어그램·모드 / 타이머·지시·줄 상태·판정 |
| practice-E2 | 시작(대기) · 탭(탭 모드) · 확인(리뷰) | `BigTimer` 18vh(시작 전에는 계획 길이, D-094), 체인지 수 16vh — 폭이 되면 한 줄(F-73) | 다음 코드 다이어그램 / 타이머·체인지 수·상태 |
| practice-E3 | 시작 · 깨끗/안 깨끗(진행) · 확인 | `BigTimer` 18vh(시작 전에는 계획 길이) | 다음 코드 다이어그램 / 타이머·도착 수·상태 |
| practice-E5 | 시작(준비·대기) · 셈/강약 자가 평가 | `BigBpm` 16vh(+`BigTimer`) | 패턴 칸·박 숫자·셈 안내·마디 결과 / BPM·마디·코드·상태 |
| practice-E6·E8(세션 항목) | 시작 · 자가 평가 | `BigBpm` 16vh | 코드 칸·마디 결과 / BPM·마디·상태 |
| practice-E4·E7·E12 | 시작 · 멈춤 · 확인(리뷰, −/+는 패널) | `BigTimer` 18vh(시작 전에는 계획 길이) | 하는 법·안전 안내(·다이어그램) / 타이머·n/10 |
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
| session(실행 뒤 · 블록 전환 · 일시정지 · 자가 평가 · 휴식) | `next-item` / `transition-start` / 계속하기 / `report-save` / 바로 다음으로 | 전환·휴식: 남은 초 16vh | (상태 카드 한 단, 헤더 왼쪽 끝에) |
| onboarding | "마이크 허용" + 마이크 없이 쓰기("나중에 하기"는 밖). 권한 오류: 다시 시도 + 마이크 없이 쓰기. 2–6단계: 단계마다 "다음" 또는 측정 하나 | — | (앱 화면) |
| home | `start-session`(분할 이어 하기가 있으면 `resume-session`) | — | (앱 화면) |
| stage, stage-10 | "먼저 해 볼 연습" 카드의 `stage-practice-now` | — | (앱 화면) |
| tuner | 튜너 켜기 / 끄기 | —(cents는 제외 대상, 큰 음 이름은 글자) | (앱 화면: 왼쪽 음·바늘, 오른쪽 조작) |
| metronome | `metronome-toggle`(시작/정지) | BPM 16vh(도구 화면에 달았으니 같은 기준) | (앱 화면: 왼쪽 BPM 카드, 오른쪽 설정·사다리) |
| routine-edit | `editor-save`(탭바 위 sticky 막대) | — | (앱 화면) |

## §2 검토 범위표

칸에는 그 조합을 fold와 full 모두 보고 검토한 커밋(짧은 해시)을 적는다. 그 화면을 마지막으로 바꾼 커밋 이후여야 한다.

U6 검토 기록(실행자):
- `2a3d1b0`(리뷰 처리 커밋): 888장 전부 다시 찍고 dark 37화면과 light·contrast 중 이후 바뀌지 않은 11화면을 봤다.
- `fdc09b4`(재검토 수정 커밋): 바뀐 26화면을 세 테마로 다시 찍어 봤다.
- `5dbeadd`(마지막 코드 커밋): practice-E2·settings·practice-E17-how-to를 세 테마로 다시 봤다. 그다음 888장을 다시 찍어 앞선 검토 그림과 픽셀 비교했다. 다른 화면의 차이는 두 가지뿐이었다. 하나는 안티에일리어싱 잡음(밝기 차 1–2)이다. 다른 하나는 매번 바뀌는 내용이다: 퀴즈 문제(Q1·Q3·Q5)와 진행 중 현재 음(E9 전체 그림). 그래서 앞선 커밋의 검토가 그대로 유효하다.

| 화면 | 테마 | macbook | ipad-landscape | ipad-portrait | iphone |
|---|---|---|---|---|---|
| onboarding | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| onboarding | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| onboarding | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| home | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| home | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| home | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| curriculum | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| curriculum | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| curriculum | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| stage | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage-practice | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage-practice | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage-practice | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| exam | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| exam | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| exam | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| tools | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| tools | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| tools | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| library | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| library | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| library | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| chord | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| chord | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| chord | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| tuner | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| tuner | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| tuner | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| metronome | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| metronome | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| metronome | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| progress | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| progress | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| progress | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| settings | dark | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| settings | light | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| settings | contrast | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| diagnostics | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| diagnostics | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| diagnostics | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| recording | dark | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| recording | light | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| recording | contrast | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` | `2a3d1b0` |
| practice-E1 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E1 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E1 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E2 | dark | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| practice-E2 | light | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| practice-E2 | contrast | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| practice-E5 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E5 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E5 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q1 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q1 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q1 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage-10 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage-10 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| stage-10 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| routine-edit | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| routine-edit | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| routine-edit | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-K1 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-K1 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-K1 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E16 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E16 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E16 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E3 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E3 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E3 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E9 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E9 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E9 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E10 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E10 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E10 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E11 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E11 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E11 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E12 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E12 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E12 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E17 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E17 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E17 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E17-how-to | dark | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| practice-E17-how-to | light | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| practice-E17-how-to | contrast | `5dbeadd` | `5dbeadd` | `5dbeadd` | `5dbeadd` |
| practice-E17-ready | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E17-ready | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-E17-ready | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q3 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q3 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q3 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q4 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q4 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q4 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q5 | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q5 | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-Q5 | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-S-perform | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-S-perform | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-S-perform | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-S-paused | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-S-paused | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| practice-S-paused | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| session | dark | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| session | light | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |
| session | contrast | `fdc09b4` | `fdc09b4` | `fdc09b4` | `fdc09b4` |

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
| F-23 | diagnostics, recording | 전 뷰포트 / 3테마 | H2 H3 | Medium | 환경 안내 상자·마이크 상태·레벨·캘리브레이션 카드가 서로 다른 모양(테두리 없는 회색 상자, 카드 밖 맨 줄, 카드)으로 흩어져 있다 | 진단: 환경 안내 info 카드 → 마이크 카드 → 트랙 설정 → 캘리브레이션, 녹음 키트 항목 카드(D-093) | FIXED | afd095e |
| F-24 | exam | ipad-landscape, macbook / 3테마 | H11 | Low | 좁은 단(3xl) 안에 항목마다 작은 "시작" 버튼이 따로 놓여 넓은 화면의 오른쪽이 비고 시선이 길다 | 번호(통과 ✓) · 내용 · 시작을 한 줄로, 실행은 아래 전폭 | FIXED | c909607 |
| F-25 | settings | 전 뷰포트 / 3테마 | H2 H8 | Medium | 테마·판정·메트로놈·세션 설정이 한 카드에 섞여 있고, 라디오가 13 px 기본 모양이다. 키 표는 "페달 학습" 밑줄 링크 17개가 같은 무게로 늘어서 있다 | "화면·판정·연습·세션" 세 카드, 라디오·체크박스는 48 px `Choice`, 키 표 정리(D-093) | FIXED | afd095e |
| F-26 | practice-Q1·Q3·Q4·Q5 | 전 뷰포트 / 3테마 | H2 | Low | 답 선택지가 가운데 정렬이라 "1. …" 번호가 줄마다 다른 위치에서 시작한다 | 답 버튼 왼쪽 정렬(`align="start"`), 답한 뒤 ✓·✗ 표시 | FIXED | 14ce3b8 |
| F-27 | library | macbook, ipad-landscape / 3테마 | H11 | Medium | 단계마다 코드 카드 1–2장이 한 줄을 차지해 넓은 화면의 3/4가 비고, 첫 화면에 코드 4개만 보인다 | 단계 순 한 격자(최대 6열), 타일에 "Stage n · 수준" | FIXED | c909607 |
| F-28 | recording | 전 뷰포트 / 3테마 | H5 | Low | 14개 녹음 항목의 진행(몇 개 했는지)이 보이지 않는다 | "14개 중 n개 녹음했어요" 진행 줄과 ✓ 아이콘 | FIXED | afd095e |
| F-29 | home | 전 뷰포트 / 3테마 | H2 H9 | Medium | 첫 설정 배너의 "처음 설정 시작"과 "연습 시작"이 둘 다 앰버 주 버튼이라 다음 할 일이 둘로 보인다. iPhone에서 "60 / BPM"처럼 숫자와 단위가 갈라진다 | 첫 설정 배너 버튼은 보조 모양, 주 조작은 연습 시작 하나(D-092) | FIXED | c909607 |
| F-30 | stage-10 | 전 뷰포트 / 3테마 | H9 | Medium | 진급 기준에 내부 id "am-pent-pos1"이 그대로 보인다(이름은 "Am 펜타토닉 1포지션") | 진급 기준 문구에 `scaleById(id).name` | FIXED | c909607 |
| F-31 | practice-E9·E10·E11·E17 | 전 뷰포트 / 3테마 | H3 H7 | Medium | 진행 중 "마치기"가 두 개(`seq-finish`, `exercise-finish`) 보이고, "마이크 없이 스스로 판단해요"와 "마이크 없이 진행해요"가 겹친다 | 꼬리 버튼(abort) 문구 "중단", 무대의 시퀀스 "마치기"는 도구 줄로(D-090) | FIXED | 14ce3b8 |
| F-32 | practice-Q4 | 전 뷰포트 / 3테마 | H2 | Low | "다시 듣기"가 답 선택지와 같은 모양·같은 줄에 있어 답처럼 보인다 | "다시 듣기"는 왼쪽 문제 카드 안의 재생 버튼, 답은 오른쪽 | FIXED | 14ce3b8 |
| F-33 | practice-S·E9·E10·E11·E17 (일시정지) | 전 뷰포트 / 3테마 | H7 | High | (U2 독립 리뷰) 일시정지 버튼이 상태마다 다른 부모로 옮겨져 다시 만들어지고 키보드 포커스를 잃었다(D-085 Space 흐름) | 행동 막대의 고정 칸, 표식·보이는 순서만 이동 + 회귀 E2E | FIXED | 14ce3b8 |
| F-34 | practice-E10·E17·E11·Q5 | iphone / 3테마 | H4 | Medium | 16음 이상 TAB이 휴대폰 폭(358 px)에서 줄어 숫자가 E17 약 10 px, E10(22음) 약 7 px다(U6 UI 리뷰가 다시 잼, 처음 기록은 E17만 봤다). 휴대폰 세로에서는 읽을 수 없다 | TAB 최소 배율 1.1(숫자 약 14 px), 더 긴 TAB은 옆으로 스크롤하며 현재 음을 가운데로 따라감. 스크롤할 때만 포커스 가능. 한 줄 구조(줄 번호·마디선)는 그대로(D-094) | FIXED | 2a3d1b0 |
| F-35 | practice-Q1·Q3·Q4·Q5 | 전 뷰포트 / 3테마 | H1 H7 | Medium | (U2 독립 리뷰) 답한 뒤 "다음"이 주 영역 밖·답 위에 생겨 답이 밀렸다 | 판정·"다음"을 답 목록 뒤, 같은 주 영역 안에 | FIXED | 14ce3b8 |
| F-36 | practice-S·E5·E1·Q3·Q4·K1·E16, progress, home | 전 뷰포트 / contrast | H10 | Medium | 고대비에서 `--surface`가 바탕과 같은 검정이라 코드 차트 칸·패턴 칸·줄 상태 칸·문제 카드 같은 `bg-surface` 칸의 경계가 사라진다(카드만 외곽선 훅이 있다) | 고대비에서 `bg-surface`·`bg-surface-2` 칸에 안쪽 1 px 외곽선(D-093) | FIXED | afd095e |
| F-37 | session(실행 뒤) | 전 뷰포트 / 3테마 | H1 H2 | Medium | 실행이 끝난 뒤 "이어서 한 번 더"와 "다음 항목"이 둘 다 앰버라 다음 할 일이 둘로 보였다(포커스는 "다음 항목") | "다음 항목"만 주 조작(첫 자리), 나머지는 보조 모양(D-091) | FIXED | 1957e09 |
| F-38 | session(블록 전환) | 전 뷰포트 / 3테마 | H4 | Medium | 전환 화면의 남은 초가 작은 회색 글자("5초 뒤 시작")뿐이라 보면대 거리에서 읽히지 않았다 | 16vh 핵심 숫자 + 다음 블록 강조(D-091) | FIXED | 1957e09 |
| F-39 | practice 결과(요약) | macbook, ipad-landscape / 3테마 | H11 | Low | 결과 카드가 넓은 화면 전폭으로 늘어져 결과와 다음 할 일 사이 시선이 멀었다 | 가운데 한 단(`max-w-3xl`) | FIXED | 1957e09 |
| F-40 | home, diagnostics | macbook, ipad-landscape / 3테마 | H3 | Low | (U6 전체 검토) 문단 48em 상한 때문에 배너의 `flex-1` 문단이 다 자라지 못해, 배너 버튼이 카드 오른쪽 끝이 아니라 가운데쯤에 떠 있다 | 배너 줄에 `justify-between`(문단 폭 상한은 유지) | FIXED | 2a3d1b0 |
| F-41 | curriculum, stage, home(진급 링) | 전 뷰포트 / light | H10 | Low | (U6 전체 검토) 라이트의 현재 단계 카드(accent-soft) 위에서 진급 링의 빈 트랙(surface-2)이 거의 보이지 않아 "0 % 채움" 옆이 빈칸처럼 보인다 | 트랙을 필드 경계 토큰 35 %로(세 테마에서 보임) | FIXED | 2a3d1b0 |
| F-42 | library, chord(G5·C5·바레 F 등), 그 코드를 쓰는 연습 | 전 뷰포트 / 3테마 | H6 H9 | High | (U6 전체 검토) 시작 프렛 표시("3프렛")가 다이어그램 왼쪽 끝에서 잘려 "프렛"만 보이고 첫 점과 겹친다. 3프렛 코드가 개방 위치 코드처럼 읽힌다(키트 이전부터 있던 결함) | 표시를 위쪽 모서리(저음 줄 쪽, 왼손잡이면 반대)로 옮겨 잘리지 않게 | FIXED | 2a3d1b0 |
| F-43 | chord | iphone / 3테마 | H1 | Medium | (U6 전체 검토) 코드 상세의 주 조작("이 코드로 정밀 체크(E1)")이 iPhone에서 다이어그램·기대 음·확인 줄 아래, 첫 화면 밖(약 860 px)이다 | 오른쪽 단 맨 위로 옮기고 휴대폰 다이어그램을 224 px로 | FIXED | 2a3d1b0 |
| F-44 | routine-edit | iphone, ipad-portrait / 3테마 | H7 H11 | Medium | (U6 코드 리뷰) 저장 막대에 확인 없이 저장된 루틴을 지우는 "기본으로 되돌리기"가 저장 옆에 붙어 있고, 저장된 루틴이 있으면 막대가 두 줄(약 150 px)이 되어 탭바와 함께 화면 1/4을 덮는다. 막대 위치가 탭바보다 1 px 높아 틈으로 목록이 비친다 | 막대는 저장 + 총 시간 한 줄, 되돌리기·취소는 목록 아래. 위치는 탭바 높이 토큰 `--tabbar-h`(57 px) | FIXED | 2a3d1b0 |
| F-45 | 탭바 화면 전부, routine-edit, 연습(sticky 막대) | iphone, ipad-portrait / 3테마 | H7 | Medium | (U6 코드 리뷰) 키보드 포커스가 화면 아래에 붙은 탭바·저장 막대·연습 막대 뒤로 스크롤돼 완전히 가려질 수 있다(WCAG 2.4.11) | lg 미만 `scroll-margin-bottom: var(--pinned-bottom)`: 탭바 화면은 탭바 높이, 루틴 편집은 저장 막대까지, 연습 무대는 7rem, 막대 안 조작은 0 | FIXED | 2a3d1b0 |
| F-46 | 연습 시작(마이크 실패), 저장 실패, 세션 휴식, onboarding 2–6단계·권한 오류 | 전 뷰포트 / 3테마 | H1 | Low | (U6 코드 리뷰) 게이트 밖 상태에 다음 조작 표식이 없다 | 마이크 복구·저장 재시도·"바로 다음으로"·단계별 "다음"/측정에 표식. 쉬는 날 홈과 할 수 있는 연습이 없는 단계는 누를 조작이 없어 표식 없음 | FIXED | 2a3d1b0 |
| F-47 | stage, stage-10 | 전 뷰포트 / 3테마 | H2 H7 | Low | (U6 코드 리뷰) "n개로 세션 시작"이 고르기 전에도 앰버라 주 조작이 둘로 보이고, "여러 개 골라 세션으로"는 스크롤만 하고 포커스는 그대로, "바로 하기" 링크 둘이 같은 이름 | 고르기 전 보조 모양, 목록으로 포커스 이동, 링크마다 연습 이름 `aria-describedby` | FIXED | 2a3d1b0 |
| F-48 | progress | iphone / 3테마 | H9 | Low | (U6 코드 리뷰) 히트맵 이름 칸이 56 px라 "F-small"·"A7sus4"가 첫 칸으로 넘친다 | 이름 칸 80 px | FIXED | 2a3d1b0 |
| F-49 | home, stage, stage-10 | 전 뷰포트 / 3테마 | H5 | Low | (U6 코드 리뷰) 체크리스트가 모르는 스케일 id 하나로 화면 전체 오류(`scaleById` throw) | 이름을 못 찾으면 id 그대로 | FIXED | 2a3d1b0 |
| F-50 | settings | 전 뷰포트 / 3테마 | H3 | Low | (U6 코드 리뷰) 감도 셀렉트의 이름이 "감도" + 도움말 문장 전체(도움말이 label 안) | `Field` 도움말을 label 밖으로, `aria-describedby` | FIXED | 2a3d1b0 |
| F-51 | diagnostics | 전 뷰포트 / 3테마 | H2 | Low | (U6 코드 리뷰) h1 다음 첫 소제목이 h3(환경 안내) | 진단에서는 h2(`EnvironmentGuide level`) | FIXED | 2a3d1b0 |
| F-52 | session(블록 전환, 다음이 E1) | iphone / 3테마 | H1 | Low | (U6 코드 리뷰) 다이어그램 160 px 때문에 "바로 시작"이 첫 화면 끝(약 840 px)에 걸린다 | 휴대폰 다이어그램 112 px | FIXED | 2a3d1b0 |
| F-53 | session(휴식), 코드 일관성 | 전 뷰포트 / 3테마 | H3 | Low | (U6 코드 리뷰) 휴식 남은 초가 핵심 숫자가 아님(블록 전환 카운트다운은 핵심 숫자), 시퀀스 "시작" 문자열 중복, D-093 선택자 문구 불일치 | 휴식 초 16vh `data-core-number`, 중복 문자열 제거, D-093 고침 | FIXED | 2a3d1b0 |
| F-54 | practice 전부(준비·진행), session(실행 중) | 전 뷰포트 / 3테마 | H1 H7 | Medium | (U6 UI 리뷰) "나가기"가 준비 상태부터 비활성이고 이유는 `title` 툴팁뿐(터치에서 안 보임). 나갈 길은 아래 "중단"뿐(iPad 가로 E17-ready는 첫 화면 밖) | 실행 중 "나가기"는 Esc와 같은 "그만할까요?"를 연다(`useExitGuard`), 회귀 E2E | FIXED | 2a3d1b0 |
| F-55 | practice-E2·E3·E12, E4·E7 | 전 뷰포트 / 3테마 | H2 H3 H5 | Medium | (U6 UI 리뷰) 시간 연습의 시작 전 모양이 제각각: E1은 2:00, E2는 "0 체인지"만, E3는 작은 "도착 0 · 깨끗 0", E12·E4·E7은 큰 숫자 없이 빈 오른쪽 단 | 시작 전에는 계획 길이를 큰 숫자로(`BigTimer plannedMs`) | FIXED | 2a3d1b0 |
| F-56 | 연습 결과 전부 | 전 뷰포트 / 3테마 | H4 H2 | Medium | (U6 UI 리뷰) 결과 값이 20 px로 작은 카드에 있고 "자동 0회"의 뜻이 없다 | 결과 머리줄 30–36 px 공통, E2 뜻 한 줄 + "센 횟수 → 고친 횟수" | FIXED | 2a3d1b0 |
| F-57 | practice-Q3·Q4 | 전 뷰포트 / 3테마 | H7 | Medium | (U6 UI 리뷰) 키 안내가 "답은 1/2/3 키로도"인데 답이 4·6개 | 답 수에 맞춘 안내(3개를 넘으면 "앞의 세 답은 1/2/3 키로도") | FIXED | 2a3d1b0 |
| F-58 | practice-Q1 | 전 뷰포트 / 3테마 | H6 | Medium | (U6 UI 리뷰) 물어보는 점이 색으로만 구별된다 | 점에 테(모양 단서) + 문구 "테두리를 두른 점" | FIXED | 2a3d1b0 |
| F-59 | tuner | 전 뷰포트 / 3테마 | H6 H10 | Medium | (U6 UI 리뷰) 맞음 범위 띠가 막대와 1.04–1.21:1이라 거의 안 보인다 | 띠 양 끝에 2 px ok 경계선(≥ 3:1) | FIXED | 2a3d1b0 |
| F-60 | home, session, practice-E9·E11·E5, practice-Q4, routine-edit | iphone 중심 / 3테마 | H9 | Medium | (U6 UI 리뷰) 줄바꿈이 한 단위를 가른다: "D D / D D · 60 BPM", 새 줄이 "· 60 BPM"으로 시작, "(아래 음 → / 위 음)", "쌍· / 코드" | `Phrases`(" · " 사이에서만 줄바꿈, 구분점은 줄 끝), 줄바꿈 없는 공백, "쌍, 코드, 템포" | FIXED | 2a3d1b0 |
| F-61 | practice-E1 | 전 뷰포트 / 3테마 | H9 H4 | Low | (U6 UI 리뷰) 줄 상태 칸이 "치지 않는 / 줄"로 갈리고 라벨이 14 px | "안 침", 16 px | FIXED | 2a3d1b0 |
| F-62 | 연습 화면 꼬리 키 안내 | 전 뷰포트 / 3테마 | H3 | Low | (U6 UI 리뷰) 꼬리 키 목록이 화면마다 같다(쓰지 않는 키 포함) | WONTFIX(Low): 키 표는 v1.1 §12.3의 전역 바인딩이고 어떤 명령을 쓰는지는 runner가 화면에 알리지 않는다. 화면별 키는 notes(퀴즈 키 안내, E1 옵션 키)에 따로 있다 | WONTFIX | — |
| F-63 | session, onboarding(진행 막대) | 전 뷰포트 / light 중심 | H10 | Low | (U6 UI 리뷰) 현재 칸(accent 50 %)과 남은 칸 대비 1.9:1(light) | 현재 칸 = 꽉 찬 accent + 두 배 높이 | FIXED | 2a3d1b0 |
| F-64 | session(after-run·자가 평가), 연습 결과, 그림 없는 연습 무대 | ipad-landscape, macbook / 3테마 | H3 H6 | Low | (U6 UI 리뷰) 가운데 한 단이라 헤더와 왼쪽 끝이 둘이고, "기록하지 않았어요" 카드에 아이콘이 없다 | 한 단을 헤더 왼쪽 끝에, info 아이콘 | FIXED | 2a3d1b0 |
| F-65 | session(자가 평가) | 전 뷰포트 / 3테마 | H9 | Low | (U6 UI 리뷰) "의학적 조언이 아닙니다."만 다른 말투 | WONTFIX(Low): v1.1 SPEC의 안전 문구가 이 문장을 그대로 요구한다(동작 SPEC 고정) | WONTFIX | — |
| F-66 | routine-edit | 전 뷰포트 / contrast 중심 | H3 H7 | Low | (U6 UI 리뷰) 저장 막대 구분선이 카드보다 넓고, 고대비에서 "빼기"가 "+30"과 같은 상자로 보인다 | 막대를 카드 폭으로, "빼기" 빨간 글자 | FIXED | 2a3d1b0 |
| F-67 | tuner | 전 뷰포트 / 3테마 | H5 | Low | (U6 UI 리뷰) 켜기 전 96 px 줄표가 막대처럼 보이고 레벨 미터에 이름이 없다 | 작은 muted 줄표, "입력 레벨" 라벨 | FIXED | 2a3d1b0 |
| F-68 | session, practice-E17-ready, metronome | 전 뷰포트 / 3테마 | H2 H3 H10 | Low | (U6 UI 리뷰) 세션 헤더에 "튜닝"이 두 번, E17 시작만 아이콘, 메트로놈 빈 박 점 1.2:1. iPhone sticky 막대가 글줄을 자른다 | 블록 이름이 항목 이름과 같으면 숨김, 아이콘 제거, 빈 점에 필드 경계 테두리. sticky 막대가 스크롤하는 내용 위에 붙는 것은 막대의 본성이라 그대로 | FIXED | 2a3d1b0 |
| F-69 | settings | iphone / 3테마 | H9 | Low | (U6 전체 재검토, `2a3d1b0` 그림) 키·페달 표의 "페달 학습" 버튼이 좁은 칸에서 "페달 / 학습" 두 줄이 된다. 한 줄로 고정하자 고대비에서 "Enter · PageDown"이 버튼 테두리에 붙었다(재검토 2회차) | 버튼 글자 한 줄, 기본 키 칸은 `Phrases`(" · " 사이 줄바꿈)와 오른쪽 여백 | FIXED | 5dbeadd |
| F-70 | practice-E9, stage, stage-10, 하는 법(stage-practice·E17-how-to·연습 화면) | iphone, ipad-portrait / 3테마 | H9 | Low | (U6 전체 재검토) 숫자와 단위가 줄에서 갈린다: "5 / BPM 올려요", "80 / BPM 졸업" | 사다리·진급 기준 문구의 숫자와 "BPM" 사이를 줄바꿈 없는 공백으로 | FIXED | fdc09b4 |
| F-71 | practice-S-perform, practice-E1, practice-E5, 연습 화면 꼬리 키 안내 | iphone / 3테마 | H9 | Low | (U6 전체 재검토) 키 목록이 키 하나를 가른다: "E / 이어폰/스피커" | 키 목록도 `Phrases`(" · " 사이에서만 줄바꿈) | FIXED | fdc09b4 |
| F-72 | routine-edit | 전 뷰포트 / contrast | H10 | Low | (U6 전체 재검토) 저장 막대 양 끝으로 아래 카드의 고대비 외곽선(1 px)이 비친다 | 막대를 양쪽 1 px 넓혀 가림 | FIXED | fdc09b4 |
| F-73 | practice-E2 | ipad-portrait, iphone / 3테마 | H1 H2 | Low | (U6 재검토, F-55 뒤) 시작 전에도 1:00을 큰 숫자로 보이면서 남은 시간·체인지 수 두 큰 숫자가 세로로 쌓여, iPad 세로에서 "준비되면 시작" 안내가 아래 막대에 반쯤 가린다 | 폭이 되면 시간과 체인지 수를 한 줄에(iPad 세로). iPhone은 폭이 모자라 그대로 쌓이고, 가려지는 안내는 막대의 "시작" 버튼과 같은 내용이다 | FIXED | 5dbeadd |
