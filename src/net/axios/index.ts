import type { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import type { ResponseTemplate } from './type'



function _requestInterceptors(config: InternalAxiosRequestConfig) {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = token?.startsWith('Bearer ') ? token : `Bearer ${token}`
  }
  return config
}

function _responseSuccessInterceptor(response: AxiosResponse<ResponseTemplate<unknown>>) {
  const { code, message } = response.data
  if (code === 200) {
    return response
  }
  if (code === 401) {
    localStorage.removeItem('token')
    return Promise.reject(new Error(message || '登录已过期，请重新登录'))
  }
  return Promise.reject(new Error(message || `业务错误(${code})`))
}

function _responseErrorInterceptor(err: AxiosError) {
  let message = '网络连接异常，请稍后重试'

  if (err.response) {
    switch (err.response.status) {
      case 400:
        message = '请求参数错误(400)'
        break
      case 401:
        message = '未授权，请重新登录(401)'
        break
      case 403:
        message = '拒绝访问(403)'
        break
      case 404:
        message = '请求资源不存在(404)'
        break
      case 500:
        message = '服务器内部错误(500)'
        break
      case 502:
        message = '网关错误(502)'
        break
      case 503:
        message = '服务不可用(503)'
        break
      default:
        message = `网络错误(${err.response.status})`
    }
  }
  else if (err.message) {
    // 服务器无响应，或者请求配置出错
    if (err.message.includes('timeout')) {
      message = '请求超时，请刷新重试'
    }
    else if (err.message.includes('Network Error')) {
      message = '网络已断开，请检查网络连接'
    }
  }

  console.error('[网络异常]: ', message)

  return Promise.reject(new Error(message))
}


class Http {
  private instance

  constructor(baseUrl: string) {
    this.instance = axios.create({
      baseURL: baseUrl,
      timeout: 3000,
    })
    this.instance.interceptors.request.use(_requestInterceptors, err => Promise.reject(err))
    this.instance.interceptors.response.use(_responseSuccessInterceptor, _responseErrorInterceptor)
  }

  // private queueAwait(): Promise<void> {
  //   return new Promise((res) => {
  //     this.queueArray.push(res)
  //   })
  // }

  // private next() {
  //   if (this.queueArray.length > 0 && this.queueCurrentLimit < this.queueConfig.maxLimit) {
  //     const nextRequestResolve = this.queueArray.shift()
  //     if (nextRequestResolve) {
  //       this.queueCurrentLimit++
  //       nextRequestResolve()
  //     }
  //   }
  // }

  // private mutexAwait(key: string): Promise<void> {
  //   return new Promise((res) => {
  //     this.mutexMap[key].push(res)
  //   })
  // }

  // private mutexRunningTarget(key: string, value: boolean) {
  //   this.mutexRunning[key] = value
  // }

  // async mutexRequest<T>(url: string, method: Method, config: AxiosRequestConfig): Promise<ResponseTemplate<T>> {
  //   if (this.mutexMap[url]) {
  //     if (this.mutexRunning[url]) {
  //       await this.mutexAwait(url)
  //     }
  //   }
  //   else {
  //     this.mutexMap[url] = []
  //   }
  //   this.mutexRunningTarget(url, true)
  //   try {
  //     const response = await this.instance.request({
  //       url,
  //       method,
  //       ...config,
  //     })
  //     return response as unknown as ResponseTemplate<T>
  //   }
  //   finally {
  //     if (this.mutexMap[url] && this.mutexMap[url].length > 0) {
  //       this.mutexRunningTarget(url, false)
  //       const nextRequestResolve = this.mutexMap[url].shift()
  //       if (nextRequestResolve) {
  //         nextRequestResolve()
  //       }
  //     }
  //   }
  // }

  // async queueRequest<T>(url: string, method: Method, config: AxiosRequestConfig): Promise<ResponseTemplate<T>> {
  //   if (this.queueCurrentLimit >= this.queueConfig.maxLimit) {
  //     await this.queueAwait()
  //   }
  //   else {
  //     this.queueCurrentLimit++
  //   }

  //   try {
  //     const response = await this.instance.request({
  //       url,
  //       method,
  //       ...config,
  //     })
  //     return response as unknown as ResponseTemplate<T>
  //   }
  //   finally {
  //     this.queueCurrentLimit--
  //     this.next()
  //   }
  // }



  wrapper<T>(p: AxiosResponse<any, any, {}, any>): ResponseWrapper<T> {
    const data: ResponseWrapper<T> = {
      data: p.data.data,
      origin: p
    }
    return data
  }

  async get<T>(url: string, params: any, config?: AxiosRequestConfig): Promise<ResponseWrapper<T>> {
    const response = await this.instance.request({
      url,
      method: 'GET',
      params,
      ...config,
    })
    return this.wrapper(response)
  }

  async post<T>(url: string, data: any, config?: AxiosRequestConfig): Promise<ResponseWrapper<T>> {
    const response = await this.instance.request({
      url,
      method: 'POST',
      data,
      ...config,
    })
    return this.wrapper(response)
  }

  async put<T>(url: string, params: any, data: any, config?: AxiosRequestConfig): Promise<ResponseWrapper<T>> {
    const response = await this.instance.request({
      url,
      method: 'PUT',
      params,
      data,
      ...config,
    })
    return this.wrapper(response)
  }

  async delete<T>(url: string, params: any, config?: AxiosRequestConfig): Promise<ResponseWrapper<T>> {
    const response = await this.instance.request({
      url,
      method: 'DELETE',
      params,
      ...config,
    })
    return this.wrapper(response)
  }
}
type ResponseWrapper<T> = {
  data: ResponseTemplate<T>
  origin: AxiosResponse<any, any, {}, any>
}
export default Http
