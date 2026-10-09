/**
 * Split-session bookkeeping (SPEC v1.1 §7.3-11): the first half is kept under `meta` until it is resumed the same
 * day; once the day changes — or a new session is started instead — the half is closed as the session it is (it
 * counts) and forgotten. While the second half runs, the kept record follows its progress.
 */
import { repo } from '../../app/services';
import { dayKey } from '../../domain/records';
import { pause, type SessionState, SPLIT_RESUME_KEY, type SplitResume } from './sessionModel';

/** The first half that can still be resumed today, closing a stale one from an earlier day. */
export async function pendingSplit(now: number): Promise<SplitResume | null> {
  const saved = await repo.getMeta<SplitResume | null>(SPLIT_RESUME_KEY);
  if (!saved) return null;
  if (saved.day === dayKey(now)) return saved;
  await closeSplit(saved);
  return null;
}

/** Ends a kept session without a self report (its runs count) and forgets the record. */
export async function closeSplit(saved: SplitResume): Promise<void> {
  const session = (await repo.sessions()).find((s) => s.id === saved.sessionId);
  if (session && session.endedAt === null)
    await repo.finishSession(
      saved.sessionId,
      session.startedAt + saved.state.practiceMs,
      saved.state.recorded.length,
      null,
      saved.state.practiceMs,
    );
  await repo.setMeta(SPLIT_RESUME_KEY, null);
}

/** Keeps the resumed half's progress (a reload resumes there; a stale close counts it). */
export function saveSplitProgress(saved: SplitResume, state: SessionState, now: number): Promise<void> {
  return repo.setMeta(SPLIT_RESUME_KEY, { ...saved, state: pause(state, now) });
}

/** Forgets the kept record when it belongs to `sessionId` (another session's half stays). */
export async function clearSplit(sessionId: string): Promise<void> {
  const saved = await repo.getMeta<SplitResume | null>(SPLIT_RESUME_KEY);
  if (saved?.sessionId === sessionId) await repo.setMeta(SPLIT_RESUME_KEY, null);
}
