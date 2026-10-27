import { createMemoryHistory, createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        children: [
            {
                path: '',
                component: () => import('@/views/Home/Home.vue'),
            },
            {
                path: 'login',
                component: () => import('@/views/Login/Login.vue')
            },
        ]
    },

]

export const router = createRouter({
    history: createWebHistory(),
    routes
})