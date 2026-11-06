<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { createObserverApi } from '@/api/xray';
import ObserverDashboard from './ObserverDashboard.vue';
import { useObserverQuery } from './useObserverQuery';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const api = createObserverApi(() => {
  auth.invalidate();
  void router.replace({ name: 'login', query: { redirect: route.fullPath } });
});
const {
  data: session,
  error,
  busy,
  refresh,
} = useObserverQuery(
  true,
  async (_key, signal) => {
    const value = await api.session(signal);
    if (value.api_version !== '1.0.1' || !value.permissions.includes('observe:read'))
      throw new Error('监控接口版本不兼容或缺少查看权限');
    return value;
  },
  60000,
);
</script>

<template>
  <div class="overview-page">
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    >
      <el-button
        text
        @click="refresh"
      >
        重新加载
      </el-button>
    </el-alert>
    <ObserverDashboard
      v-if="session"
      :api="api"
      :data-mode="session.data_mode"
    />
    <el-skeleton
      v-else-if="busy"
      :rows="12"
      animated
    />
  </div>
</template>

<style scoped>
.overview-page {
  min-width: 0;
  width: 100%;
}
</style>
