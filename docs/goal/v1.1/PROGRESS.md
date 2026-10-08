# PROGRESS — guitar-hero v1.1 goal

> goal 실행자가 **매 턴 시작 시 읽고, 턴 끝에 갱신**한다. 컨텍스트가 압축된 뒤에는 이 파일과 `docs/goal/v1.1/SPEC.md`만으로 이어갈 수 있어야 한다.
> 상태 값: TODO / DOING / DONE / BLOCKED(AC-SQ2만, GuitarSet 마커가 있을 때). AC-P10은 그 경우 `DONE (G1–G3 BLOCKED)`. 마일스톤 표의 "(부분)" AC는 DOING + 범위 증거로 마일스톤 종료(SPEC §16). DONE에는 증거(테스트 파일·테스트 이름·명령·산출물 경로)를 적는다.
> v1 진행 기록은 `docs/goal/PROGRESS.md`(보존, 수정하지 않음).

## 현재 상태

- 현재 마일스톤: **M9 (기반·결함 수정)** 시작 전
- 시작 지점: `feat/practice-app-v1.1`, v1.1 키트 커밋(부모 `5e94332`)
- 마일스톤 끝 리뷰 서브에이전트: M10·M12·M15
- 마지막 갱신: 2026-10-08 (키트 작성)
- 누적 턴(대략): 0
- 턴 상한: **1000**. §16.1 축소 조건은 턴 수가 아니라 "M13 커밋 이후, 같은 하위 항목 때문에 마일스톤 verify 3회 연속 실패"(SPEC §2.6).
- 다음 할 일:
  1. SPEC v1.1 §0–§3과 `GAP_AUDIT.md`를 읽는다.
  2. M9: 무결성 11(v1 계약 ⊆ v1.1 계약)을 만든다. 계약 경로 전환은 M11(§14.0).
  3. M9: 시뮬레이션 하네스(§14.9)를 Stage 0–7에 대해 만들고 A군 결함을 고친다. v1 테스트 갱신 목록을 DECISIONS에 남긴다(§2.4).
- 막힌 점: 없음

## 마일스톤

| M | 이름 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| M9 | 기반·결함 수정 | TODO | | |
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
| AC-P10 | v1 AC(P1–P6, D1–D5, A1–A5, S1–S8, G1–G3, X1–X10, R1–R5, U1–U6, T1–T4, W1–W3, F1–F3) 보존 | TODO | |
| AC-TR1 | `traceability.json` 완전성 무결성 테스트 통과, FINAL_REPORT에 항목별 대조 결과(구현·제외·연기 수). | TODO | |
| AC-TR2 | 모든 learn 항목의 `practicedBy` 유효(무결성 8) + 커버리지 단언 Stage 0–11 통과. | TODO | |
| AC-TR3 | 진급 규칙 ↔ 루틴 대응과 도달 단언 통과, 교착 0. | TODO | |
| AC-TR4 | SPEC 요구 함수 프로덕션 호출 검사(무결성 9) 통과. | TODO | |
| AC-RT1 | 스테이지 시간 템플릿 합계·배치 테스트, Stage 8–11 30분과 분할, 레퍼토리 블록. | TODO | |
| AC-RT2 | 쌍 슬롯 배정과 7일 배정 보장, 순환 블록 3세션 보장, 처방 추가·만료(기술 항목을 몰아내지 않음). | TODO | |
| AC-RT3 | 복습 배정(같은 종류 블록, 밀림 방지, 7일 안 배정), 지식 카드 간격 반복. | TODO | |
| AC-RT4 | 블록 시간 반복·끝 신호·전환 화면. | TODO | |
| AC-RT5 | 파라미터 의미: progression 코드 진행, 사다리 현재 BPM, E7 시작 프렛, 통증 감량 실행 반영. | TODO | |
| AC-PG1 | Stage 0–11 규칙 데이터와 새 규칙 종류 단위 테스트, Stage 7 → 8 진급, 초급 2 수료. | TODO | |
| AC-PG2 | 정체 감지 연결과 처방 표, 조건부 진급 3주, 2주/3주 구분 테스트. | TODO | |
| AC-PG3 | G 보이싱 3단 전환 제안(`suggestedGVoicing` 연결), E7 시작 프렛 조정(`nextStretchStartFret` 연결). | TODO | |
| AC-CT1 | 보이싱 29개 검증, 스케일 3개 검증, 리프 4개와 TAB 렌더, 패턴 P6–P8과 스윙 그리드, Stage 8–11 쌍, 연습곡 18곡+ 스테이지 코드 제약과 블루스 형식. | TODO | |
| AC-NE1 | K1 자가 체크 카드와 루틴 배정 규칙. | TODO | |
| AC-NE2 | E16 프렛 위치 비교, E2E-15. | TODO | |
| AC-NE3 | E3 정확 빠른 체인지, 통과·졸업·안내. | TODO | |
| AC-NE4 | E9 크로매틱, E10 스케일 사다리 1–5단계·사다리·암기, E12 새끼손가락, E2E-16. | TODO | |
| AC-NE5 | E11 해머온, 하루 상한, 레가토 베타 표시. | TODO | |
| AC-NE6 | E17 리프, Q5 TAB 퀴즈. | TODO | |
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
| AC-DT1 | Dexie v2 스키마와 마이그레이션, v1 내보내기 → v2 가져오기 테스트, 왕복 테스트. | TODO | |
| AC-W4 | 새 화면의 PWA 오프라인 동작과 CSP 위반 0(반주 재생 포함). | TODO | |
| AC-F4 | README(초급 2, 새 연습, 반주·이어폰, 30분 세션), `docs/ARCHITECTURE.md`(시퀀스·베타·시뮬레이션), `docs/DSP.md`, `docs/BENCHMARK.md`(새 영역·베타 절), `docs/BACKLOG.md`(v1.1 제외 항목), `docs/MANUAL_VALIDATION.md`(스케일·리프·해머온·반주 이어폰/스피커·Stage 8+ 실기기 항목 추가). | TODO | |
| AC-F5 | `docs/goal/v1.1/FINAL_REPORT.md` 작성. | TODO | |

## 턴 로그 (최근 것이 위, 한 줄씩)

- (아직 없음)
