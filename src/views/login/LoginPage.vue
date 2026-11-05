<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { safeDestination } from '@/router/access';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const form = reactive({ username: '', password: '' });
const error = shallowRef('');
const demoHint =
  import.meta.env.DEV && import.meta.env.MODE === 'mock'
    ? '本地演示：admin / viewer / tester，密码均为 Demo@123456'
    : '';

async function login() {
  if (auth.busy) return;
  error.value = '';
  try {
    await auth.login({ username: form.username.trim(), password: form.password });
    form.password = '';
    await router.replace(safeDestination(route.query.redirect, router, auth));
  } catch (cause) {
    form.password = '';
    error.value = cause instanceof Error ? cause.message : '登录失败，请稍后重试';
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <h1>后台管理</h1>
      <p>登录以访问你的工作空间</p>
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
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            show-password
            maxlength="256"
          />
        </el-form-item>
        <el-button
          type="primary"
          native-type="submit"
          :loading="auth.busy"
          class="login-button"
        >
          登录
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
.el-alert {
  margin-bottom: 16px;
}
</style>
