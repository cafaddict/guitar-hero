/** Label of an addable routine slot in the editor (SPEC v1.1 §7.3-9). */
import { ko } from '../../i18n/ko';
import { itemTitle } from '../session/itemTitle';
import type { AddOption } from './editorModel';

export function slotLabel(option: AddOption): string {
  const slot = option.slot;
  switch (slot.kind) {
    case 'custom':
    case 'fixed':
      return itemTitle({ exerciseType: slot.exerciseType, params: { ...slot.params } });
    case 'rotation':
      return ko.routineEditor.rotation[slot.list];
    case 'change':
      return ko.routineEditor.change[slot.rule];
    default:
      return ko.routineEditor.slots[slot.kind];
  }
}
