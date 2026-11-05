import type { TerminalHandle } from '@/components/AppTerminal/types';

interface CommandResult {
  output?: string;
  clear?: boolean;
  exit?: boolean;
}
interface Operation {
  text: string;
  control: boolean;
  done?: () => void;
}

/** Local preview editing only. Real SSH input still goes directly to the remote PTY. */
export function createDemoLineEditor(
  terminal: TerminalHandle,
  options: {
    prompt: string;
    welcome: string;
    execute: (command: string) => CommandResult;
    exited: () => void;
    highlight?: { commandStyle(line: string): string; format(line: string, from?: number): string };
  },
) {
  let line = '';
  let historyIndex = 0;
  const history: string[] = [];
  let running = true;
  let writing = true;
  let queue: Operation[] = [];
  let offset = 0;
  let current: Operation | undefined;
  let escape = '';
  let carriageReturn = false;
  const format = (value: string, from = 0) =>
    options.highlight?.format(value, from) ?? value.slice(from);

  function discardPending() {
    for (let index = offset; index < queue.length; index++) queue[index]?.done?.();
    queue = [];
    offset = 0;
  }
  function redraw() {
    const buffer = terminal.getBuffer();
    let up = 0;
    if (buffer) {
      const cursor = buffer.baseY + buffer.cursorY;
      let start = cursor;
      while (start > buffer.baseY && buffer.getLine(start)?.isWrapped) start--;
      up = cursor - start;
    }
    // Clear the entire visible input region, rather than just its last physical row.
    return `${up ? `\x1b[${up}A` : ''}\r\x1b[J${options.prompt}${format(line)}`;
  }
  function backspace() {
    if (!line) return '';
    const buffer = terminal.getBuffer();
    if (!buffer) return '';
    const cursorRow = buffer.baseY + buffer.cursorY;
    let row = cursorRow;
    let column = buffer.cursorX - 1;
    if (column < 0 && buffer.getLine(row)?.isWrapped) {
      row--;
      column = terminal.getSize().cols - 1;
    }
    const previous = buffer.getLine(row);
    // Skip wide-character continuation cells and the empty padding before a wide wrap.
    while (column >= 0) {
      const cell = previous?.getCell(column);
      if (cell && cell.getWidth() > 0 && cell.getChars()) {
        const text = cell.getChars();
        const previousStyle = options.highlight?.commandStyle(line);
        const owned = line.endsWith(text);
        line = owned ? line.slice(0, -text.length) : Array.from(line).slice(0, -1).join('');
        // A cursor cannot move into scrollback; redraw the remaining input in the active screen.
        if (!owned || row < buffer.baseY || previousStyle !== options.highlight?.commandStyle(line))
          return redraw();
        return `${row < cursorRow ? `\x1b[${cursorRow - row}A` : ''}\x1b[${column + 1}G\x1b[${cell.getWidth()}X`;
      }
      column--;
    }
    return '';
  }
  function apply(operation: Operation) {
    const { text } = operation;
    if (!operation.control) {
      const previousStyle = options.highlight?.commandStyle(line);
      const start = line.length;
      line += text;
      return previousStyle !== options.highlight?.commandStyle(line)
        ? redraw()
        : format(line, start);
    }
    if (text === '\x7f' || text === '\b') return backspace();
    if (text === '\x03') {
      line = '';
      historyIndex = history.length;
      return '^C\r\n' + options.prompt;
    }
    if (text === '\x0c') return '\x1b[2J\x1b[H' + options.prompt + format(line);
    if (text === 'redraw') return redraw();
    if (['\x1b[A', '\x1b[B', '\x1bOA', '\x1bOB'].includes(text)) {
      historyIndex = Math.max(
        0,
        Math.min(history.length, historyIndex + (text.endsWith('A') ? -1 : 1)),
      );
      line = history[historyIndex] ?? '';
      return redraw();
    }
    if (text !== '\r' && text !== '\n') return '';
    const command = line.trim();
    if (command) {
      history.push(command);
      if (history.length > 100) history.shift();
    }
    historyIndex = history.length;
    line = '';
    const result = options.execute(command);
    const output = result.output ? result.output + '\r\n' : '';
    if (result.exit) {
      running = false;
      discardPending();
      options.exited();
      return '\r\n' + output;
    }
    return (result.clear ? '\x1b[2J\x1b[H' : '\r\n') + output + options.prompt;
  }
  function drain() {
    if (writing || !running) return;
    current = queue[offset++];
    if (!current) {
      queue = [];
      offset = 0;
      return;
    }
    writing = true;
    const operation = current;
    // xterm writes are asynchronous: do not read cursor/cell state until the prior write parses.
    terminal.write(apply(operation), () => {
      operation.done?.();
      current = undefined;
      writing = false;
      drain();
    });
  }
  function tokenize(data: string) {
    const operations: Operation[] = [];
    let printable = '';
    function flush() {
      if (printable) operations.push({ text: printable, control: false });
      printable = '';
    }
    for (const character of data) {
      if (character === '\n' && carriageReturn) {
        carriageReturn = false;
        continue;
      }
      carriageReturn = character === '\r';
      if (escape) {
        escape += character;
        const csi = escape[1] === '[';
        const final = escape.length > 2 && character >= '@' && character <= '~';
        if ((!csi && escape[1] !== 'O') || final || escape.length > 32) {
          operations.push({ text: escape, control: true });
          escape = '';
        }
      } else if (character === '\x1b') {
        flush();
        escape = character;
      } else if (character < ' ' || (character >= '\x7f' && character <= '\x9f')) {
        flush();
        operations.push({ text: character, control: true });
      } else printable += character;
    }
    flush();
    return operations;
  }

  // Drain output from a previous session before resetting the shared renderer.
  terminal.write('', () => {
    if (!running) return;
    terminal.reset();
    terminal.write(options.welcome + options.prompt, () => {
      writing = false;
      drain();
    });
  });
  function enqueue(operations: Operation[]): Promise<void> {
    if (!running) return Promise.resolve();
    if (!operations.length) operations.push({ text: '', control: false });
    return new Promise((resolve) => {
      operations[operations.length - 1]!.done = resolve;
      queue.push(...operations);
      drain();
    });
  }
  return {
    input(data: string): Promise<void> {
      return running ? enqueue(tokenize(data)) : Promise.resolve();
    },
    resize() {
      return enqueue([{ text: 'redraw', control: true }]);
    },
    stop() {
      running = false;
      current?.done?.();
      discardPending();
    },
  };
}
