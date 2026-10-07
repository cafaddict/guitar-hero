# DSP — 판정기 설계와 최종 파라미터

> 대상: `src/dsp/` (순수 TypeScript, Node·브라우저 공용). 근거: SPEC §10, 리서치 02. 파라미터는 **dev split(시드 1000–1999)에서만** 튜닝했다.
> 벤치마크 결과는 `docs/BENCHMARK.md`(생성 파일), 실녹음(GuitarSet) 분석은 아래 "GuitarSet" 절(M3)에 적는다.
> detectorVersion: `src/dsp/version.ts` (현재 1.3.1 — M3에서 onset 재튜닝·Mode A 강건화). 알고리즘·파라미터가 바뀌면 올린다.

## 0. 공통

- 모든 파라미터는 ms/Hz로 정의하고 `sampleRate`로 변환한다(44.1 kHz와 48 kHz 모두 벤치마크 매트릭스에 포함).
- 판정은 항상 **onset 직전 잡음 또는 창 자체의 국소 바닥** 대비로 한다(절대 레벨 없음). 클리핑(|x| > 0.98)이면 판정하지 않고 RETRY(CLIPPING).
- 확신이 없으면 RETRY. FAIL은 확신 조건을 모두 만족할 때만 낸다.
- 엄격도(관대/보통/엄격)는 cents 허용폭과 뮤트·존재 임계값을 바꾼다. 벤치마크는 기본값(관대).

## 1. FFT·스펙트럼 (`fft.ts`, `spectrum.ts`, `window.ts`)

- radix-2 복소 FFT(사전 계산 twiddle·bit-reversal) + N/2 패킹 real FFT, 역변환 포함. naive DFT 대비 상대 오차 ≤ 1e-6(테스트).
- Hann 창, zero-pad ×2(기본), 진폭 정규화(사인파 진폭 A → 피크 ≈ A). `partialPeak`는 ±tol cents 안 최대 bin + log-magnitude 포물선 보간.

## 2. 피치 (`pitch.ts`)

- MPM(NSDF, FFT 자기상관). 기대 음을 알면 탐색 범위를 `[f0/1.5, f0·1.5]`로 제한(옥타브 오류 차단).
- **조화 회귀 보정**: `f_h/h = f0·√(1+B·h²) ≈ f0 + (f0·B/2)·h²`이므로 부분음 피크들을 가중 최소제곱으로 직선 맞춤한 절편이 f0다. 시간영역 주기성은 줄의 비조화성(B 최대 1.5e-4) 때문에 저음현에서 수~18 cents 치우치는데, 이 보정이 그것을 없앤다(튜너 median 0.07 cents, p95 1.65 cents — dev).

## 3. Onset (`onset.ts`)

| 파라미터 | 값 | 비고 |
|---|---|---|
| 프레임 | **85.3 ms**(4096 @48k) Hann | M3: 42.7 ms → 85.3 ms(GuitarSet dev 재현율, D-029) |
| hop | 5.33 ms(256 @48k), 비정수 hop 누적 | |
| γ | 100 | log(1+γ·|X|) |
| SuperFlux max-filter | 3 bin | |
| flux lag μ | **8 프레임(43 ms)** | M2 4 → M3 8 |
| 적응 임계값 | 직전 100 ms median × 1.5 + 2 | |
| broadband 조건 | ≥ 2 kHz 대역 에너지: 피크 후 4프레임 최대가 lag 이전 3프레임 최소보다 **+1 dB**, 고역 flux ≥ 0.5 | M2 +3 dB/1.0 → M3 dev 튜닝 |
| 저역 경로(부드러운 새 음) | broadband를 못 넘어도 1 kHz 미만 flux ≥ 3 그리고 ≥ 녹음 자체 최근 1 s 저역 flux median × 4 그리고 ≥ 직전 400 ms 저역 flux 최대 × 0.15 이면 후보(총 flux가 임계값 아래여도). 시작 250 ms 워밍업 동안은 막음 | 엄지 베이스·핑거스타일 음 |
| 모든 후보 | 1 kHz 미만 flux ≥ 1 | |
| 기대 선행 억제 | 60–180 ms 뒤에 4배 이상 강한 이벤트가 오면 앞의 약한 이벤트 제거(코드 바꾸는 왼손 잡음) | 결정 지연 180 ms |
| 최소 IOI / 스트럼 그룹 | 60 ms / 60 ms | |
| 클릭 마스킹 | 예약+RTT ±10 ms(+반 프레임)에서 1 kHz 미만 flux < 1.5 **그리고** 2–4 kHz 클릭 대역 flux 비중 ≥ 0.4면 버림 | 정박 스트럼은 저역 flux가 커서 유지 |

- 스트리밍 `OnsetPicker`(무할당: 고정 버퍼 삽입 정렬·사전 할당 후보 객체, worklet 공용)와 오프라인 `pickOnsets`가 **같은 코드**다. 판정 지연 = 4프레임(21 ms) look-ahead. minIoi 안의 더 강한 피크는 대기 중인 후보를 대체하고, minIoi가 지나면 확정한다.
- **시각 정밀화**(첫 줄 onset): 거친 피크 주변 [−40, +15] ms에서(M3: −60 → −40 ms, 실녹음에서 앞선 잡음으로 당겨지는 것을 줄임) 미세 log 스펙트럼 flux(10.7 ms 창, 1 ms hop, 5 ms lag)를 계산해, 기준선 + 0.3·(최대 − 기준선)을 처음 넘는 프레임의 끝 − 5 ms(dev 보정)를 onset으로 한다.
  - 처음에는 고역 미분 에너지 포락선 임계값을 썼으나, additive 합성(부드러운 attack)에서 미분된 잡음이 포락선을 지배해 40 ms까지 이르게 잡혔다. log flux는 정상 잡음·직전 코드 sustain에 둔감해서 교체했다(dev: |오차| median 0.8 ms, p95 ≈ 9–11 ms).

## 4. Mode A — 한 줄씩 (`modeA.ts`)

| 파라미터 | 값 |
|---|---|
| 피치 구간 | onset +30…+130 ms, 프레임 42.7 ms, hop 10.7 ms, MPM 제한 + 조화 회귀. 모호하면 +130…+330 ms에서 한 번 더(D-031) |
| clarity 최소 | 0.80 (M3, D-030) |
| 음 허용 | ±35 cents(관대) / 30 / 25 |
| 레벨 | 조화 대역 전력이 직전 동일 길이 대비 +7 dB 미만이면 WEAK(LOW_LEVEL) (M3, D-030) |
| 뮤트 | decay 비율 < 템플릿 × 0.25(관대), 템플릿 없으면 < 0.07 (합성 뮤트 p99 0.05, 실녹음 정상 음 최소 0.12 사이 — D-030) |

- **decay 비율** `RMS[+250..350]/RMS[+30..80]`은 광대역 RMS가 아니라 **목표 줄의 조화 대역(h ≤ 8) 전력에서 onset 직전 같은 길이의 전력을 뺀 값**으로 계산한다. 앞서 튕긴 줄이 아직 울리는 실제 Chord Perfect 흐름과 잡음에서도 뮤트 판정이 흔들리지 않게 하기 위해서다.
- WRONG_NOTE: |cents − 100·k| ≤ 허용폭(k ≠ 0)이면 k 반음. ±12 근처나 반음 사이 값은 RETRY(AMBIGUOUS/DETUNED).
- onset: 한 줄씩 흐름은 `selectTakeEvent`(첫 onset)를 쓰고, flux 검출이 없으면 `energyOnset`(직전 150 ms 25-퍼센타일 대비 +12 dB, 30 ms 유지) 폴백(D-031).
- x 줄 확인 옵션(`verifySilentString`): 음정이 잡히면 UNEXPECTED, 뮤트/무음이면 OK.

## 5. Mode B — 스트럼(베타) (`modeB.ts`, `leakage.ts`)

SPEC §10.6 골격(창 +40 ms·170.7 ms, 잡음 = 직전 0.5 s bin별 median, 독립 partial의 가중 harmonic 증거, 3상태)을 유지하면서 dev split에서 다음을 바꿨다(D-024).

0. **실제 피크만 증거**: 기대 위치에서 가장 가까운 국소 최대의 보간 주파수가 ±30 cents 밖이면 그 partial은 없다(이웃 피크 스커트를 증거로 쓰지 않음). 잘못된 프렛 PASS 0.10 → 0.0025(dev).
1. **누설 인지 바닥**: 화음 안에서는 강한 이웃 partial의 Hann 사이드로브(2.5 bin에서 −31 dB)가 bin별 잡음보다 수십 dB 높다. 증거 = 피크 ÷ (잡음 + c·Σ_j A_j·W((f−f_j)/Δ) + 국소 바닥). A_j는 기대 partial(줄별 k ≤ 16, 6 kHz 이하)의 측정 크기, W는 Hann 커널, c = 2(줄 판정)/1.5(기대 밖 음). 국소 바닥 = ±1/3 옥타브에서 기대 partial·탐침 주변을 뺀 bin의 30-퍼센타일(반향된 피크 잡음).
2. **해상 불가 partial 제외**: 다른 기대 partial과 0.02–2 분석 bin 거리면 증거로 쓰지 않는다.
3. **뮤트 = 시간 모양**: 같은 길이(100 ms)의 초기 창 [+30, +130]과 후기 창 [+130, +230]에서 그 줄 독립 partial의 평균 로그 크기 변화(decay)와 후기 창에서 스트럼 전체 대비 상대 레벨(relLate)을 본다.
   - OK: 주 창 증거 ≥ 12 dB(T_PRESENT) 그리고 decay ≥ −5 dB
   - MUTED: (decay ≤ −6 dB 그리고 relLate ≤ −16 dB) 또는 decay ≤ −10 dB, 그리고 스트럼 기준 레벨 ≥ T_ABSENT + 15 dB
   - 그 밖: 불확실(RETRY)
   - 근거(dev, 줄 단위): 뮤트 줄 decay p50 −12.5 dB, 울리는 줄 decay p02 −4.3 dB. 규칙의 뮤트 검출 0.90(SNR ≥ 25), 울리는 줄 오판 0.8%.
4. **x 줄 울림**: 증강 보이싱(x 줄을 개방현으로)에 §6.3 규칙을 적용해 그 줄이 verifiable일 때만 확인한다. 확인에는 독립 partial과(이웃 기대 partial이 ±35 cents 안에 없으면) 기본음 h=1도 쓴다. 주 창 증거 ≥ 14 dB 그리고 후기 창 ≥ 8 dB(지속)이면 UNEXPECTED.
5. **기대 밖 음 탐색**: 전 음역 탐색은 화음 고역에서 오탐이 많아, 줄마다 ±1·±2 반음(잘못된 프렛 가설)만 탐색한다. 증거 ≥ 28 dB 그리고 후기 ≥ 8 dB. dev 분포: 깨끗한 스트럼 최대 25.7 dB, 잘못된 프렛 median 32.7 dB.
- 커버리지: 판정기는 §6.3 기본 규칙(`MODE_B_COLLISION_PARAMS = DEFAULT_COLLISION_PARAMS`)을 그대로 쓴다(Stage 0–7 verifiable 비율 0.457).
- 성능: 노이즈 프레임 hop을 창/2로 해 median 9.4 ms(목표 ≤ 20 ms).

## 6. Mode C — 닫힌 집합 분류 (`modeC.ts`)

- 증거 = partial 피크 ÷ **국소 스펙트럼 포락선**(±1/3 옥타브 30-퍼센타일, 탐침 ±2 bin 제외) — "peakiness". 연속 스트럼에서는 onset 직전 구간에 이전 코드가 울리므로 직전 스펙트럼을 잡음으로 쓰면 같은 코드 재스트럼의 증거가 0에 가까워져 무작위 판정이 됐다(D-025).
- 쌍 판정: 두 후보 중 **각자에게만 있는 partial**(±35 cents)의 가중 평균(h^−0.5) 증거 차이 = margin. |margin| < 3 dB면 보류. 이긴 후보가 **개방현 6줄 방해자**보다 2 dB 이상 앞서지 못하면 보류(체인지 중 개방현 스트럼).
- 집합 분류(Q2): 후보마다 다른 모든 클래스와의 쌍 margin 중 최솟값(최악의 경우)이 점수. G 두 보이싱은 같은 클래스.
- 카운터: 시작 코드 상태에서, 다른 코드의 확신 판정이 직전 카운트 후 ≥ 300 ms일 때만 +1. 같은 코드·보류·개방현은 무시(과소 집계 쪽).
- dev: |오차| ≤ 1 비율 0.975, 평균 절대 오차 0.07, 과대 집계 0, 집합 top-1 0.996.

## 7. Mode D — 타이밍 (`timing.ts`)

- 사용자 타이밍 오차 = 스트럼 시각 − (예약 그리드 + RTT). 거리순 탐욕 일대일 매칭, 창 60–80 BPM ±60 ms / 80–100 ±50 / 100+ ±40.
- 쉼 슬롯 매칭 = 추가, 어디에도 안 맞은 스트럼도 추가로 센다. 개인 선행(최근 ≥ 3회 평균 offset)을 빼고 다시 판정한 hit_rate를 함께 낸다. E8용 `ioi_cv`.

## 8. 튜너 (`tuner.ts`)

- 프레임 85.3 ms(4096 @48k), hop 10.7 ms. 크로매틱 모드는 MPM 키-최대 규칙(k = 0.9) 후 **f/2 홀수 배음 검사**(홀수 반배음이 짝수보다 −12 dB 이내면 f/2로 내림), 그다음 조화 회귀 보정. 줄 모드는 제한 범위.
- attack이 걸친 프레임(앞 1/4 RMS가 뒤 1/4보다 6 dB 넘게 작음)은 읽지 않는다(편향된 읽기 방지, D-028).
- 안정 = 연속 5 프레임이 median ±3 cents 이내. dev(녹음 처음부터 연속 실행): |오차| median 0.09 / p95 1.85 cents, 안정까지 p95 125 ms, 옥타브 오류 0.

## 9. RTT (`rtt.ts`)

- 3 ms Hann 창 잡음 버스트 8개를 불규칙 간격(0, 0.41, 0.73, 1.19, 1.47, 1.96, 2.27, 2.81 s)으로 예약. 정합 필터(FFT 상관) 후 **모든 버스트의 상관 에너지 합이 최대인 지연**을 고른다(불규칙 간격이라 유일). 버스트별 ±4 ms 정밀화 → median이 RTT, MAD ≤ 2 ms면 성공.
- 상관 피크/잡음 비 ≥ 8인 버스트가 6개 미만이면 **NO_SIGNAL 실패**를 보고한다(가짜 값 없음). dev: |오차| p95 0.03 ms, 무신호 실패 보고 100%.
- tap 보정: 클릭 8개에 맞춘 스트럼 onset의 median 오프셋.

## 10. 캡처 코어 (`capture.ts`)

- worklet이 128 샘플 블록마다 호출: 4 s 링 버퍼, ~30 Hz 레벨(RMS·peak·클리핑), 스트리밍 onset. 생성 후 `processBlock`에서 할당 없음(사전 할당 객체 재사용). Node 마이크로벤치 블록 평균 0.018 ms(목표 ≤ 0.3 ms).

## 11. 합성기 (`synth/`)

- 확장 Karplus–Strong: 2점 평균 손실 필터(선형 위상 0.5 샘플) + **f0에서 위상 지연이 정확히 맞도록 이분법으로 구한 1차 allpass 계수** → 명목 f0 대비 ≤ 0.5 cent(테스트). excitation = 시드 잡음, one-pole 밝기, pick-position comb.
- Additive: `f_h = h·f0·√(1+B·h²)`, h^−α·|sin(π h β)|·몸통 공진, partial별 decay(고차일수록 빠름), 1 ms attack, 4 ms 피크 잡음.
- 뮤트: 정규화 **후** 120 ms 안에 −30 dB 지수 포락선(뮤트 줄도 시작 크기는 같다).
- 채널: 작은 방(지수 감쇠 잡음 IR, RT60 0.3 s, DRR +3 dB) → 마이크 HPF(2차 0/100/150 Hz) → 선택 LPF 8 kHz → 잡음(white/pink, 같은 HPF/LPF를 거친 잡음; SNR은 필터 후 onset+0..500 ms 신호 RMS 기준이라 판정기가 보는 SNR과 같다). 클릭 누출은 방을 거쳐 예약+RTT에 −20 dB(스트럼 0–500 ms RMS 대비).

## 12. 벤치마크 하네스 (`tools/bench/`)

- `cases.ts`: split별 시드(`thresholds.splitSeeds`)에서 결정적으로 케이스를 만든다. 집합 값은 균등 반복 후 셔플, 연속 구간은 n등분 층화(양 끝 10 % 보장), B는 로그 균등. 불가능 조합(개방현 −1/−2, verifiable 줄 없는 보이싱 등)은 제외하고 수를 보고한다.
- `evaluate.ts`: 앱과 같은 순서로 onset 검출 → `selectTakeEvent`(첫 onset; +400 ms 안 두 번째 onset이면 RETRY) → [onset−500, onset+400] ms 구간 판정(A/B/집합), 전체 테이크(C/D). 튜너는 녹음 처음부터 연속 실행. 정답 onset은 판정에 쓰지 않는다. 판정기에는 신호·보이싱·calibration δ(잔차 ±3 cents)·RTT(±2 ms)·예약 클릭만 준다.
- `metrics.ts`: SPEC §14.3 지표 정의를 그대로 코드로 옮겼다. 임계값은 `thresholds.json` 객체에서 읽는다(무결성 테스트가 deep-equal 확인).
- `run.ts`: worker_threads 병렬(최대 11), test split은 임계값 미달 시 exit 1, `bench-results/dsp-<split>.json`과 `docs/BENCHMARK.md`(test) 생성. dev 전용 옵션 `--modes`, `--fraction`, `--dump`.
- `debug/`: dev split 분석용 탐침 스크립트(특징 분포, 파라미터 스윕). test split은 쓰지 않는다.


## 13. GuitarSet 실녹음 벤치마크와 개선 기록 (M3)

### 13.1 파이프라인 (`tools/guitarset/`)

- `download.ts`: Zenodo record 3371780 API에서 파일 목록·MD5를 받아 `audio_mono-mic.zip`·`annotation.zip`만 **curl**로 받는다(Node fetch는 이 환경에서 IPv6 우선 연결이 타임아웃). 파일별 최대 3회, 지수 백오프. 모두 실패하면 이 스크립트만 `data/guitarset/.download-blocked`에 시도별 URL·HTTP 상태/curl exit code·시각을 JSON으로 쓴다. 체크섬 확인 후 의존성 없는 `unzip.ts`(stored/deflate, ZIP64, 경로 탈출 차단)로 푼다.
- `jams.ts`: JAMS의 두 직렬화(관측 목록·병렬 배열)를 모두 읽는다. data_source 0–5 = 6번→1번 줄(우리 idx와 같음).
  - 스트럼 이벤트(comp): 60 ms 안 노트 ≥ 3, 울린 줄 ≥ 4, 모든 노트 ≥ 250 ms, 이후 300 ms 다른 onset 없음.
  - 단음 이벤트(solo): ≥ 400 ms, 다음 onset까지 ≥ 400 ms, **앞 150 ms 동안 울리는 다른 노트 없음**(보수적 해석), 노트 구간 pitch contour가 ±35 cents 안.
  - onset F1 정답: comp 클립 모든 note onset을 60 ms로 묶은 그룹. Funk comp 제외.
  - 판정 대상 이벤트는 분석 구간 [onset−500 ms, onset+400 ms]가 녹음 안에 있어야 한다(클립 시작 0.02–0.05 s의 음은 onset도 잡음 기준도 없음 — D-029).
  - calibration 흉내: 클립의 줄별 주석 MIDI가 가장 가까운 반음에서 벗어난 cents의 median을 δ로 준다(튜너 calibration이 재는 양).
- `evaluate.ts`: 클립 전체에서 onset 검출 → 주석 시각 ±60 ms 안 검출 이벤트로 Mode A(기대 음 / ±1 반음 교란)·Mode B(실제 보이싱 / verifiable 줄 +1·+2 프렛 교란)·Mode C(같은 클립의 pitch-class 집합이 다른 스트럼과 2지선다, 시드 균등)를 판정, comp 클립 onset F1(±50 ms 일대일).
- `bench.ts`: worker 병렬. **dev 플레이어(00–03)만 튜닝에 쓰고**(`--dev-only`는 test 클립을 아예 평가하지 않는다), 판정은 test 플레이어(04–05). 하드 미달이면 exit 1, 마커가 있으면 exit 3(BLOCKED).

### 13.2 onset 재튜닝 (dev: 합성 dev split + GuitarSet dev 플레이어)

M2 설정의 GuitarSet dev 지표: Mode A OK 0.884(n=43), **onset F1 0.734**(P 0.761, R 0.709). 원인 분석(`tools/guitarset/debug/*.ts`):

1. **정밀화가 실녹음에서 너무 이르게 당김**: 검출−주석 median −12.8 ms, 그리고 ±50 ms 밖으로 밀린 검출이 ~140개(거친 시각은 median −1.8 ms). 정밀화 lookback 60 → 40 ms로 F1 0.734 → 0.784(합성 dev도 0.979 → 0.988).
2. **놓친 정답의 대부분이 단음·2음 그룹**(미검출률 51 %·28 %): 보사노바 엄지 베이스처럼 고역 attack이 거의 없는 부드러운 음(총 flux 2–8, 고역 flux 0.2–2). broadband 조건과 총 flux 임계값에서 탈락.
3. **오검출의 ~40 %는 주석된 음이 울리지 않는 순간**, 많은 수가 다음 스트럼 50–200 ms 전: 코드 바꾸는 왼손 소리·뮤트 "칙" 등 주석에 없는 실제 소리. 음색 지표(새 partial 수, spectral flatness)로는 분리되지 않았다(오검출도 대부분 음정이 있음).

시도와 결과(F1은 GuitarSet dev 절반, 합성 지속음 가짜 onset은 합성 dev):

| 시도 | GuitarSet F1 | 합성 지속음 가짜 | 채택 |
|---|---|---|---|
| 프레임 85 ms, lag 8 (+느슨한 임계값) | 0.841 | 36 % | 프레임·lag만 |
| 저역 flux로 broadband 우회(절대값) | 0.80–0.83 | 4–19 % | 상대 조건과 함께 |
| 문턱 per-bin 상승(thresholded flux) | 0.67–0.74 | 0 % | ✗ |
| MAD 적응 임계값 | 0.74–0.80 | 19–27 % | ✗ |
| 저역 에너지 상승·상승 bin 군집·음정 확인 | 0.78–0.82 | 0–2 % | ✗(부드러운 음도 같이 막힘) |
| γ 300/1000 | 0.83–0.84 | 0–1 % | ✗(정밀도 하락) |
| 사후 spectral flatness 게이트 | ≤ 0.848 | — | ✗ |
| **기대 선행 억제(60–180 ms 뒤 4배 강한 이벤트)** | +0.01 | 0 % | ✓ |
| **저역 경로 = 절대(≥3) + 녹음 자체 1 s median×4 + 직전 400 ms 최대×0.15 + 워밍업** | 0.852(dev 전체) | 0 % | ✓ |

- 합성 지속음의 가짜 onset 두 종류(녹음 시작 직후 이력 없는 구간, 큰 스트럼 직후 100–330 ms의 맥놀이)는 각각 워밍업과 "직전 400 ms 최대×0.15" 조건으로 없앴다. 두 조건은 단일 테이크 판정(Mode B·집합 분류)의 MULTIPLE_ONSETS RETRY도 되돌렸다.
- 최종(1.1.0) dev: 합성 F1 0.991, 지속음 가짜 0 %, |오차| p95 8.8 ms / GuitarSet dev onset F1 0.852, Mode A OK 0.974(n=39), Mode C 0.980, Mode B 소프트 FAIL 0.038 / 교란 OK 0.
- test(04–05, 1.3.1): Mode A OK 1.000(17/17), ±1 반음 오수용 0, Mode C 0.980, onset F1 0.877 — 하드 4/4. 실행 이력은 D-029–D-031.
- 남은 한계: GuitarSet onset F1은 dev에서 임계값 0.85에 여유가 작다(test는 0.877). 오검출 상당수가 주석 없는 실제 소리라 정밀도 ~0.87에서 막히고, 재현율은 아주 약한 음(레가토·해머온·고스트 노트로 보이는 flux 0.2–3)에서 막힌다.

### 13.3 소프트 지표 (Mode B 실녹음)

- dev: 실제 보이싱 FAIL 0.038(≤ 0.10), verifiable 줄 +1/+2 프렛 교란 시 그 줄 OK 0.000(≤ 0.15). **test(04–05, detector 1.3.1): FAIL 0.064, 교란 OK 0.003** — 둘 다 통과(`docs/BENCHMARK.md` GuitarSet 절).
- 해석: 실녹음에서도 FAIL은 드물고(대부분 RETRY 쪽), 교란 줄은 "실제 국소 피크만 증거" 규칙(D-028) 덕분에 OK가 되지 않는다. 미달 시 이 절에 원인 분석을 추가한다.
