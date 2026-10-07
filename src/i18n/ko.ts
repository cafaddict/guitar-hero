/**
 * All user-facing Korean strings live here (SPEC §12.4). Components must not hard-code Korean text;
 * tests/integrity enforces this.
 */
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
} as const;
