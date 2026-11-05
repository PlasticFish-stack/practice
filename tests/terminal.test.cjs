const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./helpers/load-ts.cjs');
const { Terminal } = require('@xterm/headless');

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

function demo(cols = 40, rows = 8) {
  let output = '',
    exits = 0;
  const engine = new Terminal({ cols, rows, scrollback: 2000, allowProposedApi: true });
  const terminal = {
    reset() {
      output = '';
      engine.reset();
    },
    write(value, parsed) {
      output += value;
      engine.write(value, parsed);
    },
    writeln(value) {
      output += value + '\r\n';
      engine.write(value + '\r\n');
    },
    getBuffer: () => engine.buffer.active,
    getSize: () => ({ cols: engine.cols, rows: engine.rows }),
  };
  const shell = createLoader()('src/views/playground/demoTerminal.ts').createDemoTerminal(
    terminal,
    () => exits++,
  );
  return {
    shell,
    engine,
    text: () => output,
    exits: () => exits,
    screen: () => {
      const buffer = engine.buffer.active;
      return Array.from(
        { length: engine.rows },
        (_, index) => buffer.getLine(buffer.baseY + index)?.translateToString(true) ?? '',
      )
        .join('\n')
        .trim();
    },
  };
}
test('command colors update while typing and deleting; arguments use independent ANSI colors', async (t) => {
  const session = demo(80, 10);
  t.after(() => session.engine.dispose());
  await session.shell.input('\x0cwhoami');
  const color = (column) => {
    const buffer = session.engine.buffer.active;
    return buffer
      .getLine(buffer.baseY + buffer.cursorY)
      .getCell(column)
      .getFgColor();
  };
  assert.equal(color(17), 2);
  await session.shell.input('x');
  assert.equal(color(17), 1);
  await session.shell.input('\x7f');
  assert.equal(color(17), 2);
  await session.shell.input('\x03echo -n "hello"');
  assert.equal(color(17), 2);
  assert.equal(color(22), 6);
  assert.equal(color(25), 3);
});
test('local terminal echoes text without evaluating commands and supports editing and history', async (t) => {
  const session = demo();
  t.after(() => session.engine.dispose());
  await session.shell.input('echo inert $(whoami)\r');
  assert.ok(session.text().includes('\r\ninert $(whoami)\r\n'));
  await Promise.all(
    ['whoamix', '\x7f', '\r', '\x1b[A', '\r'].map((data) => session.shell.input(data)),
  );
  assert.equal(session.text().split('\r\ndemo\r\n').length - 1, 2);
});
test('local terminal cancels partial input, stops after exit and drops input after stop', async (t) => {
  const session = demo();
  t.after(() => session.engine.dispose());
  await session.shell.input('bad-command\x03whoami\r');
  assert.ok(session.text().includes('^C\r\n'));
  assert.ok(!session.text().includes('bad-command: 未提供'));
  await session.shell.input('exit\rwhoami\r');
  assert.equal(session.exits(), 1);
  const ended = session.text();
  await session.shell.input('echo should-not-run\r');
  session.shell.stop();
  await session.shell.input('help\r');
  assert.equal(session.text(), ended);
});

test('held input exceeds the old limit and can be deleted back through exact wraps and scrollback', async (t) => {
  for (const count of [23, 24, 80, 320, 4096]) {
    const session = demo(40, 8);
    t.after(() => session.engine.dispose());
    await session.shell.input('\x0c');
    await session.shell.input('a'.repeat(count));
    // Queue repeats without waiting, as happens when key events arrive faster than the parser.
    await Promise.all(Array.from({ length: count }, () => session.shell.input('\x7f')));
    assert.equal(session.screen(), 'demo@vps-demo:~$');
    await session.shell.input('echo recovered\r');
    assert.ok(session.text().includes('\r\nrecovered\r\n'));
  }
});

test('wide and combining characters delete cleanly after resize and history recall', async (t) => {
  const session = demo(25, 8);
  t.after(() => session.engine.dispose());
  await session.shell.input('\x0c');
  const value = '中文🙂e\u0301'.repeat(24);
  await session.shell.input('echo ' + value + '\r');
  await session.shell.input('\x1b[A');
  await session.shell.input('\x0c');
  session.engine.resize(31, 10);
  await session.shell.resize();
  // More backspaces than graphemes also tests the empty-input boundary.
  await session.shell.input('\x7f'.repeat(Array.from(value).length + 5));
  assert.equal(session.screen(), 'demo@vps-demo:~$');
  await session.shell.input('whoami\r');
  assert.ok(
    session.text().endsWith('\r\ndemo\r\n\x1b[1;32mdemo@vps-demo\x1b[0m:\x1b[1;34m~\x1b[0m$ '),
  );
});

test('fragmented escape sequences and CRLF do not leak control characters or duplicate prompts', async (t) => {
  const session = demo();
  t.after(() => session.engine.dispose());
  await session.shell.input('whoami\r\n');
  await session.shell.input('\x1b[');
  await session.shell.input('A');
  await session.shell.input('\r');
  await session.shell.input('\n');
  assert.equal(session.text().split('\r\ndemo\r\n').length - 1, 2);
});
