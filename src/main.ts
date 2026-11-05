import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'normalize.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import './styles/theme.css';
import './styles/element-plus.css';
import './styles/menu.css';
import './style.css';
import App from './App.vue';
import { router } from './router';
import { installAuthGuard, canAccessRoute } from './router/access';
import { useAuthStore } from './stores/auth';
import { usePreferencesStore } from './stores/preferences';
import { configureHttpAuth } from './api';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
usePreferencesStore(pinia);
const auth = useAuthStore(pinia);
installAuthGuard(router, auth);
configureHttpAuth({
  getSessionVersion: () => auth.revision,
  onUnauthorized() {
    const hadSession = auth.authenticated;
    auth.invalidate();
    const route = router.currentRoute.value;
    if (
      hadSession &&
      route.name &&
      !route.meta.public &&
      route.meta.authentication !== 'observer'
    ) {
      void router.replace({ name: 'login', query: { redirect: route.fullPath } });
    }
  },
});
app.use(router);
// 返回浏览器标签时重新校验，处理其他标签退出、切换用户和权限变更。
window.addEventListener('focus', () => {
  if (router.currentRoute.value.meta.authentication === 'observer') return;
  if (!auth.authenticated || auth.busy) return;
  void auth
    .ensureSession(true)
    .then(() => {
      const route = router.currentRoute.value;
      if (auth.authenticated && !route.meta.public && !canAccessRoute(route, auth)) {
        void router.replace({ name: 'forbidden' });
      }
    })
    .catch(() => {
      void router.replace({
        name: 'session-error',
        query: { redirect: router.currentRoute.value.fullPath },
      });
    });
});
app.mount('#app');
