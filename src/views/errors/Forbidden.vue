<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { defaultDestination } from '@/router/access';
const router = useRouter();
const auth = useAuthStore();
</script>

<template>
  <section class="error-page">
    <h1>403</h1>
    <p>你没有访问此页面的权限。如需访问，请联系管理员。</p>
    <el-button
      v-if="defaultDestination(router, auth) !== '/403'"
      type="primary"
      @click="router.replace(defaultDestination(router, auth))"
    >
      返回可访问页面
    </el-button>
  </section>
</template>

<style scoped>
.error-page {
  padding: 48px 16px;
  text-align: center;
}
</style>
