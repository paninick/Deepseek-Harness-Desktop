'use strict';

/**
 * Fork feature-marker guard: the mechanical-loss gate from the sync playbook.
 * Whole-package swaps and lineage restores can delete fork features that an
 * incoming upstream change never touched (rc.8 lineage alignment erased the
 * vision-picker image filter this way). Each assertion pins one protected
 * feature by a source marker; a red test here means a sync (or any bulk
 * checkout) dropped fork work — restore it before shipping. The desktop
 * updater redirect is guarded separately in src/main/update.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const vendor = path.join(repoRoot, 'vendor', 'deepseek-harness');

function read(relative) {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8');
}

test('vision fallback package survives in the vendored llm stack', () => {
  const manifest = JSON.parse(read(path.join('vendor', 'deepseek-harness', 'packages', 'llm', 'llm-vision-fallback', 'package.json')));
  assert.match(manifest.name, /vision-fallback/);
});

test('vision picker filters catalog routes to image-capable models', () => {
  const picker = read(path.join('vendor', 'deepseek-harness', 'packages', 'client', 'ui-settings-models', 'src', 'client', 'VisionModelPicker.tsx'));
  assert.match(picker, /inputModalities/, 'image-modality filter missing — a sync wiped the picker again (see 8d50d618ae / stash pre-sync vision work)');
});

test('vision settings locales carry the endpoint-reuse hint', () => {
  const locales = read(path.join('vendor', 'deepseek-harness', 'packages', 'client', 'ui-settings-models', 'src', 'client', 'locales.ts'));
  assert.match(locales, /visionModelEndpointHint/);
});

test('ui-primitives keeps exporting useDismissOnOutsidePointer', () => {
  const index = read(path.join('vendor', 'deepseek-harness', 'packages', 'client', 'ui-primitives', 'src', 'index.ts'));
  assert.match(index, /useDismissOnOutsidePointer/);
});

test('katex stylesheet loads only in the vite web entry, never the Node half', () => {
  const webEntry = read(path.join('vendor', 'deepseek-harness', 'apps', 'web', 'src', 'main.ts'));
  assert.match(webEntry, /katex\/dist\/katex\.min\.css/);
  const markdown = read(path.join('vendor', 'deepseek-harness', 'packages', 'client', 'ui-primitives', 'src', 'markdown', 'MarkdownText.tsx'));
  assert.doesNotMatch(markdown, /import\s+'katex/, 'bare css import returned to the Node-bundled module — dsh crashes at ESM resolution');
});

test('no-directory session wire keeps the chisa scratchCwd field', () => {
  const hostApi = read(path.join('vendor', 'deepseek-harness', 'packages', 'host', 'apiproxy', 'src', 'api', 'host.ts'));
  assert.match(hostApi, /scratchCwd/);
});

test('model catalog still advertises inputModalities to the browser', () => {
  const sessions = read(path.join('vendor', 'deepseek-harness', 'packages', 'host', 'apiproxy', 'src', 'api', 'sessions.ts'));
  assert.match(sessions, /inputModalities/);
});

test('guard file list stays inside the vendored tree it protects', () => {
  assert.ok(fs.statSync(vendor).isDirectory());
});
