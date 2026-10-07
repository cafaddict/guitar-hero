/**
 * SPEC §14.6 integrity rules 1, 3, 4, 5, 6 (static source scans).
 * Rule 2 (benchmark matrix / thresholds) lives in thresholds-contract.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { listFiles, readSource, stripComments } from './source-scan';

const CODE = /\.(ts|tsx|mts)$/;

describe('§14.6-1 pure modules (src/dsp, src/domain)', () => {
  const files = [...listFiles('src/dsp', CODE), ...listFiles('src/domain', CODE)].filter(
    (f) => !/\.test\.tsx?$/.test(f),
  );
  // Static, side-effect, dynamic and require() forms of every banned module.
  const banned = String.raw`(react(-dom)?(\/[^'"]*)?|dexie(-react-hooks)?|[./]*\/(audio|app|ui|features|data)\/[^'"]*)`;
  const forbiddenImports = [
    new RegExp(String.raw`from\s+['"]${banned}['"]`),
    new RegExp(String.raw`import\s+['"]${banned}['"]`),
    new RegExp(String.raw`import\s*\(\s*['"]${banned}['"]`),
    new RegExp(String.raw`require\s*\(\s*['"]${banned}['"]`),
  ];
  const forbiddenGlobals = [
    /\bwindow\./,
    /\bdocument\./,
    /\bnavigator\./,
    /\bindexedDB\b/,
    /AudioContext\b/,
    /\bAudioWorklet\w*/,
    /\blocalStorage\b/,
    /\brequestAnimationFrame\b/,
  ];

  it('the scan patterns catch every import form and Web Audio global (self-test)', () => {
    const bad = [
      "import React from 'react';",
      "import 'react-dom/client';",
      "const db = await import('dexie');",
      "const h = require('dexie-react-hooks');",
      "import { audioEngine } from '../audio/engine';",
      "import x from '../../features/exercises/registry';",
    ];
    for (const line of bad)
      expect(
        forbiddenImports.some((p) => p.test(line)),
        line,
      ).toBe(true);
    expect(forbiddenImports.some((p) => p.test("import { z } from 'zod';"))).toBe(false);
    for (const g of [
      'new OfflineAudioContext(1, 1, 48000)',
      'new webkitAudioContext()',
      'window.foo',
      'navigator.mediaDevices',
    ]) {
      expect(
        forbiddenGlobals.some((p) => p.test(g)),
        g,
      ).toBe(true);
    }
  });

  it('has files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s imports no DOM/Web Audio/React/Dexie', (file) => {
    const code = stripComments(readSource(file));
    for (const pattern of forbiddenImports) expect(code, `${file} matches ${pattern}`).not.toMatch(pattern);
    const noStrings = stripComments(readSource(file), { stripStrings: true });
    for (const pattern of forbiddenGlobals)
      expect(noStrings, `${file} matches ${pattern}`).not.toMatch(pattern);
  });
});

describe('§14.6-3 no focused/skipped tests, no TS suppressions', () => {
  const testFiles = [
    ...listFiles('src', /\.test\.tsx?$/),
    ...listFiles('tests', /\.(test|spec)\.ts$/),
    ...listFiles('tools', /\.test\.ts$/),
  ];
  // Built from parts so this file does not match its own rule.
  const banned = ['skip', 'only', 'fixme'].map((word) => new RegExp(`\\.${word}\\s*\\(`));

  it.each(testFiles)('%s has no skip/only/fixme calls', (file) => {
    const code = stripComments(readSource(file), { stripStrings: true });
    for (const pattern of banned) expect(code, `${file} matches ${pattern}`).not.toMatch(pattern);
  });

  const sources = [
    ...listFiles('src', CODE),
    ...listFiles('tools', CODE),
    ...listFiles('tests', CODE),
    'vite.config.ts',
    'vitest.config.ts',
    'playwright.config.ts',
  ];
  const tsIgnore = new RegExp(`@ts-${'ignore'}`);
  const tsExpect = new RegExp(`@ts-${'expect-error'}`);
  const biomeIgnore = new RegExp(`${'biome'}-ignore[^:\\n]*:\\s*(\\S.*)?$`, 'gm');

  it.each(sources)('%s has no TS suppression comments, and every biome suppression has a reason', (file) => {
    const text = readSource(file);
    expect(text, file).not.toMatch(tsIgnore);
    if (!file.endsWith('.test-d.ts')) expect(text, file).not.toMatch(tsExpect);
    for (const match of text.matchAll(biomeIgnore)) {
      expect((match[1] ?? '').trim().length, `${file}: biome-ignore needs a reason`).toBeGreaterThan(3);
    }
  });
});

describe('§14.6-4 no Korean literals outside i18n/content', () => {
  const hangul = /[ㄱ-ㆎ가-힣]/;
  const files = listFiles('src', CODE).filter(
    (f) => !f.startsWith('src/i18n/') && !f.startsWith('src/content/') && !/\.test\.tsx?$/.test(f),
  );

  it.each(files)('%s has no Hangul outside comments', (file) => {
    expect(stripComments(readSource(file)), file).not.toMatch(hangul);
  });
});

describe('§14.6-5 test hooks are frozen read-only getters', () => {
  it('window.__gh_test is defined from an Object.freeze of getters only', () => {
    const source = stripComments(readSource('src/app/testHooks.ts'));
    const freeze = source.match(/Object\.freeze\(\{([\s\S]*?)\n\s*\}\)/);
    expect(freeze, 'Object.freeze({...}) literal').not.toBeNull();
    const body = freeze?.[1] ?? '';
    const members = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[A-Za-z_$][\w$]*\s*[(:]|^get\s/.test(l));
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) expect(member, 'only getters allowed').toMatch(/^get\s/);
    expect(source).toMatch(
      /defineProperty\(window,\s*'__gh_test',\s*\{\s*value:\s*hooks,\s*writable:\s*false/,
    );
  });
});

describe('§14.6-6 no Math.random in dsp/ and tools/', () => {
  const files = [
    ...listFiles('src/dsp', /\.(ts|tsx|mts|js|mjs|cjs)$/),
    ...listFiles('tools', /\.(ts|tsx|mts|js|mjs|cjs)$/),
  ];
  const direct = new RegExp(`Math\\.${'random'}\\b`);
  const computed = /Math\s*\[/;
  it.each(files)('%s does not use Math.random', (file) => {
    expect(stripComments(readSource(file), { stripStrings: true }), file).not.toMatch(direct);
    expect(stripComments(readSource(file)), `${file} computed Math access`).not.toMatch(computed);
  });
});
