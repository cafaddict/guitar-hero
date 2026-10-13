import { describe, expect, it } from 'vitest';
import { reviewLabel, subjectLabel } from './subjectLabel';

describe('prescription subjects shown by name (SPEC v1.1 §12.4)', () => {
  it('maps internal keys to display names', () => {
    expect(subjectLabel('pair:A|D')).toBe('A–D');
    expect(subjectLabel('chord:G-2f')).toBe('G (두 손가락)');
    expect(subjectLabel('chord:C')).toBe('C');
    expect(subjectLabel('strum:P3:mute')).toBe('D DU UDU (뮤트 스트럼)');
    expect(subjectLabel('altpick:3')).toBe('3번 줄 교대 피킹');
    expect(subjectLabel('riff:R2')).toBe('리프 R2');
  });

  it('names review queue items: songs, knowledge cards and the kind of review (D-081)', () => {
    expect(subjectLabel('card:recall:E')).toBe('E');
    expect(subjectLabel('card:note:0:3')).toBe('6번 줄 3프렛');
    expect(subjectLabel('card:ear:majmin:major')).toBe('메이저/마이너');
    expect(subjectLabel('card:note:x:3')).toBe('card:note:x:3');
    expect(reviewLabel({ subjectKey: 'card:recall:E', kind: 'card' })).toBe('코드 기억 카드 · E');
    expect(reviewLabel({ subjectKey: 'pair:A|D', kind: 'pair' })).toBe('체인지 · A–D');
    expect(reviewLabel({ subjectKey: 'strum:P0', kind: 'pattern' })).toBe('패턴 · D D D D');
    expect(reviewLabel({ subjectKey: 'riff:R1', kind: 'riff' })).toBe('리프 R1');
  });
});
