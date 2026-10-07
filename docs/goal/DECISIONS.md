# DECISIONS — guitar-hero v1

> 형식: `D-NNN 제목` / 날짜 / 맥락 / 선택지 / 결정 / 결과·트레이드오프. goal 실행자는 SPEC에 없는 선택이나 SPEC과 다른 선택을 할 때 여기에 추가한다(사용자에게 질문하지 않는다).
> D-001–D-010은 goal 시작 전 사용자와 합의한 결정이다(2026-10-07 세션).

## D-001 대상 사용자와 악기
- 맥락: 사용자 답변 — 완전 초보, 어쿠스틱(통기타), MacBook·iPad·iPhone 모두 사용.
- 결정: Stage 0부터 시작하는 초급 커리큘럼. 스틸 줄 어쿠스틱 + 기기 내장 마이크를 1차 대상으로 DSP를 튜닝한다.

## D-002 자체 커리큘럼 (특정 강사 콘텐츠 연동 없음)
- 선택지: 강의 영상 임베드 / 링크만 / 자체 커리큘럼.
- 결정: 자체 커리큘럼. 연습 방법(1분 코드 체인지, 한 줄씩 확인 등)은 일반 명칭과 앱 자체 문구로 구현하고, 연습곡은 앱이 창작한 코드 진행으로 한다.

## D-003 데이터: local-first + JSON 내보내기
- 선택지: 로컬 + JSON / 클라우드 동기화(Supabase 등) / 단일 기기.
- 결정: 기기별 IndexedDB(Dexie) + JSON 내보내기/가져오기. 동기화는 v2. 데이터 모델은 append-only Attempt라 나중에 동기화를 붙이기 쉽다.

## D-004 배포: 정적 호스팅 준비만
- 결정: goal은 빌드 산출물, `_headers`/`vercel.json`, `docs/DEPLOY.md`, `dev:https`까지만 만든다. 실제 배포는 사용자가 goal 이후 직접 한다.

## D-005 Git: 별도 브랜치에서 마일스톤마다 커밋
- 결정: `feat/practice-app-v1`에서 마일스톤 종료 시 커밋. push·main 병합 금지. (사용자 전역 규칙 "자동 커밋 금지"의 예외로 사용자가 이 goal에 한해 승인)

## D-006 DSP 구현 언어: 순수 TypeScript
| 선택지 | 장점 | 단점 |
|---|---|---|
| TypeScript | Node 테스트와 브라우저가 같은 코드, 빌드 단순, GPL 회피 | 이론상 느림(실측상 충분) |
| C++ → WASM | 사용자에게 익숙, 성능 여유 | Emscripten 빌드 체인, worklet 로딩 번거로움 |
| Rust → WASM | 안전성 | 빌드 체인 추가 |
- 결정: v1은 TypeScript. 프로파일로 필요가 증명된 커널만 v2에서 WASM. (리서치 02 §6)

## D-007 판정 철학: 인식이 아니라 검증, 3상태 판정
- 결정: 앱은 목표 보이싱을 알고 있으므로 "무슨 코드인가"가 아니라 "기대한 음이 울렸나"를 검증한다. 판정은 PASS/FAIL/RETRY. 확신 없으면 RETRY. 스트럼 모드는 독립 partial이 있는 줄만 판정(베타), 확정 판정은 한 줄씩 모드. (리서치 02 §2.c–2.d)

## D-008 스택
- 결정: Vite 8 + React 19 + TS 7(strict) + Tailwind 4 + Dexie 4 + Zustand 5 + Zod 4 + svguitar + Recharts 3 + vite-plugin-pwa 1.3 + Vitest 5 + Playwright 1.63 + Biome 2. 이유: 병목은 오디오 파이프라인이라 UI 프레임워크 성능 차이가 결정적이지 않고, SvelteKit 3·Solid 2는 메이저 전환 직후/직전이라 위험. (리서치 03 §4.2)

## D-009 품질 계약 고정
- 결정: 테스트 임계값·매트릭스는 `docs/goal/thresholds.json`에 고정하고, goal 조건문에 SPEC.md·thresholds.json의 SHA-256을 넣어 실행 중 변경을 막는다. 합성 벤치마크는 dev/test split을 분리한다.

## D-010 UI 언어
- 결정: 한국어 UI(존댓말), 문자열은 `src/i18n/ko.ts`에 모은다(나중에 다국어 확장 가능). 음악 용어는 관용 표기.

---
<!-- goal 실행자 결정은 D-011부터 아래에 추가 -->
