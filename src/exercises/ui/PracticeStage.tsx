/**
 * The practice skeleton every exercise view is built on (SPEC §4.2, D-090):
 *
 *   figure  │ panel   (key number, instruction, live status)
 *           │ actions (the next step, [data-primary-action], + controls next to it)
 *           │ notes   (guidance, modes, keys)
 *
 * From `lg` (iPad landscape, MacBook) the stage is two columns: the figure the learner plays from on the left,
 * number, status and controls on the right. A TAB is a timeline read left to right, so `figureSpan="full"` gives
 * it the full width with the two columns below it (notes left, panel and actions right).
 *
 * Below `lg` the stage is one column, and the action bar sticks to the bottom of the screen: the next step is on
 * the first screen however tall the figure is. The bar is an item of the stage's own flex column (not of a grid
 * cell or a wrapper), which is what lets it stick across the stage's full height.
 *
 * A pausable run (D-085) hands its pause button in through `RunControlsContext`: while paused, "이어서" is the
 * next step; while running it sits beside the view's own controls.
 */
import { createContext, type ReactNode, useContext } from 'react';
import { ko } from '../../i18n/ko';
import { Icon } from '../../ui/icons';

export interface RunControls {
  /** The pause / resume button of a pausable run in a pausable phase, else null. */
  pause: ReactNode | null;
  paused: boolean;
  /** Live microphone feedback of the run (level, confidence): status, shown at the end of the panel. */
  feedback?: ReactNode;
}

export const RunControlsContext = createContext<RunControls>({ pause: null, paused: false });

/** The status line shown while a run is paused (the pause E2E's anchor). */
function PausedBadge() {
  return (
    <p
      role="status"
      className="inline-flex w-fit items-center gap-2 rounded-2xl bg-retry-soft px-4 py-2 text-lg font-semibold text-retry"
      data-testid="exercise-paused"
    >
      <Icon name="pause" size={20} />
      {ko.exercises.common.paused}
    </p>
  );
}

/** A slot holds something (views fill slots with `cond && <X />`, so `false` and `''` count as empty). */
export const filled = (node: ReactNode): boolean =>
  node !== null && node !== undefined && node !== false && node !== '';

/**
 * The bar that holds the next step and the controls beside it (sticky below `lg`).
 *
 * The view's controls and the pause button each keep one fixed slot: only the `[data-primary-action]` marker and
 * the visual order move between them. Moving the pause button to another parent would remount it and drop the
 * keyboard focus a learner left on it (Space on the focused button pauses and resumes, D-085).
 */
function ActionBar({
  view,
  pause,
  pauseIsNext,
  secondary,
  label,
  sticky,
  className,
}: {
  view: ReactNode;
  pause: ReactNode;
  pauseIsNext: boolean;
  secondary: ReactNode;
  label: string | undefined;
  sticky: boolean;
  className: string;
}) {
  const hasView = filled(view);
  const hasPause = filled(pause);
  if (!hasView && !hasPause && !filled(secondary)) return null;
  const bar = sticky
    ? 'sticky bottom-0 z-10 -mx-4 border-t border-border bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [--pinned-bottom:0px] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0'
    : '';
  const next = (isNext: boolean) =>
    isNext ? { 'data-primary-action': '', ...(label ? { role: 'group', 'aria-label': label } : {}) } : {};
  return (
    <div className={`flex flex-wrap items-center gap-3 ${bar} ${className}`}>
      {hasView && (
        <div className={`flex flex-wrap gap-3 ${sticky ? '' : 'w-full'}`} {...next(!pauseIsNext)}>
          {view}
        </div>
      )}
      {hasPause && (
        <div className={`flex ${pauseIsNext ? 'order-first' : ''}`} {...next(pauseIsNext)}>
          {pause}
        </div>
      )}
      {secondary}
    </div>
  );
}

/**
 * Chord diagram width on a practice stage: small enough on a phone that the instruction under it is on the
 * first screen, large on the wide two-column stage where it has its own column.
 */
export const PRACTICE_DIAGRAM = 'max-w-48 sm:max-w-xs lg:max-w-sm';

type FigureSpan = 'column' | 'full';

interface Placement {
  rows: string;
  figure: string;
  panel: string;
  actions: string;
  tools: string;
  notes: string;
}

/**
 * lg grid placement, with and without a tools row. The last row is `1fr`: a figure taller than the right-hand
 * column stretches only that row, so the panel and the actions stay together at the top.
 */
const PLACEMENT: Record<FigureSpan, Record<'plain' | 'tools', Placement>> = {
  column: {
    plain: {
      rows: 'lg:grid-rows-[auto_auto_1fr]',
      figure: 'lg:col-start-1 lg:row-span-3 lg:row-start-1',
      panel: 'lg:col-start-2 lg:row-start-1',
      actions: 'lg:col-start-2 lg:row-start-2',
      tools: '',
      notes: 'lg:col-start-2 lg:row-start-3',
    },
    tools: {
      rows: 'lg:grid-rows-[auto_auto_auto_1fr]',
      figure: 'lg:col-start-1 lg:row-span-4 lg:row-start-1',
      panel: 'lg:col-start-2 lg:row-start-1',
      actions: 'lg:col-start-2 lg:row-start-2',
      tools: 'lg:col-start-2 lg:row-start-3',
      notes: 'lg:col-start-2 lg:row-start-4',
    },
  },
  full: {
    plain: {
      rows: 'lg:grid-rows-[auto_auto_1fr]',
      figure: 'lg:col-span-2 lg:col-start-1 lg:row-start-1',
      panel: 'lg:col-start-2 lg:row-start-2',
      actions: 'lg:col-start-2 lg:row-start-3',
      tools: '',
      notes: 'lg:col-start-1 lg:row-span-2 lg:row-start-2',
    },
    tools: {
      rows: 'lg:grid-rows-[auto_auto_auto_1fr]',
      figure: 'lg:col-span-2 lg:col-start-1 lg:row-start-1',
      panel: 'lg:col-start-2 lg:row-start-2',
      actions: 'lg:col-start-2 lg:row-start-3',
      tools: 'lg:col-start-2 lg:row-start-4',
      notes: 'lg:col-start-1 lg:row-span-3 lg:row-start-2',
    },
  },
};

export function PracticeStage({
  figure,
  children,
  primary,
  primaryLabel,
  secondary,
  tools,
  notes,
  figureSpan = 'column',
  stickyActions = true,
  className = '',
  ...rest
}: {
  /** What the learner plays from: diagram, TAB, pattern, picture or the question. Left out: one column. */
  figure?: ReactNode;
  /** The panel: key number, instruction, live status. */
  children?: ReactNode;
  /** The next step: the control(s) of the one decision the learner makes now. */
  primary?: ReactNode;
  /** The question the `primary` answers, when it is asked in the panel (names the group of answers). */
  primaryLabel?: string | undefined;
  /** Controls beside the next step (other answers to the same question belong in `primary`). */
  secondary?: ReactNode;
  /** Occasional controls (hide the TAB, finish): after the bar, outside it, so a phone's bar stays one row. */
  tools?: ReactNode;
  /** Guidance, modes and key hints: quiet lines read before or between runs. */
  notes?: ReactNode;
  figureSpan?: FigureSpan;
  /** False for a list of answers (quizzes): the answers are the content, not a bar over it. */
  stickyActions?: boolean;
  className?: string;
  [data: `data-${string}`]: string | number | boolean | undefined;
}) {
  const run = useContext(RunControlsContext);
  // While paused, "이어서" is the next step; while running it is the next step only when the view has none.
  const pauseIsNext = filled(run.pause) && (run.paused || !filled(primary));
  const hasFigure = filled(figure);
  const hasTools = filled(tools);
  const at = PLACEMENT[figureSpan][hasTools ? 'tools' : 'plain'];
  const grid = hasFigure
    ? `lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-5 ${at.rows}`
    : // One readable column on the header's left edge, like the result after it (D-094).
      'w-full max-w-3xl';
  const place = (slot: string) => (hasFigure ? slot : '');
  return (
    // Focus scrolled into view stops above the sticky bar (about 6 rem with the safe area, styles.css).
    <section
      className={`flex flex-col gap-5 ${grid} ${stickyActions ? '[--pinned-bottom:7rem]' : ''} ${className}`}
      {...rest}
    >
      {hasFigure && <div className={`flex min-w-0 flex-col items-center gap-3 ${at.figure}`}>{figure}</div>}
      <div className={`flex min-w-0 flex-col gap-4 ${place(at.panel)}`}>
        {run.paused && <PausedBadge />}
        {children}
        {run.feedback}
      </div>
      <ActionBar
        view={primary}
        pause={run.pause}
        pauseIsNext={pauseIsNext}
        secondary={filled(secondary) ? secondary : null}
        label={primaryLabel}
        sticky={stickyActions}
        className={place(at.actions)}
      />
      {hasTools && <div className={`flex flex-wrap items-center gap-3 ${place(at.tools)}`}>{tools}</div>}
      {filled(notes) && <div className={`flex min-w-0 flex-col gap-2 ${place(at.notes)}`}>{notes}</div>}
    </section>
  );
}
