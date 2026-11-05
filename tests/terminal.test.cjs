const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./helpers/load-ts.cjs');

test('terminal gateway accepts same-origin paths and rejects credential URLs, external hosts and insecure transport', () => {
  const { terminalSocketUrl } = createLoader()('src/composables/useTerminalConnection.ts');
  assert.equal(
    terminalSocketUrl('/api/terminal', 'https://admin.test/page'),
    'wss://admin.test/api/terminal',
  );
  assert.equal(
    terminalSocketUrl('/api/terminal', 'http://localhost:5173/page'),
    'ws://localhost:5173/api/terminal',
  );
  for (const value of [
    '',
    '//other.test/terminal',
    'wss://user:secret@admin.test/terminal',
    'ws://admin.test/terminal',
    'javascript:alert(1)',
    '/api/terminal#token',
  ]) {
    assert.throws(() => terminalSocketUrl(value, 'https://admin.test/page'));
  }
});
