import type { TerminalHandle } from '@/components/AppTerminal/types';
import { createDemoLineEditor } from './demoLineEditor';
import { createDemoHighlighter } from './demoHighlight';

/** Local interaction only: deliberately does not evaluate JS or execute a system shell. */
export function createDemoTerminal(terminal: TerminalHandle, exited: () => void) {
  const prompt = '\x1b[1;32mdemo@vps-demo\x1b[0m:\x1b[1;34m~\x1b[0m$ ';
  const commands: Record<string, string> = {
    help: '可用演示命令：help  clear  whoami  hostname  pwd  ls  uname -a  uptime  free -h  df -h  date  echo  exit\r\n支持退格、↑/↓历史、Ctrl+C、Ctrl+L。输出为本地示例数据。',
    whoami: 'demo',
    hostname: 'vps-demo',
    pwd: '/home/demo',
    ls: '\x1b[34mapps/  backups/  logs/\x1b[0m  README.md',
    'uname -a': 'Linux vps-demo 6.8.0-generic x86_64 GNU/Linux (demo)',
    uptime: 'up 12 days, 03:42, 1 user, load average: 0.08, 0.12, 0.10 (demo)',
    'free -h':
      '               total        used        free\r\nMem:           2.0Gi       682Mi       1.3Gi\r\nSwap:          1.0Gi          0B       1.0Gi',
    'df -h':
      'Filesystem      Size  Used Avail Use% Mounted on\r\n/dev/vda1        40G   12G   28G  30% /',
  };
  return createDemoLineEditor(terminal, {
    prompt,
    highlight: createDemoHighlighter([...Object.keys(commands), 'clear', 'date', 'echo', 'exit']),
    welcome:
      '\x1b[1mVPS Terminal · 本地交互演示\x1b[0m\r\n不会执行本机或 VPS 命令。输入 help 查看示例命令。\r\n\r\n',
    execute(command) {
      if (command === 'exit') return { output: '本地演示会话已结束。', exit: true };
      if (command === 'clear') return { clear: true };
      if (command === 'date') return { output: new Date().toLocaleString() };
      if (command === 'echo' || command.startsWith('echo ')) return { output: command.slice(5) };
      if (Object.hasOwn(commands, command)) return { output: commands[command]! };
      return { output: command ? `${command}: 未提供此演示命令，请输入 help` : '' };
    },
    exited,
  });
}
