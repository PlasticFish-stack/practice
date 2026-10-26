import { createMemoryHistory, createRouter } from 'vue-router'

const routes = [
    {
        path: '/', 
        component: () => import('@/views/Home/Home.vue')
    },
]

export const router = createRouter({
    history: createMemoryHistory(),
    routes
})