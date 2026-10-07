# PROGRESS — guitar-hero v1 goal

> goal 실행자가 **매 턴 시작 시 읽고, 턴 끝에 갱신**한다. 컨텍스트가 압축된 뒤에는 이 파일과 SPEC.md만으로 이어갈 수 있어야 한다.
> 상태 값: TODO / DOING / DONE / BLOCKED(AC-G1·G2·G3만, SPEC §14.4 조건). DONE에는 증거(테스트 파일·테스트 이름·명령·산출물 경로)를 적는다.

## 현재 상태

- 현재 마일스톤: M1 (도메인·콘텐츠·데이터) 시작 전 — M0 완료
- 마지막 갱신: 2026-10-07 (M0 커밋 직후)
- 누적 턴(대략): 1
- 턴 상한: **1000** (사용자 지시, D-011). §16.1 축소는 턴 800 이후에만.
- 다음 할 일:
  1. M1: `src/domain/`(strings, theory, voicing: expectedNotes/mutedStrings/anchors/partialCollisionMap) + 시드 25 보이싱 zod 검증·tonal 테스트
  2. M1: 커리큘럼 0–11·진급 규칙 데이터·연습곡 8곡·코칭 규칙, 루틴 생성기·진급 엔진·복습 큐·안전 규칙 테스트
  3. M1: Dexie 스키마·repo·export/import 왕복·rebuildDerived (fake-indexeddb)
- 막힌 점: 없음

## 마일스톤

| M | 이름 | 상태 | 커밋 | 비고 |
|---|---|---|---|---|
| M0 | 부트스트랩·스파이크 | DONE | (M0 커밋) | 스파이크 3종 통과(D-014, D-015) |
| M1 | 도메인·콘텐츠·데이터 | TODO | | |
| M2 | DSP 코어·합성기·벤치마크 | TODO | | |
| M3 | 실녹음 벤치마크 | TODO | | |
| M4 | 오디오 엔진·캘리브레이션 | TODO | | |
| M5 | 연습 플러그인 | TODO | | |
| M6 | 커리큘럼·루틴·진도 | TODO | | |
| M7 | PWA·반응형·접근성·배포 준비 | TODO | | |
| M8 | 하드닝·최종 검증 | TODO | | |

## Acceptance Criteria

| AC | 요약 | 상태 | 증거 |
|---|---|---|---|
| AC-P1 | 브랜치·커밋·main 불변·push 없음·clean | TODO | |
| AC-P2 | `npm ci && npm run verify` exit 0 | DOING | M0: `npm run verify` exit 0, RESULT: PASS (NOT_YET: bench:dsp, bench:guitarset) — `tools/verify.ts`, `tools/verify.test.ts` |
| AC-P3 | 라이선스 검사 통과 | DONE | `npm run licenses` (`tools/licenses.ts`): 78 prod packages 표 출력, 전부 허용. `tools/licenses.test.ts` (GPL/LGPL/AGPL/BlueOak 거부). svguitar 제거(D-013) |
| AC-P4 | 무결성 테스트 통과 | TODO | |
| AC-P5 | TS strict·noExplicitAny·린트 경고 0 | DOING | `tsconfig.base.json`(strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes), `biome.json` noExplicitAny=error, `lint` = `biome check --error-on-warnings` — 최종 확인은 M8 |
| AC-P6 | SPEC.md·thresholds.json SHA-256 일치 | TODO | |
| AC-D1 | 시드 보이싱 25개 검증 | TODO | |
| AC-D2 | partial 충돌 맵·커버리지 리포트 | TODO | |
| AC-D3 | 커리큘럼 데이터·진급 규칙 데이터화·연습곡 8곡 | TODO | |
| AC-D4 | anchors() 테스트 | TODO | |
| AC-D5 | 코칭 힌트 규칙 테스트 | TODO | |
| AC-A1 | 캡처 constraint·진단·장치 오류 처리 | TODO | |
| AC-A2 | 메트로놈 스케줄러 | TODO | |
| AC-A3 | 시계 차이 타이머·Wake Lock | TODO | |
| AC-A4 | 온보딩/캘리브레이션 마법사·E2E-01 | TODO | |
| AC-A5 | AudioWorklet 번들·무할당 | TODO | |
| AC-S1 | Mode A 합성 지표 | TODO | |
| AC-S2 | Mode B 합성 지표 | TODO | |
| AC-S3 | Mode C 합성 지표 | TODO | |
| AC-S4 | Mode D 합성 지표 | TODO | |
| AC-S5 | 튜너 지표 | TODO | |
| AC-S6 | RTT 지표 | TODO | |
| AC-S7 | 성능 지표 | TODO | |
| AC-S8 | 커버리지·매트릭스·표본 수 | TODO | |
| AC-G1 | GuitarSet 파이프라인 | TODO | |
| AC-G2 | GuitarSet 하드 지표 | TODO | |
| AC-G3 | GuitarSet 소프트 지표 보고·분석 | TODO | |
| AC-X1 | 플러그인 레지스트리·오디오 없는 러너 | TODO | |
| AC-X2 | E1 코드 정밀 체크·E2E-02/03/04 | TODO | |
| AC-X3 | E2 1분 코드 체인지·E2E-05 | TODO | |
| AC-X4 | E4 앵커·공중 체인지 | TODO | |
| AC-X5 | E5 스트러밍 사다리·E2E-06 | TODO | |
| AC-X6 | E6·E7·E8 | TODO | |
| AC-X7 | Q1–Q4 | TODO | |
| AC-X8 | S 연습곡 | TODO | |
| AC-X9 | 졸업 시험 | TODO | |
| AC-X10 | 마이크 거부 대체 흐름·E2E-12/13 | TODO | |
| AC-R1 | 루틴 생성 규칙 테스트 | TODO | |
| AC-R2 | 진급 엔진 테스트 | TODO | |
| AC-R3 | 복습 큐·주간 스트릭 | TODO | |
| AC-R4 | 안전 규칙 | TODO | |
| AC-R5 | 홈·세션 러너·커리큘럼·진도·E2E-07 | TODO | |
| AC-U1 | 화면 전부·i18n | TODO | |
| AC-U2 | 키·페달·첫 스트럼 자동 시작 | TODO | |
| AC-U3 | 반응형 E2E-10 | TODO | |
| AC-U4 | 접근성 E2E-11 | TODO | |
| AC-U5 | 판정 문구 규칙 | TODO | |
| AC-U6 | 테마·왼손잡이 | TODO | |
| AC-T1 | Dexie·append-only·rebuildDerived | TODO | |
| AC-T2 | export/import 왕복 | TODO | |
| AC-T3 | persist·백업 리마인더 | TODO | |
| AC-T4 | 녹음 키트·bench:real | TODO | |
| AC-W1 | PWA 오프라인 E2E-09 | TODO | |
| AC-W2 | 헤더·vercel.json·VITE_BASE·dev:https | TODO | |
| AC-W3 | DEPLOY.md | TODO | |
| AC-F1 | README·ARCHITECTURE·DSP·BENCHMARK·BACKLOG | TODO | |
| AC-F2 | MANUAL_VALIDATION.md | TODO | |
| AC-F3 | FINAL_REPORT.md | TODO | |

## 턴 로그 (최근 것이 위, 한 줄씩)

- 턴 1: M0 완료 — 브랜치·docs 커밋, 스캐폴드(Vite 8/React 19/TS 7/Tailwind 4), Biome/Vitest/Playwright(4 프로젝트), verify·licenses·무결성(일부) 도구, 스파이크 3종 통과. 사용자 지시로 턴 상한 1000(D-011).
