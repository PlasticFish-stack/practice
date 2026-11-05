<script setup lang="ts">
import { computed, onScopeDispose, shallowRef, useTemplateRef, watch } from 'vue';
import { Document, Right, Search } from '@/components/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { accessibleMenus, canAccessRoute } from '@/router/access';
import type { MenuNode } from '@/router/menu';

const router = useRouter();
const auth = useAuthStore();
const open = shallowRef(false);
const query = shallowRef('');
const selected = shallowRef(0);
const shortcutLabel = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K';
const input = useTemplateRef<HTMLInputElement>('searchInput');
function flatten(
  nodes: MenuNode[],
  parents: string[] = [],
): { title: string; path: string; trail: string }[] {
  return nodes.flatMap((node) =>
    node.children.length
      ? flatten(node.children, [...parents, node.title])
      : [{ title: node.title, path: node.path, trail: parents.join(' / ') || '工作空间' }],
  );
}
const results = computed(() => {
  const pages = flatten(accessibleMenus(router, auth));
  const paths = new Set(pages.map((page) => page.path));
  for (const record of router.getRoutes()) {
    if (
      record.meta.searchable &&
      record.meta.title &&
      !paths.has(record.path) &&
      canAccessRoute(router.resolve(record.path), auth)
    ) {
      pages.push({ title: record.meta.title, path: record.path, trail: '账户' });
      paths.add(record.path);
    }
  }
  const keyword = query.value.trim().toLowerCase();
  return pages.filter((item) =>
    `${item.title} ${item.trail} ${item.path}`.toLowerCase().includes(keyword),
  );
});
watch(query, () => {
  selected.value = 0;
});
function show() {
  query.value = '';
  selected.value = 0;
  open.value = true;
}
async function navigate(index: number) {
  const item = results.value[index];
  if (!item) return;
  await router.push(item.path);
  open.value = false;
}
function move(direction: number) {
  const count = results.value.length;
  selected.value = count ? (selected.value + direction + count) % count : 0;
}
function shortcut(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    show();
  }
}
window.addEventListener('keydown', shortcut);
onScopeDispose(() => window.removeEventListener('keydown', shortcut));
</script>

<template>
  <button
    class="search-trigger"
    type="button"
    aria-label="搜索导航"
    @click="show"
  >
    <el-icon><Search /></el-icon>
    <span>搜索页面</span>
    <kbd>{{ shortcutLabel }}</kbd>
  </button>
  <el-dialog
    v-model="open"
    title="导航搜索"
    width="560px"
    class="navigation-search-dialog"
    @opened="input?.focus()"
  >
    <div class="search-field">
      <el-icon><Search /></el-icon>
      <input
        ref="searchInput"
        v-model="query"
        aria-label="搜索页面"
        placeholder="输入页面名称或路径…"
        role="combobox"
        aria-controls="navigation-results"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-activedescendant="results.length ? `navigation-result-${selected}` : undefined"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="navigate(selected)"
      />
    </div>
    <div
      id="navigation-results"
      role="listbox"
      aria-label="可访问页面"
      class="search-results"
    >
      <button
        v-for="(item, index) in results"
        :id="`navigation-result-${index}`"
        :key="item.path"
        type="button"
        role="option"
        :aria-selected="index === selected"
        :class="{ selected: index === selected }"
        class="search-result"
        @click="navigate(index)"
        @pointermove="selected = index"
      >
        <el-icon><Document /></el-icon>
        <div>
          <strong>{{ item.title }}</strong>
          <span>{{ item.trail }} · {{ item.path }}</span>
        </div>
        <el-icon><Right /></el-icon>
      </button>
      <el-empty
        v-if="!results.length"
        description="没有匹配的可访问页面"
        :image-size="64"
      />
    </div>
    <footer class="search-footer">
      <span>↑ ↓ 选择</span>
      <span>Enter 打开</span>
      <span>Esc 关闭</span>
    </footer>
  </el-dialog>
</template>

<style scoped>
.search-trigger {
  display: flex;
  align-items: center;
  gap: var(--app-space-xs);
  color: var(--el-text-color-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--app-radius-base);
  padding: var(--app-space-xs);
  cursor: pointer;
  font-size: 13px;
}
.search-trigger:hover {
  background: var(--el-fill-color-light);
}
.search-trigger .el-icon {
  font-size: var(--app-icon-size-lg);
}
.search-trigger kbd {
  border: var(--app-border);
  padding: 0 var(--app-space-2xs);
  border-radius: var(--app-radius-sm);
  font:
    11px/18px ui-monospace,
    Consolas,
    monospace;
}
.search-field {
  display: flex;
  gap: var(--app-space-sm);
  align-items: center;
  padding: var(--app-space-sm);
  border: var(--app-border-width) var(--app-border-style) var(--el-color-primary);
  border-radius: var(--app-radius-base);
}
.search-field input {
  min-width: 0;
  flex: 1;
  color: var(--el-text-color-primary);
  background: transparent;
  outline: none;
  border: 0;
  font-size: 15px;
}
.search-results {
  display: grid;
  gap: var(--app-space-2xs);
  max-height: 360px;
  overflow-y: auto;
  padding: var(--app-space-sm) 0;
}
.search-result {
  width: 100%;
  display: flex;
  gap: var(--app-space-sm);
  align-items: center;
  text-align: left;
  background: transparent;
  color: var(--el-text-color-regular);
  border: 0;
  border-radius: var(--app-radius-base);
  padding: var(--app-space-sm);
  cursor: pointer;
}
.search-result.selected {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.search-result > div {
  min-width: 0;
  flex: 1;
}
.search-result strong {
  display: block;
  font-size: 14px;
  font-weight: 500;
}
.search-result span {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  overflow-wrap: anywhere;
}
.search-footer {
  display: flex;
  gap: var(--app-space-md);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-top: var(--app-border-secondary);
  padding-top: var(--app-space-sm);
}
@media (max-width: 900px) {
  .search-trigger > span,
  .search-trigger kbd {
    display: none;
  }
}
</style>

<style>
.navigation-search-dialog {
  max-width: calc(100vw - 32px);
}
</style>
