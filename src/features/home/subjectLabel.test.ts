import { describe, expect, it } from 'vitest';
import { subjectLabel } from './subjectLabel';

describe('prescription subjects shown by name (SPEC v1.1 §12.4)', () => {
  it('maps internal keys to display names', () => {
    expect(subjectLabel('pair:A|D')).toBe('A–D');
    expect(subjectLabel('chord:G-2f')).toBe('G (두 손가락)');
    expect(subjectLabel('chord:C')).toBe('C');
    expect(subjectLabel('strum:P3:mute')).toBe('D DU UDU (뮤트 스트럼)');
    expect(subjectLabel('altpick:3')).toBe('3번 줄 교대 피킹');
    expect(subjectLabel('riff:R2')).toBe('리프 R2');
  });
});
