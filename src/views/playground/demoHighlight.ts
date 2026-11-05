/** Presentation only; this is not a shell parser or command evaluator. */
export function createDemoHighlighter(commands: readonly string[]) {
  const known = new Set(commands.map((command) => command.split(' ')[0]));
  function commandStyle(line: string) {
    const command = line.trimStart().split(/\s/, 1)[0];
    return command ? (known.has(command) ? '1;32' : '31') : '39';
  }
  function format(line: string, from = 0) {
    let first = true;
    let output = '';
    for (const match of line.matchAll(/"[^"]*"?|'[^']*'?|\s+|[^\s"']+/g)) {
      const text = match[0];
      const whitespace = /^\s+$/.test(text);
      const style = whitespace
        ? '39'
        : first
          ? commandStyle(line)
          : text.startsWith('"') || text.startsWith("'")
            ? '33'
            : text.startsWith('-')
              ? '36'
              : '39';
      if (!whitespace) first = false;
      const start = Math.max(0, from - match.index);
      if (start < text.length) output += `\x1b[${style}m${text.slice(start)}\x1b[0m`;
    }
    return output;
  }
  return { commandStyle, format };
}
