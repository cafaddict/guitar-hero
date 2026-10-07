# 02. 브라우저 마이크 기반 기타 코드 검증 및 타이밍 감지: 기술 타당성 조사

- 작성일: 2026-10-07
- 대상: guitar-hero (브라우저 기반 기타 연습 웹앱)
- 범위: 마이크로 "코드를 정확히 잡았는가(모든 의도한 줄이 깨끗하게 울리는가, 뮤트/버징/잘못된 줄이 없는가)"를 검증하고, 타이밍 연습(60초 코드 체인지 카운트, 메트로놈 대비 스트럼 타이밍)을 측정하는 기능
- 표기: 출처로 확인하지 못한 주장은 "(미확인)"으로 표시. 라이브러리 버전과 마지막 배포일은 2026-10-07에 `npm view`로 확인한 값.

---

## 0. 핵심 요약 (TL;DR)

1. **"열린 문제(이 소리가 무슨 코드인가?)"가 아니라 "검증 문제(이 코드가 맞게 울렸는가?)"로 접근하면 정확도가 크게 올라간다.** 앱은 목표 voicing(예: open C = `x32010`)을 알고 있으므로, 줄마다 기대 MIDI 음과 그 harmonic 위치의 에너지만 확인하면 된다.
2. **가장 신뢰도 높은 v1 기능은 "줄 하나씩 튕기기" 모드(JustinGuitar "Chord Perfect"와 같은 방식)**다. 한 번에 한 음만 울리므로 monophonic pitch detection(YIN / McLeod MPM) + onset detection으로 줄 단위 판정이 거의 확정적으로 가능하다.
3. **한 번에 긁는(strum) 모드에서 줄 단위 판정은 본질적으로 모호하다.** 예: open C의 2번 줄 C4(261.63 Hz)는 5번 줄 C3의 2nd harmonic과 같은 주파수, 1번 줄 E4는 4번 줄 E3의 2nd harmonic과 겹친다. 그래서 strum 모드 v1은 "pitch-class 단위 + 확실히 판단 가능한 줄만" 판정하고, 애매하면 "잘 안 들렸어요, 다시 쳐 주세요" 같은 UNCERTAIN을 돌려주는 3-상태 판정이 맞다.
4. **코드 체인지 카운트(두 코드 사이 전환)는 두 후보 중 하나를 고르는 binary classification이라 chroma template matching으로도 매우 견고하다.** 스트럼 onset은 spectral flux로 frame 단위 약 5 ms 해상도로 잡을 수 있고, 메트로놈 대비 오차는 latency 보정 후 대략 ±10–20 ms 수준이 현실적이다(미확인, 기기 의존).
5. **타이밍 보정에는 round-trip latency(RTT) 하나만 알면 된다**(유도는 §1.4). 스피커-마이크 loopback으로 측정하고, Bluetooth 헤드폰일 때는 "박자에 맞춰 치기" 보정으로 대체한다.
6. **ML 모델(Spotify basic-pitch 등)은 v2의 "second opinion"으로 쓴다.** basic-pitch는 파라미터 16,782개로 브라우저에서 돌릴 수 있지만 2초 window를 쓰고, 공식 TS 패키지는 2022년 이후 배포가 멈췄다(tfjs ^3.2.0 의존). 쓴다면 ONNX 모델 + `onnxruntime-web`(1.30.0, 2026-09-18 배포)이 낫다.
7. **DSP 코어는 순수 TypeScript로, AudioWorklet 안에서 돌린다.** 계산량이 작아서(초당 4096-point FFT 100회 수준) WASM이 필요 없다. 같은 코드를 Node(vitest)에서 WAV fixture로 그대로 테스트할 수 있다는 장점이 더 크다. WASM(C++/Rust)은 v2의 NNLS 분해 등에서 profiling 결과로 필요가 확인될 때만 쓴다.

---

## 1. 브라우저 오디오 캡처

### 1.1 getUserMedia constraints (음악용)

브라우저 기본값은 Chrome/Firefox/Safari 모두 `echoCancellation`, `noiseSuppression`, `autoGainControl` = **true**다. 이 처리는 음성에 맞춰져 있다. noise suppression은 기타의 지속음(sustain)을 "잡음"으로 보고 깎아내고, AGC는 음량 envelope를 왜곡해 onset과 decay 분석(뮤트 판정의 핵심)을 망친다. 그러므로 반드시 끈다 ([addpipe](https://blog.addpipe.com/getusermedia-audio-constraints.md)).

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
    // sampleRate는 강제하지 않는다 (아래 Firefox/Safari 이슈 참고)
    // latency: 0  // Chrome/Firefox 지원. 낮은 latency 힌트
    deviceId: preferredBuiltInMicId ? { exact: preferredBuiltInMicId } : undefined,
  },
});
const settings = stream.getAudioTracks()[0].getSettings();
// settings.echoCancellation 등을 반드시 읽어서 실제로 꺼졌는지 확인하고 로그로 남긴다
```

- **반드시 `track.getSettings()`로 실제 적용 값을 확인**한다. constraint는 "요청"일 뿐이고 브라우저가 무시할 수 있다. 실제 값을 진단 로그에 남겨 두면 정확도 문제를 분석할 때 쓸 수 있다.
- `latency` constraint / `MediaTrackSettings.latency`: Chrome 59+, Firefox 50+에서 지원하고 Safari는 지원하지 않는다. Baseline 기능이 아니다 ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/latency)).
- `voiceIsolation` constraint는 음성 전용이라 **켜면 안 된다**. 주로 Safari 계열에서만 지원한다 ([vdo.ninja docs](https://docs.vdo.ninja/advanced-settings/audio-parameters/and-voiceisolation)).
- `AudioContext`는 `new AudioContext({ latencyHint: 0 })` 또는 `'interactive'`로 만들고 **sampleRate는 지정하지 않는다.** 장치 기본값(대개 48 kHz, 일부 Safari는 44.1 kHz)을 쓰고, DSP는 `ctx.sampleRate`로 파라미터를 동적으로 계산한다.
  - Firefox는 과거에 "Connecting AudioNodes from AudioContexts with different sample-rate is currently not supported" 에러를 냈다. 최신 WPT(`mediastreamaudiosourcenode-from-context-with-different-rate`)는 resampling 성공을 검증하는 테스트로 바뀌었지만, 현재 Firefox 동작은 확인하지 못했다(미확인, 출처 간 상충). sampleRate를 지정하지 않으면 이 문제 자체를 피할 수 있다.

### 1.2 AudioWorklet vs AnalyserNode

| 항목 | AnalyserNode | AudioWorklet |
|---|---|---|
| 샘플 연속성 | `getFloatTimeDomainData`가 "지금" 버퍼를 복사. main thread의 rAF 주기(약 16 ms)에 의존하므로 프레임이 빠지거나 중복된다 | 128-sample render quantum마다 빠짐없이 호출된다 |
| 타임스탬프 | 정확한 샘플 시각을 알 수 없다 | `currentFrame` / `currentTime`으로 샘플 단위 시각을 안다 |
| 스레드 | main thread (React 렌더링과 경쟁) | 오디오 렌더 스레드 |
| 용도 | 튜너 UI, 레벨 미터 같은 시각화 | onset, timing, 검증 등 **측정 전부** |

- 128-sample 블록 처리 예산은 48 kHz 기준 약 2.67 ms다 ([cprimozic](https://cprimozic.net/blog/webaudio-audioworklet-optimization/), [Mozilla Hacks](https://hacks.mozilla.org/2020/05/high-performance-web-audio-with-audioworklet-in-firefox/)).
- 권장 구조: AudioWorklet은 **ring buffer 적재와 저비용 onset 함수(hop 단위)만** 처리한다. FFT 기반 검증(onset 후 150–300 ms window)은 `port.postMessage`(Transferable Float32Array)로 **Web Worker**에 넘긴다. `SharedArrayBuffer` ring buffer가 더 빠르지만 COOP/COEP 헤더가 필요해서 배포가 번거롭다. v1에서는 postMessage로 충분하다.

### 1.3 브라우저/기기별 이슈

- **보안 컨텍스트**: `getUserMedia`는 HTTPS 또는 localhost에서만 동작한다. iframe에 넣을 때는 `allow="microphone"`과 Permissions-Policy가 필요하다 ([MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/navigator/mediaDevices.getUserMedia)). `AudioContext.resume()`은 사용자 제스처(버튼 클릭) 안에서 호출해야 한다.
- **iOS Safari**
  - `echoCancellation:false`가 무시되던 WebKit bug 179411은 2019-11에 수정됐다(r252681). 다만 보고자는 수정 후에도 고역이 필터링된다고 남겼다 ([WebKit 179411](https://bugs.webkit.org/show_bug.cgi?id=179411)).
  - **WebKit 311451 (2026-04 보고, 2026-10-04 기준 NEW)**: iOS/iPadOS 26–27에서 마이크를 켜면 **재생 오디오**의 sample rate가 내려가고 mono로 바뀐다. echoCancellation 설정과 관계없이 발생하고 macOS에는 없다 ([WebKit 311451](https://bugs.webkit.org/show_bug.cgi?id=311451)). 메트로놈 클릭과 반주 음질에 영향을 준다. 클릭은 단순한 소리라 괜찮지만 반주 음악은 품질이 떨어진다.
  - 마이크 권한을 받는 순간 출력이 헤드폰에서 스피커로 바뀌는 라우팅 문제가 보고됐다. `navigator.audioSession.type = 'play-and-record'`(Audio Session API, Safari 16.4+)를 getUserMedia 전에 설정해 완화할 수 있다 ([MDN Audio Session API](https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API), [W3C](https://www.w3.org/TR/audio-session/)). 효과는 기기별로 검증해야 한다(미확인).
  - AudioContext가 보고하는 sampleRate(48k)와 실제 track 설정(44.1k)이 다르거나, 실측 sample rate가 이상하게 나온다는 보고가 있다 ([WebKit 244203](https://bugs.webkit.org/show_bug.cgi?id=244203)). **calibration 단계에서 알려진 주파수(튜너로 측정한 A 줄 등)로 sample-rate sanity check**를 하는 것이 안전하다.
  - `AudioContext.outputLatency`는 Safari 18.4부터, `baseLatency`는 Safari 14.1부터 지원한다 ([web.dev](https://web.dev/articles/audio-output-latency), [caniuse](https://caniuse.com/mdn-api_audiocontext_baselatency)).
- **Chrome (desktop/Android)**: 과거(Chrome 62)에는 noiseSuppression/AGC constraint를 지원하지 않았지만, 현재는 constraint로 끌 수 있다(정확한 지원 버전은 미확인). getSettings로 확인한다. `outputLatency`는 Chrome 102+에서 지원한다.
- **Firefox**: `outputLatency`/`baseLatency`는 70+에서 지원한다. 과거 측정에서 echo cancellation이 Chrome보다 훨씬 공격적이었다 ([addpipe](https://blog.addpipe.com/getusermedia-audio-constraints.md)). 반드시 끈다.
- **OS 레벨 처리**: Windows "audio enhancements"나 macOS Control Center의 Mic Mode(Voice Isolation)처럼 브라우저 constraint와 별개로 OS가 적용하는 음성 처리는 웹에서 끌 수 없다(미확인: 브라우저 캡처에 적용되는 범위). 온보딩에서 안내 문구로 다룬다.

### 1.4 Latency 측정과 보정

**보정 대상이 무엇인지 먼저 정리한다.** 메트로놈 클릭은 `ctx.currentTime` 기준 `t_sched`에 예약된다.

- 사용자가 클릭을 듣는 시각: `t_sched + L_out` (`L_out` = 출력 latency, 스피커까지 음파 이동 포함)
- 사용자가 친 소리가 AudioWorklet에 도착하는 시각: `t_strum + L_in`
- 실제 타이밍 오차: `e = t_strum - (t_sched + L_out) = (t_capture - L_in) - t_sched - L_out = t_capture - t_sched - (L_in + L_out)`

즉 **`RTT = L_in + L_out`만 알면 충분하다.** 그리고 RTT는 "스피커로 클릭을 내고 마이크로 다시 잡는" loopback으로 직접 잴 수 있다. 측정은 이렇게 한다.

1. 사용자에게 조용히 해 달라고 하고 기타를 뮤트하게 한다.
2. 짧은 broadband click(또는 chirp) N=8개를 불규칙 간격으로 예약한다.
3. AudioWorklet에서 click template과 matched filter(cross-correlation)로 도착 frame을 찾는다.
4. `RTT = median(t_detect - t_sched)`, 그리고 MAD(중앙값 절대 편차)로 측정 품질을 판단한다.

참고 실측값: 2016 MacBook에서 Chrome 기본 설정 RTT 약 67 ms, `latencyHint:0`과 처리 off로 약 19 ms. Firefox는 약 55 ms에서 약 14 ms로 줄었다 ([jefftk 2021](https://www.jefftk.com/p/browser-audio-latency)). Rocksmith+ WASAPI는 약 25 ms다 ([Ubisoft dev diary](https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/1Zcwvdcw0IwhBEYoCGCQtt/rocksmith-dev-diary-february-2022-audio-updates)).

**Bluetooth 헤드폰**: SBC/AAC 출력 latency는 보통 100–300 ms다 ([dev.to 측정 글](https://dev.to/keyboard-testerclick/your-bluetooth-headphones-are-300-ms-late-measure-it-in-one-browser-tab-2idp)). 헤드폰 소리는 마이크에 들어오지 않으므로 loopback이 불가능하다. 대안은 두 가지다.
- (a) **"클릭에 맞춰 8번 치기" 보정**: 사람의 습관적 선행/지연까지 포함한 offset을 구한다(리듬게임 표준 방식).
- (b) `ctx.outputLatency`를 참고값으로 쓴다(정확도 미확인).

또 BT 헤드셋 마이크가 선택되면 HFP 프로파일로 바뀌면서 음질이 떨어지는 것으로 알려져 있다(미확인: 웹에서의 구체적 sample rate). 그래서 **입력은 내장 마이크 deviceId를 명시**하고 UI로 경고한다.

**마이크 종류**
- 휴대폰과 노트북 마이크는 저역 roll-off가 있어 **low E의 82.4 Hz 기본음이 약하게 잡힌다**(미확인: 기기별 cutoff). 그래서 검증 알고리즘은 기본음보다 **harmonic(2–6차)**에 크게 의존해야 한다.
- 권장 배치: 기타에서 30–60 cm, 사운드홀과 12프렛 사이를 향하게 둔다(업계 가이드 기반 경험칙, 미확인). JustinGuitar 커뮤니티에서도 기기 위치가 인식률을 크게 좌우한다고 보고한다 ([JustinGuitar forum](https://community.justinguitar.com/t/how-do-i-properly-use-the-chord-perfect-practice-on-the-app/200534)).
- 일렉 기타는 앰프 clean 톤, effect off, 앰프를 기기 가까이에 둔다 ([Simply Guitar help](https://guitar-help.hellosimply.com/en/articles/5135082-improve-note-recognition-in-simply-guitar)).

---

## 2. 신호처리 접근법 (단순한 것에서 정교한 것 순서)

### 2.0 기초 수치: 주파수, 해상도, window

표준 튜닝의 개방현 기본음: `f = 440 * 2^((m-69)/12)`

| 줄 | 음 | MIDI | f0 (Hz) | 주기 (ms) |
|---|---|---|---|---|
| 6 | E2 | 40 | 82.41 | 12.13 |
| 5 | A2 | 45 | 110.00 | 9.09 |
| 4 | D3 | 50 | 146.83 | 6.81 |
| 3 | G3 | 55 | 196.00 | 5.10 |
| 2 | B3 | 59 | 246.94 | 4.05 |
| 1 | E4 | 64 | 329.63 | 3.03 |

- 반음 간격은 `f*(2^(1/12)-1) ≈ 0.0595 f`다. **E2–F2 간격은 4.90 Hz**, E4 근처는 19.6 Hz다.
- FFT bin 간격 `Δf = fs/N`, window 길이 `T = N/fs`:

| fs | N | Δf (Hz) | window (ms) | 비고 |
|---|---|---|---|---|
| 48 000 | 2048 | 23.4 | 42.7 | onset/YIN용. E2 주기 3.5개 |
| 48 000 | 4096 | 11.7 | 85.3 | 일반 spectral 분석 |
| 48 000 | 8192 | 5.86 | 170.7 | **strum 검증 권장** |
| 48 000 | 16384 | 2.93 | 341 | 저역 고해상도, 대신 시간 해상도 나쁨 |
| 44 100 | 4096 | 10.8 | 92.9 | |
| 44 100 | 8192 | 5.38 | 185.8 | **strum 검증 권장** |

- Hann window의 main lobe 폭은 ±2 bin이다. 그래서 **E2와 F2 기본음을 "분리"하려면 Δf가 약 1.2 Hz 이하여야 한다**(N ≈ 40k @48k, 0.8초). 실시간으로는 비현실적이다. 해결책은 두 가지다.
  1. **검증 문제이므로 분리가 아니라 "기대 위치의 에너지 측정"만 하면 된다.** 기대 주파수에서 Goertzel 또는 zero-padded FFT + parabolic interpolation으로 peak를 찾는다.
  2. **harmonic을 쓴다.** h차 harmonic에서는 반음 간격도 h배로 넓어진다(E2의 4차: 329.6 Hz와 349.2 Hz, 간격 19.6 Hz). 8192-point FFT로 충분히 분리된다.
- Hop: onset용 256 samples(48k에서 5.33 ms) 또는 512(10.7 ms). 검증용 window는 onset 이후 **+40 ms에서 시작**해(pick attack의 broadband transient를 피하기 위해) 170–200 ms 길이로 잡는다.
- **Inharmonicity**: `f_h = h·f0·sqrt(1 + B·h²)`. 기타 줄의 B는 대략 10⁻⁵ 오더이고, 클래식 G줄 기준 6×10⁻⁵ 이하가 바람직하다는 문헌이 있다 ([US5587541](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5587541), [Penn State 데모](https://www.acs.psu.edu/drussell/Demos/Stiffness-Inharmonicity/Stiffness-B.html)). B=5×10⁻⁵이면 h=6에서 편차가 `sqrt(1+0.0018)-1 ≈ 0.09% ≈ 1.6 cents`다. 무시할 만하지만, 굵은 wound 줄이나 높은 프렛에서는 커질 수 있다. **harmonic 탐색 허용폭을 ±25–35 cents로 두면 inharmonicity와 약간의 튜닝 오차를 함께 흡수한다.**

### 2.a Chroma / PCP / HPCP + template matching

- 방법: spectrum을 12 pitch class로 접고(fold) 코드 template과 cosine similarity를 비교한다 (Fujishima 1999). [FMP 노트북](https://audiolabs-erlangen.de/resources/MIR/FMP/C5/C5S2_ChordRec_Templates.html)에 이론과 구현이 정리돼 있다.
- 라이브러리
  - **Meyda 5.6.3** (MIT, 마지막 배포 2024-04): `chroma`, `spectralFlux`, `rms` 제공. 기본 bufferSize 512, Hann window. 512로는 저역 chroma가 쓸모없으므로 bufferSize를 8192 등으로 키워야 한다 ([Meyda features](https://meyda.js.org/audio-features)).
  - **Essentia.js 0.1.3** (**AGPL-3.0**, npm 마지막 배포 2021-06, "rapid development"라고 표기): `HPCP`, `ChordsDetection`(major/minor triad만), `MultiPitchKlapuri`, onset 함수 제공 ([GitHub](https://github.com/MTG/essentia.js), [ChordsDetection](https://essentia.upf.edu/reference/std_ChordsDetection.html), [MultiPitchKlapuri](https://essentia.upf.edu/reference/std_MultiPitchKlapuri.html)). **AGPL은 클로즈드 SaaS에 부적합할 수 있다.** 오래 배포가 없었던 점도 위험 요소다.
  - 직접 구현: FFT(예: `fft.js`나 직접 작성한 radix-2) + log-frequency mapping. 100줄 남짓이다.
- 기대 정확도: major/minor 구분이나 "A vs B 두 코드" 판별은 견고하다. 반면 **"모든 줄이 울렸는가"는 판단할 수 없다.** 같은 pitch class가 여러 줄에 있고(open C에는 C가 2개, E가 2개), 한 줄이 빠져도 chroma 모양이 거의 그대로이기 때문이다. Fujishima 계열 실험에서는 소규모 데이터 기준 약 85% 정확도가 보고됐다 ([JOS 요약](https://ccrma.stanford.edu/~jos/mus423h/Real_Time_Chord_Recognition_Musical.html), 구체 수치는 출처별 상이).
- **용도: 코드 체인지 카운트, 코드 종류 확인(v1).**

### 2.b Polyphonic transcription 모델

| 모델 | 크기/특성 | 브라우저 실행 | 정확도 (보고값) | 라이선스/상태 |
|---|---|---|---|---|
| **Spotify basic-pitch** | 16,782 params. 입력 22,050 Hz mono, window 2 s (43,776 samples), hop 256 (약 11.6 ms, 86 fps), 88 notes + 3 bins/semitone contour | TS 패키지 `@spotify/basic-pitch` 1.0.1 (마지막 배포 **2022-08**, `@tensorflow/tfjs ^3.2.0` 의존). ONNX 모델(`nmp.onnx`)을 그대로 재호스팅한 HF repo가 있어 `onnxruntime-web` 1.30.0(WASM/WebGPU)으로 실행 가능 | 7분 45초 오디오 처리 24 s (CPU, 실시간의 약 19배), peak 951 MB (Python, 전체 파일 기준). GuitarSet note-F 약 0.685, offset 무시 시 0.722 (논문 표, split 세부 미확인) | Apache-2.0 ([repo](https://github.com/spotify/basic-pitch), [TS](https://github.com/spotify/basic-pitch-ts), [paper](https://arxiv.org/abs/2203.09893), [ONNX](https://huggingface.co/daserge/basic-pitch-onnx)) |
| **CREPE** | monophonic pitch 전용 (tiny에서 full까지) | ml5/tfjs 포팅 존재(미확인: 현재 유지 상태) | monophonic 고정밀 | MIT. per-string pluck 모드에서는 YIN/MPM으로 충분해 불필요 |
| **TabCNN** (Wiggins & Kim 2019) | CNN, CQT 입력, 6 strings × fret 분류 | GGUF 변환본 존재 ([HF](https://huggingface.co/cstr/tabcnn-GGUF)). 브라우저 실시간 사례 미확인 | GuitarSet tab F1 0.748, TDR 0.899 ([arXiv 2405.14679](https://arxiv.org/html/2405.14679v3)) | 연구 코드 |
| 최신 tab 모델 (TART 2025/26, diffusion 기반 등) | 무겁다 | 실시간 브라우저용 아님 | — | [TART](https://arxiv.org/html/2510.02597v1) |
| Murgul et al. (ISMIR 2025) | CRNN, 스트럼 방향 + 코드 joint transcription | 미확인 | onset detection 대비 개선 보고 | [arXiv 2508.07973](https://arxiv.org/abs/2508.07973) |
| **Fretiq** (2026-07) | 26-dim 수작업 feature(MFCC 포함)로 **monophonic 일렉의 줄 분류**, 브라우저 네이티브 | 가능 | held-out 86.5%, free-play 87.8% | [arXiv 2607.18303](https://arxiv.org/abs/2607.18303) (DI 입력인지 mic 입력인지 미확인) |

평가는 다음과 같다.
- basic-pitch는 **2초 context가 필요해서 strum 직후 0.3–0.5 s 안에 판정하는 UX에서는 지연이 생긴다.** 오버랩 window를 쓰면 처리 자체는 가능하다(실측 필요, 미확인). 모델이 instrument-agnostic이라 기타의 "어느 줄인지"는 모르고 pitch만 낸다. 그래도 **pitch 집합(MIDI set) 수준의 second opinion**으로는 가치가 있다.
- tfjs 4.22.0도 마지막 배포가 2025-01로 유지보수가 느리다. **새로 붙인다면 `onnxruntime-web` + ONNX 모델을 쓴다.** WebGPU는 Chrome, Safari 26(iOS 26 포함), Firefox 141+(Windows)/145+(macOS)에서 기본 활성화된다 ([요약 기사](https://app.cinevva.com/guides/webgpu-vs-webgl-games)). 다만 17k params 모델은 WASM backend로도 충분할 가능성이 높다(미확인).

### 2.c 기타 특화 "기대 음 검증" (핵심 제안)

앱이 목표 voicing을 안다는 점을 이용한다. 줄 s의 개방현 MIDI `open[s]`, 프렛 `fret[s]`(x = 뮤트), capo `c`, 튜너로 측정한 줄별 cents 오프셋 `δ[s]`가 주어지면 기대값은 다음과 같다.

```
m[s] = open[s] + c + fret[s]
f0[s] = 440 * 2^((m[s] - 69)/12) * 2^(δ[s]/1200)
```

**관측량**: onset 후 `[t+40ms, t+220ms]` window(8192 @48k, Hann, zero-pad ×2)의 magnitude spectrum `X`와 onset 직전 0.5 s의 noise spectrum `N`(bin별 median).

```ts
// 의사코드: 줄별 기대 음의 salience와 confidence
type Verdict = 'PRESENT' | 'ABSENT' | 'UNCERTAIN';

function partialPeak(X, f, tolCents = 30): { mag: number; bin: number } {
  // f*2^(±tol/1200) 범위에서 최대 bin을 찾고 parabolic interpolation으로 보정
}

function salience(X, N, f0, B = 5e-5, H = 6): number {
  // Klapuri식 harmonic summation: 고차 harmonic일수록 가중치를 낮춘다
  let s = 0, n = 0;
  for (let h = 1; h <= H; h++) {
    const fh = h * f0 * Math.sqrt(1 + B * h * h);
    if (fh > 5000) break;
    const { mag, bin } = partialPeak(X, fh);
    const snrDb = 20 * Math.log10(mag / (N[bin] + eps));
    s += w(h) * Math.max(0, snrDb);   // 예: w(h) = 1/h^0.5, 휴대폰 저역 roll-off를 고려해 h=1 가중치는 낮춘다
    n += w(h);
  }
  return s / n;                         // 가중 평균 harmonic SNR (dB)
}
```

**문제 1: harmonic 중첩(octave/harmonic ambiguity).** open C `x32010` = C3(130.81) E3(164.81) G3(196.00) C4(261.63) E4(329.63)라고 하자.
- C4(2번 줄)의 모든 partial은 C3(5번 줄)의 짝수 harmonic과 겹친다. E4(1번 줄)는 E3(4번 줄)의 짝수 harmonic과 겹친다. 따라서 **2번 줄이 뮤트돼도 261.63 Hz에는 C3의 2차 harmonic 에너지가 남는다.** 단순 존재 판정으로는 뮤트를 잡을 수 없다.
- G3(3번 줄, 196 Hz)는 C3의 3차(392.4 Hz)가 G4와 겹칠 뿐, 기본음 196 Hz는 C3 계열과 겹치지 않아 판정할 수 있다.
- 따라서 각 기대 음을 두 종류로 나눈다.
  - **"독립 판정 가능"**: 다른 기대 음의 harmonic과 겹치지 않는 partial이 2개 이상 있는 음
  - **"종속"**: 모든 partial이 더 낮은 기대 음의 harmonic과 겹치는 음
- 종속 음은 v1에서 **판정하지 않거나(UNCERTAIN), 줄별 pluck 모드로 넘긴다.**

```ts
// 사전 계산 (voicing마다 한 번): partial 충돌 맵
for (const s of playedStrings) {
  independentPartials[s] = partialsOf(f0[s]).filter(p =>
    !playedStrings.some(o => o !== s && f0[o] < f0[s] && isNearHarmonic(p, f0[o], 35 /*cents*/)));
  verifiable[s] = independentPartials[s].length >= 2;
}
```

**문제 2: 기대하지 않은 음.** 예를 들어 `x32010`에서 6번 줄(E2)이 울리는 경우다.
- E2의 harmonic 중 82.4, 247.2(≈B3), 412(≈G#4) Hz는 C 코드의 partial과 겹치지 않는다. 그래서 **"x 줄이 울렸는지" 판정은 비교적 쉽다.** 다만 휴대폰에서는 82 Hz가 약하므로 3차와 5차 harmonic을 쓴다.
- 잘못된 프렛(예: 2번 줄을 0프렛으로 쳐서 B3)도 "기대 집합 밖의 강한 peak"로 잡는다.
- 구현 방법: `X`에서 기대 partial을 모두 제외한 뒤, 남은 상위 peak들을 MIDI 후보로 harmonic sum해서 salience가 임계값보다 크면 `UNEXPECTED(note)`로 판정한다.

**문제 3: 뮤트(데드) 줄.** 손가락이 닿아 소리가 죽은 줄은 attack 순간에 짧은 broadband "톡" 소리만 내고 partial이 50–100 ms 안에 사라진다(미확인: 정량값).
- 기준: 같은 줄 기대 partial의 에너지 비율 `E[t+150..250ms] / E[t+20..60ms]`가 해당 줄의 정상 decay 비율(calibration으로 학습)보다 크게 낮으면 MUTED로 본다.
- 독립 판정 가능한 음에만 적용한다.

**문제 4: 버징(fret buzz).** 공개된 전용 연구를 찾지 못했다. 그러므로 **v2의 실험 기능으로 분류한다.**
- 후보 feature: 기대 harmonic peak들을 notch로 제거한 뒤 남은 2–8 kHz residual 에너지(사운드홀 기준 noise floor 대비)와 spectral flatness, 그리고 줄 decay 초반의 불규칙한 amplitude modulation이다.
- 정상 strum 대비 상대값으로만 판정해야 하며, 사용자별 calibration 없이는 오탐이 클 것으로 예상한다(미확인).

**판정 결합 (3-상태)**

```ts
const T_PRESENT = 12, T_ABSENT = 4;   // dB. 초기값이며 fixture 평가로 튜닝한다
function judgeString(sal: number, verifiable: boolean): Verdict {
  if (!verifiable) return 'UNCERTAIN';
  if (sal >= T_PRESENT) return 'PRESENT';
  if (sal <= T_ABSENT)  return 'ABSENT';
  return 'UNCERTAIN';
}
// 코드 판정
// - 모든 verifiable 줄이 PRESENT이고 UNEXPECTED가 없음 → PASS (종속 줄은 "확인 불가"로 표시)
// - verifiable 줄 중 하나라도 ABSENT, 또는 UNEXPECTED 확신 → FAIL(구체적 줄 지목)
// - 그 외(UNCERTAIN이 핵심 줄에 있음, 입력 레벨 부족, 클리핑) → RETRY "잘 안 들렸어요, 다시 쳐 주세요"
```

**학술 근거와 현실성**
- Klapuri의 harmonic amplitude summation 기반 multi-F0 추정 ([ISMIR 2006](https://archives.ismir.net/ismir2006/paper/000125.pdf))이 위 salience의 원형이다. Yousician의 CTO급 연구자인 Klapuri가 Yousician 특허(코드 모델 배열로 실시간 세그먼트별 코드 확률 계산)의 발명자로 등재돼 있다. 상용 앱도 "기대 코드 모델 기반 확률" 방식일 가능성이 높다(구현 세부는 미확인) ([Justia 검색 결과](https://patents.justia.com/assignee/yousician-oy)).
- **줄 단위 식별**: 물리 모델(inharmonicity 포함) 기반 parametric pitch 추정으로 string/fret 분류 오류율 평균 1.5%가 보고됐다. 단 **monophonic, 40 ms segment 단위이고 SNR 20 dB 미만에서는 성능이 떨어진다** ([Hjerrild & Christensen ICASSP 2019](https://vbn.aau.dk/ws/files/333801680/icassp_plucking_position_estimation.pdf), [WASPAA 2019](https://vbn.aau.dk/da/publications/physical-models-for-fast-estimation-of-guitar-string-fret-and-plu)). Kehling et al.(DAFx 2014)은 polyphonic 녹음에서 줄 번호 82%, 주법 93%를 보고했다 ([Fraunhofer](https://publica.fraunhofer.de/handle/publica/387270)).
- **결론**: strum 상태에서 "어느 줄이 빠졌나"를 줄 단위로 단정하는 것은 **독립 partial이 있는 줄에 한해서만 현실적**이다. 나머지는 pitch-class나 "확인 불가"로 처리하고, 확정 판정은 2.d 모드로 넘기는 것이 정직한 설계다.

### 2.d "한 줄씩 튕기기" 모드 (Chord Perfect 방식): v1 핵심

- 흐름: 코드를 잡는다 → 앱이 6번(또는 voicing의 최저음 줄)부터 1번까지 순서대로 "이 줄을 튕기세요"를 하이라이트한다 → onset 검출 → 그 note의 pitch/clarity/decay를 판정 → 다음 줄로 넘어간다. x 줄 차례에는 "치지 마세요"를 표시하고 건너뛰거나, 선택적으로 "쳐서 소리가 안 나는지 확인"을 요구한다.
- **판정 알고리즘**
  1. onset 후 `[+30, +130 ms]`에서 McLeod MPM(`pitchy`) 또는 YIN으로 f0와 clarity를 구한다. window는 2048 samples(48k, 42.7 ms)로 E2 주기(12.1 ms)의 3.5배다. hop은 512다.
  2. `cents = 1200·log2(f_meas / f0[s])`
     - |cents| ≤ 35 → 음 맞음
     - |cents ± 1200| ≤ 35 → **octave error**일 가능성이 있다. 줄별 기대 f0로 탐색 범위를 `[f0/1.5, f0·1.5]`로 제한해 방지한다. 이 제한은 검증 문제라서 가능한 강력한 prior다.
     - 그 외(예: ±100 cents) → **잘못된 프렛** 또는 다른 줄을 친 경우
  3. clarity < 0.85 또는 RMS가 noise floor + 15 dB 미만 → `WEAK/UNCLEAR` (판정을 미루고 "조금 더 세게"를 안내)
  4. decay 비율 `RMS[+250..350ms] / RMS[+30..80ms]`가 calibration 기준보다 매우 낮음 → `MUTED` (손가락이 닿아 소리가 죽음)
  5. (v2) 줄 오인 판정: 같은 pitch를 다른 줄에서 냈는지는 Fretiq/Hjerrild 방식의 timbre·inharmonicity feature로 판단할 수 있다. 코드 연습에서는 "순서대로 친다"는 전제로 충분하므로 v1에서는 생략한다.
- 기대 성능: 조용한 환경의 개방현 monophonic 판정은 튜너 수준(±5 cents)으로 신뢰할 수 있다.
  - 참고로 브라우저 YIN 기반 mono 트래커가 GuitarSet solo(**자유 연주**, 레가토 포함)에서 P≈73%, R≈84%, octave 오류 2.9%, low E onset→note latency 31–36 ms를 기록했다 ([jamrack PR #1, 2026-10](https://github.com/benasterisk/jamrack/pull/1)).
  - 코드 검증은 기대 f0를 알고 한 번에 한 줄이며 sustain도 기다릴 수 있으므로 이보다 훨씬 유리하다(정량값 미확인, 자체 평가 필요).
- 라이브러리
  - **pitchy 4.1.0** (MPM, `findPitch(input, sampleRate) → [pitch, clarity]`, ESM only). 마지막 배포 2024-01. 라이선스는 npm에 MIT, GitHub README에 0BSD로 **표기가 상충**하지만 둘 다 permissive다 ([GitHub](https://github.com/ianprime0509/pitchy)).
  - **pitchfinder 2.3.4** (YIN/AMDF/McLeod/DynamicWavelet). **GPL-3.0**이므로 클로즈드 소스라면 피한다 ([GitHub](https://github.com/peterkhayes/pitchfinder)).
  - YIN은 50줄 정도라 직접 구현을 권장한다(테스트와 튜닝 용이).

### 2.e Onset detection: 코드 체인지 카운트와 스트럼 타이밍

- **ODF(onset detection function)**: log-compressed spectral flux가 기본이다.
  `SF[n] = Σ_k max(0, log(1+γ|X_n[k]|) − log(1+γ|X_{n−1}[k]|))`. N=1024–2048, hop 256 @48k(5.33 ms)를 쓴다.
  - **SuperFlux**(Böck & Widmer 2013)는 주파수 방향 max-filter로 vibrato에 의한 오탐을 최대 60%까지 줄인다 ([ISMIR 2013 paper](https://archives.ismir.net/ismir2013/paper/000175.pdf)). 기타 지속음 위의 미세 피치 변동으로 생기는 오탐 억제에 유용하다.
  - aubio의 `hfc`/`complex`/`specflux`, 최소 IOI 기본 20 ms 등의 설정을 참고한다 ([aubioonset man](https://aubio.org/manpages/latest/aubioonset.1.html)). `aubiojs` 0.2.1(2022-11)은 README상 pitch/tempo만 노출한다. aubio 본체는 GPL-3.0이라 라이선스 확인이 필요하다(미확인: aubiojs 번들의 실질 라이선스).
- **Peak picking**: 적응형 threshold `median(ODF[n−W..n]) + δ`, local max, 최소 간격 50–80 ms(16분음표 200 BPM ≈ 75 ms이므로 그보다 작게)를 쓴다.
- **스트럼 = 하나의 이벤트**: 6줄을 긁는 데 수십 ms가 걸린다(미확인: 통상 10–50 ms). 첫 onset부터 60 ms 안의 onset들을 하나로 묶고, 이벤트 시각은 **첫 onset**으로 한다(사람이 지각하는 시점과 일치하도록 하는 설계 선택). 업/다운 방향 판정은 v2에서 Murgul et al. 2025를 참고한다.
- **"지속 코드를 여러 번 스트럼으로 오인"하는 문제**: Simply Guitar 리뷰가 지적한 실패 유형이다 ([guitar.com 2025-06](https://guitar.com/reviews/accessories/simply-guitar-review/)). 대책은 다음과 같다.
  - (1) log-flux로 레벨 변화에 둔감하게 만든다.
  - (2) **broadband 조건**: onset 후보에서 2 kHz 이상 대역 에너지가 급증해야 한다(pick/손톱 attack).
  - (3) 직전 이벤트의 decay 곡선 대비 증가량 조건을 둔다.
- **타이밍 정확도**
  - frame 양자화 ±2.7 ms(hop 5.33 ms), ODF peak에 parabolic interpolation을 하면 더 좋아진다.
  - 여기에 RTT 측정 오차(loopback median 기준 수 ms, 미확인)와 스트럼 자체의 퍼짐이 더해져 **실효 ±10–20 ms**로 추정한다(미확인).
  - 판정 window는 리듬게임 관행을 따라 Perfect ±35 ms, Good ±70 ms, 그 외 Miss로 시작하고 사용자 데이터로 조정한다(설계 선택).
- **60초 코드 체인지 카운트 (one-minute changes)**
  - 두 코드 A/B만 후보이므로, 매 스트럼 이벤트마다 chroma(또는 2.c salience)로 `score_A − score_B`를 계산한다.
  - |margin|이 작으면 "판정 보류(미카운트)"로 처리한다.
  - 상태 머신으로 A→B, B→A 전환이 **확신 있게** 일어날 때만 +1 한다. 같은 코드 반복 스트럼이나 보류는 무시한다.
  - 카운트는 과대 집계보다 **약간 과소 집계**되는 쪽으로 치우치게 한다(오탐이 신뢰를 더 크게 해친다).

---

## 3. 기존 제품과 데모

| 제품 | 알려진 방식 | 줄 단위 피드백 | 알려진 불만 |
|---|---|---|---|
| **Yousician** | 내장 마이크 실시간 note/chord 인식. Klapuri 등 발명 특허(코드 모델 배열로 세그먼트별 확률) | **있음**: "줄이 안 들리면 빨간색으로 표시". 굵은 줄만 세게 치고 가는 줄은 약하게 치는 습관과 1번 줄이 안 들리는 경우를 대표 원인으로 안내 ([support](https://support.yousician.com/hc/en-us/articles/202893201-Chords-are-not-recognized), 검색 스니펫 기준, 페이지 403) | 맞게 쳤는데 틀렸다고 함, 소음, 휴대폰 마이크 품질 |
| **Rocksmith+** | 케이블 중심 + USB 마이크 모드. root와 **3rd를 가중**하는 코드 판정(바레 코드에서 단 하나의 3rd를 우선 탐지) | 미확인 | 베타에서 "너무 엄격"하다는 피드백 → **판정 완화**. 48 kHz/16-bit 요구, WASAPI RTT 약 25 ms ([dev diary](https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/1Zcwvdcw0IwhBEYoCGCQtt/rocksmith-dev-diary-february-2022-audio-updates)) |
| **JustinGuitar app (Musopia)** "Chord Perfect" | 줄 하나씩 튕기기 + 마지막 스트럼. 타이머 기반 진행, 마이크 미터 | 있음 (줄별 하이라이트) | 일부 줄을 못 들음, 세게 쳐야 함, Android/Mac 미동작(2026-02까지 보고). **앱 내 튜너로 튜닝하면 개선**(2023-09 커뮤니티 발견) ([forum 1](https://community.justinguitar.com/t/how-do-i-properly-use-the-chord-perfect-practice-on-the-app/200534), [forum 2](https://community.justinguitar.com/t/chord-perfect-exercises-dont-work/409028)) |
| **Simply Guitar** | 마이크 인식. 매번 앱 튜너로 튜닝하고 헤드폰을 쓰라고 권장 | 아르페지오로 버징/뮤트를 확인하라고 안내 | 리뷰어 평가: "코드 감지가 사실상 작동하지 않음". 틀린 코드나 기침도 통과, 지속음을 여러 스트럼으로 인식, 자기 반주 소리를 인식 ([guitar.com](https://guitar.com/reviews/accessories/simply-guitar-review/)) |
| **GuitarTuna** | 튜너 + "Chords" 게임, 노이즈 캔슬링 기술 언급 | 미확인 | 기술 세부 비공개 ([App Store](https://apps.apple.com/us/app/-/id527588389)) |
| **Fender Play** | 마이크 피드백 기능 여부와 방식 미확인 | — | — |
| 웹 데모 | `@chordbook/tuner`(pitchy 기반 튜너), MMLL(JS 머신리스닝, 코드 검출 포함), Chris Wilson PitchDetect(autocorrelation) ([chordbook/tuner](https://github.com/chordbook/tuner), [PitchDetect](https://github.com/RobinWuDev/PitchDetect)) | 없음 | 대부분 "열린 코드 인식"이고 검증은 없음 |

**교훈**
- (1) 줄 단위 피드백은 상용 앱도 하고 있다. 다만 오탐/미탐 불만이 많다.
- (2) **엄격함과 사용감 사이의 균형**이 실제로 중요하다(Rocksmith+가 판정을 완화한 사례).
- (3) **튜닝을 앱 안에서 강제**하면 인식률이 오른다.
- (4) 앱이 자기 반주 소리를 듣는 문제가 있으므로 반주 재생 중에는 판정을 조심해야 한다.
- (5) 지속음을 재스트럼으로 오인하는 문제가 대표적인 실패 유형이다.

---

## 4. Calibration과 robustness

1. **환경 점검(10초)**
   - 무음 2 s로 bin별 noise floor `N[k]`와 전체 dBFS를 측정한다. 너무 시끄러우면(예: noise RMS > −45 dBFS, 초기값) 경고한다.
   - getSettings로 처리가 꺼졌는지 확인한다.
   - sample-rate sanity check는 아래 튜너 단계에서 함께 한다.
2. **튜너 단계(필수)**
   - 줄별 MPM으로 cents 오프셋 `δ[s]`를 측정한다. |δ| > 15 cents면 튜닝을 유도하고, 허용 범위 안이면 δ를 검증 기대 f0에 반영한다.
   - JustinGuitar와 Simply의 경험상 인식률에 큰 영향을 준다.
3. **줄별 gain/timbre calibration**
   - 개방현을 하나씩 튕겨 줄별 harmonic 상대 크기(spectral template)와 정상 decay 비율을 저장한다.
   - 휴대폰 마이크의 주파수 응답, 기타 차이, 줄 상태(헌 줄/새 줄)가 이 값에 반영된다.
   - v2 NNLS의 dictionary로도 재사용한다.
4. **RTT 측정**(§1.4): 스피커 loopback 또는 박자 맞춰 치기.
5. **입력 레벨 가이드**: 실시간 미터. 클리핑(|x| > 0.98)이 있으면 판정 무효(RETRY)로 처리하고, 너무 작으면 "가까이".
6. **배경 소음**
   - 판정은 항상 **onset 직전 noise 대비 SNR**로 한다(절대값 사용 안 함).
   - 반주나 메트로놈을 스피커로 재생하는 중에는 echo cancellation을 꺼 두었으므로 그 소리가 마이크로 들어온다. 대책은 다음과 같다.
     - (a) 메트로놈 클릭은 2–4 kHz의 짧은 소리로 만들고 기타 harmonic 대역과 겹치는 시간을 줄인다.
     - (b) 클릭 예약 시각 ± (RTT ± 10 ms) 구간은 onset 후보에서 제외하거나 matched filter로 제거한다.
     - (c) 반주 음악 재생 중에는 검증 정확도를 낮춰 표시하거나 헤드폰(유선)을 권장한다.
7. **Capo / 대체 튜닝**: 튜닝 모델을 `open[6]`(줄별 MIDI) 배열로 두고 capo는 `+c`로 처리한다. 튜너 단계가 실제 튜닝을 검증한다. Drop D 등은 `open[6]=38`처럼 표현한다.
8. **왼손잡이**: 오디오 처리와 무관하다. 다이어그램 UI만 좌우 반전한다(줄 번호와 음은 동일).
9. **기타 종류**
   - 어쿠스틱(강철/나일론)과 일렉(앰프)은 harmonic 분포가 다르다. 그래서 calibration template에 의존하는 설계가 유리하다.
   - 나일론은 고차 harmonic이 약하므로 H를 줄인다(미확인: 최적값).

---

## 5. 테스트 전략

### 5.1 원칙
- **DSP 코어는 순수 함수**로 만든다(`Float32Array`와 `sampleRate`를 받아 결과를 반환). Web Audio에 의존하지 않으므로 Node(vitest)에서 그대로 실행된다.
- AudioWorklet과 Worker는 얇은 adapter로만 두고, E2E에서만 검증한다.

### 5.2 데이터셋

| 데이터셋 | 내용 | 라이선스 | 용도 |
|---|---|---|---|
| **GuitarSet** | 어쿠스틱, **hexaphonic pickup으로 줄별 분리 녹음**, 줄/프렛/코드/비트 주석(JAMS), 약 3시간 | **CC BY 4.0** ([Zenodo](https://zenodo.org/records/1422265), [ISMIR 2018](https://ismir2018.ismir.net/doc/pdfs/188_Paper.pdf)) | 줄별 ground truth가 있어 "이 줄이 실제로 울렸는가" 평가에 최적. mic 채널 + hex 채널로 회귀 테스트 구성 가능. 일부 클립을 저장소 fixture로 포함 가능(출처 표기) |
| **IDMT-SMT-Guitar** | 4 subsets, muted / dead-note / harmonics 등 주법, 코드 annotation, 44.1 kHz mono, 1.3 GB | **CC BY-NC-ND 4.0** ([Zenodo](https://zenodo.org/records/7544110)) | dead-note·mute 판정 평가에 유용. **비상업·변경 금지**이므로 저장소 재배포와 상업 제품 학습에는 쓰지 말고, 내부 평가에만 쓸지 법무 검토 후 결정 |
| Guitar-TECHS (2025) | 일렉, 다양한 하드웨어/주법 | 미확인 ([arXiv 2501.03720](https://arxiv.org/pdf/2501.03720)) | 일렉 robustness |
| **자체 녹음** | 대상 기기(iPhone, Android, MacBook)로 5개 기본 코드 × {정상, 줄 하나 뮤트, x줄 울림, 버징} | 자체 소유 | **가장 중요한 실측 fixture.** 소량이라도 반드시 확보 |

### 5.3 합성 fixture (Karplus-Strong / additive)

목적은 정답이 확실한 신호로 알고리즘 경계 조건을 체계적으로 시험하는 것이다.

```ts
// 확장 Karplus-Strong: 줄 하나
function ksString(f0: number, fs: number, durS: number, opts: {
  decay?: number;        // 루프 손실 (0.996 = 정상 sustain, 0.90 = 뮤트/데드)
  brightness?: number;   // 초기 excitation lowpass (pick vs 손가락)
  pickPos?: number;      // comb filter로 pick 위치 반영
  buzz?: number;         // >0이면 줄-프렛 접촉 비선형(soft clip + 짧은 noise burst)
}): Float32Array { /* delay line 길이 L = fs/f0 (분수 지연은 allpass로 보정) */ }

// 코드 = 줄별 신호를 스트럼 지연(다운 스트럼은 6→1번 줄 순서로 0–40 ms)으로 더하고,
// 마이크 특성(100 Hz 이하 HPF), 배경 noise(SNR 10–40 dB), 클릭 누출을 합성
```

- KS는 기본적으로 거의 harmonic이다. **inharmonicity 시험에는 additive 합성**(`f_h = h f0 sqrt(1+B h²)`, partial별 지수 decay)을 함께 쓴다.
- 시험 매트릭스: 코드 × {정상, 각 줄 MUTED, x줄 울림, 한 줄 잘못된 프렛(±1 semitone), ±20 cents detune, SNR 단계, HPF cutoff 80/120/150 Hz}.
- 기대 결과는 PASS / FAIL(줄 지목) / RETRY로 둔다. 특히 **종속 음(open C의 2번 줄) 뮤트는 "RETRY 또는 확인 불가"가 정답**이다. 잘못된 확신 판정이 나오면 테스트 실패로 처리한다.

### 5.4 지표와 합격선 (초기 제안, 데이터로 조정)
- **False reject**(맞게 쳤는데 FAIL) ≤ 3%. 사용자 좌절을 가장 크게 만드므로 가장 엄격하게 잡는다.
- **False accept**(틀렸는데 PASS) ≤ 10% (v1), 5% (v2).
- **RETRY 비율** ≤ 15%. 이보다 높으면 UX가 무너진다.
- 줄별 confusion matrix와 SNR별 곡선을 CI 아티팩트로 남긴다.
- onset: ±25 ms tolerance F-measure ≥ 0.95(합성), ≥ 0.9(실녹음). 타이밍 오차 분포의 p95를 보고한다.

### 5.5 Node 단위 테스트 (vitest)
- WAV 파서(16/24/32f PCM)와 fixture 로더를 만든다. 테스트에서는 합성 fixture를 즉석 생성하거나 seed를 고정해 캐시한다.
- 회귀 방지를 위해 판정 결과와 salience 값을 snapshot으로 저장하되, 수치는 허용 오차 비교로 한다.
- Python(numpy/librosa) 레퍼런스 구현으로 동일 fixture를 처리해 교차 검증하는 golden test를 둔다(연구 단계에서 유용).

### 5.6 E2E (Playwright + Chromium fake capture)

```ts
// playwright.config.ts (project별로 fixture 1개)
use: {
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',          // 권한 프롬프트 자동 허용
      '--use-fake-device-for-media-stream',      // 가짜 장치
      `--use-file-for-fake-audio-capture=${path.resolve('fixtures/c_major_ok.wav')}%noloop`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
},
```

- WAV(16-bit PCM)만 지원하고, 44.1 kHz stereo 16-bit에서 동작이 확인된 사례가 있다. `%noloop`을 붙이면 반복 재생하지 않는다. **fake 장치는 브라우저 인스턴스당 한 번 초기화**되므로 fixture를 바꾸려면 새 브라우저(또는 project)가 필요하다 ([dkarlovi 글](https://dkarlovi.github.io/testing-speech-recognition), [QA Wolf](https://docs.qawolf.com/qawolf/web-audio-injection), [Chromium fake_audio_input_stream](https://chromium.googlesource.com/chromium/src/+/74.0.3729.169/media/audio/fake_audio_input_stream.cc)).
- 대안(빠르고 유연함): `page.addInitScript`로 `navigator.mediaDevices.getUserMedia`를 override한다. 테스트가 지정한 WAV를 `AudioBufferSourceNode → MediaStreamAudioDestinationNode.stream`으로 돌려주면 한 브라우저에서 여러 fixture를 쓸 수 있고 시작 시각도 통제된다. 실제 경로(권한, constraint) 검증은 fake-capture 테스트 몇 개로 따로 유지한다.
- Firefox는 `media.navigator.streams.fake=true` pref로 가짜 장치(톤)만 지원하고 파일 주입은 안 되는 것으로 알려져 있다(미확인). 그래서 Firefox E2E는 위 override 방식을 쓴다.
- 실기기 수동 테스트(iOS Safari, Android Chrome)는 자동화가 어려우므로 릴리스 체크리스트로 관리한다.

---

## 6. 구현 언어: TypeScript vs WASM (C++/Rust)

| 항목 | 순수 TypeScript | C++/Rust → WASM |
|---|---|---|
| 성능 필요량 | 8192-pt FFT를 strum당 1–3회, onset용 2048-pt FFT 초당 약 190회(hop 256 @48k). JS로도 오디오 예산의 몇 % 수준(미확인, 프로파일 필요) | 여유가 크다. SIMD 사용 가능 |
| AudioWorklet 통합 | 바로 import | wasm 모듈을 worklet에 로드하는 방법(`processorOptions`로 bytes 전달, 동기 compile)이 번거롭다 |
| 테스트 | vitest로 동일 코드를 Node에서 실행 | Node에서도 되지만 빌드 체인(emscripten/wasm-pack)이 CI에 추가된다 |
| 디버깅/반복 속도 | 빠르다 | 느리다 |
| 기존 자산 | Meyda/pitchy 등 | Essentia(AGPL), aubio(GPL), 직접 작성 코드 |
| 숫자 정밀도 | Float32/64 선택 가능 | 동일 |

**권고**: v1은 **순수 TS(엄격한 타입, 할당 없는 hot path, 사전 할당 버퍼, 미리 계산한 twiddle/window)**로 간다. 이유는 다음과 같다.
- (1) 계산량이 작다.
- (2) Node 테스트와 브라우저가 같은 코드를 쓰는 것이 품질에 가장 크게 기여한다.
- (3) GPL/AGPL 의존을 피할 수 있다.

v2에서 NNLS/inharmonic partial tracking/다중 후보 탐색이 프로파일상 audio 예산의 30%를 넘거나 Worker 지연이 50 ms를 넘으면, **그 커널만** Rust(또는 C++/emscripten) WASM으로 옮긴다. 인터페이스는 `(Float32Array, params) → result`로 고정해 TS 레퍼런스 구현과 같은 fixture로 비교 검증한다. 사용자가 C++ 전문가이므로 연구용 프로토타입은 Python(numpy/librosa)이나 C++로 빠르게 돌려 보고, 제품 코드는 TS로 옮기는 2단계 흐름도 합리적이다.

---

## 7. 권장 아키텍처

### 7.1 v1: 높은 신뢰도 우선

```
[getUserMedia (처리 off, 내장 마이크)]
      │
[AudioWorkletProcessor]  ── ring buffer(4 s) + log-spectral-flux ODF(hop 256) + RMS/clip 감시
      │  onset 이벤트 {frame, strength} + 해당 구간 샘플(Transferable)
[DSP Worker (TS)]
   ├─ Tuner/Calibration: MPM(pitchy 또는 자체 YIN), noise floor, 줄 template, RTT
   ├─ Mode A  한 줄씩 튕기기 검증: 기대 f0 prior + MPM + decay → 줄별 OK/WRONG_NOTE/MUTED/WEAK
   ├─ Mode B  스트럼 검증(보수적): 기대-음 salience(독립 partial만) + 비기대 음 탐지 → PASS/FAIL/RETRY
   ├─ Mode C  코드 체인지 카운트: 이벤트별 A-vs-B margin (chroma + salience) + 히스테리시스 상태 머신
   └─ Mode D  메트로놈 타이밍: 이벤트 시각 − 예약 시각 − RTT → 오차(ms) 히스토그램
      │
[UI (main thread)]  판정 3-상태 표시, 줄별 색상, "다시 쳐 주세요"
```

- 우선순위: **Mode A, D, C를 먼저 출시**하고, Mode B는 "베타" 표시와 함께 독립 판정 가능한 줄만 지적한다.
- UX 규칙
  - **확신이 없으면 절대 "틀렸다"고 하지 않는다.** RETRY 메시지는 구체적으로 쓴다: "1번 줄이 잘 안 들렸어요. 조금 더 크게, 한 번 더".
  - 같은 RETRY가 2회 연속이면 Mode A(한 줄씩)로 유도한다.
  - RETRY 원인 코드(LOW_LEVEL / CLIPPING / NOISY / AMBIGUOUS_PARTIAL / NO_ONSET)를 구분해 로그를 남긴다.
  - 엄격도 슬라이더(Rocksmith+ 사례)를 둔다. 기본값은 관대하게 한다.

### 7.2 v2: 확장

1. **Calibration template 기반 NNLS 분해**: Mode A에서 수집한 사용자 기타의 줄별 harmonic template(프렛 이동은 template 주파수 스케일링으로 근사)을 dictionary로 쓴다. strum spectrum을 `X ≈ Σ_s a_s·T_s(f0_s) + Σ_u b_u·T(u) + noise`로 분해한다(비기대 음 후보 u 포함). 2번 줄 C4처럼 **종속 음도 "harmonic 비율 초과분"으로 판정**할 수 있게 된다. 효과는 미확인이며, jamrack의 NMF 실험은 dyad recall 48–54%로 부진했다. 사용자별 template이 이 차이를 메울 수 있을지는 실측으로 확인해야 한다.
2. **basic-pitch ONNX second opinion**: strum 후 약 1 s 지연 허용 모드에서 MIDI set을 교차 확인한다. 두 방법이 불일치하면 RETRY로 처리한다.
3. **버징 탐지(실험)**: harmonic notch 후 residual 고역 에너지 + flatness. 사용자 기준선 대비 상대 판정.
4. **스트럼 방향(업/다운)**: 줄별 onset 순서(저음에서 고음이면 down) 또는 Murgul et al. 2025 계열 CRNN.
5. **줄 식별(같은 음 다른 줄)**: inharmonicity/timbre feature(Hjerrild 2019, Fretiq 2026).
6. **WASM 커널**: 위 기능이 프로파일상 필요할 때만 도입한다.

---

## 8. 앱 설계 시사점 (구체적 권고)

1. **문제 정의를 "검증"으로 고정한다.** 모든 판정 함수는 `(audio, expectedVoicing, calibration) → {verdict, perString[], confidence, reasonCode}` 시그니처를 갖고, 열린 코드 인식 API는 만들지 않는다.
2. **판정은 3-상태(PASS/FAIL/RETRY)로 한다.** false reject ≤ 3%를 최상위 품질 지표로 두고, 확신이 없을 때 RETRY로 빠지는 것을 허용한다(RETRY ≤ 15% 목표).
3. **v1 출시 범위**: 튜너 + calibration, Mode A(한 줄씩 튕기기 검증), Mode D(메트로놈 타이밍, RTT 보정), Mode C(60초 코드 체인지). 스트럼 검증 Mode B는 "독립 partial을 가진 줄만" 지적하는 베타로 낸다.
4. **voicing 데이터 모델**: `{ tuning: number[6] /*MIDI*/, capo: number, frets: (number|'x')[6], fingers?: ... }`. voicing마다 **partial 충돌 맵을 사전 계산**해 "검증 가능한 줄"을 UI에 미리 알 수 있게 한다(예: open C에서 2·1번 줄은 한 줄씩 모드에서만 확정).
5. **오디오 파라미터 기본값 (fs=48k 기준, `ctx.sampleRate`로 스케일)**
   - onset: N=2048, hop=256, log-flux(γ=100), adaptive median threshold, 최소 IOI 60 ms, 스트럼 그룹 60 ms
   - 스트럼 검증: onset+40 ms부터 N=8192 Hann, zero-pad ×2, harmonic H=6, tol ±30 cents, B=5e-5
   - 한 줄 판정: N=2048 MPM, 탐색 범위 `[f0/1.5, f0·1.5]`, clarity ≥ 0.85, 음정 허용 ±35 cents
   - 임계값(초기): PRESENT ≥ 12 dB, ABSENT ≤ 4 dB (fixture로 튜닝)
6. **getUserMedia**: `echoCancellation/noiseSuppression/autoGainControl=false`, sampleRate는 지정하지 않는다. 내장 마이크 deviceId를 우선하고, **getSettings 결과와 RTT를 세션 진단 정보로 저장**한다.
7. **iOS Safari 대응**: getUserMedia 전에 `navigator.audioSession.type='play-and-record'`를 설정하고, AudioContext는 탭 이벤트에서 resume한다. 마이크가 켜진 동안 재생 품질 저하(WebKit 311451)를 감안해 메트로놈 클릭은 단순한 합성음으로 만든다. 반주 재생 + 검증 동시 사용은 유선 헤드폰을 권장한다.
8. **타이밍 보정은 RTT 하나로 한다.** 기본은 스피커 loopback(chirp 8회 median)이고, BT 출력이 감지되거나 loopback이 실패하면 "박자 맞춰 8번 치기" 보정으로 넘어간다. 보정값은 기기와 출력 장치별로 저장한다.
9. **메트로놈 클릭 누출 처리**: 클릭 예약 시각 + RTT ± 10 ms 구간은 onset 후보에서 마스킹한다. 클릭 음색은 짧은 고역(2–4 kHz)으로 만든다.
10. **DSP는 순수 TS 모듈(`/dsp`)로, AudioWorklet과 Worker에서 공유**하고 vitest로 테스트한다. GPL/AGPL 라이브러리(pitchfinder, essentia.js, aubio)는 쓰지 않는다. pitchy(MIT/0BSD)와 Meyda(MIT) 정도만 허용하거나 직접 구현한다.
11. **테스트 피라미드**: (a) 합성 KS/additive fixture 매트릭스 → (b) GuitarSet(CC BY 4.0) hex 채널 기반 줄별 정답 회귀 → (c) 자체 실기기 녹음 fixture(가장 중요) → (d) Playwright fake-capture E2E 몇 개 + getUserMedia override 기반 다수 시나리오. IDMT-SMT-Guitar는 라이선스(CC BY-NC-ND) 때문에 내부 평가 전용으로 검토한다.
12. **ML은 v2에서 second opinion으로만** 쓴다. 쓰게 되면 `@spotify/basic-pitch`(tfjs 3, 2022 배포 중단) 대신 ONNX 모델 + `onnxruntime-web`을 쓴다. 지연(2 s context)을 감안해 "스트럼 후 결과 보기" UX에만 붙인다.
13. **텔레메트리(옵트인)**: RETRY 원인 코드, SNR, 기기/브라우저, getSettings를 수집한다. 원본 오디오는 명시적 동의가 있을 때만 받는다. 임계값 튜닝의 실데이터 근거가 된다.

---

## Sources

**Web Audio / 브라우저**
- getUserMedia audio constraints (addpipe): https://blog.addpipe.com/getusermedia-audio-constraints.md
- MDN getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/navigator/mediaDevices.getUserMedia
- MDN MediaTrackSettings.latency: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings/latency
- MDN Audio Session API: https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API
- W3C Audio Session: https://www.w3.org/TR/audio-session/
- web.dev audio output latency: https://web.dev/articles/audio-output-latency
- caniuse baseLatency: https://caniuse.com/mdn-api_audiocontext_baselatency
- WebKit bug 179411 (echoCancellation): https://bugs.webkit.org/show_bug.cgi?id=179411
- WebKit bug 311451 (iOS 마이크 사용 시 재생 품질 저하): https://bugs.webkit.org/show_bug.cgi?id=311451
- WebKit bug 244203 (sample rate 불일치): https://bugs.webkit.org/show_bug.cgi?id=244203
- WPT MediaStreamAudioSourceNode 다른 rate: https://searchfox.org/firefox-main/source/testing/web-platform/tests/webaudio/the-audio-api/the-mediastreamaudiosourcenode-interface/mediastreamaudiosourcenode-from-context-with-different-rate.https.html
- Browser audio latency (jefftk, 2021): https://www.jefftk.com/p/browser-audio-latency
- Chromium audio latency tracing: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/media/latency_tracing.md
- AudioWorklet in Firefox (Mozilla Hacks): https://hacks.mozilla.org/2020/05/high-performance-web-audio-with-audioworklet-in-firefox/
- AudioWorklet 최적화: https://cprimozic.net/blog/webaudio-audioworklet-optimization/
- voiceIsolation: https://docs.vdo.ninja/advanced-settings/audio-parameters/and-voiceisolation
- Bluetooth latency 측정: https://dev.to/keyboard-testerclick/your-bluetooth-headphones-are-300-ms-late-measure-it-in-one-browser-tab-2idp
- WebGPU 2026 지원 현황: https://app.cinevva.com/guides/webgpu-vs-webgl-games

**라이브러리 / 모델**
- basic-pitch: https://github.com/spotify/basic-pitch , constants: https://raw.githubusercontent.com/spotify/basic-pitch/main/basic_pitch/constants.py
- basic-pitch-ts: https://github.com/spotify/basic-pitch-ts
- basic-pitch 논문: https://arxiv.org/abs/2203.09893 , https://ar5iv.labs.arxiv.org/html/2203.09893
- basic-pitch ONNX: https://huggingface.co/daserge/basic-pitch-onnx
- pitchy: https://github.com/ianprime0509/pitchy
- pitchfinder: https://github.com/peterkhayes/pitchfinder
- Meyda features: https://meyda.js.org/audio-features
- Essentia.js: https://github.com/MTG/essentia.js , ChordsDetection: https://essentia.upf.edu/reference/std_ChordsDetection.html , MultiPitchKlapuri: https://essentia.upf.edu/reference/std_MultiPitchKlapuri.html
- aubiojs: https://github.com/qiuxiang/aubiojs , aubioonset: https://aubio.org/manpages/latest/aubioonset.1.html
- TabCNN 관련 평가: https://arxiv.org/html/2405.14679v3 , TabCNN GGUF: https://huggingface.co/cstr/tabcnn-GGUF
- TART: https://arxiv.org/html/2510.02597v1
- npm 버전/배포일: `npm view` (2026-10-07 조회)

**논문 / 신호처리**
- Klapuri 2006, harmonic amplitude summation: https://archives.ismir.net/ismir2006/paper/000125.pdf
- SuperFlux (Böck & Widmer 2013): https://archives.ismir.net/ismir2013/paper/000175.pdf
- FMP chord recognition templates: https://audiolabs-erlangen.de/resources/MIR/FMP/C5/C5S2_ChordRec_Templates.html
- JOS real-time chord recognition: https://ccrma.stanford.edu/~jos/mus423h/Real_Time_Chord_Recognition_Musical.html
- Hjerrild & Christensen ICASSP 2019: https://vbn.aau.dk/ws/files/333801680/icassp_plucking_position_estimation.pdf
- Hjerrild, Willemsen, Christensen WASPAA 2019: https://vbn.aau.dk/da/publications/physical-models-for-fast-estimation-of-guitar-string-fret-and-plu
- Kehling et al. DAFx 2014: https://publica.fraunhofer.de/handle/publica/387270
- Murgul et al. ISMIR 2025 (strumming + chords): https://arxiv.org/abs/2508.07973
- Fretiq (2026): https://arxiv.org/abs/2607.18303
- jamrack Guitar→MIDI tracker PR (2026-10): https://github.com/benasterisk/jamrack/pull/1
- Inharmonicity: https://www.acs.psu.edu/drussell/Demos/Stiffness-Inharmonicity/Stiffness-B.html , https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/5587541
- Grollmisch & Cano SMC 2019: https://www.smc2019.uma.es/articles/D2/D2_07_SMC2019_paper.pdf

**데이터셋**
- GuitarSet (CC BY 4.0): https://zenodo.org/records/1422265 , https://ismir2018.ismir.net/doc/pdfs/188_Paper.pdf
- IDMT-SMT-Guitar (CC BY-NC-ND 4.0): https://zenodo.org/records/7544110
- Guitar-TECHS: https://arxiv.org/pdf/2501.03720

**제품**
- Yousician support (코드 미인식/빨간 줄): https://support.yousician.com/hc/en-us/articles/202893201-Chords-are-not-recognized
- Yousician 특허 목록: https://patents.justia.com/assignee/yousician-oy
- Rocksmith+ dev diary (2022-02): https://www.ubisoft.com/en-us/game/rocksmith/plus/news-updates/1Zcwvdcw0IwhBEYoCGCQtt/rocksmith-dev-diary-february-2022-audio-updates
- JustinGuitar Chord Perfect 포럼: https://community.justinguitar.com/t/how-do-i-properly-use-the-chord-perfect-practice-on-the-app/200534 , https://community.justinguitar.com/t/chord-perfect-exercises-dont-work/409028
- Simply Guitar 리뷰 (guitar.com, 2025-06): https://guitar.com/reviews/accessories/simply-guitar-review/
- Simply Guitar 인식 개선 가이드: https://guitar-help.hellosimply.com/en/articles/5135082-improve-note-recognition-in-simply-guitar
- GuitarTuna: https://apps.apple.com/us/app/-/id527588389
- @chordbook/tuner: https://github.com/chordbook/tuner

**테스트**
- Playwright fake audio capture: https://dkarlovi.github.io/testing-speech-recognition
- QA Wolf web audio injection: https://docs.qawolf.com/qawolf/web-audio-injection
- Chromium fake_audio_input_stream (`%noloop`): https://chromium.googlesource.com/chromium/src/+/74.0.3729.169/media/audio/fake_audio_input_stream.cc
- Karplus-Strong (JS 구현): https://amid.fish/javascript-karplus-strong
