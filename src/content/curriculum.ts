/**
 * App-authored curriculum (SPEC §7.1–7.2, research 01 §5.2). Stage 0–7 playable, 8–11 locked preview.
 * Unlock rules are data evaluated by domain/progression.ts.
 */
import type { StageDef } from './schemas';

const MIN_SESSIONS = 4;
const sessions = { kind: 'sessionsInStageAtLeast', count: MIN_SESSIONS } as const;
const pairs30 = { kind: 'unlockedPairsAtLeast', value: 30, days: 2 } as const;
const recall = { kind: 'recallUnlocked' } as const;

export const CURRICULUM: readonly StageDef[] = [
  {
    stage: 0,
    name: '준비',
    summary: '튜닝, 자세, 피크 잡기, 코드 다이어그램 읽기를 익혀요.',
    learn: [
      '튜너로 6줄 맞추기',
      '앉은 자세와 기타 잡는 법',
      '피크 잡기',
      '코드 다이어그램 읽기',
      '프렛 바로 뒤를 누르기',
    ],
    tips: [
      '프렛 바로 뒤(프렛 쇠 가까이)를 누르면 적은 힘으로도 깨끗하게 울려요.',
      '처음엔 손끝이 아픈 게 정상이에요. 짧게 자주 연습하세요.',
    ],
    newChords: [],
    focusPairs: [],
    rhythm: [{ patternId: 'P0', mode: 'mute' }],
    technique: [{ type: 'Q1', params: {} }],
    unlockRules: [
      { kind: 'countAtLeast', subject: 'tuning:session', metric: 'complete', minValue: 1, count: 3 },
      { kind: 'metricAtLeast', subject: 'quiz:diagram', metric: 'accuracy', value: 0.9 },
      sessions,
    ],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 1,
    name: '첫 두 코드',
    summary: 'D와 A 코드를 배우고, 두 코드를 오가는 연습을 시작해요.',
    learn: ['D 코드', 'A 코드', '앵커 손가락(1번 손가락은 3번 줄 2프렛에 그대로)', '1분 코드 체인지'],
    tips: [
      'D↔A를 바꿀 때 1번 손가락은 3번 줄 2프렛에서 떼지 마세요.',
      '1분 코드 체인지는 소리보다 손 모양을 빨리 만드는 연습이에요.',
    ],
    newChords: ['D', 'A'],
    focusPairs: ['A>D', 'D>A'],
    rhythm: [{ patternId: 'P0', mode: 'single' }],
    technique: [{ type: 'E4', params: { pair: 'A|D' } }],
    unlockRules: [recall, pairs30, sessions],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 2,
    name: '세 번째 코드와 박',
    summary: 'E 코드를 더하고, 박의 첫 박에 코드를 바꾸는 연습을 해요.',
    learn: ['E 코드', '박 1에 코드 바꾸기', '발로 박 세기'],
    tips: [
      '코드를 바꿀 때는 다음 마디 첫 박 전에 미리 움직이세요.',
      '발로 박을 세면 리듬이 흔들리지 않아요.',
    ],
    newChords: ['E'],
    focusPairs: ['A>E', 'E>A', 'D>E', 'E>D', 'A>D'],
    rhythm: [{ patternId: 'P0', mode: 'progression' }],
    technique: [
      { type: 'E6', params: { progression: ['A', 'D', 'E', 'A'] } },
      { type: 'E4', params: { pair: 'A|E' } },
    ],
    unlockRules: [
      recall,
      pairs30,
      { kind: 'countAtLeast', subject: 'song:*', metric: 'completed', minValue: 1, count: 1 },
      sessions,
    ],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 3,
    name: '마이너 코드와 업스트럼',
    summary: 'Em, Am 코드와 업스트럼이 들어간 패턴을 배워요.',
    learn: ['Em 코드', 'Am 코드', '업스트럼', 'D DU D D 패턴', 'D DU DU D 패턴(뮤트)'],
    tips: ['업스트럼은 높은 줄 몇 개만 가볍게 스쳐도 충분해요.', '손은 박에 맞춰 계속 위아래로 움직이세요.'],
    newChords: ['Em', 'Am'],
    focusPairs: ['Am>E', 'E>Am', 'Em>D', 'D>Em', 'Am>Em', 'Em>Am'],
    rhythm: [
      { patternId: 'P1', mode: 'single' },
      { patternId: 'P2', mode: 'mute' },
    ],
    technique: [
      { type: 'E4', params: { pair: 'Am|E' } },
      { type: 'E6', params: { progression: ['Em', 'Am', 'D', 'Em'] } },
    ],
    unlockRules: [
      recall,
      pairs30,
      { kind: 'metricAtLeast', subject: 'strum:P2:mute', metric: 'passBpm', value: 70 },
      sessions,
    ],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 4,
    name: '메트로놈과 표준 패턴',
    summary: 'Dm 코드와 표준 스트럼 패턴 D DU UDU를 메트로놈에 맞춰 익혀요.',
    learn: ['Dm 코드', '메트로놈(1박 악센트)', '표준 패턴 D DU UDU', '손가락 스트레칭'],
    tips: [
      '패턴은 뮤트 → 한 코드 → 코드 바꾸기 순서로 올리세요.',
      '스트레칭은 늘어나는 느낌까지만, 아프면 멈추세요.',
    ],
    newChords: ['Dm'],
    focusPairs: ['A>Dm', 'Dm>A', 'E>Dm', 'Dm>Am', 'Am>Dm'],
    rhythm: [
      { patternId: 'P3', mode: 'mute' },
      { patternId: 'P3', mode: 'single' },
    ],
    technique: [{ type: 'E6', params: { progression: ['Dm', 'A', 'Dm', 'A'] } }],
    unlockRules: [
      recall,
      { kind: 'metricAtLeast', subject: 'strum:P3:mute', metric: 'passBpm', value: 80 },
      sessions,
    ],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 5,
    name: 'C 코드',
    summary: 'C 코드를 배우고 타이밍에 집중한 스트럼을 연습해요.',
    learn: ['C 코드', 'Am ↔ C, C ↔ Em 체인지', '패턴 안에서 코드 바꾸기'],
    tips: [
      'C 코드의 3번 손가락 끝을 세워 4번 줄이 막히지 않게 하세요.',
      'Am → C는 1·2번 손가락이 그대로예요.',
    ],
    newChords: ['C'],
    focusPairs: ['Am>C', 'C>Am', 'C>Em', 'Em>C', 'C>D'],
    rhythm: [
      { patternId: 'P3', mode: 'progression' },
      { patternId: 'P3', mode: 'single' },
    ],
    technique: [
      { type: 'E4', params: { pair: 'Am|C' } },
      { type: 'E6', params: { progression: ['C', 'Am', 'Dm', 'E'] } },
    ],
    unlockRules: [
      recall,
      pairs30,
      { kind: 'metricAtLeast', subject: 'strum:P3:progression', metric: 'passBpm', value: 70 },
      sessions,
    ],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 6,
    name: 'G 코드와 교대 피킹',
    summary: '두 손가락 G로 시작해 세 손가락 G로 넘어가고, 한 줄 교대 피킹과 6/8 박자를 배워요.',
    learn: ['G 코드(두 손가락 → 세 손가락)', '한 줄 교대 피킹', '6/8 스트럼', '개방현 음이름'],
    tips: [
      'G → C는 앵커가 없어요. 손 모양을 공중에서 먼저 만들고 한 번에 내려놓으세요.',
      '피크는 줄에 살짝 비스듬히 대세요.',
    ],
    newChords: ['G-2f', 'G-3f'],
    focusPairs: ['G>C', 'C>G', 'G>D', 'D>G', 'C>D', 'D>C'],
    rhythm: [
      { patternId: 'P3', mode: 'progression' },
      { patternId: 'P5', mode: 'single' },
    ],
    technique: [
      { type: 'E8', params: { stringIdx: 3 } },
      { type: 'Q3', params: {} },
      { type: 'E4', params: { pair: 'C|G' } },
    ],
    unlockRules: [
      recall,
      pairs30,
      { kind: 'metricAtLeast', subject: 'altpick:any', metric: 'passBpm', value: 70 },
      { kind: 'countAtLeast', subject: 'strum:P5', metric: 'hitRate', minValue: 0, count: 1 },
      sessions,
    ],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 7,
    name: '통합',
    summary: '8개 코드를 정리하고 25쌍을 순환하며, 졸업 시험을 준비해요.',
    learn: ['공중 체인지', '25쌍 순환', '메이저/마이너 듣고 구분하기', '연습곡 외워서 치기'],
    tips: ['졸업 시험은 항목별로 따로 통과해도 돼요.', '악보 없이 치려면 코드 진행을 소리 내어 말해 보세요.'],
    newChords: [],
    focusPairs: [],
    rhythm: [
      { patternId: 'P3', mode: 'progression' },
      { patternId: 'P4', mode: 'single' },
    ],
    technique: [
      { type: 'E4', params: { pair: 'C|G', air: true } },
      { type: 'Q4', params: {} },
      { type: 'E8', params: { stringIdx: 1 } },
    ],
    unlockRules: [{ kind: 'examPassed' }, sessions],
    minSessions: MIN_SESSIONS,
    locked: false,
  },
  {
    stage: 8,
    name: '드론 코드와 첫 스케일',
    summary: '네 손가락 G, Cadd9, Dsus4, A7sus4, Em7과 Em 펜타토닉을 배워요. (다음 버전)',
    learn: ['G(네 손가락)', 'Cadd9', 'Dsus4', 'A7sus4', 'Em7', '정확 빠른 체인지', 'Em 펜타토닉'],
    tips: [],
    newChords: ['G-4f', 'Cadd9', 'Dsus4', 'A7sus4', 'Em7'],
    focusPairs: [],
    rhythm: [{ patternId: 'P4', mode: 'single' }],
    technique: [],
    unlockRules: [],
    minSessions: 8,
    locked: true,
  },
  {
    stage: 9,
    name: 'F 코드와 새끼손가락',
    summary: 'Fmaj7 → 작은 F → 바레 F 순서로 F를 익혀요. (다음 버전)',
    learn: ['Fmaj7', '작은 F', '바레 F', '새끼손가락 운동', 'C 메이저 스케일'],
    tips: [],
    newChords: ['Fmaj7', 'F-small', 'F'],
    focusPairs: [],
    rhythm: [],
    technique: [],
    unlockRules: [],
    minSessions: 8,
    locked: true,
  },
  {
    stage: 10,
    name: '파워코드와 펜타토닉',
    summary: '6번·5번 줄 루트 파워코드와 Am 펜타토닉을 배워요. (다음 버전)',
    learn: ['G5(6번 줄 루트)', 'C5(5번 줄 루트)', '팜뮤트', 'Am 펜타토닉 1포지션', '6·5번 줄 음이름'],
    tips: [],
    newChords: ['G5', 'C5'],
    focusPairs: [],
    rhythm: [],
    technique: [],
    unlockRules: [],
    minSessions: 8,
    locked: true,
  },
  {
    stage: 11,
    name: '7th 코드와 블루스',
    summary: 'A7, D7, E7, G7, C7, B7과 12마디 블루스를 배워요. (다음 버전)',
    learn: ['A7', 'D7', 'E7', 'G7', 'C7', 'B7', '12마디 블루스', '셔플 리듬'],
    tips: [],
    newChords: ['A7', 'D7', 'E7', 'G7', 'C7', 'B7'],
    focusPairs: [],
    rhythm: [],
    technique: [],
    unlockRules: [],
    minSessions: 8,
    locked: true,
  },
];

export const PLAYABLE_STAGE_MAX = 7;

export function stageDef(stage: number): StageDef {
  const def = CURRICULUM.find((s) => s.stage === stage);
  if (!def) throw new Error(`unknown stage ${stage}`);
  return def;
}
