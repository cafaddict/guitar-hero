/**
 * K1 self-check cards (SPEC v1.1 §11.12): basics the microphone cannot judge. Each item is a picture and a
 * short description; the user answers "됐어요 / 아직" (keys 1 / 2). Texts live in i18n (ko.selfChecks).
 */
export const SELF_CHECK_ITEMS = [
  { id: 'posture', stage: 0 },
  { id: 'pick', stage: 0 },
  { id: 'countAloud', stage: 0 },
  { id: 'footTap', stage: 2 },
  { id: 'deliberateMute', stage: 8 },
  { id: 'palmMute', stage: 10 },
] as const;

export type SelfCheckId = (typeof SELF_CHECK_ITEMS)[number]['id'];
export const SELF_CHECK_IDS: readonly SelfCheckId[] = SELF_CHECK_ITEMS.map((item) => item.id);

export function selfChecksOfStage(stage: number): SelfCheckId[] {
  return SELF_CHECK_ITEMS.filter((item) => item.stage === stage).map((item) => item.id);
}

export function isSelfCheckId(id: string): id is SelfCheckId {
  return (SELF_CHECK_IDS as readonly string[]).includes(id);
}
