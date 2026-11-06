<script setup lang="ts">
import { onBeforeUnmount, reactive, shallowRef } from 'vue';
import { authApi } from '@/api/auth';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { safeDestination } from '@/router/access';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const form = reactive({ username: '', password: '' });
const error = shallowRef('');
const setupRequired = shallowRef(false);
const checking = shallowRef(true);
const confirmPassword = shallowRef('');
const bootstrapCode = shallowRef('');
const statusRequest = new AbortController();
async function checkSetup() {
  checking.value = true;
  error.value = '';
  try {
    const status = await authApi.setupStatus(statusRequest.signal);
    if (!statusRequest.signal.aborted) setupRequired.value = status.setup_required;
  } catch (cause) {
    if (!statusRequest.signal.aborted)
      error.value = cause instanceof Error ? cause.message : '无法读取登录配置';
  } finally {
    if (!statusRequest.signal.aborted) checking.value = false;
  }
}
void checkSetup();
onBeforeUnmount(() => statusRequest.abort());
const demoHint =
  import.meta.env.DEV && import.meta.env.MODE === 'mock'
    ? '本地演示：admin / viewer / tester，密码均为 Demo@123456'
    : '';

async function login() {
  if (auth.busy || checking.value) return;
  error.value = '';
  if (setupRequired.value && form.password !== confirmPassword.value) {
    error.value = '两次输入的密码不一致';
    return;
  }
  try {
    const credentials = { username: form.username.trim(), password: form.password };
    if (setupRequired.value) await auth.setup(credentials, bootstrapCode.value);
    else await auth.login(credentials);
    form.password = '';
    confirmPassword.value = '';
    bootstrapCode.value = '';
    await router.replace(safeDestination(route.query.redirect, router, auth));
  } catch (cause) {
    form.password = '';
    confirmPassword.value = '';
    bootstrapCode.value = '';
    error.value = cause instanceof Error ? cause.message : '登录失败，请稍后重试';
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <h1>鲸栈</h1>
      <p>{{ setupRequired ? '首次设置工作区账号，完成后自动登录' : '登录以访问你的工作空间' }}</p>
      <p
        v-if="checking"
        role="status"
      >
        正在读取登录配置…
      </p>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
        role="alert"
      />
      <el-form
        :model="form"
        label-position="top"
        @submit.prevent="login"
      >
        <el-form-item label="用户名">
          <el-input
            v-model="form.username"
            name="username"
            autocomplete="username"
            required
            maxlength="100"
            :minlength="setupRequired ? 3 : undefined"
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            name="password"
            type="password"
            :autocomplete="setupRequired ? 'new-password' : 'current-password'"
            required
            show-password
            maxlength="256"
            :minlength="setupRequired ? 10 : undefined"
          />
        </el-form-item>
        <template v-if="setupRequired">
          <el-form-item label="确认密码">
            <el-input
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              show-password
            />
          </el-form-item>
          <el-form-item label="初始化校验码">
            <el-input
              v-model="bootstrapCode"
              type="password"
              autocomplete="off"
              required
              placeholder="仅首次设置账号需要"
            />
          </el-form-item>
          <p class="setup-note">
            校验码由服务端管理员提供，仅初始化时使用。以后使用你设置的用户名和密码登录。
          </p>
        </template>
        <el-button
          type="primary"
          native-type="submit"
          :loading="auth.busy"
          :disabled="checking"
          class="login-button"
        >
          {{ setupRequired ? '创建账号并进入' : '登录' }}
        </el-button>
      </el-form>
      <p
        v-if="demoHint"
        class="demo-hint"
      >
        {{ demoHint }}
      </p>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--app-page-padding);
  box-sizing: border-box;
}
.login-card {
  box-sizing: border-box;
  width: min(100%, 380px);
  padding: var(--app-space-xl);
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  background: var(--app-color-surface);
  box-shadow: var(--app-shadow-card);
}
.login-card h1 {
  margin-top: 0;
}
.login-card > p {
  color: var(--el-text-color-secondary);
}
.login-button {
  width: 100%;
}
.demo-hint {
  font-size: 12px;
  line-height: 1.6;
}
.setup-note {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.el-alert {
  margin-bottom: 16px;
}
</style>
