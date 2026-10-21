import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { repo } from '../../app/services';
import { loadStoredState } from '../../app/storedState';
import { stageDef } from '../../content/curriculum';
import type { RoutineItem } from '../../content/schemas';
import { generateRoutine } from '../../domain/routine';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Field, Select } from '../../ui/Field';
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

  if (!loaded) return <Screen title={ko.routineEditor.title} busy />;
  const totalMin = Math.round(items.reduce((sum, i) => sum + i.durationSec, 0) / 60);
  const option = loaded.options.find((o) => o.id === choice);

  const save = () =>
    void repo.saveRoutineTemplate(toTemplate(items, loaded.stage, Date.now())).then(() => navigate('/'));
  return (
    <Screen title={ko.routineEditor.title}>
      <p className="text-lg text-muted">{ko.routineEditor.intro}</p>
      <ol className="mt-5 flex flex-col gap-3" data-testid="editor-items">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface px-4 py-3"
            data-testid="editor-item"
          >
            <span className="min-w-0 flex-1 basis-56">
              <span className="block text-sm font-medium text-muted">{ko.home.blocks[item.block]}</span>
              <span className="font-semibold">
                {item.exerciseType === 'REST' ? ko.home.restItem : itemTitle(item)}
              </span>
              <span className="ml-2 whitespace-nowrap tabular-nums text-muted">
                {ko.routineEditor.seconds(item.durationSec)}
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="min-w-12"
                disabled={index === 0}
                onClick={() => setItems((list) => moveItem(list, item.id, -1))}
                aria-label={ko.routineEditor.moveUp}
              >
                ↑
              </Button>
              <Button
                variant="secondary"
                className="min-w-12"
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
                variant="ghost"
                onClick={() => setItems((list) => removeItem(list, item.id))}
                data-testid="editor-remove"
              >
                {ko.routineEditor.remove}
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Field label={ko.routineEditor.addLabel} className="min-w-0 flex-1 basis-64">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)} data-testid="editor-add-choice">
            {loaded.options.map((o) => (
              <option key={o.id} value={o.id}>
                {slotLabel(o)}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant="secondary"
          disabled={!option}
          onClick={() => option && setItems((list) => addItem(list, option))}
          data-testid="editor-add"
        >
          {ko.routineEditor.add}
        </Button>
      </div>
      {/*
       * Save stays on the first screen (SPEC §4.5): a bar stuck above the bottom tab bar (its height plus the
       * safe area), at the window's bottom where the sidebar replaces the tab bar.
       */}
      <div className="sticky bottom-[calc(3.625rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-border bg-bg px-4 py-3 sm:-mx-6 sm:px-6 lg:bottom-0 lg:-mx-8 lg:px-8">
        <div data-primary-action>
          <Button large onClick={save} data-testid="editor-save">
            {ko.routineEditor.save}
          </Button>
        </div>
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
        <p className="ml-auto font-semibold tabular-nums" data-testid="editor-total">
          {ko.home.totalTime(totalMin)}
        </p>
      </div>
    </Screen>
  );
}
