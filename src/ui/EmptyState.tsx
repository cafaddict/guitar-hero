import type { ReactNode } from 'react';

/** What a card shows before there is anything to show: a quiet icon, one line, and maybe the next step. */
export function EmptyState({ icon, text, action }: { icon?: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
      {icon !== undefined && <span className="text-muted">{icon}</span>}
      <p className="text-muted">{text}</p>
      {action}
    </div>
  );
}
