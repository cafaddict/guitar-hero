import { describe, expect, it } from 'vitest';
import { riffById } from '../../content/riffs';
import { riffSpelled } from './spell';

describe('riff read out in words (D-080)', () => {
  it('writes each bar with string, fret and finger, repeats as ×n', () => {
    expect(riffSpelled(riffById('R1'))).toEqual([
      '1마디: 6번 줄 개방 ×2 → 6번 줄 3프렛(3번 손가락) ×2',
      '2마디: 5번 줄 개방 ×2 → 5번 줄 2프렛(2번 손가락) ×2',
      '3마디: 6번 줄 개방 ×2 → 6번 줄 3프렛(3번 손가락) ×2',
      '4마디: 5번 줄 2프렛(2번 손가락) → 5번 줄 개방 → 6번 줄 3프렛(3번 손가락) → 6번 줄 개방',
    ]);
  });

  it('a third-position riff names the fingers of that position (R4: 3rd fret = 1, 5th = 3)', () => {
    expect(riffSpelled(riffById('R4'))[0]).toBe(
      '1마디: 6번 줄 개방 ×2 → 6번 줄 3프렛(1번 손가락) → 6번 줄 개방 → 6번 줄 5프렛(3번 손가락) → 6번 줄 개방 → 6번 줄 3프렛(1번 손가락) → 6번 줄 개방',
    );
  });
});
