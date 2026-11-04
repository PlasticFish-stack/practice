import { onScopeDispose, reactive, shallowRef } from 'vue'
import axios from 'axios'
import { systemApi } from '@/api/system'
import type { SystemCatalog, SystemQuery } from '@/types/system'
import type { Pagination } from '@/types/device'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { canAccessRoute } from '@/router/access'

export function useSystemList<Row>(load: (query: SystemQuery, signal: AbortSignal) => Promise<Pagination<Row[]>>) {
  const auth = useAuthStore(), route = useRoute(), router = useRouter()
  const query = reactive<SystemQuery>({ keyword: '', page: 1, pageSize: 10 })
  const rows = shallowRef<Row[]>([])
  const total = shallowRef(0)
  const catalog = shallowRef<SystemCatalog>({ roles: [], permissions: [], icons: [] })
  const loading = shallowRef(false)
  const error = shallowRef('')
  let controller: AbortController | undefined
  let disposed = false
  onScopeDispose(() => { disposed = true; controller?.abort() })
  async function reload(): Promise<void> {
    if (disposed) return
    controller?.abort()
    const current = controller = new AbortController()
    loading.value = true; error.value = ''
    try {
      const [result, options] = await Promise.all([load({ ...query }, current.signal), systemApi.catalog(current.signal)])
      if (current.signal.aborted) return
      const last = Math.max(1, Math.ceil(result.total / query.pageSize))
      if (query.page > last) { query.page = last; return await reload() }
      rows.value = result.list; total.value = result.total; catalog.value = options
    } catch (cause) {
      if (!current.signal.aborted && !axios.isCancel(cause)) error.value = cause instanceof Error ? cause.message : '加载失败，请重试'
    } finally { if (current === controller) loading.value = false }
  }
  function search(keyword: string) { query.keyword = keyword.trim(); query.page = 1; void reload() }
  function paginate(params: { page: number; pageSize: number }) { Object.assign(query, params); void reload() }
  async function refresh() {
    if (disposed) return
    const location = route.fullPath
    try {
      await auth.ensureSession(true)
      // 权限刷新可能先使 RouterView 卸载；仍需把失去权限的当前地址转到 403。
      if (route.fullPath !== location) return
      if (!auth.authenticated) { await router.replace({ name: 'login', query: { redirect: route.fullPath } }); return }
      if (!canAccessRoute(route, auth)) { await router.replace({ name: 'forbidden' }); return }
      if (!disposed) await reload()
    } catch (cause) { if (!disposed) error.value = cause instanceof Error ? cause.message : '刷新会话失败，请重试' }
  }
  void reload()
  return { query, rows, total, catalog, loading, error, reload, search, paginate, refresh }
}
