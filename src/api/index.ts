import createHttp from '@/net/axios'
import type { HttpAuthHooks } from '@/net/axios'

const hooks: HttpAuthHooks = {}
export function configureHttpAuth(auth: HttpAuthHooks) { Object.assign(hooks, auth) }
export const api = createHttp({}, hooks)
