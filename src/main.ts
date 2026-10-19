import { createApp } from 'vue'
import ElTable from 'element-plus/es/components/table/index'
import ElPagination from 'element-plus/es/components/pagination/index'
import ElLoading from 'element-plus/es/components/loading/index'
import 'element-plus/es/components/table/style/css'
import 'element-plus/es/components/pagination/style/css'
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/switch/style/css'
import './style.css'
import App from './App.vue'
import { router } from './router/index.ts'

const app = createApp(App)
app.use(router)
app.use(ElTable)
app.use(ElPagination)
app.use(ElLoading)
app.mount('#app')
