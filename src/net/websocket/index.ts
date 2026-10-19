import { onScopeDispose } from "vue"

type WebSocketOptions = {
  reconnectInterval: number,
  maxReconnectAttempts: number,
  pingInterval: number
}

type FnTypeStrict<K extends keyof WebSocketEventMap> = (
  event: WebSocketEventMap[K],
  socket: WebSocket
) => void

// 只保存回调的身份，不通过这个类型调用回调。
type ListenerRef = (...args: never[]) => unknown

type ListenerRecord = {
  cancel: () => void
  bind: (socket: WebSocket) => void
}
export function useWebsocket(url: string, options?: WebSocketOptions) {
  let websocketClient: WebSocket | null = null,
    reconnectInterval: number = options?.reconnectInterval ?? 5000, //重连时间间隔
    maxReconnectAttempts: number = options?.maxReconnectAttempts ?? 5, //最大连接次数
    needReconnect: boolean = true,
    reconnectAttempts: number = 0, //重连已连接次数
    reconnectTimer: ReturnType<typeof setTimeout> | null = null,
    pingInterval: number = options?.pingInterval ?? 30000, //ping时间间隔
    pingOvertime: number = 5000,
    timeoutEvent: ReturnType<typeof setTimeout> | null = null,
    intervalEvent: ReturnType<typeof setInterval> | null = null
  let connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null

  const eventBuckets = new WeakMap<ListenerRef, Record<string, keyof WebSocketEventMap>>()
  const eventListenCancel = new Map<string, ListenerRecord>()
  const activeUUID = new Set<string>()

  function clearConnectTimeout() {
    if (connectTimeoutTimer !== null) {
      clearTimeout(connectTimeoutTimer)
      connectTimeoutTimer = null
    }
  }
  function websocketConnect() {
    if (websocketClient) return
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    needReconnect = true
    const socket = new WebSocket(url)
    clearConnectTimeout()
    connectTimeoutTimer = setTimeout(() => {
      if (socket.readyState !== 1) {
        console.log("没连上");
        socket.close()
      }
      connectTimeoutTimer = null
    }, 10_000)


    websocketClient = socket

    // 在 open 事件触发前恢复监听，沿用原来的 UUID 和取消函数。
    for (const listener of eventListenCancel.values()) {
      listener.bind(socket)
    }

    websocketClient.onopen = () => {
      if (websocketClient !== socket) return
      clearConnectTimeout()
      console.log("连接了");
      reconnectAttempts = 0
      heartbeat(socket)
    }

    websocketClient.onmessage = () => {
      if (websocketClient !== socket) return
      console.log("消息");

      heartbeat(socket)
    }

    websocketClient.onclose = () => {
      if (websocketClient !== socket) return
      clearConnectTimeout()
      console.log("断开了");
      activeUUID.clear()
      clearHeartbeat()
      websocketClient = null

      if (!needReconnect) return

      if (reconnectAttempts >= maxReconnectAttempts) return

      const delay = Math.min(
        reconnectInterval * 2 ** reconnectAttempts,
        30_000,
      )
      console.log(`准备第${reconnectAttempts + 1}次重连`);

      reconnectAttempts++
      reconnectTimer = setTimeout(() => {
        websocketConnect()
      }, delay)
    }
  }

  function sendMessage(data: BufferSource | Blob | string) {
    if (!websocketClient) return
    const socket = websocketClient
    if (socket.readyState !== 1) return
    socket?.send(data)
  }

  function heartbeat(socket: WebSocket) {
    clearHeartbeat()
    intervalEvent = setInterval(() => {
      socket.send(JSON.stringify({ type: 'heartbeat' }))
      timeoutEvent = setTimeout(() => {
        socket.close()
      }, pingOvertime)
    }, pingInterval)
  }

  function clearHeartbeat() {
    if (intervalEvent !== null) {
      clearInterval(intervalEvent)
      intervalEvent = null
    }
    if (timeoutEvent !== null) {
      clearTimeout(timeoutEvent)
      timeoutEvent = null
    }
  }

  function websocketClose(noReconnect: boolean = true) {
    needReconnect = !noReconnect
    if (!needReconnect) {
      clearEventListener()
    }
    clearConnectTimeout()
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    clearHeartbeat()
    websocketClient?.close()
  }



  function addEventListener<K extends keyof WebSocketEventMap>(type: K, fn: FnTypeStrict<K>) {
    if (!websocketClient) return
    let socket = websocketClient
    let copyFn: FnTypeStrict<K> | null = fn
    console.log("gugugaga");

    const wrapper = (e: WebSocketEventMap[K]) => copyFn?.(e, socket)
    const uuid = crypto.randomUUID()
    activeUUID.add(uuid)
    const buckets = eventBuckets.get(copyFn) ?? {}
    buckets[uuid] = type
    eventBuckets.set(copyFn, buckets)

    const cancel = () => {
      if (!copyFn) return
      const cancelBuckets = eventBuckets.get(copyFn)
      socket.removeEventListener(type, wrapper)
      eventListenCancel.delete(uuid)
      activeUUID.delete(uuid)
      if (cancelBuckets) {
        delete cancelBuckets[uuid]
        if (Object.keys(cancelBuckets).length === 0) {
          eventBuckets.delete(copyFn)
        }

      }
      copyFn = null
    }
    const bind = (nextSocket: WebSocket) => {
      if (!copyFn) return
      socket.removeEventListener(type, wrapper)
      socket = nextSocket
      socket.addEventListener(type, wrapper)
      activeUUID.add(uuid)
    }

    eventListenCancel.set(uuid, { cancel, bind })

    socket.addEventListener(type, wrapper)
    console.log(eventBuckets);

    return cancel
  }




  function clearEventListener() {
    for (const listener of eventListenCancel.values()) {
      listener.cancel()
    }
  }

  onScopeDispose(() => {

  })

  return {
    websocketConnect, websocketClose, addEventListener, sendMessage
  }
}





//需要修复
