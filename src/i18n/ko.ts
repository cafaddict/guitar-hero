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
  },
  diagnostics: {
    title: '진단',
    micStart: '마이크 켜기',
    micStop: '마이크 끄기',
    level: '입력 레벨',
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
