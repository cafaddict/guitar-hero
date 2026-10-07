/**
 * Plugin registry. `definePlugin` erases each plugin's generic types behind an `ExerciseDefinition` that
 * validates params and results with the plugin's own zod schemas at the boundary, so the core (host, session
 * runner, records) handles every exercise uniformly without `any`.
 */
import type { ReactNode } from 'react';
import type { z } from 'zod';
import type { MetricSampleInput } from '../domain/records';
import type {
  ContentContext,
  ExerciseContext,
  ExercisePlugin,
  ExerciseRunner,
  ExerciseTitleKey,
} from './types';

export interface ExerciseDefinition {
  type: string;
  version: number;
  titleKey: ExerciseTitleKey;
  usesMicrophone: boolean;
  resultSchema: z.ZodType<unknown>;
  defaultParams(content: ContentContext): unknown;
  /** Validates (and fills defaults of) raw params; throws on invalid input. */
  parseParams(raw: unknown): unknown;
  createRunner(ctx: ExerciseContext, params: unknown): ExerciseRunner<unknown, unknown>;
  renderView(props: {
    runner: ExerciseRunner<unknown, unknown>;
    params: unknown;
    ctx: ExerciseContext;
  }): ReactNode;
  renderSummary(props: { result: unknown; params: unknown }): ReactNode;
  toMetrics(result: unknown, params: unknown): MetricSampleInput[];
  /** Params adjusted by the latest stored results of this exercise (results that fail validation are skipped). */
  withHistory(params: unknown, recentResults: readonly unknown[]): unknown;
}

export function definePlugin<P, R, V>(plugin: ExercisePlugin<P, R, V>): ExerciseDefinition {
  const parse = (raw: unknown): P => plugin.paramsSchema.parse(raw);
  // Runners created here keep their precise type for the view (no casts at the erasure boundary).
  const typed = new WeakMap<object, ExerciseRunner<R, V>>();
  const View = plugin.View;
  const Summary = plugin.Summary;
  return {
    type: plugin.type,
    version: plugin.version,
    titleKey: plugin.titleKey,
    usesMicrophone: plugin.usesMicrophone,
    resultSchema: plugin.resultSchema,
    defaultParams: (content) => plugin.defaultParams(content),
    parseParams: parse,
    createRunner(ctx, raw) {
      const runner = plugin.createRunner(ctx, parse(raw));
      typed.set(runner, runner);
      return runner;
    },
    renderView({ runner, params, ctx }) {
      const own = typed.get(runner);
      if (!own) throw new Error(`${plugin.type}: runner was not created by this plugin`);
      return <View runner={own} params={parse(params)} ctx={ctx} />;
    },
    renderSummary: ({ result, params }) => (
      <Summary result={plugin.resultSchema.parse(result)} params={parse(params)} />
    ),
    toMetrics: (result, params) => plugin.toMetrics(plugin.resultSchema.parse(result), parse(params)),
    withHistory(params, recentResults) {
      const typedParams = parse(params);
      if (!plugin.withHistory) return typedParams;
      const results = recentResults.flatMap((r) => {
        const parsed = plugin.resultSchema.safeParse(r);
        return parsed.success ? [parsed.data] : [];
      });
      return plugin.withHistory(typedParams, results);
    },
  };
}

const definitions = new Map<string, ExerciseDefinition>();

export function registerExercise(definition: ExerciseDefinition): void {
  if (definitions.has(definition.type)) throw new Error(`exercise ${definition.type} registered twice`);
  definitions.set(definition.type, definition);
}

export function exerciseDefinition(type: string): ExerciseDefinition | undefined {
  return definitions.get(type);
}

export function registeredExerciseTypes(): string[] {
  return [...definitions.keys()];
}
