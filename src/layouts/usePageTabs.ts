import { computed, nextTick, onScopeDispose, shallowRef, watch } from 'vue';
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router';
import type { RouteLocationNormalizedLoaded, RouteLocationResolved } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { usePageTabsStore } from '@/stores/pageTabs';
import type { PageTabInput } from '@/stores/pageTabs';
import { canAccessRoute, defaultDestination } from '@/router/access';

type TabRoute = RouteLocationNormalizedLoaded | RouteLocationResolved;
export function usePageTabs() {
  const route = useRoute(),
    router = useRouter(),
    auth = useAuthStore(),
    tabs = usePageTabsStore();
  const busy = shallowRef(false);
  const activeKey = computed(() => route.path);
  const allowed = computed(() => canAccessRoute(route, auth));
  let disposed = false;
  let scrollFrame = 0;
  function describe(target: TabRoute): PageTabInput | null {
    if (
      (!auth.authenticated && target.meta.authentication !== 'observer') ||
      typeof target.name !== 'string' ||
      target.name === 'layout' ||
      target.meta.public ||
      target.meta.tab === false ||
      !target.meta.title ||
      !target.matched.at(-1)?.components?.default ||
      !canAccessRoute(target, auth)
    )
      return null;
    return {
      key: target.path,
      fullPath: target.fullPath,
      name: target.name,
      keepAlive: target.meta.keepAlive !== false,
      title:
        auth.user?.navigation?.find((item) => item.routeName === target.name)?.title ??
        target.meta.title,
    };
  }
  function sync() {
    if (!auth.authenticated && route.meta.authentication !== 'observer') {
      tabs.clear();
      return;
    }
    tabs.reconcile((tab) => describe(router.resolve(tab.fullPath)));
    const current = describe(route);
    if (current) tabs.visit(current);
  }
  // 在页面渲染前登记页签，避免先挂载无缓存页面、随后又挂载缓存页面。
  watch(
    () => auth.user?.id,
    () => tabs.clear(),
    { flush: 'sync' },
  );
  watch([() => route.fullPath, () => auth.user], sync, { immediate: true, flush: 'sync' });
  const stopBefore = router.beforeEach((_to, from) => {
    tabs.rememberScroll(from.path, { x: window.scrollX, y: window.scrollY });
  });
  async function restoreScroll() {
    await nextTick();
    if (disposed) return;
    cancelAnimationFrame(scrollFrame);
    const key = route.path;
    scrollFrame = requestAnimationFrame(() => {
      if (disposed || route.path !== key) return;
      const position = tabs.items.find((tab) => tab.key === key)?.scroll ?? { x: 0, y: 0 };
      window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
    });
  }
  watch(() => route.path, restoreScroll, { flush: 'post' });
  async function navigate(fullPath: string) {
    const failure = await router.push(fullPath);
    return !failure || isNavigationFailure(failure, NavigationFailureType.duplicated);
  }
  async function run(action: () => Promise<void>) {
    if (busy.value || disposed) return;
    busy.value = true;
    try {
      await action();
    } catch (cause) {
      if (!disposed)
        ElMessage.error(cause instanceof Error ? cause.message : '页签操作失败，请重试');
    } finally {
      busy.value = false;
    }
  }
  function select(key: string) {
    return run(async () => {
      const tab = tabs.items.find((item) => item.key === key);
      if (tab) await navigate(tab.fullPath);
    });
  }
  function close(key: string) {
    return run(async () => {
      const index = tabs.items.findIndex((tab) => tab.key === key);
      if (index < 0) return;
      if (key !== route.path) {
        tabs.remove(key);
        return;
      }
      const neighbor = tabs.items[index - 1] ?? tabs.items[index + 1];
      const destination = neighbor?.fullPath ?? defaultDestination(router, auth);
      if (!(await navigate(destination)) || disposed) return;
      if (route.path !== key) tabs.remove(key);
      else {
        tabs.refresh(key);
        await restoreScroll();
      }
    });
  }
  function command(value: string) {
    return run(async () => {
      const key = route.path,
        index = tabs.items.findIndex((tab) => tab.key === key);
      if (value === 'all') {
        if (!(await navigate(defaultDestination(router, auth))) || disposed) return;
        tabs.clear();
        sync();
        await restoreScroll();
      } else if (value === 'others' && index >= 0) tabs.retain([key]);
      else if (value === 'right' && index >= 0)
        tabs.retain(tabs.items.slice(0, index + 1).map((tab) => tab.key));
      else if (value === 'refresh' && index >= 0) {
        if (route.meta.authentication !== 'observer') await auth.ensureSession(true);
        if (disposed) return;
        if (!auth.authenticated && route.meta.authentication !== 'observer') {
          await router.replace({ name: 'login', query: { redirect: route.fullPath } });
          return;
        }
        if (!canAccessRoute(route, auth)) {
          await router.replace({ name: 'forbidden' });
          return;
        }
        if (route.path === key) {
          tabs.refresh(key);
          await restoreScroll();
        }
      }
    });
  }
  onScopeDispose(() => {
    disposed = true;
    stopBefore();
    cancelAnimationFrame(scrollFrame);
    tabs.clear();
  });
  return { tabs, activeKey, allowed, busy, select, close, command };
}
