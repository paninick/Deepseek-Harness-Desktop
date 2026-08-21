'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: { getVersion: () => '0.2.4' },
      shell: { openExternal: async () => {} },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const update = require('./update');
Module._load = originalLoad;

test('desktop updates are sourced from the maintained fork', () => {
  assert.equal(update.GITHUB_OWNER, 'paninick');
  assert.equal(update.GITHUB_REPO, 'Deepseek-Harness-Desktop');
  assert.equal(update.REPO_URL, 'https://github.com/paninick/Deepseek-Harness-Desktop');
  assert.equal(update.RELEASES_PAGE, 'https://github.com/paninick/Deepseek-Harness-Desktop/releases');
});
