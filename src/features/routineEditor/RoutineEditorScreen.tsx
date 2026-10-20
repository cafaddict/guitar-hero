import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { repo } from '../../app/services';
import { loadStoredState } from '../../app/storedState';
import { stageDef } from '../../content/curriculum';
import type { RoutineItem } from '../../content/schemas';
import { generateRoutine } from '../../domain/routine';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { routineInputFrom, userTemplateFor } from '../home/homeModel';
import { itemTitle } from '../session/itemTitle';
import {
  type AddOption,
  addItem,
  addOptions,
  EDITOR_STEP_SEC,
  editorInput,
  moveItem,
  removeItem,
  resizeItem,
  toTemplate,
  userTemplateId,
} from './editorModel';
import { slotLabel } from './slotLabel';

interface Loaded {
  stage: number;
  items: RoutineItem[];
  options: AddOption[];
  hasTemplate: boolean;
}

/** Routine editor (SPEC v1.1 §7.3-9, §12.1): edit today's items, save as this stage's template, or reset. */
export function RoutineEditorScreen() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [choice, setChoice] = useState('');

  const load = useCallback(async () => {
    const now = Date.now();
    const stored = await loadStoredState(now);
    const stage = stored.progression.stage;
    // The editor shows the stage's composition with template times: today's adjustments (pain halving, the daily
    // change cap, review songs, the card split) are not part of a saved template (§7.3-7, §7.3-9).
    const plan = generateRoutine(editorInput(routineInputFrom(stored, now)));
    const options = addOptions(stageDef(stage));
    setLoaded({
      stage,
      items: plan.items,
      options,
      hasTemplate: userTemplateFor(stored.userTemplates, stage) !== null,
    });
    setItems(plan.items);
    setChoice(options[0]?.id ?? '');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return <Screen title={ko.routineEditor.title}>{null}</Screen>;
  const totalMin = Math.round(items.reduce((sum, i) => sum + i.durationSec, 0) / 60);
  const option = loaded.options.find((o) => o.id === choice);

  return (
    <Screen title={ko.routineEditor.title}>
      <p className="text-muted">{ko.routineEditor.intro}</p>
      <p className="mt-2 font-semibold" data-testid="editor-total">
        {ko.home.totalTime(totalMin)}
      </p>
      <ol className="mt-3 divide-y divide-surface-2" data-testid="editor-items">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
            data-testid="editor-item"
          >
            <span>
              <span className="text-muted">{ko.home.blocks[item.block]} · </span>
              {item.exerciseType === 'REST' ? ko.home.restItem : itemTitle(item)}
              <span className="ml-2 tabular-nums text-muted">
                {ko.routineEditor.seconds(item.durationSec)}
              </span>
            </span>
            <span className="flex flex-wrap gap-1">
              <Button
                variant="secondary"
                disabled={index === 0}
                onClick={() => setItems((list) => moveItem(list, item.id, -1))}
                aria-label={ko.routineEditor.moveUp}
              >
                ↑
              </Button>
              <Button
                variant="secondary"
                disabled={index === items.length - 1}
                onClick={() => setItems((list) => moveItem(list, item.id, 1))}
                aria-label={ko.routineEditor.moveDown}
              >
                ↓
              </Button>
              <Button
                variant="secondary"
                onClick={() => setItems((list) => resizeItem(list, item.id, -EDITOR_STEP_SEC))}
                data-testid="editor-shorter"
                aria-label={ko.routineEditor.shorter}
              >
                −30
              </Button>
              <Button
                variant="secondary"
                onClick={() => setItems((list) => resizeItem(list, item.id, EDITOR_STEP_SEC))}
                data-testid="editor-longer"
                aria-label={ko.routineEditor.longer}
              >
                +30
              </Button>
              <Button
                variant="secondary"
                onClick={() => setItems((list) => removeItem(list, item.id))}
                data-testid="editor-remove"
              >
                {ko.routineEditor.remove}
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span>{ko.routineEditor.addLabel}</span>
          <select
            className="min-h-12 rounded-xl border border-border bg-surface-2 px-3 text-fg"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            data-testid="editor-add-choice"
          >
            {loaded.options.map((o) => (
              <option key={o.id} value={o.id}>
                {slotLabel(o)}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={!option}
          onClick={() => option && setItems((list) => addItem(list, option))}
          data-testid="editor-add"
        >
          {ko.routineEditor.add}
        </Button>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          large
          onClick={() =>
            void repo
              .saveRoutineTemplate(toTemplate(items, loaded.stage, Date.now()))
              .then(() => navigate('/'))
          }
          data-testid="editor-save"
        >
          {ko.routineEditor.save}
        </Button>
        {loaded.hasTemplate && (
          <Button
            variant="secondary"
            onClick={() => void repo.deleteRoutineTemplate(userTemplateId(loaded.stage)).then(load)}
            data-testid="editor-reset"
          >
            {ko.routineEditor.reset}
          </Button>
        )}
        <Button variant="secondary" onClick={() => navigate('/')}>
          {ko.routineEditor.cancel}
        </Button>
      </div>
    </Screen>
  );
}
