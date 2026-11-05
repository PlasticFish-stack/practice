<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue';
import { createObserverApi, type ObserverApi } from '@/api/xray';
import type { Session } from '@/api/xray/types';
import ObserverDashboard from './ObserverDashboard.vue';

const token = shallowRef('');
const session = shallowRef<Session | null>(null);
const api = shallowRef<ObserverApi | null>(null);
const busy = shallowRef(false);
const error = shallowRef('');
let loginRequest: AbortController | undefined;
function disconnect(message = '') {
  loginRequest?.abort();
  session.value = null;
  api.value = null;
  token.value = '';
  busy.value = false;
  error.value = message;
}
async function connect() {
  if (!token.value.trim() || busy.value) return;
  loginRequest = new AbortController();
  const request = loginRequest;
  busy.value = true;
  error.value = '';
  const client = createObserverApi(token.value.trim(), () => disconnect('令牌已失效，请重新输入'));
  token.value = '';
  try {
    const result = await client.session(request.signal);
    if (request.signal.aborted) return;
    if (result.api_version !== '1.0.1' || !result.permissions.includes('observe:read'))
      throw new Error('接口版本不兼容或缺少观察权限');
    session.value = result;
    api.value = client;
  } catch (cause) {
    if (!request.signal.aborted) error.value = cause instanceof Error ? cause.message : '连接失败';
  } finally {
    if (loginRequest === request) busy.value = false;
  }
}
onBeforeUnmount(() => disconnect());
</script>

<template>
  <div class="observer-page">
    <div
      v-if="session"
      class="connection-toolbar"
    >
      <el-tag
        :type="session.data_mode === 'live' ? 'success' : 'warning'"
        effect="plain"
      >
        {{ session.data_mode === 'live' ? '真实数据' : '模拟数据' }} · v{{ session.api_version }}
      </el-tag>
      <el-button @click="disconnect()">断开连接</el-button>
    </div>
    <section
      v-if="!session || !api"
      class="connect-card"
    >
      <h1 class="connect-title">连接你的观察节点</h1>
      <p class="muted">查看主机指标和实时访问记录。请输入观察服务的访问令牌。</p>
      <form
        class="connect-form"
        @submit.prevent="connect"
      >
        <label for="observer-token">访问令牌</label>
        <el-input
          id="observer-token"
          v-model="token"
          type="password"
          autocomplete="off"
          placeholder="输入 Bearer 令牌"
          :disabled="busy"
        />
        <el-button
          native-type="submit"
          type="primary"
          :loading="busy"
          :disabled="!token.trim()"
        >
          连接观察服务
        </el-button>
      </form>
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
      <p class="connect-note">令牌仅用于当前观察页，刷新、关闭页签或离开后需要重新输入。</p>
    </section>
    <ObserverDashboard
      v-else
      :api="api"
    />
  </div>
</template>

<style scoped>
.observer-page {
  min-width: 0;
}
.connection-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--app-space-sm);
  margin-bottom: var(--app-space-md);
}
.connect-card {
  box-sizing: border-box;
  width: min(100%, 480px);
  padding: var(--app-space-xl);
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  background: var(--app-color-surface);
  box-shadow: var(--app-shadow-card);
}
.connect-title {
  font-size: 20px;
  margin: 0 0 var(--app-space-md);
}
.muted,
.connect-note {
  color: var(--app-color-text-secondary);
}
.connect-form {
  display: grid;
  gap: var(--app-space-sm);
  margin: var(--app-space-lg) 0;
}
.connect-note {
  font-size: 12px;
}
.error {
  color: var(--el-color-danger);
}
</style>
