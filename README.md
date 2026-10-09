# guitar-hero — 기타 연습 (v1)

완전 초보 성인이 어쿠스틱 기타를 체계적으로 배우도록 **매일의 연습 루틴을 짜 주고, 마이크로 듣고 정직하게
피드백하며, 진도를 숫자로 보여 주는** local-first 웹앱(PWA)입니다. MacBook, iPad, iPhone 브라우저에서 동작하고
기록은 모두 내 기기 안에만 남습니다. 명세: v1 [`docs/goal/SPEC.md`](docs/goal/SPEC.md), v1.1(개발 중)
[`docs/goal/v1.1/SPEC.md`](docs/goal/v1.1/SPEC.md).

## 무엇을 할 수 있나

- **처음 설정**: 마이크 권한·장치, 주변 소음(마이크 환경 안내), 6줄 튜닝(±15 cents, "조이세요/푸세요"와 줄감개 방향 그림, 다른 튜너로 맞췄으면 건너뛰기), 줄별 소리 템플릿, 지연(RTT: 스피커 루프백, 안 되면 클릭에 맞춰 치기)
- **오늘의 루틴 → 세션 러너**: 단계별 시간 템플릿(20분, 단계 8부터 30분)을 채웁니다 — 튜닝, (단계 7부터) 레퍼토리, 코드, 1분 체인지 두 칸(새 코드 쌍 / 진급에 필요한데 오래 안 한 쌍), 리듬·기술 순환(목록의 각 항목이 3세션마다 한 번 이상), 코드 기억 퀴즈, 연습곡(항상 마지막). 복습은 같은 종류 블록 안에서, 템포는 사다리의 현재 BPM에서 이어 갑니다. 30분마다 휴식 알림, 끝나면 통증·난이도 자가 평가
- **루틴 편집**(홈 → 루틴 편집): 항목 빼기·더하기·순서·블록 시간을 바꿔 그 단계 템플릿으로 저장하면 다음 세션부터 그 구성으로 짭니다(쌍·코드·템포는 앱이 그날 맞게 채움). "기본으로 되돌리기"로 지웁니다. 설정의 세션 길이는 기본이 "단계 기본값"이고, 분을 직접 고치면 그 길이로 맞춥니다.
- **추천 카드**: 2주째 제자리인 항목의 처방(1분 체인지 → 앵커·공중 드릴, 한 줄씩 확인, 일주일 −10 BPM), 세 손가락 G로 바꾸기 제안, 조건부 진급
- **연습**(v1.1에서 늘어나는 중): K1 자가 체크 카드(자세·피크·박 세기·발 박자), E16 프렛 위치 비교, 단음 시퀀스 연습 — E9 크로매틱, E10 스케일 사다리(1–5단계, 4사이클 연속 무실수로 단계 졸업, 틀린 음은 위치와 반음 차이로 표시, 반주 선택), E11 해머온(하루 상한), E12 새끼손가락, E17 단음 리프(TAB) — 은 마이크가 사이클마다 판정하고 마이크가 없으면 자가 보고, E3 정밀 빠른 체인지(1분 체인지 정체 처방), Q3 6·5번 줄 음이름(이름 → 튕기기), Q4 인터벌·진행 귀 훈련, Q5 TAB 읽기 퀴즈, S 연주 단계 반주(play-along: 이어폰이면 그대로 판정, 스피커면 반주 소리를 가려 박 1을 판정하고 코드 확인은 "참고"로만 보여 줌), 그리고 v1의 E0 튜닝, E1 코드 정밀 체크(한 줄씩 판정·스트럼 베타·수동·귀 먼저), E2 1분 코드 체인지(첫 스트럼으로 자동 시작, 자동/탭/직접 카운트), E4 앵커·공중 체인지, E5 스트러밍 패턴 사다리, E6 박 1 체인지, E7 손가락 스트레칭, E8 한 줄 교대 피킹, Q1 다이어그램 퀴즈, Q2 코드 기억 퀴즈, Q3 개방현 음이름, Q4 메이저/마이너 귀 훈련, S 연습곡(학습/연주 모드)
- **커리큘럼** Stage 0–7(8–11은 미리보기), 데이터로 정의된 진급 기준과 진행 상황, **초급 1 졸업 시험**(항목별 통과 기록)
- **진도**: 주간 연습 시간, 쌍별 1분 체인지 추이, 코드×줄 깨끗 비율, 패턴별 최고 BPM, 타이밍 평균·흔들림, 세션 기록, 간격 반복 복습 큐
- **도구**: 튜너(줄 모드·크로매틱), 메트로놈(탭 템포, 박자·세분, 카운트인, 음소거 마디, 시각 전용, 템포 사다리), 코드 라이브러리(다이어그램·기대 음·들어 보기)
- **마이크가 없거나 거부돼도** 모든 연습을 수동·자가 판정으로 진행할 수 있습니다. 마이크 판정은 보조 수단이고, 내 귀가 먼저예요.

## 요구 사항

- 사용: 최신 Chrome / Safari(iPad·iPhone은 Safari), **HTTPS 또는 localhost**(마이크·화면 꺼짐 방지·오프라인에 필요)
- 개발: Node.js ≥ 22.12(확인: 24.3), npm 11. E2E는 `npx playwright install chromium webkit`
- 실녹음 벤치마크(`bench:guitarset`)는 처음 실행 때 GuitarSet(Zenodo, 약 700 MB 내려받기, 풀면 약 2 GB)을 `data/`로 내려받습니다.

## 스크립트

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (localhost) |
| `npm run dev:https` | 같은 Wi-Fi의 iPad/iPhone 접속용 HTTPS 개발 서버(자체 서명 인증서) |
| `npm run build` / `npm run preview` | 정적 빌드(`dist/`) / 프리뷰 |
| `npm run typecheck` · `lint` · `test` | 타입체크 · Biome · Vitest |
| `npm run bench:dsp:dev` · `bench:dsp` | 합성 벤치마크(dev split: 튜닝용 / test split: 판정). 계약 파일은 `docs/goal/v1.1/thresholds.json`(v1 계약 포함). 베타 판정기 값은 별도 표로 보고만 하고 종료 코드에 영향이 없다 |
| `npm run bench:guitarset` | GuitarSet 실녹음 벤치마크(dev 00–03 / test 04–05, comp 스트럼·solo 단음·solo 단음 시퀀스) |
| `npm run bench:real` | 녹음 키트로 만든 내 기기 fixture 벤치마크(`tests/fixtures/real/<기기>/`, 없으면 "no fixtures") |
| `npm run fixtures:generate` | E2E용 WAV fixture 결정적 생성 |
| `npm run test:e2e` | Playwright E2E(가짜 마이크·실제 getUserMedia·iPad/iPhone WebKit) |
| `npm run licenses` | 프로덕션 의존성 라이선스 검사(GPL/AGPL 금지) |
| `npm run verify` | 전체 품질 게이트 + 요약표(`bench-results/verify-summary.txt`). 게이트의 벤치 보고서는 `bench-results/BENCHMARK.md`에 쓰고, `docs/BENCHMARK.md`는 `bench:dsp`·`bench:guitarset`를 직접 실행할 때 갱신된다 |
| `npm run check:audio-dev` | dev 서버에서 AudioWorklet·DSP worker·메트로놈 worker 로드 점검 |
| `npx tsx tools/icons/generate.ts` | 앱 아이콘(SVG·PNG) 다시 만들기 |

## iPad에서 쓰는 법

1. Safari로 배포 주소(또는 `npm run dev:https`의 Network 주소)를 엽니다.
2. 공유 → **홈 화면에 추가**. 홈 화면의 "기타" 앱으로 열면 전체 화면이고, 한 번 연 뒤에는 오프라인에서도 열립니다.
3. 처음 설정에서 마이크를 허용하고, 기기를 기타에서 30–60 cm 떨어진 곳에 둡니다(블루투스 이어폰 마이크 대신 내장 마이크).
4. 손이 기타 위에 있을 때는 키보드나 블루투스 페이지 터너 페달로 조작합니다: Space·PageDown(→) 시작, 끝나면 Space 다시 하기(블록 시간이 남은 마디·문항 연습은 "이어서 한 번 더", 사다리 다음 템포)·PageDown(→)·Enter 다음 항목, PageUp(←) 이전 항목, ↑↓ 보정, 1/2/3 수동 판정, Esc 중단(한 번 더 눌러 확인). 연습 옵션 키: E1 M 모드 바꾸기·E 귀 먼저, E5 V 시각 큐 숨기기, 연습곡 ↑↓ 템포·L 구간 반복·H 악보 숨김·B 반주 켜기(연주 단계)·E 이어폰/스피커, 단음 연습(스케일·크로매틱·해머온·리프 등) H TAB 숨김. 페달 버튼은 설정 > 키·페달에서 원하는 동작에 연결할 수 있습니다.

자세한 배포·설치 절차: [`docs/DEPLOY.md`](docs/DEPLOY.md). 실기기 검증 순서: [`docs/MANUAL_VALIDATION.md`](docs/MANUAL_VALIDATION.md).

## 데이터와 백업

- 모든 기록은 브라우저 IndexedDB(연습 기록·설정·캘리브레이션)와 OPFS(녹음 키트 오디오)에 저장되고, 서버로 보내지 않습니다.
- 시작할 때 브라우저에 저장소 보호(`storage.persist`)를 요청합니다. 그래도 Safari는 데이터를 지울 수 있으니 **설정 → 백업 → 내보내기**(JSON 파일)를 가끔 하세요. 마지막 백업 후 7일이 지나면 홈에 알림이 뜹니다.
- 가져오기는 미리보기(테이블별 건수) 후 **합치기**(같은 기록은 건너뜀) 또는 **바꾸기**(2단계 확인)입니다. 연습 기록(Attempt)은 추가만 되고 수정·삭제되지 않으며, 지표·스킬·복습 큐는 기록에서 언제든 다시 계산됩니다.

## 아키텍처 요약

```
UI(React) ─ 연습 플러그인 러너·세션 러너·진급 ─ AudioEngine ─┬─ AudioWorklet(캡처·onset)
                                                            └─ DSP Worker(판정) ─ src/dsp(순수)
데이터: Dexie(IndexedDB) · 콘텐츠·규칙: src/content(시드+zod) · 음악 이론·규칙: src/domain(순수)
```

- 판정기(Mode A 한 줄씩, Mode B 스트럼 베타, Mode C 코드 분류, Mode D 타이밍, 단음 시퀀스 검증, 반주 누출 마스킹, 튜너, RTT)는 의존성 없는 TypeScript 순수 함수이고, 합성 벤치마크(dev/test split)와 공개 실녹음 데이터셋(GuitarSet)으로 임계값을 검증합니다. 버징·스트럼 방향·해머온·팜뮤트·셈여림은 정답 데이터가 없어 "참고(베타)"로만 재고 보고합니다.
- 연습 종류는 플러그인(params/result 스키마 + 러너 + 화면)이라 코어 수정 없이 추가할 수 있습니다.

자세히: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · DSP 파라미터와 근거: [`docs/DSP.md`](docs/DSP.md) · 측정 결과: [`docs/BENCHMARK.md`](docs/BENCHMARK.md) · v2 계획: [`docs/BACKLOG.md`](docs/BACKLOG.md) · 결정 기록: [`docs/goal/DECISIONS.md`](docs/goal/DECISIONS.md)
