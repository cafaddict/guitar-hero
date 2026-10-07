# DSP — 판정기 설계와 최종 파라미터

> 대상: `src/dsp/` (순수 TypeScript, Node·브라우저 공용). 근거: SPEC §10, 리서치 02. 파라미터는 **dev split(시드 1000–1999)에서만** 튜닝했다.
> 벤치마크 결과는 `docs/BENCHMARK.md`(생성 파일), 실녹음(GuitarSet) 분석은 아래 "GuitarSet" 절(M3)에 적는다.
> detectorVersion: `src/dsp/version.ts` (현재 1.0.0). 알고리즘·파라미터가 바뀌면 올린다.

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
| 프레임 | 42.7 ms(2048 @48k) Hann | |
| hop | 5.33 ms(256 @48k), 비정수 hop 누적 | |
| γ | 100 | log(1+γ·|X|) |
| SuperFlux max-filter | 3 bin | |
| flux lag μ | **4 프레임(21 ms)** | 초기 2 → dev 튜닝 |
| 적응 임계값 | 직전 100 ms median × 1.5 + 2 | |
| broadband 조건 | ≥ 2 kHz 대역 에너지: 피크 후 4프레임 최대가 lag 이전 3프레임 최소보다 **+3 dB**, 고역 flux ≥ 1 | 초기 +6 dB/1프레임 → dev 튜닝(D-026, D-028) |
| 최소 IOI / 스트럼 그룹 | 60 ms / 60 ms | |
| 클릭 마스킹 | 예약+RTT ±10 ms(+반 프레임)에서 1 kHz 미만 flux < 1.5 **그리고** 2–4 kHz 클릭 대역 flux 비중 ≥ 0.4면 버림 | 정박 스트럼은 저역 flux가 커서 유지 |

- 스트리밍 `OnsetPicker`(무할당: 고정 버퍼 삽입 정렬·사전 할당 후보 객체, worklet 공용)와 오프라인 `pickOnsets`가 **같은 코드**다. 판정 지연 = 4프레임(21 ms) look-ahead. minIoi 안의 더 강한 피크는 대기 중인 후보를 대체하고, minIoi가 지나면 확정한다.
- **시각 정밀화**(첫 줄 onset): 거친 피크 주변 [−60, +15] ms에서 미세 log 스펙트럼 flux(10.7 ms 창, 1 ms hop, 5 ms lag)를 계산해, 기준선 + 0.3·(최대 − 기준선)을 처음 넘는 프레임의 끝 − 5 ms(dev 보정)를 onset으로 한다.
  - 처음에는 고역 미분 에너지 포락선 임계값을 썼으나, additive 합성(부드러운 attack)에서 미분된 잡음이 포락선을 지배해 40 ms까지 이르게 잡혔다. log flux는 정상 잡음·직전 코드 sustain에 둔감해서 교체했다(dev: |오차| median 0.8 ms, p95 ≈ 9–11 ms).

## 4. Mode A — 한 줄씩 (`modeA.ts`)

| 파라미터 | 값 |
|---|---|
| 피치 구간 | onset +30…+130 ms, 프레임 42.7 ms, hop 10.7 ms, MPM 제한 + 조화 회귀 |
| clarity 최소 | 0.85 |
| 음 허용 | ±35 cents(관대) / 30 / 25 |
| 레벨 | 조화 대역 전력이 직전 동일 길이 대비 +10 dB 미만이면 WEAK(LOW_LEVEL) |
| 뮤트 | decay 비율 < 템플릿 × 0.25(관대), 템플릿 없으면 < 0.10 |

- **decay 비율** `RMS[+250..350]/RMS[+30..80]`은 광대역 RMS가 아니라 **목표 줄의 조화 대역(h ≤ 8) 전력에서 onset 직전 같은 길이의 전력을 뺀 값**으로 계산한다. 앞서 튕긴 줄이 아직 울리는 실제 Chord Perfect 흐름과 잡음에서도 뮤트 판정이 흔들리지 않게 하기 위해서다.
- WRONG_NOTE: |cents − 100·k| ≤ 허용폭(k ≠ 0)이면 k 반음. ±12 근처나 반음 사이 값은 RETRY(AMBIGUOUS/DETUNED).
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

## 13. GuitarSet (M3에서 작성)
