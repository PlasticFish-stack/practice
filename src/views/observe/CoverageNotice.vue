<script setup lang="ts">
import type { Coverage } from '@/api/xray/types';
import { coverageText } from './format';
defineProps<{ coverage: Coverage }>();
</script>

<template>
  <p
    class="coverage"
    :class="{ partial: coverage.partial }"
    role="status"
  >
    {{ coverageText(coverage) }}
  </p>
</template>

<style scoped>
.coverage {
  margin: 12px 0;
  color: var(--app-color-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.partial {
  color: var(--el-color-warning-dark-2);
}
</style>
