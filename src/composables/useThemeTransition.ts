import { nextTick, onScopeDispose } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';

/** Theme state stays in Pinia; this scope owns only the optional visual transition. */
export function useThemeTransition() {
  const preferences = usePreferencesStore();
  let transition: ViewTransition | undefined;
  let revision = 0;

  function cancel() {
    revision++;
    transition?.skipTransition();
    transition = undefined;
    if (typeof document !== 'undefined')
      document.documentElement.classList.remove('is-theme-transitioning');
  }
  onScopeDispose(cancel);

  async function setTheme(value: string) {
    if (value !== 'light' && value !== 'dark' && value !== 'system') return;
    cancel();
    const version = revision;
    if (typeof document === 'undefined') {
      preferences.setTheme(value);
      return;
    }
    const root = document.documentElement;
    const nextDark =
      value === 'dark' ||
      (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (
      nextDark === preferences.dark ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof document.startViewTransition !== 'function'
    ) {
      preferences.setTheme(value);
      return;
    }

    // Let the dropdown close before capturing either theme.
    await nextTick();
    if (version !== revision) return;
    root.classList.add('is-theme-transitioning');
    try {
      transition = document.startViewTransition(async () => {
        if (version !== revision) return;
        preferences.setTheme(value);
        await nextTick();
      });
      // A skipped/hidden-page transition must never leave a rejected promise unhandled.
      void transition.ready.catch(() => {});
      void transition.updateCallbackDone.catch(() => {});
      await transition.finished;
    } catch {
      if (version === revision) {
        transition?.skipTransition();
        preferences.setTheme(value);
      }
    } finally {
      if (version === revision) {
        transition = undefined;
        root.classList.remove('is-theme-transitioning');
      }
    }
  }

  return { setTheme, cancel };
}
