import { onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { ObserverError } from '@/api/xray';

/** 一个可取消的轮询任务；参数变化或页面隐藏时立刻中止，旧响应不得覆盖新数据。 */
export function useObserverQuery<K, T>(
  key: MaybeRefOrGetter<K | null>,
  load: (key: K, signal: AbortSignal) => Promise<T>,
  interval = 30000,
) {
  const data = shallowRef<T | null>(null);
  const error = shallowRef('');
  const busy = shallowRef(false);
  const visible = shallowRef(!document.hidden);
  const revision = shallowRef(0);
  let blockedUntil = 0;
  const visibility = () => {
    visible.value = !document.hidden;
  };
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => document.removeEventListener('visibilitychange', visibility));
  watch(
    () => toValue(key),
    () => {
      data.value = null;
    },
  );
  watch(
    [() => toValue(key), visible, revision],
    ([value, active], _old, cleanup) => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      cleanup(() => {
        controller.abort();
        clearTimeout(timer);
      });
      busy.value = false;
      if (value == null || !active) return;
      async function run() {
        if (Date.now() < blockedUntil) {
          timer = setTimeout(() => void run(), blockedUntil - Date.now());
          return;
        }
        busy.value = true;
        let delay = interval;
        try {
          const result = await load(value as K, controller.signal);
          if (!controller.signal.aborted) {
            data.value = result;
            error.value = '';
          }
        } catch (cause) {
          if (!controller.signal.aborted) {
            error.value = cause instanceof Error ? cause.message : '请求失败';
            if (cause instanceof ObserverError && cause.status === 429) {
              delay = Math.max(delay, cause.retryAfterMs);
              blockedUntil = Date.now() + cause.retryAfterMs;
            }
          }
        } finally {
          if (!controller.signal.aborted) {
            busy.value = false;
            timer = setTimeout(() => void run(), delay);
          }
        }
      }
      void run();
    },
    { immediate: true },
  );
  return {
    data,
    error,
    busy,
    refresh: () => {
      revision.value++;
    },
  };
}
