/**
 * App-authored curriculum (SPEC v1.1 §7.1–7.3, research 01 §5.2). Every learn item names what practises it
 * (`practicedBy`, checked against the §7.1 table by tests/integrity), every stage carries its rotation lists and
 * its E5 progression, and unlock rules are data evaluated by domain/progression.ts.
 */
import { pairId } from '../domain/pairs';
import type { ExerciseRef, LearnItem, Rotation, StageDef, UnlockRule } from './schemas';

const BEGINNER1_MIN_SESSIONS = 4;
const BEGINNER2_MIN_SESSIONS = 8;
const BEGINNER2_MIN_DAYS = 14;

const sessions = (count: number): UnlockRule => ({ kind: 'sessionsInStageAtLeast', count });
const days = (n: number): UnlockRule => ({ kind: 'daysInStageAtLeast', days: n });
const pairs30: UnlockRule = { kind: 'unlockedPairsAtLeast', value: 30, days: 2 };
const recall = (...voicingIds: string[]): UnlockRule => ({ kind: 'recallPassed', voicingIds });
const passBpm = (subject: string, value: number): UnlockRule => ({
  kind: 'metricAtLeast',
  subject,
  metric: 'passBpm',
  value,
});

const learn = (text: string, ...practicedBy: string[]): LearnItem => ({ text, practicedBy });
const ex = (type: string, params: Record<string, unknown> = {}): ExerciseRef => ({ type, params });
const rotation = (lists: Partial<Rotation>): Rotation => ({
  rhythm: [],
  scales: [],
  technique: [],
  knowledge: [],
  ...lists,
});
const pairsOf = (list: readonly (readonly [string, string])[]) => list.map(([a, b]) => pairId(a, b));

/** Stage 11 pairs: I–IV–V of the G, A and E 12-bar blues (§6.5). */
const STAGE11_PAIRS = pairsOf([
  ['G7', 'C7'],
  ['C7', 'D7'],
  ['D7', 'G7'],
  ['A7', 'D7'],
  ['D7', 'E7'],
  ['E7', 'A7'],
  ['A7', 'B7'],
  ['B7', 'E7'],
]);

export const CURRICULUM: readonly StageDef[] = [
  {
    stage: 0,
    name: '준비',
    summary: '튜닝, 자세, 피크 잡기, 코드 다이어그램 읽기, 프렛 가까이 누르기, 박 세기를 익혀요.',
    learn: [
      learn('튜너로 6줄 맞추기', 'E0'),
      learn('앉은 자세와 기타 잡는 법', 'K1:posture'),
      learn('피크 잡기', 'K1:pick'),
      learn('코드 다이어그램 읽기', 'Q1'),
      learn('프렛 바로 뒤를 누르기', 'E16'),
      learn('박 소리 내어 세기', 'E5:P0', 'K1:countAloud'),
    ],
    tips: [
      '프렛 바로 뒤(프렛 쇠 가까이)를 누르면 적은 힘으로도 깨끗하게 울려요.',
      '처음엔 손끝이 아픈 게 정상이에요. 짧게 자주 연습하세요.',
    ],
    newChords: [],
    stagePairs: [],
    rhythmProgression: [],
    rotation: rotation({}),
    unlockRules: [
      { kind: 'countAtLeast', subject: 'tuning:session', metric: 'complete', minValue: 1, count: 3 },
      { kind: 'metricAtLeast', subject: 'quiz:diagram', metric: 'accuracy', value: 0.9 },
      sessions(BEGINNER1_MIN_SESSIONS),
    ],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 1,
    name: '첫 두 코드',
    summary: 'D와 A 코드를 배우고, 두 코드를 오가며 박 1에 바꾸는 연습을 시작해요.',
    learn: [
      learn('D·A 코드', 'E1', 'Q2'),
      learn('앵커 손가락(1번 손가락은 3번 줄 2프렛에 그대로)', 'E4'),
      learn('1분 코드 체인지', 'E2'),
      learn('박 1에 코드 바꾸기', 'E6'),
      learn('2코드 곡', 'S'),
    ],
    tips: [
      'D↔A를 바꿀 때 1번 손가락은 3번 줄 2프렛에서 떼지 마세요.',
      '1분 코드 체인지는 소리보다 손 모양을 빨리 만드는 연습이에요.',
    ],
    newChords: ['D', 'A'],
    stagePairs: [],
    rhythmProgression: ['D', 'A', 'D', 'A'],
    rotation: rotation({}),
    unlockRules: [recall('D', 'A'), pairs30, sessions(BEGINNER1_MIN_SESSIONS)],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 2,
    name: '세 번째 코드와 박',
    summary: 'E 코드를 더하고, 박의 첫 박에 코드를 바꾸며 발로 박을 세요.',
    learn: [
      learn('E 코드', 'E1', 'Q2'),
      learn('박 1에 코드 바꾸기', 'E6'),
      learn('발로 박 세기', 'K1:footTap', 'E5'),
      learn('다운 스트럼 온 비트', 'E5'),
      learn('첫 단음 리프', 'E17'),
    ],
    tips: [
      '코드를 바꿀 때는 다음 마디 첫 박 전에 미리 움직이세요.',
      '발로 박을 세면 리듬이 흔들리지 않아요.',
    ],
    newChords: ['E'],
    stagePairs: [],
    rhythmProgression: ['A', 'D', 'E', 'A'],
    rotation: rotation({
      rhythm: [ex('E5', { patternId: 'P0' }), ex('E6', { progression: ['A', 'D', 'E', 'A'] })],
      technique: [ex('E17', { riffId: 'R1' }), ex('E4', { pair: 'A|E' })],
    }),
    unlockRules: [
      recall('E'),
      pairs30,
      { kind: 'songsCompletedAtLeast', filter: { stage: 2 }, count: 1 },
      sessions(BEGINNER1_MIN_SESSIONS),
    ],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 3,
    name: '마이너 코드와 업스트럼',
    summary: 'Em, Am 코드와 업스트럼이 들어간 패턴을 배워요.',
    learn: [
      learn('Em·Am 코드', 'E1', 'Q2'),
      learn('업스트럼(D DU D D)', 'E5:P1'),
      learn('D DU DU D 패턴(뮤트)', 'E5:P2'),
      learn('체인지 Am–E · Em–D · Am–Em', 'E2'),
    ],
    tips: ['업스트럼은 높은 줄 몇 개만 가볍게 스쳐도 충분해요.', '손은 박에 맞춰 계속 위아래로 움직이세요.'],
    newChords: ['Em', 'Am'],
    stagePairs: [],
    rhythmProgression: ['Em', 'Am', 'D', 'Em'],
    rotation: rotation({
      rhythm: [ex('E5', { patternId: 'P1' }), ex('E5', { patternId: 'P2', mode: 'mute' })],
      technique: [ex('E4', { pair: 'Am|E' })],
    }),
    unlockRules: [
      recall('Em', 'Am'),
      pairs30,
      passBpm('strum:P2:mute', 70),
      sessions(BEGINNER1_MIN_SESSIONS),
    ],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 4,
    name: '메트로놈과 표준 패턴',
    summary: 'Dm 코드와 표준 스트럼 패턴 D DU UDU를 메트로놈에 맞춰 익히고, TAB을 읽기 시작해요.',
    learn: [
      learn('Dm 코드', 'E1', 'Q2'),
      learn('메트로놈(1박 악센트)', 'E5'),
      learn('표준 패턴 D DU UDU', 'E5:P3'),
      learn('손가락 스트레칭', 'E7'),
      learn('TAB 읽기', 'Q5'),
      learn('리프', 'E17'),
    ],
    tips: [
      '패턴은 뮤트 → 한 코드 → 코드 바꾸기 순서로 올리세요.',
      '스트레칭은 늘어나는 느낌까지만, 아프면 멈추세요.',
    ],
    newChords: ['Dm'],
    stagePairs: [],
    rhythmProgression: ['Dm', 'A', 'Dm', 'A'],
    rotation: rotation({
      rhythm: [ex('E5', { patternId: 'P3' }), ex('E6', { progression: ['Dm', 'A', 'Dm', 'A'] })],
      technique: [ex('Q5'), ex('E17', { riffId: 'R2' })],
    }),
    unlockRules: [
      recall('D', 'A', 'E', 'Em', 'Am', 'Dm'),
      passBpm('strum:P3:mute', 80),
      sessions(BEGINNER1_MIN_SESSIONS),
    ],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 5,
    name: 'C 코드',
    summary: 'C 코드를 배우고, 패턴 안에서 코드를 바꾸며 개방현 음이름을 익혀요.',
    learn: [
      learn('C 코드', 'E1', 'Q2'),
      learn('체인지 Am–C · C–Em', 'E2'),
      learn('패턴 안에서 코드 바꾸기', 'E5:P3', 'E6'),
      learn('음이름 기초', 'Q3'),
    ],
    tips: [
      'C 코드의 3번 손가락 끝을 세워 4번 줄이 막히지 않게 하세요.',
      'Am → C는 1·2번 손가락이 그대로예요.',
    ],
    newChords: ['C'],
    stagePairs: [],
    rhythmProgression: ['C', 'Am', 'Dm', 'E'],
    rotation: rotation({
      rhythm: [
        ex('E5', { patternId: 'P3', mode: 'progression' }),
        ex('E6', { progression: ['C', 'Am', 'Dm', 'E'] }),
      ],
      technique: [ex('Q3', { scope: 'open' }), ex('E4', { pair: 'Am|C' })],
    }),
    unlockRules: [
      recall('D', 'A', 'E', 'Em', 'Am', 'Dm', 'C'),
      pairs30,
      passBpm('strum:P3:progression', 70),
      sessions(BEGINNER1_MIN_SESSIONS),
    ],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 6,
    name: 'G 코드와 교대 피킹',
    summary: '두 손가락 G로 시작해 세 손가락 G로 넘어가고, 한 줄 교대 피킹과 6/8 박자를 배워요.',
    learn: [
      learn('G 코드(두 손가락 → 세 손가락)', 'E1', 'Q2'),
      learn('한 줄 교대 피킹', 'E8'),
      learn('6/8 스트럼', 'E5:P5'),
      learn('개방현 음이름', 'Q3'),
      learn('체인지 G–C · G–D · C–D', 'E2'),
    ],
    tips: [
      'G → C는 앵커가 없어요. 손 모양을 공중에서 먼저 만들고 한 번에 내려놓으세요.',
      '피크는 줄에 살짝 비스듬히 대세요.',
    ],
    newChords: ['G-2f', 'G-3f'],
    stagePairs: [],
    rhythmProgression: ['G', 'C', 'D', 'G'],
    rotation: rotation({
      rhythm: [ex('E5', { patternId: 'P5' }), ex('E5', { patternId: 'P3', mode: 'progression' })],
      technique: [ex('E8', { stringIdx: 3 }), ex('Q3', { scope: 'open' })],
    }),
    unlockRules: [
      recall('D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G'),
      pairs30,
      passBpm('altpick:any', 70),
      { kind: 'countAtLeast', subject: 'strum:P5', metric: 'hitRate', minValue: 0, count: 1 },
      sessions(BEGINNER1_MIN_SESSIONS),
    ],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 7,
    name: '통합',
    summary: '8개 코드를 정리하고 25쌍을 순환하며, 곡을 외워 치고 졸업 시험을 준비해요.',
    learn: [
      learn('공중 체인지', 'E4'),
      learn('25쌍 순환', 'E2'),
      learn('셈여림', 'E5:dynamics'),
      learn('메이저/마이너 듣고 구분하기', 'Q4'),
      learn('연습곡 외워서 치기', 'S'),
    ],
    tips: ['졸업 시험은 항목별로 따로 통과해도 돼요.', '악보 없이 치려면 코드 진행을 소리 내어 말해 보세요.'],
    newChords: [],
    stagePairs: [],
    rhythmProgression: ['C', 'G', 'Am', 'Em'],
    rotation: rotation({
      rhythm: [
        ex('E5', { patternId: 'P3', cuesHidden: true }),
        ex('E5', { patternId: 'P3', dynamics: true }),
      ],
      technique: [ex('E4', { pair: 'C|G', air: true }), ex('Q4', { kind: 'majmin' })],
    }),
    unlockRules: [{ kind: 'examPassed' }, sessions(BEGINNER1_MIN_SESSIONS)],
    minSessions: BEGINNER1_MIN_SESSIONS,
    minDays: 0,
    locked: false,
  },
  {
    stage: 8,
    name: '드론 코드와 첫 스케일',
    summary: '네 손가락 G, Cadd9, Dsus4, A7sus4, Em7과 Em 펜타토닉, 정확 빠른 체인지를 배워요.',
    learn: [
      learn('신규 코드 5개(G 네 손가락, Cadd9, Dsus4, A7sus4, Em7)', 'E1', 'Q2'),
      learn('정확 빠른 체인지', 'E3'),
      learn('Em 펜타토닉', 'E10'),
      learn('다운 8분 악센트', 'E5:P4'),
      learn('의도적 뮤트', 'E5:P6', 'K1:deliberateMute'),
      learn('개방 포지션 음', 'Q3'),
      learn('리프', 'E17'),
    ],
    tips: [
      '드론 코드는 3·4번 손가락을 1·2번 줄 3프렛에 그대로 두고 나머지만 바꿔요.',
      '정확 빠른 체인지는 1분 체인지보다 점수가 낮은 게 정상이에요.',
    ],
    newChords: ['G-4f', 'Cadd9', 'Dsus4', 'A7sus4', 'Em7'],
    stagePairs: pairsOf([
      ['G-4f', 'D'],
      ['G-4f', 'Cadd9'],
      ['Cadd9', 'Dsus4'],
      ['Dsus4', 'A7sus4'],
      ['G-4f', 'Em7'],
      ['Em7', 'Cadd9'],
    ]),
    rhythmProgression: ['G-4f', 'Cadd9', 'Dsus4', 'Em7'],
    rotation: rotation({
      rhythm: [ex('E5', { patternId: 'P4' }), ex('E5', { patternId: 'P6' })],
      scales: [ex('E10', { scaleId: 'em-pent-open' })],
      technique: [ex('E17', { riffId: 'R3' })],
      knowledge: [ex('Q3', { scope: 'openPosition' })],
    }),
    unlockRules: [
      { kind: 'scaleStepGraduated', scaleId: 'em-pent-open', step: 1, bpm: 80 },
      passBpm('strum:P4', 80),
      recall('G-4f', 'Cadd9', 'Dsus4', 'A7sus4', 'Em7'),
      { kind: 'songsCompletedAtLeast', filter: { stage: 8 }, count: 2 },
      sessions(BEGINNER2_MIN_SESSIONS),
      days(BEGINNER2_MIN_DAYS),
    ],
    minSessions: BEGINNER2_MIN_SESSIONS,
    minDays: BEGINNER2_MIN_DAYS,
    locked: true,
  },
  {
    stage: 9,
    name: 'F 코드와 새끼손가락',
    summary: 'Fmaj7 → 작은 F → 바레 F 순서로 F를 익히고, 새끼손가락 운동과 C 메이저 스케일을 해요.',
    learn: [
      learn('F 계열 코드(Fmaj7 → 작은 F → 바레 F)', 'E1', 'Q2'),
      learn('새끼손가락 운동', 'E12'),
      learn('C 메이저 스케일', 'E10'),
      learn('F 정확 빠른 체인지', 'E3'),
      learn('인터벌 듣기', 'Q4'),
    ],
    tips: [
      '바레는 1번 손가락을 프렛 바로 뒤에 두고 엄지 쪽으로 살짝 굴려 뼈 쪽으로 누르세요.',
      '아직 바레 F가 어려우면 작은 F로 먼저 쳐도 돼요.',
    ],
    newChords: ['Fmaj7', 'F-small', 'F'],
    stagePairs: pairsOf([
      ['Fmaj7', 'C'],
      ['Fmaj7', 'G'],
      ['D', 'F'],
      ['F', 'C'],
      ['Am', 'F'],
      ['F', 'G'],
    ]),
    rhythmProgression: ['Am', 'F', 'C', 'G'],
    rotation: rotation({
      rhythm: [
        ex('E5', { patternId: 'P3', mode: 'progression' }),
        ex('E6', { progression: ['C', 'F', 'G', 'C'] }),
      ],
      scales: [ex('E10', { scaleId: 'c-major-open' })],
      technique: [ex('E12')],
      knowledge: [ex('Q4', { kind: 'interval' }), ex('Q3', { scope: 'openPosition' })],
    }),
    unlockRules: [
      { kind: 'chordCleanRatioAtLeast', voicingIds: ['F-small', 'F'], window: 10, ratio: 0.7 },
      { kind: 'scaleMemorized', scaleId: 'c-major-open' },
      { kind: 'songsCompletedAtLeast', filter: { anyChords: ['Fmaj7', 'F-small', 'F'] }, count: 1 },
      sessions(BEGINNER2_MIN_SESSIONS),
      days(BEGINNER2_MIN_DAYS),
    ],
    minSessions: BEGINNER2_MIN_SESSIONS,
    minDays: BEGINNER2_MIN_DAYS,
    locked: true,
  },
  {
    stage: 10,
    name: '파워코드와 펜타토닉',
    summary: '6·5번 줄 루트 파워코드와 팜뮤트, Am 펜타토닉 1포지션, 크로매틱을 배워요.',
    learn: [
      learn('파워코드(G5, C5, E5, A5, D5, F5)', 'E1', 'Q2'),
      learn('팜뮤트', 'E5:P4', 'K1:palmMute'),
      learn('Am 펜타토닉 1포지션', 'E10'),
      learn('6·5번 줄 음이름', 'Q3'),
      learn('크로매틱', 'E9'),
      learn('리프', 'E17'),
    ],
    tips: ['파워코드는 연주하지 않는 줄을 왼손 손가락으로 살짝 덮어 뮤트하세요.'],
    newChords: ['G5', 'C5', 'E5', 'A5', 'D5', 'F5'],
    stagePairs: pairsOf([
      ['E5', 'A5'],
      ['A5', 'D5'],
      ['G5', 'C5'],
      ['E5', 'G5'],
      ['F5', 'G5'],
    ]),
    rhythmProgression: ['E5', 'A5', 'D5', 'A5'],
    rotation: rotation({
      rhythm: [ex('E5', { patternId: 'P4', palmMute: true }), ex('E5', { patternId: 'P6' })],
      scales: [ex('E10', { scaleId: 'am-pent-pos1' }), ex('E9')],
      technique: [ex('E17', { riffId: 'R4' })],
      knowledge: [ex('Q3', { scope: 'strings65' })],
    }),
    unlockRules: [
      { kind: 'quizRunAtLeast', scope: 'strings65', questions: 20, accuracy: 0.9, medianReactionMsMax: 3000 },
      { kind: 'scaleStepGraduated', scaleId: 'am-pent-pos1', step: 1, bpm: 80 },
      { kind: 'songsCompletedAtLeast', filter: { stage: 10 }, count: 2 },
      sessions(BEGINNER2_MIN_SESSIONS),
      days(BEGINNER2_MIN_DAYS),
    ],
    minSessions: BEGINNER2_MIN_SESSIONS,
    minDays: BEGINNER2_MIN_DAYS,
    locked: true,
  },
  {
    stage: 11,
    name: '7th 코드와 블루스',
    summary: 'A7, D7, E7, G7, C7, B7과 12마디 블루스, 셔플 리듬, 해머온을 배워요.',
    learn: [
      learn('7th 코드 6개', 'E1', 'Q2'),
      learn('12마디 블루스', 'S'),
      learn('셔플 리듬', 'E5:P7', 'E5:P8'),
      learn('해머온', 'E11'),
      learn('코드 진행 듣기', 'Q4'),
    ],
    tips: ['셔플은 "긴-짧은, 긴-짧은"으로 박을 나눠요.'],
    newChords: ['A7', 'D7', 'E7', 'G7', 'C7', 'B7'],
    stagePairs: STAGE11_PAIRS,
    rhythmProgression: ['A7', 'D7', 'A7', 'E7'],
    rotation: rotation({
      rhythm: [ex('E5', { patternId: 'P7' }), ex('E5', { patternId: 'P8' })],
      scales: [ex('E9'), ex('E10', { review: true })],
      technique: [ex('E11')],
      knowledge: [ex('Q4', { kind: 'progression' })],
    }),
    unlockRules: [
      recall('A7', 'D7', 'E7', 'G7', 'C7', 'B7'),
      { kind: 'songsCompletedAtLeast', filter: { stage: 11 }, count: 1 },
      { kind: 'pairsPassedAtLeast', pairs: STAGE11_PAIRS, minCount: 6 },
      sessions(BEGINNER2_MIN_SESSIONS),
      days(BEGINNER2_MIN_DAYS),
    ],
    minSessions: BEGINNER2_MIN_SESSIONS,
    minDays: BEGINNER2_MIN_DAYS,
    locked: true,
  },
];

export const PLAYABLE_STAGE_MAX = 7;

export function stageDef(stage: number): StageDef {
  const def = CURRICULUM.find((s) => s.stage === stage);
  if (!def) throw new Error(`unknown stage ${stage}`);
  return def;
}
