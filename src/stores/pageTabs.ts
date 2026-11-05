import { shallowRef } from 'vue';
import { defineStore } from 'pinia';

export const MAX_PAGE_TABS = 15;
export interface PageTab {
  key: string;
  fullPath: string;
  name: string;
  title: string;
  keepAlive: boolean;
  id: number;
  used: number;
  scroll: { x: number; y: number };
}
export type PageTabInput = Pick<PageTab, 'key' | 'fullPath' | 'name' | 'title' | 'keepAlive'>;

export const usePageTabsStore = defineStore('pageTabs', () => {
  const items = shallowRef<PageTab[]>([]);
  let sequence = 0;
  function visit(input: PageTabInput) {
    const existing = items.value.find((tab) => tab.key === input.key);
    const used = ++sequence;
    if (existing) {
      items.value = items.value.map((tab) =>
        tab.key === input.key ? { ...tab, ...input, used } : tab,
      );
      return;
    }
    let next = items.value;
    if (next.length >= MAX_PAGE_TABS) {
      const oldest = next.reduce((a, b) => (a.used < b.used ? a : b));
      next = next.filter((tab) => tab.key !== oldest.key);
    }
    items.value = [...next, { ...input, id: used, used, scroll: { x: 0, y: 0 } }];
  }
  function remove(key: string) {
    items.value = items.value.filter((tab) => tab.key !== key);
  }
  function retain(keys: readonly string[]) {
    items.value = items.value.filter((tab) => keys.includes(tab.key));
  }
  function reconcile(resolve: (tab: PageTab) => PageTabInput | null) {
    items.value = items.value.flatMap((tab) => {
      const next = resolve(tab);
      return next ? [{ ...tab, ...next }] : [];
    });
  }
  function rememberScroll(key: string, scroll: PageTab['scroll']) {
    items.value = items.value.map((tab) => (tab.key === key ? { ...tab, scroll } : tab));
  }
  function refresh(key: string) {
    items.value = items.value.map((tab) =>
      tab.key === key ? { ...tab, id: ++sequence, scroll: { x: 0, y: 0 } } : tab,
    );
  }
  // 不重置实例序号，关闭最后一个页签后重开同页也必须得到新缓存。
  function clear() {
    items.value = [];
  }
  return { items, visit, remove, retain, reconcile, rememberScroll, refresh, clear };
});
