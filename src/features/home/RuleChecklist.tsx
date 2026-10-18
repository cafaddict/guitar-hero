import type { RuleEvaluation } from '../../domain/progression';
import { ko } from '../../i18n/ko';

export function ruleText(evaluation: RuleEvaluation): string {
  const rule = evaluation.rule;
  switch (rule.kind) {
    case 'countAtLeast':
      return ko.rules.countAtLeast(rule.subject, rule.count);
    case 'metricAtLeast':
      return ko.rules.metricAtLeast(rule.subject, rule.value);
    case 'distinctDaysAtLeast':
      return ko.rules.distinctDaysAtLeast(rule.subject, rule.value, rule.days);
    case 'unlockedPairsAtLeast':
      return ko.rules.unlockedPairsAtLeast(rule.value, rule.days);
    case 'pairsPassedAtLeast':
      return ko.rules.pairsPassedAtLeast(rule.minCount, rule.pairs.length);
    case 'recallPassed':
      return ko.rules.recallPassed(rule.voicingIds.join(', '));
    case 'sessionsInStageAtLeast':
      return ko.rules.sessionsInStageAtLeast(rule.count);
    case 'daysInStageAtLeast':
      return ko.rules.daysInStageAtLeast(rule.days);
    case 'songsCompletedAtLeast':
      return ko.rules.songsCompletedAtLeast(rule.count, rule.filter.stage ?? null);
    case 'scaleStepGraduated':
      return ko.rules.scaleStepGraduated(rule.scaleId, rule.step, rule.bpm);
    case 'scaleMemorized':
      return ko.rules.scaleMemorized(rule.scaleId);
    case 'chordCleanRatioAtLeast':
      return ko.rules.chordCleanRatioAtLeast(rule.voicingIds.join('·'), rule.ratio);
    case 'quizRunAtLeast':
      return ko.rules.quizRunAtLeast(rule.questions, rule.accuracy);
    case 'examPassed':
      return ko.rules.examPassed;
  }
}

/** Rules whose `missing` entries are meaningful to show (pairs, chord classes); others only name the subject. */
const LISTS_MISSING = new Set(['unlockedPairsAtLeast', 'pairsPassedAtLeast', 'recallPassed']);

/** Stage criteria with progress; met rules carry a check mark and text (not colour alone). */
export function RuleChecklist({ rules }: { rules: readonly RuleEvaluation[] }) {
  return (
    <ul className="space-y-2" data-testid="rule-checklist">
      {rules.map((r) => (
        <li key={ruleText(r)} className="flex flex-col gap-1">
          <span className={r.met ? 'text-ok' : ''}>
            <span aria-hidden="true">{r.met ? '✓ ' : '○ '}</span>
            <span className="sr-only">{r.met ? ko.rules.met : ko.rules.notMet} </span>
            {ruleText(r)}
          </span>
          {!r.met && (
            <span className="h-2 w-full overflow-hidden rounded bg-surface-2" aria-hidden="true">
              <span
                className="block h-full bg-accent"
                style={{ width: `${Math.round(r.progress * 100)}%` }}
              />
            </span>
          )}
          {!r.met && r.pairs && r.pairs.length > 0 ? (
            <ul className="text-sm text-muted" data-testid="rule-pairs">
              {r.pairs.map((p) => (
                <li key={p.pairId} data-pair={p.pairId}>
                  {ko.rules.pairProgress(p.pairId.replace('|', ' ↔ '), p.days, p.needDays, p.value, p.best)}
                </li>
              ))}
            </ul>
          ) : (
            !r.met &&
            LISTS_MISSING.has(r.rule.kind) &&
            r.missing.length > 0 &&
            r.missing.length <= 8 && (
              <span className="text-xs text-muted">{ko.rules.missing(r.missing.join(', '))}</span>
            )
          )}
        </li>
      ))}
    </ul>
  );
}
