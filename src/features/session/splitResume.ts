/**
 * Split-session bookkeeping (SPEC v1.1 §7.3-11): the first half is kept under `meta` until it is resumed the same
 * day; once the day changes the option disappears and the half is closed as the session it is (it counts).
 */
import { repo } from '../../app/services';
import { dayKey } from '../../domain/records';
import { SPLIT_RESUME_KEY, type SplitResume } from './sessionModel';

/** The first half that can still be resumed today, closing a stale one from an earlier day. */
export async function pendingSplit(now: number): Promise<SplitResume | null> {
  const saved = await repo.getMeta<SplitResume | null>(SPLIT_RESUME_KEY);
  if (!saved) return null;
  if (saved.day === dayKey(now)) return saved;
  const ended = (await repo.sessions()).find((s) => s.id === saved.sessionId);
  if (ended && ended.endedAt === null)
    await repo.finishSession(
      saved.sessionId,
      ended.startedAt + saved.state.practiceMs,
      saved.state.recorded.length,
      null,
      saved.state.practiceMs,
    );
  await repo.setMeta(SPLIT_RESUME_KEY, null);
  return null;
}

export function clearSplit(): Promise<void> {
  return repo.setMeta(SPLIT_RESUME_KEY, null);
}
