<script setup lang="ts">
import { computed } from 'vue';
import type { SessionUser } from '@/auth/permissions';
import { validAvatarUrl } from '@/auth/profile';
const props = withDefaults(defineProps<{ user: SessionUser | null; size?: number }>(), {
  size: 32,
});
const source = computed(() =>
  props.user?.avatarUrl && validAvatarUrl(props.user.avatarUrl) ? props.user.avatarUrl : undefined,
);
const initial = computed(() => Array.from(props.user?.displayName || '?')[0]);
</script>

<template>
  <el-avatar
    :size="size"
    :src="source"
    class="user-avatar"
    :style="{ fontSize: `${Math.max(12, Math.round(size * 0.38))}px` }"
    role="img"
    :aria-label="`${user?.displayName ?? '用户'}的头像`"
  >
    {{ initial }}
  </el-avatar>
</template>

<style scoped>
.user-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--app-color-primary), var(--app-color-primary-hover));
  color: #fff;
  font-weight: 600;
}
</style>
