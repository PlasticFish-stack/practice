import axios from 'axios'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { ResponseTemplate, ResponseWrapper } from './type'

export interface HttpAuthHooks {
  getToken?: () => string | null
  getSessionVersion?: () => number
  onUnauthorized?: () => void
}

export class ApiError extends Error {
  readonly code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export default function createHttp(config: AxiosRequestConfig = {}, auth: HttpAuthHooks = {}) {
  const instance = axios.create({
    baseURL: '/', timeout: 10000, withCredentials: true,
    xsrfCookieName: 'XSRF-TOKEN', xsrfHeaderName: 'X-XSRF-TOKEN', ...config,
  })
  const versions = new WeakMap<object, number>()
  function unauthorized(config?: object) {
    if (!auth.getSessionVersion || (config && versions.get(config) === auth.getSessionVersion())) {
      auth.onUnauthorized?.()
    }
  }
  instance.interceptors.request.use(request => {
    if (auth.getSessionVersion) versions.set(request, auth.getSessionVersion())
    const token = auth.getToken?.()
    if (token && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`)
    }
    return request
  })
  instance.interceptors.response.use(undefined, (error: unknown) => {
    if (axios.isAxiosError<ResponseTemplate<unknown>>(error) && !axios.isCancel(error)) {
      const status = error.response?.status
      if (status === 401) unauthorized(error.config)
      const message = error.response?.data?.message
      if (status) {
        error.message = typeof message === 'string' && message ? message
          : status === 401 ? '登录已过期，请重新登录' : `请求失败（HTTP ${status}）`
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        error.message = '请求超时，请稍后重试'
      } else if (error.code === 'ERR_NETWORK') {
        error.message = '网络连接异常，请检查网络'
      }
    }
    return Promise.reject(error)
  })

  async function request<T>(config: AxiosRequestConfig): Promise<ResponseWrapper<T>> {
    const response = await instance.request<ResponseTemplate<T>, AxiosResponse<ResponseTemplate<T>>>(config)
    const body = response.data
    if (!body || typeof body.code !== 'number') throw new Error('接口响应格式错误')
    if (body.code !== 200) {
      if (body.code === 401) unauthorized(response.config)
      throw new ApiError(body.message || `业务错误（${body.code}）`, body.code)
    }
    return { data: body.data, origin: response }
  }

  return {
    request,
    get: <T>(url: string, params?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, url, method: 'GET', params }),
    post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, url, method: 'POST', data }),
    put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, url, method: 'PUT', data }),
    delete: <T>(url: string, params?: unknown, config?: AxiosRequestConfig) =>
      request<T>({ ...config, url, method: 'DELETE', params }),
  }
}
