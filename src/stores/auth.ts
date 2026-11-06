import { computed, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import axios from 'axios';
import { authApi } from '@/api/auth';
import { ApiError } from '@/net/axios';
import { hasPermissions, parseSessionUser } from '@/auth/permissions';
import type { PermissionRequirement, SessionUser } from '@/auth/permissions';
import type { UserProfile } from '@/auth/profile';
import type { LoginCredentials } from '@/api/auth';

export function isUnauthorized(error: unknown) {
  return (
    (error instanceof ApiError && error.code === 401) ||
    (axios.isAxiosError(error) && error.response?.status === 401)
  );
}

export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<SessionUser | null>(null);
  const initialized = shallowRef(false);
  const busy = shallowRef(false);
  const savingProfile = shallowRef(false);
  const revision = shallowRef(0);
  const authenticated = computed(() => user.value !== null);
  let pending: Promise<void> | null = null;
  let loading: AbortController | null = null;

  function can(required: PermissionRequirement = []) {
    return hasPermissions(user.value, required);
  }

  function invalidate() {
    revision.value++;
    loading?.abort();
    loading = null;
    pending = null;
    user.value = null;
    initialized.value = true;
  }

  async function ensureSession(force = false): Promise<void> {
    if (pending) return pending;
    if (initialized.value && !force) return;
    const version = revision.value;
    const controller = new AbortController();
    loading = controller;
    const task = (async () => {
      try {
        const value = await authApi.session(controller.signal);
        if (version !== revision.value) return;
        const next = parseSessionUser(value);
        if (user.value && user.value.id !== next.id) revision.value++;
        user.value = next;
        initialized.value = true;
      } catch (error) {
        if (version !== revision.value) return;
        if (!isUnauthorized(error)) throw error;
        invalidate();
      } finally {
        if (loading === controller) loading = null;
      }
    })();
    pending = task;
    try {
      await task;
    } finally {
      if (pending === task) pending = null;
    }
  }

  async function login(credentials: LoginCredentials) {
    if (busy.value) throw new Error('正在处理登录请求');
    busy.value = true;
    invalidate();
    const version = revision.value;
    try {
      const value = await authApi.login(credentials);
      if (version !== revision.value) throw new Error('会话已变更，请重新登录');
      user.value = parseSessionUser(value);
      initialized.value = true;
      revision.value++;
    } finally {
      busy.value = false;
    }
  }

  async function saveProfile(profile: UserProfile) {
    if (!user.value || busy.value || savingProfile.value) throw new Error('当前无法保存个人资料');
    const version = revision.value;
    const id = user.value.id;
    savingProfile.value = true;
    try {
      const next = parseSessionUser(await authApi.updateProfile(profile));
      if (version !== revision.value || user.value?.id !== id || next.id !== id)
        throw new Error('会话已变更，请重新打开设置');
      revision.value++;
      user.value = next;
      return next;
    } finally {
      savingProfile.value = false;
    }
  }

  async function logout() {
    if (busy.value) return;
    busy.value = true;
    try {
      await authApi.logout();
      invalidate();
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      invalidate();
    } finally {
      busy.value = false;
    }
  }

  return {
    user,
    initialized,
    busy,
    savingProfile,
    revision,
    authenticated,
    can,
    ensureSession,
    login,
    logout,
    saveProfile,
    invalidate,
  };
});
