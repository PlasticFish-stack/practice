import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';

type Theme = 'light' | 'dark' | 'system';
function readTheme(): Theme {
  try {
    const value = localStorage.getItem('ui.theme');
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* 浏览器禁用存储时仍可使用当前页面。 */
  }
  return 'system';
}

export const usePreferencesStore = defineStore('preferences', () => {
  const theme = shallowRef<Theme>(readTheme());
  const media =
    typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)');
  const systemDark = shallowRef(media?.matches ?? false);
  const dark = computed(
    () => theme.value === 'dark' || (theme.value === 'system' && systemDark.value),
  );
  const update = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches;
  };
  media?.addEventListener('change', update);
  onScopeDispose(() => media?.removeEventListener('change', update));
  watch(
    [theme, dark],
    () => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', dark.value);
        document.documentElement.style.colorScheme = dark.value ? 'dark' : 'light';
      }
      try {
        localStorage.setItem('ui.theme', theme.value);
      } catch {
        /* 设置仅在当前会话生效。 */
      }
    },
    { immediate: true },
  );
  function setTheme(value: string) {
    if (value === 'light' || value === 'dark' || value === 'system') theme.value = value;
  }
  return { theme, dark, setTheme };
});
