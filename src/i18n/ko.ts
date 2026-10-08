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
    session: '연습',
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
  pwa: {
    updateReady: '새 버전이 있어요. 연습을 마친 뒤 업데이트하세요.',
    update: '지금 업데이트',
    later: '나중에',
    offlineReady: '이제 인터넷 없이도 쓸 수 있어요.',
  },
  home: {
    firstRun: '처음이라면 마이크와 튜닝부터 맞춰요.',
    startOnboarding: '처음 설정 시작',
    todayRoutine: '오늘의 루틴',
    totalTime: (minutes: number) => `총 ${minutes}분`,
    itemMinutes: (minutes: number) => `${minutes}분`,
    start: '연습 시작',
    doneToday: '오늘 연습을 마쳤어요. 잘했어요!',
    again: '한 번 더 하기',
    stage: (stage: number, name: string) => `Stage ${stage} · ${name}`,
    checklist: '진급 체크리스트',
    weakPairs: '약한 체인지 Top 3',
    notPracticed: '아직 안 함',
    noPairs: '코드를 두 개 배우면 체인지 쌍이 생겨요.',
    perMinute: (v: number) => `분당 ${v.toFixed(0)}회`,
    week: (minutes: number) => `이번 주 ${minutes}분`,
    streak: (weeks: number) => `주간 스트릭 ${weeks}주`,
    reviewsDue: (n: number) => `오늘 복습 ${n}개`,
    backupReminder: '마지막 백업 후 7일이 지났어요. 기록을 잃지 않게 백업해 두세요.',
    backupNow: '백업하러 가기',
    longer: '그래도 더 길게 하기',
    blocks: {
      tuning: '튜닝',
      warmup: '워밍업',
      stageReview: '지난 단계 복습',
      chord: '코드',
      changes: '체인지',
      rest: '휴식',
      rhythm: '리듬',
      technique: '기술',
      review: '복습',
      song: '연습곡',
    },
    restItem: '휴식',
    notices: {
      gapReview: (days: number) => `${days}일 만이에요. 지난 단계를 먼저 복습해요.`,
      capApplied: (minutes: number) => `처음 4주는 하루 ${minutes}분으로 맞췄어요.`,
      changesCapReached: '오늘 1분 체인지는 충분히 했어요(하루 6회).',
    },
    promote: (stage: number) => `진급 조건을 모두 채웠어요! Stage ${stage}(으)로 올라갈까요?`,
    promoteConditional:
      '쌍 몇 개가 3주째 제자리예요. 앵커·공중 체인지 드릴을 처방받고 조건부로 진급할 수 있어요.',
    promoteYes: '진급하기',
    completedBeginner: '초급 1 수료! 축하해요.',
  },
  rules: {
    countAtLeast: (subject: string, count: number) =>
      subject === 'tuning:session'
        ? `튜너로 6줄 튜닝 완료 ${count}회`
        : subject === 'song:*'
          ? `연습곡 ${count}곡 완주`
          : subject.startsWith('strum:P5')
            ? 'P5(6/8) 패턴 시도 기록'
            : `${subject} ${count}회`,
    metricAtLeast: (subject: string, value: number) => {
      if (subject === 'quiz:diagram') return `다이어그램 퀴즈 ${(value * 100).toFixed(0)}% 이상`;
      if (subject === 'altpick:any') return `한 줄 교대 피킹 ${value} BPM 통과`;
      const m = /^strum:(P\d)(?::(\w+))?$/.exec(subject);
      if (m) {
        const mode =
          m[2] === 'mute'
            ? ' 뮤트'
            : m[2] === 'progression'
              ? ' 코드 진행'
              : m[2] === 'single'
                ? ' 단일 코드'
                : '';
        return `${m[1]}${mode} ${value} BPM 통과`;
      }
      return `${subject} ≥ ${value}`;
    },
    distinctDaysAtLeast: (subject: string, value: number, days: number) =>
      `${subject} ${value} 이상, 서로 다른 ${days}일`,
    unlockedPairsAtLeast: (value: number, days: number) =>
      `배운 코드 쌍 모두 1분 체인지 ${value}회 이상(서로 다른 ${days}일)`,
    recallUnlocked: '배운 코드 모두 기억 퀴즈 3초 안에 통과',
    sessionsInStageAtLeast: (count: number) => `이 단계에서 ${count}세션 이상 연습`,
    examPassed: '초급 1 졸업 시험 통과',
    missing: (items: string) => `남은 것: ${items}`,
    met: '달성:',
    notMet: '아직:',
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
    detectorVersion: (version: string) => `판정기 버전 ${version}`,
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
  session: {
    title: '연습',
    itemOf: (index: number, total: number) => `${index}/${total}`,
    itemBudget: (seconds: number) =>
      `이 항목 남은 시간 ${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`,
    budgetOver: '계획한 시간이 지났어요. 마무리하고 다음으로 가요.',
    next: (title: string) => `다음: ${title}`,
    lastItem: '마지막 항목이에요.',
    nextItem: '다음 항목 (Enter)',
    retry: '다시 하기 (Space)',
    retrySameTempo: '같은 템포로 다시 (Space)',
    retryAtBpm: (bpm: number) => `${bpm} BPM으로 다시`,
    skip: '건너뛰기',
    previous: '이전 항목',
    pause: '일시정지',
    resume: '계속하기',
    paused: '일시정지 중',
    end: '세션 끝내기',
    finishRunFirst: '연습이 끝나면 이동할 수 있어요. 지금 그만두려면 Esc를 두 번 누르거나 "마치기"를 눌러요.',
    rest: (seconds: number) => `잠깐 쉬어요 · ${seconds}초`,
    restSkip: '바로 다음으로',
    breakReminder: '30분 동안 연습했어요. 잠깐 손을 쉬고 스트레칭해요.',
    breakOk: '알겠어요',
    reportTitle: '오늘 연습은 어땠나요?',
    pain: (n: number) => `손가락·손목 통증 ${n}/10`,
    difficulty: (n: number) => `난이도 ${n}/5`,
    danger: { sharp: '날카로운 통증', numbness: '저림', joint: '관절·손목 통증' },
    dangerLegend: '이런 증상이 있었나요?',
    note: '메모 (선택)',
    save: '저장하고 끝내기',
    saved: '세션을 저장했어요.',
    noRoutine: '오늘은 쉬는 날이에요.',
  },
  curriculum: {
    title: '커리큘럼',
    locked: '다음 버전에서 열립니다',
    current: '현재 단계',
    passed: '통과',
    learn: '배울 것',
    tips: '팁',
    criteria: '진급 기준',
    chords: (list: string) => `새 코드: ${list}`,
    exam: '졸업 시험',
    examIntro: '항목별로 따로 통과해도 돼요. 통과한 항목은 기록돼요.',
    examItems: {
      '1': '튜너로 6줄 튜닝(±5 cents)',
      '2': '무작위 8코드: 이름을 보고 3초 안에 스트럼 + 코드별 정확 체크 깨끗 50% 이상',
      '3': '무작위 5쌍 1분 체인지 각 30회 이상',
      '4': '표준 패턴 D DU UDU 80 BPM 8마디 적중 90% (시각 큐 숨김 포함)',
      '5': '연습곡 5곡 악보 숨김 완주',
    } as Record<string, string>,
    examPassedAt: (date: string) => `통과 (${date})`,
    examStart: '시작',
    examChordClean: (chord: string, pct: number) => `${chord} 깨끗 ${pct}%`,
    examSongs: (n: number) => `악보 숨김 완주 ${n}/5곡`,
    examCheck: '결과 확인',
    examNotYet: '아직 기준에 못 미쳤어요. 다시 해 봐요.',
  },
  progressScreen: {
    title: '진도',
    weekly: '주간 연습 시간(분)',
    pairs: '쌍별 1분 체인지 (점: 기록, 선: 이동 중앙값)',
    heatmap: '코드 × 줄 깨끗 비율',
    patterns: '패턴별 최고 통과 BPM',
    timing: '타이밍 평균·흔들림(ms)',
    reviews: (n: number) => `복습 대기 ${n}개`,
    sessions: '세션 기록',
    noData: '아직 기록이 없어요.',
    sessionRow: (date: string, minutes: number, done: number, planned: number) =>
      `${date} · ${minutes}분 · ${done}/${planned}항목`,
    mean: '평균',
    sd: '흔들림',
  },
  library: {
    title: '코드',
    stage: (n: number) => `Stage ${n}`,
    expected: '기대 음',
    verifiable: '스트럼으로 확인 가능한 줄',
    notVerifiable: '스트럼으로 확인 불가(한 줄씩 확인)',
    listen: '들어 보기',
    practice: '이 코드로 정밀 체크(E1)',
    level: { none: '처음', learning: '익히는 중', acquired: '습득', mastered: '숙달' } as Record<
      string,
      string
    >,
    back: '코드 목록',
  },
  settingsScreen: {
    title: '설정',
    devices: '입력 장치·진단',
    recalibrate: '캘리브레이션 다시 하기',
    theme: '테마',
    themes: { dark: '다크', light: '라이트', contrast: '고대비' },
    leftHanded: '왼손잡이(다이어그램 좌우 반전)',
    strictness: '판정 엄격도',
    strictnessNames: { lenient: '관대', normal: '보통', strict: '엄격' },
    visualOnly: '시각 전용 메트로놈(소리 없이)',
    xStringCheck: 'x줄 확인(치지 않는 줄이 조용한지 확인)',
    sessionMinutes: '세션 길이(분)',
    micDisabled: '마이크 없이 쓰기',
    micNotice: '마이크 판정은 보조 수단이에요. 내 귀가 먼저예요.',
    backup: '백업',
    exportData: '내보내기(JSON 파일)',
    importData: '가져오기',
    importPreview: (rows: string) => `가져올 데이터: ${rows}`,
    importMerge: '합치기(같은 기록은 건너뜀)',
    importReplace: '바꾸기(지금 데이터를 지우고 가져오기)',
    importReplaceConfirm: '정말 지금 데이터를 모두 지우고 바꿀까요? 되돌릴 수 없어요.',
    importDone: '가져왔어요.',
    importError: '파일을 읽지 못했어요. 이 앱에서 내보낸 JSON 파일인지 확인해 주세요.',
    exported: (name: string) => `${name} 파일로 내보냈어요.`,
    exportError: '내보내지 못했어요. 저장 공간을 확인하고 다시 해 주세요.',
    lastBackup: (date: string | null) => (date ? `마지막 백업: ${date}` : '아직 백업하지 않았어요.'),
    persist: (granted: boolean) =>
      granted
        ? '브라우저가 기록을 지우지 않도록 보호했어요.'
        : '저장소 보호를 받지 못했어요. 자주 백업해 주세요.',
    homeScreenTip:
      'iPad·iPhone에서는 Safari 공유 버튼 → "홈 화면에 추가"로 설치하면 기록이 더 안전하게 보관돼요.',
    recording: '녹음 키트',
    reset: '데이터 초기화',
    resetConfirm1: '모든 연습 기록·설정을 지울까요?',
    resetConfirm2: '정말 지울까요? 되돌릴 수 없어요. (백업을 먼저 권장해요)',
    resetDone: '모든 데이터를 지웠어요.',
    yes: '네',
    no: '아니요',
    cancel: '취소',
    keys: '키·페달',
  },
  recording: {
    title: '녹음 키트',
    intro: '내 기타·내 방 소리로 판정기를 확인하는 데 쓰는 짧은 녹음이에요. 녹음은 기기 안에만 저장돼요.',
    record: '녹음',
    stop: '멈춤',
    recording: (s: number) => `녹음 중… ${s.toFixed(0)}초`,
    saved: '저장했어요.',
    save: '저장',
    count: '직접 센 횟수',
    exportAll: '모두 내보내기(zip)',
    exported: '내보냈어요.',
    exportedWithout: (n: number) =>
      `내보냈어요. 오디오 파일이 없는 기록 ${n}개는 뺐어요(백업에서 가져온 녹음 기록에는 오디오가 없어요).`,
    noFiles: '내보낼 오디오 파일이 없어요. 백업에서 가져온 녹음 기록에는 오디오가 들어 있지 않아요.',
    failed:
      '녹음하거나 저장하지 못했어요. 저장 공간이 부족하거나 브라우저가 막았을 수 있어요. 다시 해 주세요.',
    gap: '녹음이 중간에 끊겼어요(화면이 꺼졌거나 다른 앱으로 넘어갔을 수 있어요). 이 녹음은 버리고 다시 녹음해 주세요.',
    empty: '아직 녹음이 없어요.',
    unsupported: '이 브라우저는 기기 내 저장(OPFS)을 지원하지 않아요.',
    kinds: {
      'chord-clean-strum': (chord: string) => `${chord} 깨끗한 스트럼 1번`,
      'chord-pluck': (chord: string) => `${chord} 한 줄씩 저음부터 튕기기`,
      'chord-muted': (chord: string, stringNo: number) => `${chord} ${stringNo}번 줄 일부러 막고 스트럼`,
      'x-string': (chord: string, stringNo: number) => `${chord} ${stringNo}번 줄(x)까지 울리며 스트럼`,
      'one-minute': (from: string, to: string) => `${from}↔${to} 30초 체인지(끝나고 센 횟수 입력)`,
      'strum-grid': (bpm: number) => `메트로놈 ${bpm} BPM에 맞춰 8마디 스트럼`,
    },
  },
  keys: {
    actions: {
      toggle: '시작/정지',
      next: '다음·확인',
      prev: '이전',
      inc: '올리기·+1 보정',
      dec: '내리기·−1 보정',
      abort: '중단',
      mark: '표시·다시 듣기',
      manual1: '1 깨끗',
      manual2: '2 막힘',
      manual3: '3 버징',
    } as Record<string, string>,
    keyNames: {
      ' ': 'Space',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Escape: 'Esc',
    } as Record<string, string>,
    learn: '페달 학습',
    learnPrompt: (action: string) => `"${action}"에 쓸 페달이나 키를 눌러 주세요… (Esc 취소)`,
    learned: (key: string, action: string) => `${key} → ${action}`,
    defaults: '기본 키',
    custom: '학습한 키',
    remove: '지우기',
    pedalTip: '블루투스 페이지 터너 페달은 키보드처럼 동작해요. 페달 버튼을 원하는 동작에 연결하세요.',
    hint: 'Space 시작/정지 · Enter 다음 · ↑↓ 보정 · 1/2/3 수동 판정 · Esc 중단',
    confirmAbort: '연습을 중단할까요? 지금까지 한 것은 기록돼요.',
    abortYes: '중단하기',
    abortNo: '계속하기',
  },
  exercises: {
    titles: {
      E0: '튜닝',
      E1: '코드 정밀 체크',
      E2: '1분 코드 체인지',
      E4: '앵커·공중 체인지 드릴',
      E5: '스트러밍 패턴 사다리',
      E6: '박 1 체인지',
      E7: '손가락 스트레칭',
      E8: '한 줄 교대 피킹',
      Q1: '다이어그램 읽기 퀴즈',
      Q2: '코드 기억 퀴즈',
      Q3: '개방현 음이름 퀴즈',
      Q4: '메이저/마이너 귀 훈련',
      S: '연습곡',
    },
    common: {
      start: '시작',
      startWithMic: '마이크 켜고 시작',
      finish: '마치기',
      remaining: '남은 시간',
      saved: '기록했어요.',
      nothingToSave: '시작 전에 멈췄거나 채점할 수 없어서 기록하지 않았어요.',
      saveFailed: '기록하지 못했어요. 다시 시도해 주세요.',
      saving: '기록하는 중…',
      again: '한 번 더',
      home: '홈으로',
      beta: '베타',
      noMic: '마이크 없이 진행해요(수동·자가 판정).',
      unknownExercise: '알 수 없는 연습이에요.',
      paused: '일시정지',
    },
    stringStatus: {
      OK: '깨끗',
      MUTED: '막힘',
      WRONG_NOTE: '다른 음',
      UNEXPECTED: '울리면 안 돼요',
      WEAK: '약함',
      UNVERIFIABLE: '확인 불가',
      NOT_PLAYED: '치지 않는 줄',
      pending: '대기',
      hidden: '내 판단 먼저',
    },
    selfStatus: { clean: '깨끗', muted: '막힘', buzz: '버징' },
    e1: {
      modes: { pluck: '한 줄씩', strum: '스트럼 (베타)', manual: '수동' },
      place: '다이어그램을 보고 손가락 번호 순서대로 놓으세요. 준비되면 "준비됐어요"(Space/Enter).',
      placeReady: '준비됐어요',
      pluckString: (stringNo: number) => `${stringNo}번 줄을 튕기세요`,
      silentString: (stringNo: number) => `${stringNo}번 줄(x)을 튕겨 보세요 — 소리가 나지 않아야 해요`,
      strum: '저음 줄부터 전체를 한 번 스트럼하세요',
      selfPrompt: '먼저 내 귀로 판단해 보세요: 1 깨끗 · 2 막힘 · 3 버징',
      manualPrompt: (stringNo: number) =>
        `${stringNo}번 줄을 튕기고 소리를 골라 주세요: 1 깨끗 · 2 막힘 · 3 버징`,
      release: '전체를 한 번 스트럼해 들어 본 뒤, 손을 떼었다가 다시 잡아요.',
      nextAttempt: '다시 잡기',
      clean: '깨끗해요!',
      suggestPluck: '스트럼으로는 판단이 어려워요. "한 줄씩" 모드로 줄마다 확인해 보세요.',
      skip: '이 줄 건너뛰기',
      notClean: '아직 깨끗하지 않은 줄이 있어요.',
      stats: (clean: number, total: number) => `깨끗한 시도 ${clean}/${total}`,
      cleanRatio: (ratio: number) => `깨끗한 비율 ${(ratio * 100).toFixed(0)}%`,
      selfAgreement: (ratio: number) => `내 귀와 앱 판정 일치 ${(ratio * 100).toFixed(0)}%`,
      diagramLabel: (symbol: string) => `${symbol} 코드 다이어그램`,
      fingerAt: (stringNo: number, fret: number, finger: string) => `${stringNo}번 줄 ${fret}프렛 ${finger}`,
      openString: (stringNo: number) => `${stringNo}번 줄 개방`,
      mutedString: (stringNo: number) => `${stringNo}번 줄 치지 않음`,
      fingerName: (finger: number | 'T') => (finger === 'T' ? '엄지' : `${finger}번 손가락`),
      baseFret: (fret: number) => `${fret}프렛`,
    },
    song: {
      modes: { learn: '학습 모드(멈추고 다시 해도 돼요)', perform: '연주 모드(멈추지 않기)' },
      listen: '들어 보기',
      again: '처음부터 다시 (Space)',
      start: '시작',
      stop: '멈추기',
      section: (name: string) => `${name} 부분`,
      loop: (name: string) => `${name} 부분 반복`,
      hidden: '악보 숨김 — 외워서 쳐 봐요',
      bar: (bar: number, bars: number) => `${bar}/${bars}마디`,
      reviewPrompt: '어땠나요? 맞는 것을 고르고 확인(Enter)을 누르세요.',
      completed: '끝까지 쳤어요 (1)',
      memorized: '외워서 쳤어요 (2)',
      stops: (n: number) => `멈춘 횟수 ${n} (↑↓)`,
      confirm: '확인',
      beat1: (rate: number) => `마디 첫 박 적중률 ${(rate * 100).toFixed(0)}%`,
      summary: (completed: boolean, stops: number) => `${completed ? '완주' : '중간까지'} · 멈춤 ${stops}회`,
      memorizedTag: '외워서',
    },
    quiz: {
      progress: (index: number, total: number) => `${index}/${total}`,
      correct: '정답!',
      wrong: (answer: string) => `아쉬워요. 정답: ${answer}`,
      next: '다음 문제',
      score: (correct: number, total: number) => `${total}문제 중 ${correct}개 정답`,
      reaction: (ms: number) => `평균 반응 ${(ms / 1000).toFixed(1)}초`,
      keysHint: '답은 1/2/3 키로도 고를 수 있어요.',
    },
    q1: {
      positionPrompt: '표시된 점은 몇 번 줄, 몇 프렛, 몇 번 손가락인가요?',
      position: (stringNo: number, fret: number, finger: string) =>
        `${stringNo}번 줄 · ${fret}프렛 · ${finger}`,
      symbolPrompt: (stringNo: number) => `${stringNo}번 줄 위의 표시는 무슨 뜻인가요?`,
      symbolX: '치지 않는 줄(x)',
      symbolO: '누르지 않고 치는 개방현(o)',
      symbolPress: '1프렛을 누르고 침',
    },
    q2: {
      prompt: (chord: string) => `${chord} 코드를 잡고 한 번 스트럼하세요`,
      countdown: (s: number) => `${s}초`,
      heard: (chord: string) => `들린 코드: ${chord}`,
      tooSlow: '맞았지만 3초를 넘겼어요.',
      timeout: '시간이 지났어요.',
      selfPrompt: '3초 안에 잡았나요? 1 잡았어요 · 2 못 잡았어요',
      self: { manual1: '잡았어요', manual2: '못 잡았어요' },
      passed: (n: number, total: number) => `3초 안에 정확히 잡은 코드 ${n}/${total}`,
    },
    q3: {
      namePrompt: (stringNo: number) => `${stringNo}번 줄 개방현의 음이름은?`,
      pluckPrompt: (note: string) => `${note} 음이 나는 개방현을 튕기세요`,
      heard: (note: string) => `들린 음: ${note}`,
    },
    q4: {
      prompt: '들려준 코드는 메이저일까요, 마이너일까요?',
      major: '메이저(밝은 소리)',
      minor: '마이너(어두운 소리)',
      replay: '다시 듣기',
    },
    e6: {
      how: '마디마다 코드 하나. 다음 마디 첫 박에 맞춰 바꾸고, 멈추지 말고 계속 쳐요.',
      now: (chord: string) => `지금 ${chord}`,
      next: (chord: string) => `다음 ${chord}`,
      selfPrompt: '어땠나요? 1 모두 제때 · 2 한두 번 늦음 · 3 멈춘 적 있음',
      self: { manual1: '모두 제때', manual2: '한두 번 늦음', manual3: '멈춤 있음' },
      bars: (inWindow: number, bars: number) => `제때 바꾼 마디 ${inWindow}/${bars}`,
      stops: (n: number) => `멈춤 ${n}회`,
      delay: (ms: number) => `첫 박 평균 ${ms >= 0 ? '+' : ''}${ms.toFixed(0)} ms`,
      passed: (bpm: number) => `통과! 다음엔 ${bpm} BPM`,
      notYet: '14/16마디 이상 제때 + 멈춤 0이면 다음 빠르기로 가요.',
    },
    e8: {
      how: (stringNo: number) => `${stringNo}번 줄 하나만, 다운·업을 번갈아 8분음표로 고르게 쳐요.`,
      selfPrompt: '어땠나요? 1 고르게 다 침 · 2 가끔 놓침 · 3 자주 놓침',
      self: { manual1: '고르게 다 침', manual2: '가끔 놓침', manual3: '자주 놓침' },
      hitRate: (rate: number) => `적중률 ${(rate * 100).toFixed(0)}%`,
      evenness: (cv: number) => `고르기(간격 변동) ${(cv * 100).toFixed(0)}%`,
      passed: (bpm: number) => `통과! 다음엔 ${bpm} BPM`,
      notYet: '적중률 90% 이상 + 간격 변동 10% 이하면 +5 BPM.',
    },
    e0: {
      target: (stringNo: number, note: string) => `${stringNo}번 줄 (${note})을 튕기고 맞춰요`,
      manual: (stringNo: number, note: string) =>
        `${stringNo}번 줄 (${note})을 다른 튜너로 맞춘 뒤 다음(Enter)`,
      skip: '이 줄 건너뛰기',
      next: '맞췄어요',
      inTune: '맞음',
      done: (n: number) => `${n}/6줄 맞음`,
      complete: '6줄 모두 맞췄어요!',
    },
    e4: {
      anchorTitle: '앵커 체인지',
      airTitle: '공중 체인지',
      anchor: (finger: string, stringNo: number, fret: number) =>
        `${finger}(${stringNo}번 줄 ${fret}프렛)은 떼지 마세요.`,
      slide: (finger: string, stringNo: number, from: number, to: number) =>
        `${finger}은 ${stringNo}번 줄에서 ${from}프렛 → ${to}프렛으로 미끄러뜨려요.`,
      anchorHow: '나머지 손가락만 천천히 옮겨요. 스트럼은 하지 않아요.',
      airHow: '줄 위 공중에서 손 모양을 먼저 만들고, 모든 손가락을 동시에 내려놓아요.',
      start: '시작',
      stop: '그만하기',
      review: '동시에 깔끔하게 착지한 횟수는 10번 중 몇 번이었나요? (↑↓, 확인 Enter)',
      confirm: '확인',
      success: (n: number) => `${n}/10`,
      noScore: '점수는 없어요. 천천히, 정확하게.',
    },
    e7: {
      startFret: (fret: number) => `${fret}프렛에서 시작해요`,
      how: '1번 손가락부터 4번 손가락까지 한 프렛씩 벌려 짚고, 한 줄씩 옮겨 가요.',
      start: '시작',
      stop: '그만하기',
      painPrompt: '지금 손가락·손목 통증은 0–10 중 얼마인가요? (↑↓, 확인 Enter)',
      pain: (n: number) => `통증 ${n}/10`,
      confirm: '확인',
    },
    e5: {
      modes: { mute: '뮤트 스트럼', single: '코드 하나', progression: '코드 진행' },
      countIn: '카운트인 — 다음 마디부터 쳐요',
      bar: (bar: number, bars: number) => `${bar}/${bars}마디`,
      keepGoing: '놓쳐도 멈추지 말고 계속 쳐요. 손은 쉼표에서도 계속 움직여요.',
      cuesHidden: '시각 큐 숨김',
      analyzing: '채점하는 중…',
      analysisFailed: '채점하지 못했어요. 이번 연주는 기록하지 않았어요.',
      armed: '첫 스트럼이나 Space로 시작해요(카운트인 1마디).',
      ready: '시작 버튼이나 Space로 시작해요(카운트인 1마디).',
      start: '시작',
      selfPrompt: '어땠나요? 1 놓친 박 없음 · 2 가끔 놓침 · 3 자주 놓침',
      self: { manual1: '놓친 박 없음', manual2: '가끔 놓침', manual3: '자주 놓침' },
      hitRate: (rate: number) => `적중률 ${(rate * 100).toFixed(0)}%`,
      corrected: (rate: number) => `내 버릇(일정한 앞/뒤 쏠림) 보정 시 ${(rate * 100).toFixed(0)}%`,
      mean: (ms: number) => `평균 ${ms >= 0 ? '+' : ''}${ms.toFixed(0)} ms (${ms >= 0 ? '늦게' : '일찍'})`,
      sd: (ms: number) => `흔들림(표준편차) ${ms.toFixed(0)} ms`,
      counts: (hits: number, misses: number, extras: number) =>
        `맞음 ${hits} · 놓침 ${misses} · 추가 ${extras}`,
      ladder: {
        up: (bpm: number) => `잘했어요! 다음엔 ${bpm} BPM으로 올려 보세요.`,
        down: (bpm: number) => `${bpm} BPM으로 내려서 다져 봐요.`,
        stay: (bpm: number) => `${bpm} BPM으로 한 번 더 해 봐요.`,
      },
      direction: { D: '↓', U: '↑', '-': '·' },
      directionLabel: { D: '다운', U: '업', '-': '쉼' },
      directionNote: '방향(다운/업)은 아직 판정하지 않아요.',
    },
    e2: {
      modes: { auto: '자동 카운트', tap: '탭 카운트', manual: '직접 입력' },
      armed: (from: string) => `${from} 코드를 잡고 기다리세요. 첫 스트럼으로 시작해요(Space로도 시작).`,
      ready: '준비되면 시작(Space).',
      start: '시작',
      count: '체인지',
      lowConfidence: (n: number) => `애매한 스트럼 ${n}`,
      next: (chord: string) => `다음: ${chord}`,
      tap: '+1 바꿨어요',
      plus: '+1 보정',
      minus: '−1 보정',
      review: '시간 끝! 개수가 맞는지 확인하고 ↑↓로 고친 뒤 확인(Enter)을 누르세요.',
      manualReview: '바꾼 횟수를 ↑↓(또는 버튼)로 입력하고 확인(Enter)을 누르세요.',
      confirm: '확인',
      soundNote: '소리 품질은 채점하지 않아요. 손이 얼마나 빨리 옮겨 가는지만 세요.',
      perMinute: (cpm: number) => `분당 ${cpm.toFixed(1)}회`,
      detail: (detected: number, corrected: number | null) =>
        corrected === null ? `자동 ${detected}회` : `자동 ${detected}회 → 보정 ${corrected}회`,
    },
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
