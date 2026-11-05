<script setup lang="ts">
import { computed, onScopeDispose, useTemplateRef, watch } from 'vue';
import { Close, MoreFilled } from '@element-plus/icons-vue';
import type { PageTab } from '@/stores/pageTabs';

const props = defineProps<{ items: readonly PageTab[]; activeKey: string; busy?: boolean }>();
const emit = defineEmits<{
  select: [key: string];
  close: [key: string];
  command: [value: string];
}>();
const strip = useTemplateRef<HTMLElement>('strip');
const activeIndex = computed(() => props.items.findIndex((tab) => tab.key === props.activeKey));
let restoreFocus = false;
function requestClose(key: string) {
  if (props.busy) return;
  restoreFocus = true;
  emit('close', key);
}
watch(
  [() => props.busy, () => props.items.map((tab) => tab.id).join(',')],
  () => {
    if (props.busy || !restoreFocus) return;
    const current = props.items[activeIndex.value];
    if (current)
      document.getElementById(`workspace-tab-${current.id}`)?.focus({ preventScroll: true });
    restoreFocus = false;
  },
  { flush: 'post' },
);
function reveal() {
  const tab = props.items[activeIndex.value];
  const container = strip.value;
  const element = tab
    ? document.getElementById(`workspace-tab-${tab.id}`)?.parentElement
    : undefined;
  if (!container || !element) return;
  const bounds = container.getBoundingClientRect(),
    target = element.getBoundingClientRect();
  if (target.left < bounds.left) container.scrollLeft += target.left - bounds.left;
  else if (target.right > bounds.right) container.scrollLeft += target.right - bounds.right;
}
let frame = 0;
let observer: ResizeObserver | undefined;
function scheduleReveal() {
  if (!frame)
    frame = requestAnimationFrame(() => {
      frame = 0;
      reveal();
    });
}
watch(
  [() => props.activeKey, () => props.items.map((tab) => `${tab.id}:${tab.title}`).join('|')],
  scheduleReveal,
  { flush: 'post' },
);
watch(
  strip,
  (element) => {
    observer?.disconnect();
    if (!element) return;
    observer = new ResizeObserver(scheduleReveal);
    observer.observe(element);
    scheduleReveal();
  },
  { flush: 'post' },
);
onScopeDispose(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
});
function move(index: number) {
  if (props.busy || !props.items.length) return;
  const tab = props.items[(index + props.items.length) % props.items.length]!;
  document.getElementById(`workspace-tab-${tab.id}`)?.focus({ preventScroll: true });
  emit('select', tab.key);
}
</script>

<template>
  <nav
    v-if="items.length"
    class="workspace-tabs"
    aria-label="页面页签栏"
  >
    <div
      ref="strip"
      role="tablist"
      aria-label="已打开的页面"
      class="tab-strip"
    >
      <div
        v-for="(tab, index) in items"
        :key="tab.id"
        class="tab-item"
        :class="{ 'is-active': tab.key === activeKey }"
      >
        <button
          :id="`workspace-tab-${tab.id}`"
          type="button"
          role="tab"
          :aria-selected="tab.key === activeKey"
          :aria-controls="`workspace-panel-${tab.id}`"
          :aria-disabled="busy"
          :tabindex="tab.key === activeKey || (activeIndex < 0 && index === 0) ? 0 : -1"
          class="tab-link"
          :title="tab.title"
          @click="emit('select', tab.key)"
          @keydown.left.prevent="move(index - 1)"
          @keydown.right.prevent="move(index + 1)"
          @keydown.home.prevent="move(0)"
          @keydown.end.prevent="move(items.length - 1)"
          @keydown.delete.prevent="requestClose(tab.key)"
        >
          <span>{{ tab.title }}</span>
        </button>
        <button
          type="button"
          class="tab-close"
          :aria-label="`关闭页签：${tab.title}`"
          :aria-disabled="busy"
          :tabindex="tab.key === activeKey ? 0 : -1"
          @click="requestClose(tab.key)"
        >
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </div>
    <el-dropdown
      trigger="click"
      placement="bottom-end"
      @command="(value) => emit('command', String(value))"
    >
      <button
        type="button"
        class="tab-actions"
        aria-label="页签操作"
        :disabled="busy"
      >
        <el-icon><MoreFilled /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            command="refresh"
            :disabled="activeIndex < 0"
          >
            刷新当前
          </el-dropdown-item>
          <el-dropdown-item
            command="others"
            :disabled="activeIndex < 0 || items.length < 2"
          >
            关闭其他
          </el-dropdown-item>
          <el-dropdown-item
            command="right"
            :disabled="activeIndex < 0 || activeIndex === items.length - 1"
          >
            关闭右侧
          </el-dropdown-item>
          <el-dropdown-item command="all">关闭全部</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </nav>
</template>

<style scoped>
.workspace-tabs {
  display: flex;
  align-items: center;
  gap: var(--app-space-xs);
  min-width: 0;
  height: 44px;
  padding-inline: var(--app-space-md);
  border-bottom: var(--app-border-secondary);
  background: var(--app-color-surface);
}
.tab-strip {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--app-space-2xs);
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}
.tab-item {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: 30px;
  border-radius: var(--app-radius-sm);
  color: var(--app-color-text-secondary);
}
.tab-item:hover {
  background: var(--app-color-fill-hover);
}
.tab-item.is-active,
.tab-item.is-active:hover {
  color: var(--app-color-selected-text);
  background: var(--app-color-selected-bg);
}
.tab-link,
.tab-close,
.tab-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: inherit;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.tab-link {
  min-width: 0;
  padding: 0 6px 0 12px;
  font: inherit;
  font-size: 13px;
}
.tab-link span {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tab-close {
  width: 24px;
  height: 24px;
  margin-inline-end: 4px;
  padding: 0;
  border-radius: var(--app-radius-xs);
}
.tab-close:hover {
  background: var(--app-color-fill);
}
.tab-actions {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: var(--app-radius-sm);
  color: var(--app-color-text-secondary);
}
.tab-actions:hover {
  background: var(--app-color-fill-hover);
  color: var(--app-color-primary);
}
.tab-link:focus-visible,
.tab-close:focus-visible,
.tab-actions:focus-visible {
  outline: 2px solid var(--app-color-primary);
  outline-offset: -2px;
}
.tab-item.is-active .tab-link:focus-visible,
.tab-item.is-active .tab-close:focus-visible {
  outline-color: currentColor;
}
@media (max-width: 760px) {
  .workspace-tabs {
    padding-inline: var(--app-space-xs);
  }
  .tab-link span {
    max-width: 120px;
  }
}
</style>
