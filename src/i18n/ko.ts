/**
 * All user-facing Korean strings live here (SPEC §12.4). Components must not hard-code Korean text;
 * tests/integrity enforces this. Parameterized strings are functions.
 */
import { GENERAL_TIPS } from '../content/tips';
import type { CoachingHint } from '../domain/coaching';

const fingerName = (finger: number | 'T') => (finger === 'T' ? '엄지' : `${finger}번 손가락`);
/** Subject form: '1번 손가락이' / '엄지가'. */
const fingerSubject = (finger: number | 'T') => (finger === 'T' ? '엄지가' : `${fingerName(finger)}이`);
/** Object form: '1번 손가락을' / '엄지를'. */
const fingerObject = (finger: number | 'T') => (finger === 'T' ? '엄지를' : `${fingerName(finger)}을`);

export const NOT_MEDICAL_ADVICE = '의학적 조언이 아닙니다.';

export type RetryReasonCode =
  | 'LOW_LEVEL'
  | 'CLIPPING'
  | 'NOISY'
  | 'AMBIGUOUS'
  | 'NO_ONSET'
  | 'MULTIPLE_ONSETS'
  | 'DETUNED';

export const ko = {
  app: {
    title: '기타 연습',
    skipToContent: '본문으로 건너뛰기',
  },
  nav: {
    home: '오늘',
    curriculum: '커리큘럼',
    library: '코드',
    tuner: '튜너',
    metronome: '메트로놈',
    progress: '진도',
    settings: '설정',
    diagnostics: '진단',
    onboarding: '처음 설정',
    main: '주 메뉴',
  },
  common: {
    next: '다음',
    retry: '다시 시도',
    start: '시작',
    stop: '정지',
    on: '켜짐',
    off: '꺼짐',
    unknown: '알 수 없음',
    withoutMic: '마이크 없이 쓰기',
    later: '나중에 하기',
    stringLabel: (stringNo: number, note: string) => `${stringNo}번 줄 (${note})`,
    cents: (cents: number) => `${cents > 0 ? '+' : ''}${cents.toFixed(1)} cents`,
    ms: (ms: number) => `${ms.toFixed(1)} ms`,
    dbfs: (db: number) => `${db.toFixed(1)} dBFS`,
  },
  home: {
    firstRun: '처음이라면 마이크와 튜닝부터 맞춰요.',
    startOnboarding: '처음 설정 시작',
    comingSoon: '오늘의 루틴은 곧 여기에 나와요.',
  },
  mic: {
    errors: {
      PERMISSION_DENIED:
        '마이크 권한이 거부됐어요. 주소창의 자물쇠 아이콘(iPad는 설정 > Safari > 마이크)에서 허용한 뒤 다시 시도하세요.',
      NO_DEVICE: '마이크를 찾지 못했어요. 마이크가 연결돼 있는지 확인하고 다시 시도하세요.',
      DEVICE_BUSY: '다른 앱이 마이크를 쓰고 있어요. 그 앱을 닫고 다시 시도하세요.',
      DEVICE_LOST: '마이크 연결이 끊겼어요. 다시 연결한 뒤 다시 시도하세요.',
      UNSUPPORTED: '이 브라우저는 마이크 입력을 지원하지 않아요. 최신 Safari나 Chrome을 써 주세요.',
      UNKNOWN: '마이크를 켜지 못했어요. 다시 시도해 주세요.',
    },
    interrupted: '다른 앱 때문에 소리가 멈췄어요. 버튼을 눌러 다시 시작하세요.',
    resume: '소리 다시 시작',
    bluetoothInput: '블루투스 마이크는 지연이 크고 음질이 낮아요. 기기 내장 마이크를 권장해요.',
    processingOn: (names: string) => `브라우저가 ${names} 기능을 끄지 않았어요. 판정이 덜 정확할 수 있어요.`,
    processingNames: {
      echoCancellation: '에코 제거',
      noiseSuppression: '잡음 제거',
      autoGainControl: '자동 음량',
    },
    noWorkaround: '마이크 없이도 수동 카운트와 자가 판정으로 연습할 수 있어요.',
  },
  diagnostics: {
    title: '진단',
    micStart: '마이크 켜기',
    micStop: '마이크 끄기',
    level: '입력 레벨',
    status: '마이크 상태',
    statusLabels: {
      idle: '꺼짐',
      starting: '켜는 중',
      running: '켜짐',
      interrupted: '중단됨',
      error: '오류',
    },
    device: '입력 장치',
    chooseDevice: '입력 장치 선택',
    defaultDevice: '기본 장치',
    trackSettings: '브라우저가 적용한 설정 (getSettings)',
    sampleRate: '샘플레이트',
    contextRate: (hz: number) => `오디오 컨텍스트 ${hz} Hz`,
    trackRate: (hz: number | null) => `마이크 트랙 ${hz === null ? '알 수 없음' : `${hz} Hz`}`,
    latency: '출력 지연 (base / output)',
    calibration: '최근 캘리브레이션',
    noCalibration: '아직 캘리브레이션을 하지 않았어요.',
    calibrationSummary: (rttMs: number, method: string, noiseDb: number) =>
      `지연 ${rttMs.toFixed(1)} ms (${method}), 주변 소음 ${noiseDb.toFixed(1)} dBFS`,
    rerunOnboarding: '캘리브레이션 다시 하기',
    allOff: '에코 제거·잡음 제거·자동 음량이 모두 꺼져 있어요.',
    gaps: (count: number, ms: number) =>
      count === 0 ? '오디오 끊김 없음' : `오디오 끊김 ${count}회 (${ms.toFixed(0)} ms, 시간은 보정됨)`,
  },
  tuner: {
    title: '튜너',
    start: '튜너 켜기',
    stop: '튜너 끄기',
    auto: '자동(크로매틱)',
    listening: '줄을 하나 튕겨 주세요.',
    inTune: '맞음',
    tuneUp: '낮아요 — 줄을 조금 조이세요',
    tuneDown: '높아요 — 줄을 조금 푸세요',
    judgingOff: '튜너를 켜 둔 동안에는 마이크 판정을 쓰지 않아요.',
    stringMode: '줄 선택',
  },
  metronome: {
    title: '메트로놈',
    start: '시작',
    stop: '정지',
    bpm: 'BPM',
    tap: '탭 템포',
    meter: '박자',
    subdivision: '세분',
    subdivisionNames: { 1: '4분음표', 2: '8분음표', 3: '셋잇단', 4: '16분음표' } as Record<number, string>,
    countIn: '카운트인',
    countInBars: (n: number) => (n === 0 ? '없음' : `${n}마디`),
    mutedBars: '음소거 마디',
    mutedOff: '끔',
    mutedPattern: (play: number, mute: number) => `${play}마디 소리 + ${mute}마디 무음`,
    visualOnly: '시각 전용 (소리 없이 깜빡임만)',
    limit: '자동 정지',
    limitOff: '없음',
    limitBars: (n: number) => `${n}마디 후`,
    limitMinutes: (n: number) => `${n}분 후`,
    ladder: '템포 사다리',
    ladderStart: '시작 BPM',
    ladderTarget: '목표 BPM',
    ladderStep: '증분',
    ladderUp: '통과 — 다음 단계로',
    countingIn: '카운트인',
    barBeat: (bar: number, beat: number) => `${bar + 1}마디 ${beat + 1}박`,
    ended: '설정한 길이만큼 연주했어요.',
    decrease: (n: number) => `BPM ${n} 내리기`,
    increase: (n: number) => `BPM ${n} 올리기`,
  },
  onboarding: {
    title: '처음 설정',
    intro: '정확한 판정을 위해 마이크·환경·튜닝·지연을 한 번 맞춰요. 5분쯤 걸려요.',
    stepNames: {
      permission: '마이크',
      noise: '환경',
      tuning: '튜닝',
      templates: '줄 소리',
      rtt: '지연',
      summary: '요약',
    },
    stepOf: (index: number, total: number, name: string) => `${index}/${total} ${name}`,
    permission: {
      explain: '기기를 기타에서 30–60cm 떨어진 곳에 두세요. 기기 내장 마이크를 권장해요.',
      allow: '마이크 허용',
      granted: '마이크가 켜졌어요.',
      device: (label: string) => `입력 장치: ${label || '알 수 없음'}`,
    },
    noise: {
      explain: '2초 동안 조용히 있어 주세요. 주변 소음을 잽니다.',
      measure: '소음 측정',
      measuring: '측정 중…',
      result: (db: number) => `주변 소음 ${db.toFixed(1)} dBFS`,
      noisy: '주변이 시끄러워요. 판정이 덜 정확할 수 있지만 계속할 수 있어요.',
      quiet: '조용해요. 좋아요!',
      again: '다시 측정',
    },
    tuning: {
      explain: '6번 줄부터 차례로 개방현을 튕겨 주세요. ±15 cents 안이면 통과해요.',
      target: (stringNo: number, note: string) => `${stringNo}번 줄 (${note}) 개방현을 튕기세요`,
      passed: (stringNo: number, cents: number) =>
        `${stringNo}번 줄 통과 (${cents > 0 ? '+' : ''}${cents.toFixed(1)} cents)`,
      tooLow: '낮아요 — 줄을 조금 조이세요.',
      tooHigh: '높아요 — 줄을 조금 푸세요.',
      otherNote: '다른 음이 들려요. 맞는 줄인지 확인하세요.',
      done: '6줄 모두 맞췄어요!',
    },
    templates: {
      explain: '각 줄의 개방현을 3번씩 튕겨 주세요. 줄마다 소리 특성을 기억해 뮤트 판정에 써요.',
      target: (stringNo: number, note: string) => `${stringNo}번 줄 (${note}) 개방현을 3번 튕기세요`,
      count: (k: number, total: number) => `${k}/${total}`,
      retry: '잘 안 들렸어요. 한 번 더 또렷하게 튕겨 주세요.',
      done: '줄 소리를 모두 기록했어요!',
    },
    rtt: {
      explain: '스피커에서 나는 짧은 소리 8개를 마이크로 들어 지연을 재요. 볼륨을 키우고 조용히 있어 주세요.',
      measure: '지연 측정',
      measuring: (attempt: number) => `측정 중… (${attempt}회째)`,
      result: (ms: number) => `지연 ${ms.toFixed(1)} ms`,
      agreeing: (a: number, b: number) => `두 번 측정: ${a.toFixed(1)} ms, ${b.toFixed(1)} ms`,
      failed: '스피커 소리를 충분히 듣지 못했어요. 클릭에 맞춰 치는 방식으로 잴게요.',
      bluetooth: '블루투스 출력은 스피커 측정이 어려워요. 클릭에 맞춰 치는 방식으로 잴게요.',
      tapExplain: '클릭 4번을 들은 뒤, 이어지는 클릭 8번에 맞춰 아무 줄이나 쳐 주세요.',
      tapStart: '탭 보정 시작',
      tapRunning: '클릭에 맞춰 쳐 주세요…',
      tapFailed: '클릭에 맞춘 소리를 충분히 찾지 못했어요. 다시 해 볼까요?',
      tryLoopback: '스피커 측정 다시 하기',
      again: '다시 측정',
    },
    summary: {
      noise: '주변 소음',
      tuning: '튜닝 (δ)',
      rtt: '지연',
      methods: { loopback: '스피커 루프백', tap: '탭 보정' },
      warnings: '주의',
      none: '없음',
      save: '저장하고 시작하기',
    },
    warnings: {
      NOISY: '주변 소음이 커요.',
      PROCESSING_ON: '브라우저 오디오 처리가 켜져 있어요.',
      BLUETOOTH_INPUT: '블루투스 마이크를 쓰고 있어요.',
      BLUETOOTH_OUTPUT: '블루투스 출력 장치를 쓰고 있어요.',
      SAMPLE_RATE_SUSPECT:
        '음높이가 전체적으로 1% 넘게 어긋나 있어요. 오디오 설정(샘플레이트)을 확인해 주세요.',
      RTT_TAP: '지연을 탭 보정으로 쟀어요(사람 반응 시간이 섞여 있어요).',
    },
  },
  coaching: {
    render(hint: CoachingHint): string {
      switch (hint.code) {
        case 'mutedOpenAdjacentFinger':
          return `${fingerSubject(hint.finger)} ${hint.stringNo}번 줄에 닿고 있을 수 있어요. 손끝을 세워 보세요.`;
        case 'mutedOpenGeneric':
          return `${hint.stringNo}번 줄은 누르지 않는 줄이에요. 손바닥이나 손가락이 닿지 않게 해 보세요.`;
        case 'mutedFretted':
          return `${fingerObject(hint.finger)} 프렛 바로 뒤에 붙이고 손끝으로 눌러 보세요.`;
        case 'wrongFret': {
          const n = Math.abs(hint.semitones);
          const amount = n === 1 ? '한 칸' : `${n}칸`;
          return hint.semitones > 0
            ? `${hint.stringNo}번 줄에서 ${amount} 높은 프렛을 누르고 있어요.`
            : `${hint.stringNo}번 줄에서 ${amount} 낮은 프렛을 누르고 있어요.`;
        }
        case 'openStringPressed':
          return `${hint.stringNo}번 줄은 누르지 않아요(개방현).`;
        case 'openStringFlat':
          return `${hint.stringNo}번 줄 소리가 낮아요. 튜닝을 다시 확인해 보세요.`;
        case 'unexpectedXString':
          return `${hint.stringNo}번 줄은 치지 않아요(x). ${hint.lowestStringNo}번 줄부터 스트럼하세요.`;
        case 'weak':
          return '조금 더 세게, 또는 기기를 기타 가까이(30–60cm) 두세요.';
        case 'generalTip':
          return GENERAL_TIPS[hint.tipIndex % GENERAL_TIPS.length] ?? '';
      }
    },
  },
  verdict: {
    pass: '깨끗해요!',
    /** FAIL always says what went wrong and how to fix it (SPEC §12.4). */
    fail(what: string, how: string): string {
      return `${what} — ${how}`;
    },
    stringMuted: (stringNo: number) => `${stringNo}번 줄이 막혔어요`,
    stringWrong: (stringNo: number) => `${stringNo}번 줄 음이 달라요`,
    stringUnexpected: (stringNo: number) => `${stringNo}번 줄이 울렸어요`,
    retry(reason: RetryReasonCode): string {
      switch (reason) {
        case 'LOW_LEVEL':
          return '잘 안 들렸어요. 조금 더 크게 한 번 더 쳐 주세요.';
        case 'CLIPPING':
          return '소리가 너무 커서 찌그러졌어요. 기기를 조금 떨어뜨려 주세요.';
        case 'NOISY':
          return '주변 소리가 커요. 조용한 곳에서 다시 해 볼까요?';
        case 'AMBIGUOUS':
          return '확실히 판단하기 어려워요. 한 번 더 쳐 주세요.';
        case 'NO_ONSET':
          return '튕기는 소리를 못 찾았어요. 한 번만 또렷하게 쳐 주세요.';
        case 'MULTIPLE_ONSETS':
          return '여러 번 친 것 같아요. 한 번만 쳐 주세요.';
        case 'DETUNED':
          return '튜닝이 많이 벗어났어요. 튜너로 먼저 맞춰 주세요.';
      }
    },
    unverifiable: '확인 불가',
    unverifiableStrum: '스트럼으로는 확인 불가 — 한 줄씩 튕겨서 확인',
    micAssistNotice: '마이크 판정은 보조 수단이에요. 내 귀가 먼저예요.',
  },
  safety: {
    notMedicalAdvice: NOT_MEDICAL_ADVICE,
    restDay: `오늘은 쉬어 가요. 날카로운 통증, 저림, 관절이나 손목 통증이 있으면 연습을 멈추고 쉬세요. 계속되면 전문가와 상담하세요. ${NOT_MEDICAL_ADVICE}`,
    painReduced: `지난번 통증이 컸어요. 오늘은 손끝에 부담이 큰 연습 시간을 절반으로 줄였어요. ${NOT_MEDICAL_ADVICE}`,
    breakReminder: '30분 동안 연습했어요. 잠깐 손을 쉬고 스트레칭해요.',
    stretchNotice: `스트레칭이지 통증 운동이 아니에요. 늘어나는 느낌까지만 하세요. ${NOT_MEDICAL_ADVICE}`,
    capConfirm: (minutes: number) =>
      `처음 4주는 하루 ${minutes}분 이내를 권장해요. 그래도 더 길게 연습할까요?`,
  },
} as const;
