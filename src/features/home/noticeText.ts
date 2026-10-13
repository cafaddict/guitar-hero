/** Wording of a routine notice (home routine card, curriculum stage practice). */
import type { RoutineNotice } from '../../domain/routine';
import { ko } from '../../i18n/ko';

export function routineNoticeText(n: RoutineNotice): string {
  switch (n.code) {
    case 'gapReview':
      return ko.home.notices.gapReview(n.days);
    case 'capApplied':
      return ko.home.notices.capApplied(n.minutes);
    case 'painReduced':
      return ko.safety.painReduced;
    case 'changesCapReached':
      return ko.home.notices.changesCapReached;
    case 'userTemplate':
      return ko.home.notices.userTemplate;
    case 'restDay':
      return '';
  }
}
