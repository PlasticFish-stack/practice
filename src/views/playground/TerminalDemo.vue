<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, shallowRef, watch } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';
import AppTerminal from '@/components/AppTerminal/AppTerminal.vue';
import type { TerminalHandle, TerminalSize, TerminalStatus } from '@/components/AppTerminal/types';
import { createDemoTerminal } from './demoTerminal';
import { useTerminalConnection } from '@/composables/useTerminalConnection';

const preferences = usePreferencesStore();
const mode = shallowRef<'demo' | 'gateway'>('demo');
const endpoint = shallowRef('/api/vps/hosts/demo/terminal');
const fontSize = shallowRef(14);
const readOnly = shallowRef(false);
const localStatus = shallowRef<TerminalStatus>('disconnected');
const terminal = shallowRef<TerminalHandle | null>(null);
let demo: ReturnType<typeof createDemoTerminal> | undefined;
const connection = useTerminalConnection((data, parsed) => {
  if (terminal.value) terminal.value.write(data, parsed);
  else parsed();
});
const status = computed(() =>
  mode.value === 'demo' ? localStatus.value : connection.status.value,
);
const connected = computed(() => status.value === 'connected' || status.value === 'connecting');
function disconnect() {
  const wasConnected = connected.value;
  demo?.stop();
  demo = undefined;
  connection.disconnect();
  localStatus.value = 'disconnected';
  if (wasConnected) terminal.value?.writeln('\r\n[会话已断开]');
}
function connect() {
  if (!terminal.value || connected.value) return;
  if (mode.value === 'demo') {
    demo = createDemoTerminal(terminal.value, () => {
      localStatus.value = 'disconnected';
    });
    localStatus.value = 'connected';
  } else {
    terminal.value.reset();
    connection.connect(endpoint.value, terminal.value.getSize());
  }
  terminal.value.focus();
}
function ready(api: TerminalHandle) {
  terminal.value = api;
  connect();
}
function input(data: string) {
  if (mode.value === 'demo') demo?.input(data);
  else connection.input(data);
}
function resize(size: TerminalSize) {
  if (mode.value === 'gateway') connection.resize(size);
  else void demo?.resize();
}
function redraw() {
  if (mode.value === 'demo') void demo?.resize();
}
function selectMode() {
  disconnect();
  terminal.value?.reset();
  if (mode.value === 'demo') connect();
  else terminal.value?.writeln('请填写已部署的终端网关地址，然后点击连接。');
}
watch(connection.status, (value, previous) => {
  if (mode.value !== 'gateway') return;
  if (value === 'connected') terminal.value?.focus();
  if (value === 'disconnected' && previous === 'connected')
    terminal.value?.writeln('\r\n[远端会话已结束]');
});
onDeactivated(() => {
  if (mode.value === 'gateway') disconnect();
});
onBeforeUnmount(disconnect);
</script>

<template>
  <section class="terminal-demo">
    <div class="demo-intro">
      <div>
        <h2>Web 终端</h2>
        <p>为 VPS 运维准备的终端界面，支持键盘输入、ANSI 输出和窗口自适应。</p>
      </div>
      <el-tag :type="mode === 'demo' ? 'info' : 'primary'">
        {{ mode === 'demo' ? '本地演示' : '网关连接' }}
      </el-tag>
    </div>
    <div class="connection-card">
      <div class="connection-options">
        <el-radio-group
          v-model="mode"
          aria-label="终端模式"
          @change="selectMode"
        >
          <el-radio-button value="demo">本地演示</el-radio-button>
          <el-radio-button value="gateway">WebSocket 网关</el-radio-button>
        </el-radio-group>
        <div class="display-options">
          <label for="terminal-font-size">字号</label>
          <el-input-number
            id="terminal-font-size"
            v-model="fontSize"
            :min="10"
            :max="24"
            :step="1"
            :precision="0"
            :value-on-clear="14"
            aria-label="终端字号"
          />
          <el-switch
            v-model="readOnly"
            active-text="只读"
            aria-label="终端只读模式"
          />
        </div>
      </div>
      <form
        class="gateway-form"
        @submit.prevent="connect"
      >
        <el-input
          v-if="mode === 'gateway'"
          v-model="endpoint"
          :disabled="connected"
          aria-label="终端网关地址"
          placeholder="/api/vps/hosts/demo/terminal"
        />
        <p
          v-else
          class="demo-note"
        >
          示例命令在浏览器中处理，不会连接或操作真实服务器。
        </p>
        <div class="connection-buttons">
          <el-button
            type="primary"
            native-type="submit"
            :disabled="connected"
          >
            {{ status === 'connecting' ? '连接中' : '连接' }}
          </el-button>
          <el-button
            :disabled="!connected"
            @click="disconnect"
          >
            断开
          </el-button>
        </div>
      </form>
      <p
        v-if="mode === 'gateway'"
        class="gateway-note"
      >
        需要已部署的同源终端网关，SSH 登录与服务器访问权限由后端处理。
      </p>
      <el-alert
        v-if="connection.error.value"
        :title="connection.error.value"
        type="error"
        :closable="false"
        role="alert"
      />
    </div>
    <AppTerminal
      title="VPS Terminal"
      :subtitle="mode === 'demo' ? 'demo@vps-demo · 浏览器本地会话' : '远程终端网关'"
      :status="status"
      :status-label="mode === 'demo' && status === 'connected' ? '演示会话' : undefined"
      :dark="preferences.dark"
      :font-size="fontSize"
      :read-only="readOnly"
      :height="440"
      @ready="ready"
      @data="input"
      @binary="connection.binary"
      @resize="resize"
      @clear="redraw"
    />
    <p class="terminal-tip">
      试试
      <code>help</code>
      、
      <code>uname -a</code>
      、
      <code>free -h</code>
      ；真实终端会话在离开本页时断开。
    </p>
  </section>
</template>

<style scoped>
.terminal-demo {
  display: grid;
  gap: var(--app-space-md);
  min-width: 0;
}
.demo-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.demo-intro h2 {
  margin: 0 0 6px;
  font-size: 20px;
}
.demo-intro p,
.terminal-tip,
.gateway-note {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.connection-card {
  display: grid;
  gap: 14px;
  padding: var(--app-space-md);
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  background: var(--el-bg-color);
}
.connection-options,
.display-options,
.gateway-form,
.connection-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}
.connection-options {
  flex-wrap: wrap;
  justify-content: space-between;
}
.display-options {
  flex-wrap: wrap;
  font-size: 13px;
}
.display-options :deep(.el-input-number) {
  width: 100px;
}
.gateway-form {
  justify-content: space-between;
}
.demo-note {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.connection-buttons {
  flex-shrink: 0;
  gap: 8px;
}
.connection-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}
.terminal-tip code {
  color: var(--el-text-color-primary);
}
@media (max-width: 640px) {
  .gateway-form {
    flex-wrap: wrap;
  }
  .connection-buttons {
    width: 100%;
  }
  .display-options {
    gap: 8px;
  }
}
</style>
