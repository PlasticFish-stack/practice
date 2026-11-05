<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { useFullscreen } from '@vueuse/core';
import { ElButton, ElIcon, ElMessage } from 'element-plus';
import { CopyDocument, Delete, FullScreen, Monitor } from '@/components/icons';
import { Terminal } from '@xterm/xterm';
import type { IDisposable, ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TerminalHandle, TerminalSize, TerminalStatus } from './types';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    status?: TerminalStatus;
    statusLabel?: string;
    readOnly?: boolean;
    dark?: boolean;
    height?: number;
    fontSize?: number;
    scrollback?: number;
  }>(),
  {
    title: '终端',
    status: 'disconnected',
    readOnly: false,
    dark: true,
    height: 440,
    fontSize: 14,
    scrollback: 2000,
  },
);
const emit = defineEmits<{
  ready: [terminal: TerminalHandle];
  data: [data: string];
  binary: [data: Uint8Array];
  resize: [size: TerminalSize];
  clear: [];
}>();
const root = useTemplateRef<HTMLElement>('root');
const screen = useTemplateRef<HTMLElement>('screen');
const size = shallowRef<TerminalSize>({ cols: 80, rows: 24 });
const selected = shallowRef(false);
const { isFullscreen, toggle, exit } = useFullscreen(root, { autoExit: true });
const labels: Record<TerminalStatus, string> = {
  disconnected: '未连接',
  connecting: '连接中',
  connected: '已连接',
  error: '连接异常',
};
const inputEnabled = computed(() => props.status === 'connected' && !props.readOnly);
const theme = computed<ITheme>(() =>
  props.dark
    ? {
        background: '#141414',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#141414',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#e3b341',
        blue: '#79c0ff',
        magenta: '#d2a8ff',
        cyan: '#76e3ea',
        white: '#e6edf3',
        brightBlack: '#8b949e',
        brightRed: '#ffa198',
        brightGreen: '#aff5b4',
        brightYellow: '#f8e3a1',
        brightBlue: '#a5d6ff',
        brightMagenta: '#e2c5ff',
        brightCyan: '#b3f0ff',
        brightWhite: '#ffffff',
      }
    : {
        background: '#ffffff',
        foreground: '#1f2328',
        cursor: '#1677ff',
        cursorAccent: '#ffffff',
        selectionBackground: '#b6d7ff',
        black: '#24292f',
        red: '#cf222e',
        green: '#116329',
        yellow: '#7d4e00',
        blue: '#0550ae',
        magenta: '#8250df',
        cyan: '#1b7c83',
        white: '#6e7781',
        brightBlack: '#57606a',
        brightRed: '#a40e26',
        brightGreen: '#1a7f37',
        brightYellow: '#9a6700',
        brightBlue: '#0969da',
        brightMagenta: '#6639ba',
        brightCyan: '#096a72',
        brightWhite: '#24292f',
      },
);
let terminal: Terminal | undefined;
let fitAddon: FitAddon | undefined;
let observer: ResizeObserver | undefined;
let frame = 0;
let active = true;
let disposed = false;
const listeners: IDisposable[] = [];

function fit() {
  if (
    !active ||
    !terminal ||
    !screen.value ||
    screen.value.clientWidth < 1 ||
    screen.value.clientHeight < 1
  )
    return;
  fitAddon?.fit();
}
function scheduleFit() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(fit);
}
const api: TerminalHandle = {
  write: (data, parsed) => terminal?.write(data, parsed),
  writeln: (data) => terminal?.writeln(data),
  clear: () => terminal?.clear(),
  reset: () => terminal?.reset(),
  focus: () => {
    if (active) terminal?.focus();
  },
  fit: scheduleFit,
  getSize: () => ({ ...size.value }),
  getSelection: () => terminal?.getSelection() ?? '',
  getBuffer: () => terminal?.buffer.active,
};
defineExpose<TerminalHandle>(api);

onMounted(() => {
  if (!screen.value) return;
  terminal = new Terminal({
    theme: theme.value,
    fontFamily: "'Cascadia Code', 'Consolas', 'Menlo', monospace",
    fontSize: Math.max(10, Math.min(24, props.fontSize)),
    lineHeight: 1.3,
    scrollback: Math.max(0, Math.min(10000, props.scrollback)),
    cursorStyle: 'block',
    cursorBlink: false,
    screenReaderMode: true,
    disableStdin: !inputEnabled.value,
    allowProposedApi: false,
  });
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(screen.value);
  terminal.textarea?.setAttribute('aria-label', '终端输入');
  listeners.push(
    terminal.onData((data) => {
      if (active && inputEnabled.value) emit('data', data);
    }),
    terminal.onBinary((data) => {
      if (active && inputEnabled.value)
        emit(
          'binary',
          Uint8Array.from(data, (char) => char.charCodeAt(0)),
        );
    }),
    terminal.onResize((next) => {
      size.value = next;
      emit('resize', next);
    }),
    terminal.onSelectionChange(() => {
      selected.value = terminal?.hasSelection() ?? false;
    }),
  );
  observer = new ResizeObserver(scheduleFit);
  observer.observe(screen.value);
  fit();
  emit('ready', api);
  void document.fonts.ready.then(() => {
    if (!disposed) scheduleFit();
  });
});
watch(inputEnabled, (enabled) => {
  if (terminal) terminal.options.disableStdin = !active || !enabled;
});
watch(theme, (value) => {
  if (terminal) terminal.options.theme = value;
});
watch(
  () => props.fontSize,
  (value) => {
    if (terminal) terminal.options.fontSize = Math.max(10, Math.min(24, value));
    scheduleFit();
  },
);
watch(
  () => props.scrollback,
  (value) => {
    if (terminal) terminal.options.scrollback = Math.max(0, Math.min(10000, value));
  },
);
onActivated(() => {
  active = true;
  if (terminal) terminal.options.disableStdin = !inputEnabled.value;
  if (screen.value) observer?.observe(screen.value);
  scheduleFit();
});
onDeactivated(() => {
  active = false;
  cancelAnimationFrame(frame);
  observer?.disconnect();
  terminal?.blur();
  if (terminal) terminal.options.disableStdin = true;
  if (isFullscreen.value) void exit().catch(() => {});
});
onBeforeUnmount(() => {
  disposed = true;
  active = false;
  cancelAnimationFrame(frame);
  observer?.disconnect();
  listeners.forEach((listener) => listener.dispose());
  terminal?.dispose();
  terminal = undefined;
});
async function copy() {
  const value = api.getSelection();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    ElMessage.error('复制失败，请使用系统复制快捷键');
  }
}
function clearScreen() {
  api.clear();
  emit('clear');
}
async function fullscreen() {
  try {
    await toggle();
    await nextTick();
    scheduleFit();
  } catch {
    ElMessage.warning('当前浏览器暂不支持终端全屏');
  }
}
</script>

<template>
  <section
    ref="root"
    class="app-terminal"
    :style="{ '--terminal-background': theme.background }"
    :aria-label="title"
  >
    <header class="terminal-toolbar">
      <div class="terminal-heading">
        <ElIcon><Monitor /></ElIcon>
        <div>
          <strong>{{ title }}</strong>
          <span v-if="subtitle">{{ subtitle }}</span>
        </div>
      </div>
      <div class="terminal-actions">
        <span
          class="terminal-status"
          :data-status="status"
          role="status"
        >
          <i />
          {{ statusLabel || labels[status] }}
        </span>
        <ElButton
          :icon="CopyDocument"
          :disabled="!selected"
          aria-label="复制终端选中内容"
          @click="copy"
        >
          复制
        </ElButton>
        <ElButton
          :icon="Delete"
          aria-label="清空终端滚屏"
          @click="clearScreen"
        >
          清屏
        </ElButton>
        <ElButton
          :icon="FullScreen"
          :aria-label="isFullscreen ? '退出终端全屏' : '终端全屏'"
          @click="fullscreen"
        />
      </div>
    </header>
    <div
      ref="screen"
      class="terminal-screen"
      :style="{ height: `${Math.max(160, height)}px` }"
    />
    <footer class="terminal-footer">
      <span aria-label="终端尺寸">{{ size.cols }} × {{ size.rows }}</span>
      <span>{{ inputEnabled ? 'Ctrl+C 中断 · Ctrl+L 清屏' : '只读 · 可选择并复制输出' }}</span>
    </footer>
  </section>
</template>

<style scoped>
.app-terminal {
  min-width: 0;
  overflow: hidden;
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  background: var(--terminal-background);
}
.terminal-toolbar,
.terminal-actions,
.terminal-heading,
.terminal-footer {
  display: flex;
  align-items: center;
}
.terminal-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: var(--app-border-secondary);
  background: var(--el-bg-color);
}
.terminal-heading {
  min-width: 0;
  gap: 10px;
}
.terminal-heading > .el-icon {
  font-size: 20px;
  color: var(--el-color-primary);
}
.terminal-heading strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
}
.terminal-heading span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  overflow-wrap: anywhere;
}
.terminal-actions {
  flex-wrap: wrap;
  gap: 8px;
}
.terminal-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.terminal-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.terminal-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}
.terminal-status[data-status='connected'] i {
  background: var(--el-color-success);
}
.terminal-status[data-status='connecting'] i {
  background: var(--el-color-primary);
}
.terminal-status[data-status='error'] i {
  background: var(--el-color-danger);
}
.terminal-screen {
  box-sizing: border-box;
  min-width: 0;
  padding: 16px;
  overflow: hidden;
}
.terminal-screen :deep(.xterm) {
  height: 100%;
}
.terminal-footer {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-top: var(--app-border-secondary);
  background: var(--el-bg-color);
}
.app-terminal:fullscreen {
  width: 100vw;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  border: 0;
  border-radius: 0;
}
.app-terminal:fullscreen .terminal-screen {
  flex: 1;
  min-height: 0;
}
@media (max-width: 600px) {
  .terminal-toolbar {
    padding: 12px;
  }
  .terminal-screen {
    padding: 12px;
  }
  .terminal-actions {
    width: 100%;
  }
  .terminal-status {
    flex-basis: 100%;
  }
  .terminal-actions :deep(.el-button) {
    flex: 1;
  }
}
</style>
