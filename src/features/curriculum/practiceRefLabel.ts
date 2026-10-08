/** Human name of a learn item's `practicedBy` reference (SPEC v1.1 §7.1, §12.1 커리큘럼). */
import { isSelfCheckId } from '../../content/selfChecks';
import { ko } from '../../i18n/ko';

export function practiceRefLabel(ref: string): string {
  const [exercise, variant] = ref.split(':') as [string, string | undefined];
  if (exercise === 'K1' && variant && isSelfCheckId(variant))
    return `${ko.exercises.titles.K1} · ${ko.selfChecks[variant].title}`;
  const title = ko.exercises.titles[exercise as keyof typeof ko.exercises.titles] ?? exercise;
  if (!variant) return title;
  return `${title} (${variant === 'dynamics' ? ko.curriculum.variantDynamics : variant})`;
}
