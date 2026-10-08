/** Registers every exercise plugin (SPEC v1.1 §11.2). Imported once by the app shell. */
import { e0Plugin } from './e0/plugin';
import { e1Plugin } from './e1/plugin';
import { e2Plugin } from './e2/plugin';
import { e4Plugin } from './e4/plugin';
import { e5Plugin } from './e5/plugin';
import { e6Plugin } from './e6/plugin';
import { e7Plugin } from './e7/plugin';
import { e8Plugin } from './e8/plugin';
import { e16Plugin } from './e16/plugin';
import { e17Plugin } from './e17/plugin';
import { k1Plugin } from './k1/plugin';
import { q1Plugin, q2Plugin, q3Plugin, q4Plugin, q5Plugin } from './quiz/plugins';
import { definePlugin, registerExercise, registeredExerciseTypes } from './registry';
import { songPlugin } from './song/plugin';

let registered = false;

export function registerAllExercises(): void {
  if (registered) return;
  registered = true;
  for (const definition of [
    definePlugin(e0Plugin),
    definePlugin(e1Plugin),
    definePlugin(e2Plugin),
    definePlugin(e4Plugin),
    definePlugin(e5Plugin),
    definePlugin(e6Plugin),
    definePlugin(e7Plugin),
    definePlugin(e8Plugin),
    definePlugin(q1Plugin),
    definePlugin(q2Plugin),
    definePlugin(q3Plugin),
    definePlugin(q4Plugin),
    definePlugin(q5Plugin),
    definePlugin(songPlugin),
    definePlugin(k1Plugin),
    definePlugin(e16Plugin),
    definePlugin(e17Plugin),
  ])
    registerExercise(definition);
}

export { registeredExerciseTypes };
