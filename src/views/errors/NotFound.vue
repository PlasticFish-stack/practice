<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="not-found">
    <h1>404</h1>
    <p>页面不存在，请检查地址。</p>
    <RouterLink to="/">返回首页</RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  padding: 48px 16px;
  text-align: center;
}
</style>
