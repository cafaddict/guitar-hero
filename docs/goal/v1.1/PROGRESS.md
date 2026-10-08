# PROGRESS — guitar-hero v1.1 goal

> goal 실행자가 **매 턴 시작 시 읽고, 턴 끝에 갱신**한다. 컨텍스트가 압축된 뒤에는 이 파일과 `docs/goal/v1.1/SPEC.md`만으로 이어갈 수 있어야 한다.
> 상태 값: TODO / DOING / DONE / BLOCKED(AC-SQ2만, GuitarSet 마커가 있을 때). AC-P10은 그 경우 `DONE (G1–G3 BLOCKED)`. 마일스톤 표의 "(부분)" AC는 DOING + 범위 증거로 마일스톤 종료(SPEC §16). DONE에는 증거(테스트 파일·테스트 이름·명령·산출물 경로)를 적는다.
> v1 진행 기록은 `docs/goal/PROGRESS.md`(보존, 수정하지 않음).

## 현재 상태

- 현재 마일스톤: **M10 (Stage 0–7 리서치 복원)** 시작 전 — M9 커밋 완료
- 시작 지점: `feat/practice-app-v1.1`, v1.1 키트 커밋 `012fb70`(부모 `5e94332`)
- 마일스톤 끝 리뷰 서브에이전트: M10·M12·M15
- 마지막 갱신: 2026-10-09 (M9 verify PASS: test 1293/1293, bench:dsp all thresholds met, bench:guitarset hard 4/4 soft 2/2, e2e 38/38)
- 누적 턴(대략): 1
- 턴 상한: **1000**. §16.1 축소 조건은 턴 수가 아니라 "M13 커밋 이후, 같은 하위 항목 때문에 마일스톤 verify 3회 연속 실패"(SPEC §2.6).
- M9에서 미리 한 M10 일: K1·E16·E17(자가 보고 경로)·Q5 플러그인, 루틴 편집 화면 기본형, Stage 0–7 시간 템플릿(D-062).
- 다음 할 일(M10):
  1. 키 옵션(E1 M/E, E5 V, S ↑/↓·L·H)과 Attempt params 기록, E2E-22. E5 박 세기·발 박자 안내, 셈여림 모드(자가 평가), 보정 hit_rate 사다리. 곡 단계(학습·연주·숨김) 결과·자동 멈춤 집계, 블록 반복·끝 신호·전환 화면.
  2. E1 경향 요약, E7 안내 문구, 튜닝 방향 안내·건너뛰기(§9.3), 레벨 미터·확신도, 환경 안내, 루트음 강조, E6 코드 확인(Mode C 2지선다), Q3·Q4 카드.
  3. 시뮬레이션 learn 커버리지(§14.9-4) Stage 0–7 + withReviews 복습 지연 단언, E2E-15·20·22, 리뷰 서브에이전트.
- 막힌 점: 없음. 참고: `keys.spec.ts` "after a run Space…"가 무거운 E2E와 병렬일 때 한 번 실패(단독 3회 통과, M9 verify에서는 통과) — 다시 나오면 원인 수정.
- 메모: `dsp-worker.ts`의 `set` 작업 클래스 매핑이 `G-`로 시작하면 모두 'G'로 묶는다 → M12에서 `classOfVoicing`으로 바꿔 G-4f를 따로 둔다.

## 마일스톤

| M | 이름 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| M9 | 기반·결함 수정 | DONE | (이 커밋) | verify PASS |
| M10 | Stage 0–7 리서치 복원 | TODO | | 끝에 code-reviewer |
| M11 | DSP·합성·벤치 확장 | TODO | | |
| M12 | 초급 2 콘텐츠·새 연습 | TODO | | 끝에 code-reviewer |
| M13 | 초급 2 진행 통합 | TODO | | |
| M14 | 화면 마감 | TODO | | |
| M15 | 하드닝·최종 검증 | TODO | | 끝에 code-reviewer |

## Acceptance Criteria (SPEC v1.1 §17)

| AC | 요약 | 상태 | 증거 |
|---|---|---|---|
| AC-P7 | `feat/practice-app-v1.1`에 키트 커밋 이후 M9–M15 커밋 존재, `main`은 `9e7eda6`, `feat/practice-app-v1`은 `5e94332` 그대로, 원격 push 없음(upstream 없음), 작업 트리 clean. | TODO | |
| AC-P8 | v1 `SPEC.md`·`thresholds.json`과 v1.1 `SPEC.md`·`thresholds.json`·`traceability.json`·`GAP_AUDIT.md`의 SHA-256이 goal 조건문의 값과 같다. | TODO | |
| AC-P9 | `npm ci && npm run verify` exit 0, §14.7 형식 요약표(v1.1 계약 기준). | TODO | |
| AC-P10 | v1 AC(P1–P6, D1–D5, A1–A5, S1–S8, G1–G3, X1–X10, R1–R5, U1–U6, T1–T4, W1–W3, F1–F3) 보존 | DOING | M9 verify PASS(v1 단위·E2E 38/38·bench:dsp·bench:guitarset 하드 4/4). v1 테스트 갱신은 D-063 목록뿐 |
| AC-TR1 | `traceability.json` 완전성 무결성 테스트 통과, FINAL_REPORT에 항목별 대조 결과(구현·제외·연기 수). | TODO | |
| AC-TR2 | 모든 learn 항목의 `practicedBy` 유효(무결성 8) + 커버리지 단언 Stage 0–11 통과. | TODO | |
| AC-TR3 | 진급 규칙 ↔ 루틴 대응과 도달 단언 통과, 교착 0. | TODO | |
| AC-TR4 | SPEC 요구 함수 프로덕션 호출 검사(무결성 9) 통과. | DOING | M9 목록 7개: `tests/integrity/production-calls.test.ts`(detectStagnation·suggestedGVoicing·nextStretchStartFret·saveRoutineTemplate·userRoutineTemplates·generateRoutine·evaluateStage). `verifySequence`는 M12 |
| AC-RT1 | 스테이지 시간 템플릿 합계·배치 테스트, Stage 8–11 30분과 분할, 레퍼토리 블록. | TODO | |
| AC-RT2 | 쌍 슬롯 배정과 7일 배정 보장, 순환 블록 3세션 보장, 처방 추가·만료(기술 항목을 몰아내지 않음). | DOING | Stage 0–7: `src/domain/simulate.test.ts` "every rotation entry appears…"·"required, unpassed pairs…"(Stage 0–7×improving, blank 0–1, pain), "plateau learner…"(처방 추가·② 배치·8세션 만료·순환 유지); `routine.test.ts` rule 3 두 개. 남음: E3 처방(M12), Stage 8–11(M13) |
| AC-RT3 | 복습 배정(같은 종류 블록, 밀림 방지, 7일 안 배정), 지식 카드 간격 반복. | TODO | |
| AC-RT4 | 블록 시간 반복·끝 신호·전환 화면. | TODO | |
| AC-RT5 | 파라미터 의미: progression 코드 진행, 사다리 현재 BPM, E7 시작 프렛, 통증 감량 실행 반영. | DOING | v1 연습: `simulate.test.ts` "parameters: progression mode…"(진행 코드 ≥2, 사다리 현재 BPM·−10 처방, E7 시작 프렛), "pain learner…"(E1·E2 실행 파라미터 절반); `session.test.ts` pain ≥5. 남음: Stage 9 tabHidden·Q3 20문항·레퍼토리(M13) |
| AC-PG1 | Stage 0–11 규칙 데이터와 새 규칙 종류 단위 테스트, Stage 7 → 8 진급, 초급 2 수료. | TODO | |
| AC-PG2 | 정체 감지 연결과 처방 표, 조건부 진급 3주, 2주/3주 구분 테스트. | DOING | `src/domain/sessionPrep.test.ts`(세션 시작 detectStagnation → 처방, 만료), `progression.test.ts` "stagnation (v1.1 §7.4)"·"conditional promotion (v1.1 §7.4)", `simulate.test.ts` plateau(22연습일 안 조건부 진급). 남음: PFC↔OMC E3 처방(M12) |
| AC-PG3 | G 보이싱 3단 전환 제안(`suggestedGVoicing` 연결), E7 시작 프렛 조정(`nextStretchStartFret` 연결). | DONE | `sessionPrep.test.ts` "AC-PG3: suggests the three-finger G…"(G-2f→G-3f Stage 6, G-3f→G-4f Stage 8), `simulate.test.ts` "G voicing: the switch…"(수락 후 E1 G-3f)·"E7 start fret…"(5,5,5,4,4,4,3…), `v11Records.test.ts` "E7 start fret from the records", 홈 추천 카드(HomeScreen `g-switch`), 무결성 9 호출 검사 |
| AC-CT1 | 보이싱 29개 검증, 스케일 3개 검증, 리프 4개와 TAB 렌더, 패턴 P6–P8과 스윙 그리드, Stage 8–11 쌍, 연습곡 18곡+ 스테이지 코드 제약과 블루스 형식. | TODO | |
| AC-NE1 | K1 자가 체크 카드와 루틴 배정 규칙. | DOING | (M9 선행) K1 플러그인 `src/exercises/k1/`, `k1/runner.test.ts`, 루틴 배정 규칙 `routine.test.ts` "Stage 0 (v1.1)…"(처음 3세션, 이후 "아직"만 3세션째) |
| AC-NE2 | E16 프렛 위치 비교, E2E-15. | DOING | (M9 선행) E16 플러그인 `src/exercises/e16/`, `e16/runner.test.ts`(Mode A 세 위치·자가 판정). 남음: E2E-15 |
| AC-NE3 | E3 정확 빠른 체인지, 통과·졸업·안내. | TODO | |
| AC-NE4 | E9 크로매틱, E10 스케일 사다리 1–5단계·사다리·암기, E12 새끼손가락, E2E-16. | TODO | |
| AC-NE5 | E11 해머온, 하루 상한, 레가토 베타 표시. | TODO | |
| AC-NE6 | E17 리프, Q5 TAB 퀴즈. | DOING | (M9 선행) E17 자가 보고 경로 `e17/runner.test.ts`, Q5 `quiz/questions.ts` tabQuestions·Q5View, TAB 렌더 `ui/Tab.tsx`. 남음: §10.10 판정(M12), Q5 테스트 보강 |
| AC-NE7 | Q3 범위 확장, Q4 종류 확장, E2E-21. | TODO | |
| AC-NE8 | S 곡 단계(학습·연주·숨김)·완주·암기·레퍼토리 정의. | TODO | |
| AC-NE9 | E5 v1.1 추가(P6–P8, 모드 사다리, 보정 hit_rate 기준, 박 세기·발 박자 안내, 시각 큐 숨김 키, 셈여림 모드, 팜뮤트 옵션), E6 Stage 1·사다리·코드 확인, E8 사다리 저장. | TODO | |
| AC-EX1 | E0·온보딩 튜닝 방향 안내와 건너뛰기, E1 경향 요약·모드 키, E7 안내 문구. | TODO | |
| AC-SQ1 | §14.8 sequence 지표 전부 통과(합성 test split). | TODO | |
| AC-SQ2 | GuitarSet solo 시퀀스 하드 지표 통과, 소프트 지표 보고(미달 시 개선 시도·원인 분석을 `docs/DSP.md`에). | TODO | |
| AC-SW1 | §14.8 swing 지표 통과. | TODO | |
| AC-BK1 | §14.8 backingBleed 지표 통과 + 반주 정책 + E2E-17. | TODO | |
| AC-BT1 | 베타 판정기 5종 구현, 베타 지표 보고(BENCHMARK.md 별도 절), 베타 계약(무결성 10), UI "참고(베타)" 라벨. | TODO | |
| AC-S9 | Stage 8–11 보이싱을 넣은 매트릭스에서 v1 Mode A·B·C 임계값 통과. | TODO | |
| AC-UX1 | 연습 옵션을 세션 러너 안에서 키로 조작, E2E-22. | TODO | |
| AC-UX2 | 연습 화면 레벨 미터(잡음 바닥선·최소 레벨선)와 확신도 표시. | TODO | |
| AC-UX3 | 환경 안내, 다이어그램 루트음 강조, 루틴 편집 화면(E2E-20). | TODO | |
| AC-UX4 | E2E-10·11에 새 화면 포함(4 뷰포트 가로 스크롤 0, 버튼 크기, axe serious/critical 0). | TODO | |
| AC-DT1 | Dexie v2 스키마와 마이그레이션, v1 내보내기 → v2 가져오기 테스트, 왕복 테스트. | DONE | `src/data/migrations.test.ts`: v1 DB → Dexie v2 제자리 업그레이드, v1 내보내기 → v2 가져오기(migration 1→2), v2 필드 왕복(deep-equal), `repo.test.ts` 왕복 |
| AC-W4 | 새 화면의 PWA 오프라인 동작과 CSP 위반 0(반주 재생 포함). | TODO | |
| AC-F4 | README(초급 2, 새 연습, 반주·이어폰, 30분 세션), `docs/ARCHITECTURE.md`(시퀀스·베타·시뮬레이션), `docs/DSP.md`, `docs/BENCHMARK.md`(새 영역·베타 절), `docs/BACKLOG.md`(v1.1 제외 항목), `docs/MANUAL_VALIDATION.md`(스케일·리프·해머온·반주 이어폰/스피커·Stage 8+ 실기기 항목 추가). | TODO | |
| AC-F5 | `docs/goal/v1.1/FINAL_REPORT.md` 작성. | TODO | |

## 턴 로그 (최근 것이 위, 한 줄씩)

- 턴 1 (2026-10-09): M9 구현 — 스키마 v2·마이그레이션, 커리큘럼 v1.1 데이터(learn→practicedBy, 순환 목록, 새 규칙), 시간 템플릿 루틴 생성기, 진급 엔진(새 규칙·2주 정체·3주 조건부·처방·G 3단), 세션 시작 처리, 시뮬레이션 하네스(Stage 0–7 도달 79일·교착 0), 무결성 7·8·9·11, K1·E16·E17·Q5 기본형, 루틴 편집, v1 테스트 갱신(D-063). verify PASS → M9 커밋.
