import { createRouter, createWebHistory } from 'vue-router';
import { routes } from './routes';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.afterEach((to, _from, failure) => {
  if (!failure) document.title = to.meta.title ? `${to.meta.title} · 后台管理` : '后台管理';
});
